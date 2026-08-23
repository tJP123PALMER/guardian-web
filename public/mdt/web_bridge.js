
(() => {
  const nativeFetch = window.fetch.bind(window);
  const RESOURCE = "guardian_mdt_browser";
  window.GetParentResourceName = () => RESOURCE;

  let state = { connected:false, units:{}, incidents:[], messages:[], callsigns:[] };
  let callsign = String(localStorage.getItem("guardianExactMdtCallsign") || "").toUpperCase();
  let lastEventId = Number(sessionStorage.getItem("guardianMdtLastEventId") || 0);
  let deliveredMessages = new Set();
  let deliveredMobilisations = new Set(
    JSON.parse(sessionStorage.getItem("guardianDeliveredMobilisations") || "[]")
  );
  let knownAssignments = new Set();
  const pendingStandbyIncidents = new Map();
  let stateInitialised = false;
  let lastStatusSentAt = 0;
  let optimisticStatus = "";
  let lastStatusPosted = "";

  const upper = v => String(v ?? "").trim().toUpperCase();
  const post = data => window.dispatchEvent(new MessageEvent("message", { data }));

  function unitMap() {
    const raw = state.units || {};
    const mapped = {};
    Object.entries(raw).forEach(([k,v]) => mapped[upper(k)] = v);
    return mapped;
  }

  function selectedUnit() {
    return unitMap()[upper(callsign)] || null;
  }

  function assignmentCallsign(x) {
    return upper(typeof x === "string" ? x : (x?.callsign || x?.unit || x?.id || ""));
  }

  function incidentAssignments(inc) {
    const list = Array.isArray(inc?.assignedUnits) ? inc.assignedUnits :
                 Array.isArray(inc?.assignedAppliances) ? inc.assignedAppliances :
                 Array.isArray(inc?.appliances) ? inc.appliances : [];
    return list.map(assignmentCallsign).filter(Boolean);
  }

  function assignedIncidents() {
    const cs = upper(callsign);
    if (!cs) return [];

    for (const inc of (state.incidents || [])) {
      if (inc?.standbyMoveId && pendingStandbyIncidents.has(String(inc.standbyMoveId))) {
        pendingStandbyIncidents.delete(String(inc.standbyMoveId));
      }
    }

    const authoritative=(state.incidents || []).filter(inc => incidentAssignments(inc).includes(cs));
    const pending=[...pendingStandbyIncidents.values()].filter(inc=>incidentAssignments(inc).includes(cs));
    const ids=new Set(authoritative.map(i=>String(i.id)));
    return [...authoritative,...pending.filter(i=>!ids.has(String(i.id)))];
  }

  function incidentKey(inc, cs = callsign) {
    return `${String(inc?.id ?? "")}|${upper(cs)}`;
  }

  function saveDelivered() {
    sessionStorage.setItem(
      "guardianDeliveredMobilisations",
      JSON.stringify([...deliveredMobilisations].slice(-100))
    );
  }

  function makeShell() {
    if (document.querySelector(".guardianWebBar")) return;
    document.body.classList.add("guardianWebMdt");

    const bar = document.createElement("div");
    bar.className = "guardianWebBar";
    bar.innerHTML = `
      <div class="guardianWebBrand">
        <div class="guardianWebBrandMark">G</div>
        <div><strong>GUARDIAN OPERATIONS</strong><span>LIVE PLAYER MDT</span></div>
      </div>
      <nav class="guardianWebMode">
        <a href="/control/">CONTROL CENTRE</a>
        <a class="active" href="/mdt/">PLAYER MDT</a>
      </nav>
      <div class="guardianWebSession" id="guardianWebSession">
        <span class="guardianWebLive" id="guardianWebBookDot"></span>
        <div class="guardianWebSessionText">
          <span>PLAYER SESSION</span>
          <strong id="guardianBookState">NOT BOOKED ON</strong>
        </div>
        <select id="guardianWebCallsign" aria-label="Select appliance">
          <option value="">Select appliance…</option>
        </select>
        <button type="button" id="guardianSessionAction">BOOK ON</button>
      </div>`;
    document.body.appendChild(bar);

    const select = bar.querySelector("#guardianWebCallsign");
    select.addEventListener("change", () => {
      callsign = upper(select.value);
      localStorage.setItem("guardianExactMdtCallsign", callsign);
      optimisticStatus = "";
      lastStatusPosted = "";
      knownAssignments = new Set(assignedIncidents().map(i => incidentKey(i)));
      post({ type:"setCallsign", callsign:callsign || "UNSET" });
      post({ type:"loadIncidents", incidents:assignedIncidents() });
      syncStateToMdt(true);
    });

    document.getElementById("guardianSessionAction")?.addEventListener("click",()=>{
      const task=bookedUnit()?bookOff():bookOn();
      Promise.resolve(task).catch(err=>{
        console.error(err);
        alert(bookedUnit() ? "Book off failed." : "Book on failed.");
      });
    });

    // Browsers require a user gesture before audio. The first click anywhere
    // on the MDT silently unlocks the exact supplied alert/ping audio.
    const unlockAudio = () => {
      ["alert","ping"].forEach(id => {
        const a = document.getElementById(id);
        if (!a) return;
        const oldVol = a.volume;
        a.volume = 0;
        const p = a.play();
        if (p?.then) {
          p.then(() => {
            a.pause(); a.currentTime = 0; a.volume = oldVol;
          }).catch(() => { a.volume = oldVol; });
        }
      });
      document.removeEventListener("pointerdown", unlockAudio, true);
    };
    document.addEventListener("pointerdown", unlockAudio, true);
  }


  function bookedUnit() {
    const cs=upper(callsign);
    const u=unitMap()[cs] || null;
    const booking=state.bookings?.[cs] || null;
    return (u?.webBooked===true || booking?.webBooked===true) ? (u || booking) : null;
  }

  function updateBookUi() {
    const action=document.getElementById("guardianSessionAction");
    const label=document.getElementById("guardianBookState");
    const dot=document.getElementById("guardianWebBookDot");
    const select=document.getElementById("guardianWebCallsign");
    const session=document.getElementById("guardianWebSession");
    if(!action||!label||!dot||!select||!session)return;

    const u=bookedUnit();
    const booked=!!u;

    session.classList.toggle("booked",booked);
    dot.classList.toggle("booked",booked);

    if(booked){
      label.textContent=`${upper(callsign)} · ${u.status || "BOOKED ON"}`;
      action.textContent="BOOK OFF";
      action.classList.add("danger");
      action.disabled=false;
      select.disabled=true;
    }else{
      label.textContent=callsign ? `${upper(callsign)} · READY TO BOOK ON` : "NOT BOOKED ON";
      action.textContent="BOOK ON";
      action.classList.remove("danger");
      action.disabled=!callsign;
      select.disabled=false;
    }
  }

  async function bookOn() {
    if(!callsign) return alert("Select an appliance first.");
    optimisticStatus="Home Station";
    lastStatusSentAt=Date.now();
    state.units={...(state.units||{}),[upper(callsign)]:{
      ...(state.units?.[upper(callsign)]||{}),
      status:"Home Station",webOnly:true,webBooked:true
    }};
    updateBookUi();
    syncStatus(true);
    await command("webBookOn",{callsign,status:"Home Station"});
  }

  async function bookOff() {
    if(!callsign) return;
    await command("webBookOff",{callsign});
    const cs=upper(callsign);
    const next={...(state.units||{})};
    const existing=next[cs];
    if(existing?.webOnly || !existing?.source) delete next[cs];
    else if(existing) next[cs]={...existing,webBooked:false,webOnly:false};
    state.units=next;
    state.bookings={...(state.bookings||{})};
    delete state.bookings[cs];
    optimisticStatus="";
    lastStatusPosted="";
    updateBookUi();
    post({type:"setStatus",status:"OFF RUN",preserveSelection:false});
  }

  function updatePicker() {
    const sel = document.getElementById("guardianWebCallsign");
    if (!sel) return;

    const units = unitMap();
    const live = Object.keys(units);
    const configured = (state.callsigns || []).map(upper);
    const values = [...new Set([...live, ...configured].filter(Boolean))].sort();
    const previous = upper(callsign);

    sel.innerHTML =
      '<option value="">Select appliance…</option>' +
      values.map(cs => `<option value="${cs}">${cs}${units[cs] ? " • LIVE" : ""}</option>`).join("");

    if (previous) {
      if (!values.includes(previous)) {
        const opt = document.createElement("option");
        opt.value = previous;
        opt.textContent = previous + " • SELECTED";
        sel.appendChild(opt);
      }
      sel.value = previous;
    }
  }

  function syncMessagesFromState() {
    const cs = upper(callsign);
    for (const item of (state.messages || [])) {
      const target = upper(item.target || item.to || "");
      const sender = upper(item.sender || "");
      if (target && target !== "ALL" && target !== "CONTROL" && target !== cs && sender !== cs) continue;

      const key = [item.sender || "", item.time || "", item.text || ""].join("|");
      if (deliveredMessages.has(key)) continue;
      deliveredMessages.add(key);
      post({ type:"message", item });
    }
  }

  function deliverMobilisation(inc, reason) {
    if (!inc || !callsign) return;
    const key = incidentKey(inc);
    if (deliveredMobilisations.has(key)) return;

    deliveredMobilisations.add(key);
    saveDelivered();

    console.info("[Guardian Web MDT] mobilisation", key, reason);
    post({ type:"incident", item:inc });
    post({ type:"setCallsign", callsign:upper(callsign) });
    post({ type:"alert" });
    post({ type:"open" });
    post({ type:"mobilising" });
  }

  function detectAssignmentTransitions() {
    if (!callsign) return;

    const current = new Set(assignedIncidents().map(i => incidentKey(i)));

    // The first state load establishes a baseline so an old incident does not
    // suddenly alarm merely because somebody opened/reloaded the web MDT.
    if (!stateInitialised) {
      knownAssignments = current;
      stateInitialised = true;
      return;
    }

    for (const inc of assignedIncidents()) {
      const key = incidentKey(inc);
      if (!knownAssignments.has(key)) {
        // Recovery path: even if SSE dropped for a moment, a newly assigned
        // incident in the authoritative heartbeat still produces the MDT alert.
        deliverMobilisation(inc, "assignment-transition");
      }
    }
    knownAssignments = current;
  }

  function syncStatus(force = false) {
    const unit = selectedUnit();
    const serverStatus = String(unit?.status || "Home Station");

    // Never let the 2-second heartbeat erase a button the user has just
    // selected/sent. Give FiveM time to acknowledge the web command.
    if (optimisticStatus && Date.now() - lastStatusSentAt < 6000) {
      if (force || lastStatusPosted !== optimisticStatus) {
        post({ type:"setStatus", status:optimisticStatus, preserveSelection:true });
        lastStatusPosted = optimisticStatus;
      }
      return;
    }

    if (optimisticStatus && upper(serverStatus) === upper(optimisticStatus)) {
      optimisticStatus = "";
    }

    if (force || lastStatusPosted !== serverStatus) {
      post({ type:"setStatus", status:serverStatus, preserveSelection:true });
      lastStatusPosted = serverStatus;
    }
  }

  function syncStateToMdt(force = false) {
    updatePicker();
    updateBookUi();
    post({ type:"setCallsign", callsign:callsign || "UNSET" });
    post({ type:"loadIncidents", incidents:assignedIncidents() });
    syncStatus(force);
    syncMessagesFromState();
    detectAssignmentTransitions();

    const unit = selectedUnit();
    if (unit?.gps) {
      post({
        type:"gpsPosition",
        x:unit.gps.x, y:unit.gps.y, z:unit.gps.z,
        heading:unit.gps.heading || 0,
        speed:unit.gps.speed || 0,
        satellites:8,
        easting:unit.gps.easting || 0,
        northing:unit.gps.northing || 0,
        screenX:50, screenY:50
      });
    }
  }

  function findIncident(id, fallback) {
    return (state.incidents || []).find(i => String(i.id) === String(id)) || fallback || null;
  }

  function processRealtimeEvent(evt) {
    if (!evt) return;
    const id = Number(evt.id || 0);
    if (id && id <= lastEventId) return;
    if (id) {
      lastEventId = id;
      sessionStorage.setItem("guardianMdtLastEventId", String(lastEventId));
    }

    const p = evt.payload || {};
    const target = upper(p.callsign || p.target || "");

    if (evt.kind === "standbyMoveCreated") {
      const move=p;
      if(!callsign || upper(move.callsign)!==upper(callsign)) return;
      const fake={
        id:String(move.incidentNumber||`STANDBY:${move.id}`),
        incidentNumber:move.incidentNumber||null,
        type:"STANDBY COVER",
        title:`Standby - ${move.destination||"Cover"}`,
        priority:"Standby",
        address:move.destination||"",
        location:move.destination||"",
        postal:"",
        caller:"CONTROL",
        description:move.note||"Proceed to standby station and acknowledge Control.",
        notes:move.note||"Proceed to standby station and acknowledge Control.",
        details:move.note||"",
        assignedUnits:[upper(move.callsign)],
        assignedAppliances:[upper(move.callsign)],
        playAlert:true,
        standbyMoveId:move.id,
        standbySourceStation:move.sourceStation||"",
        standbyDestination:move.destination||"",
        isStandby:true,
        isStandbyMove:true
      };
      pendingStandbyIncidents.set(String(move.id),fake);
      post({type:"incident",item:fake});
      post({type:"setCallsign",callsign:upper(callsign)});
      post({type:"alert"});
      post({type:"open"});
      post({type:"mobilising"});
      return;
    }

    if (evt.kind === "mdtMobilise") {
      if (!callsign || target !== upper(callsign)) return;
      const inc = findIncident(p.incidentId, p.incident);
      if (inc) deliverMobilisation(inc, "realtime-event");
      return;
    }

    if (evt.kind === "message") {
      const item = p.item || p;
      const msgTarget = upper(p.target || item.target || "");
      if (msgTarget && msgTarget !== "ALL" && msgTarget !== "CONTROL" &&
          msgTarget !== upper(callsign) && upper(item.sender) !== upper(callsign)) return;

      const key = [item.sender || "", item.time || "", item.text || ""].join("|");
      if (deliveredMessages.has(key)) return;
      deliveredMessages.add(key);
      post({ type:"message", item });
      return;
    }

    if (evt.kind === "status" && (!target || target === upper(callsign))) {
      const status = p.status || "Home Station";
      if (optimisticStatus && upper(status) === upper(optimisticStatus)) optimisticStatus = "";
      lastStatusPosted = status;
      post({ type:"setStatus", status, preserveSelection:true });
      return;
    }

    if (evt.kind === "stateDirty") loadState().catch(() => {});
  }

  async function replayRecentEvents() {
    try {
      const r = await nativeFetch(`/api/recent-events?since=${lastEventId}&ageMs=30000`, {cache:"no-store"});
      const j = await r.json();
      for (const evt of (j.events || [])) processRealtimeEvent(evt);
    } catch (_) {}
  }

  async function command(action, data) {
    const r = await nativeFetch("/api/command", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action, data:data || {} })
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json().catch(() => ({ok:true}));
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const marker = `https://${RESOURCE}/`;
    if (!url.startsWith(marker)) return nativeFetch(input, init);

    const name = url.slice(marker.length).split(/[?#]/)[0];
    let data = {};
    try {
      if (typeof init.body === "string" && init.body) data = JSON.parse(init.body);
    } catch (_) {}

    if (name === "close") {
      // Web mode should never navigate away or kill the live bridge.
      const frame = document.querySelector(".frame");
      if (frame) frame.style.display = "none";
      return new Response("ok", {status:200});
    }

    if (!callsign && ["sendStatus","sendMessage","ackIncident"].includes(name)) {
      alert("Select your appliance callsign first.");
      return new Response(JSON.stringify({ok:false}), {
        status:200, headers:{"Content-Type":"application/json"}
      });
    }

    if (name === "sendStatus") {
      if(!bookedUnit()){
        alert("Book on first before sending an appliance status.");
        return new Response(JSON.stringify({ok:false}),{status:200,headers:{"Content-Type":"application/json"}});
      }
      optimisticStatus = String(data.status || "");
      lastStatusSentAt = Date.now();
      lastStatusPosted = optimisticStatus;
      post({ type:"setStatus", status:optimisticStatus, preserveSelection:true });
      await command("webMdtStatus", { callsign, status:optimisticStatus });
    } else if (name === "sendMessage") {
      await command("webMdtMessage", { callsign, message:data.message });
    } else if (name === "ackIncident") {
      if(String(data.id||"").startsWith("STANDBY:")){
        await command("ackStandbyMove",{callsign,moveId:String(data.id).slice(8)});
      }else{
        await command("webMdtAck", { callsign, incidentId:data.id });
      }
    } else if (name === "setIncidentWaypoint") {
      console.info("[Guardian Web MDT] waypoint selected", data);
    }

    return new Response(JSON.stringify({ok:true}), {
      status:200, headers:{"Content-Type":"application/json"}
    });
  };

  async function loadState() {
    const r = await nativeFetch("/api/state", {cache:"no-store"});
    const j = await r.json();
    if (j?.state) {
      state = { ...state, ...j.state };
      syncStateToMdt(false);
    }
  }

  function connectEvents() {
    const es = new EventSource("/api/events");
    es.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "state") {
          state = { ...state, ...m.payload };
          syncStateToMdt(false);
        } else if (m.type === "fivemEvent" || m.type === "event") {
          processRealtimeEvent(m.payload);
        }
      } catch (err) {
        console.error("[Guardian Web MDT]", err);
      }
    };
    es.onopen = () => replayRecentEvents();
    es.onerror = () => console.warn("[Guardian Web MDT] realtime link reconnecting…");
  }

  window.addEventListener("DOMContentLoaded", () => {
    makeShell();
    setTimeout(async () => {
      post({ type:"open" });
      await loadState().catch(console.error);
      connectEvents();
      await replayRecentEvents();
      setInterval(() => { if(!document.hidden) loadState().catch(() => {}); }, 30000);
      document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadState().catch(()=>{});});
    }, 80);
  });
})();
