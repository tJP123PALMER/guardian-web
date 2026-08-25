
const $=id=>document.getElementById(id);
let me=null,config=null,operational=null,active="overview";

async function api(url,opt={}){
  const r=await fetch(url,{cache:"no-store",headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    if(r.status===401 && !url.includes("/api/admin/login") && !url.includes("/api/admin/me")){
      $("appView")?.classList.add("hidden");
      $("loginView")?.classList.remove("hidden");
      $("loginError").textContent="Your admin session expired. Please sign in again.";
    }
    throw new Error(data.error||`HTTP ${r.status}`);
  }
  return data;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setContent(html){$("content").innerHTML=html}
function errorView(title,e){setContent(`<div class="card errorCard"><h3>${esc(title)}</h3><p>${esc(e?.message||e||"Unknown error")}</p><button id="retryBtn">RETRY</button></div>`);$("retryBtn").onclick=refreshAll}
function notify(msg){const n=document.createElement("div");n.className="toast";n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2400)}

async function boot(){
  try{
    me=(await api("/api/admin/me")).user;
    showApp();
    await refreshAll();
  }catch(_){
    $("appView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
  }
}
$("loginBtn").onclick=async()=>{
  try{me=(await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("loginUser").value,password:$("loginPass").value})})).user;$("loginError").textContent="";showApp();await refreshAll()}
  catch(e){$("loginError").textContent=e.message}
};
$("logoutBtn").onclick=async()=>{await api("/api/admin/logout",{method:"POST"});location.reload()};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");active=b.dataset.tab;$("pageTitle").textContent=b.textContent;render()});
function showApp(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("who").innerHTML=`${esc(me.displayName||me.username)} · <span class="badge ${me.role==="owner"?"owner":""}">${esc(me.role.toUpperCase())}</span>`}
async function refreshAll(){
  setContent(`<div class="card"><h3>Loading Guardian data…</h3></div>`);
  try{
    const c=await api("/api/admin/config");
    let o={};try{o=await api("/api/admin/operational")}catch(_){const b=await api("/api/admin/baseline");o={stations:b.stations||[],appliances:b.appliances||[],applianceTypes:c.config?.applianceTypes||[],skills:c.config?.skills||[],statuses:c.config?.statuses||[],stationMapPositions:{},stationMapLocked:false,summary:{stations:(b.stations||[]).length,appliances:(b.appliances||[]).length,booked:0,incidents:0,calls999:0,standby:0,fivemConnected:false,coreMode:"STANDALONE"}}}
    config=c.config||{};operational=o||{};
    config.stations=operational.stations||config.stations||[];
    config.appliances=operational.appliances||config.appliances||[];
    config.applianceTypes=operational.applianceTypes||config.applianceTypes||[];
    config.skills=operational.skills||config.skills||[];
    render();
  }catch(e){errorView("Unable to load Guardian Settings",e)}
}
function render(){
  if(!config||!operational)return;
  try{
    ({overview:renderOverview,stations:renderStations,appliances:renderAppliances,map:renderMap,config:renderConfig,users:renderUsers,backup:renderBackup,audit:renderAudit}[active]||renderOverview)()
  }catch(e){errorView("This Settings page failed to render",e)}
}

function renderOverview(){
 const s=operational.summary||{},warnings=operational.warnings||[],mapCount=s.mappedStations||Object.keys(operational.stationMapPositions||{}).length;
 setContent(`<div class="grid stats"><div class="card"><div class="eyebrow">STATIONS</div><div class="big">${s.stations||0}</div><p>Configured operational stations</p></div><div class="card"><div class="eyebrow">APPLIANCES</div><div class="big">${s.appliances||0}</div><p>Known Guardian callsigns</p></div><div class="card"><div class="eyebrow">SIGNED ON</div><div class="big">${s.booked||0}</div><p>Operationally live appliances</p></div><div class="card"><div class="eyebrow">OPEN INCIDENTS</div><div class="big">${s.incidents||0}</div><p>Currently active</p></div><div class="card"><div class="eyebrow">999 QUEUE</div><div class="big">${s.calls999||0}</div><p>Awaiting Control action</p></div><div class="card"><div class="eyebrow">STANDBY</div><div class="big">${s.standby||0}</div><p>Active standby moves</p></div><div class="card"><div class="eyebrow">MAP POSITIONS</div><div class="big">${mapCount}</div><p>Manual station positions</p></div><div class="card"><div class="eyebrow">CONFIG HEALTH</div><div class="big">${warnings.length}</div><p>${warnings.length?"Warnings need attention":"No detected warnings"}</p></div><div class="card wide"><div class="sectionHead"><div><div class="eyebrow">GUARDIAN CORE</div><h3>${esc(s.coreMode||"UNKNOWN")}</h3></div><span class="statusBadge ${s.fivemConnected?"ok":"warn"}">${s.fivemConnected?"FIVEM CONNECTED":"STANDALONE"}</span></div><p>Last heartbeat: <b>${s.lastHeartbeat?new Date(s.lastHeartbeat).toLocaleString():"No active FiveM heartbeat"}</b></p>${warnings.length?`<div class="warningList">${warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join("")}</div>`:""}</div></div>`);
}

function renderStations(){
 const saved=operational.stationMapPositions||{};
 const rows=(config.stations||[]).map((s,i)=>{const mapped=!!saved[String(s.name||"").trim().toLowerCase()];return `<tr><td><input data-st-name="${i}" value="${esc(s.name)}"></td><td><input data-st-postal="${i}" value="${esc(s.postal||"")}" placeholder="Postal"></td><td>${(operational.appliances||[]).filter(a=>a.station===s.name).map(a=>`<span class="pill">${esc(a.callsign)}</span>`).join(" ")||"—"}</td><td><span class="statusBadge ${mapped?"ok":"warn"}">${mapped?"MANUAL MAP":"POSTAL MAP"}</span></td><td><label><input type="checkbox" data-st-active="${i}" ${s.active!==false?"checked":""}> Active</label></td><td><button class="danger" data-st-del="${i}">DELETE</button></td></tr>`}).join("");
 setContent(`<div class="card"><div class="sectionHead"><div><h3>Stations</h3><p>Shared by Control, MDT, standby cover and mapping.</p></div><button id="addStation">ADD STATION</button></div><div id="stationValidation" class="validationBox hidden"></div><div class="tableWrap"><table><thead><tr><th>Station</th><th>Postal</th><th>Appliances</th><th>Map</th><th>Status</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="6">No stations configured.</td></tr>`}</tbody></table></div><button id="saveStations">VALIDATE & SAVE STATIONS</button></div>`);
 $("addStation").onclick=()=>{config.stations.push({name:"New Station",postal:"",active:true});renderStations()};document.querySelectorAll("[data-st-del]").forEach(b=>b.onclick=()=>{config.stations.splice(+b.dataset.stDel,1);renderStations()});
 $("saveStations").onclick=async()=>{config.stations.forEach((s,i)=>{s.name=document.querySelector(`[data-st-name="${i}"]`).value.trim();s.postal=document.querySelector(`[data-st-postal="${i}"]`).value.trim();s.active=document.querySelector(`[data-st-active="${i}"]`).checked});const names=config.stations.map(s=>s.name.toLowerCase()),errors=[];config.stations.forEach((s,i)=>{if(!s.name)errors.push(`Row ${i+1}: station name required`);if(names.indexOf(s.name.toLowerCase())!==i)errors.push(`Duplicate station: ${s.name}`)});const box=$("stationValidation");if(errors.length){box.classList.remove("hidden");box.innerHTML=errors.map(x=>`<div>⚠ ${esc(x)}</div>`).join("");return}box.classList.add("hidden");await api("/api/admin/stations",{method:"POST",body:JSON.stringify({stations:config.stations})});notify("Stations saved to Guardian");await refreshAll()};
}

function renderAppliances(){
 const stations=(config.stations||[]).map(s=>s.name),types=config.applianceTypes||[];
 const rows=(config.appliances||[]).map((a,i)=>`<tr><td><input data-ap-cs="${i}" value="${esc(a.callsign)}"></td><td><select data-ap-st="${i}"><option value="">— Select —</option>${stations.map(x=>`<option ${x===a.station?"selected":""}>${esc(x)}</option>`).join("")}</select></td><td><select data-ap-type="${i}">${types.map(x=>`<option ${x===a.type?"selected":""}>${esc(x)}</option>`).join("")}</select></td><td><input data-ap-skills="${i}" value="${esc((a.skills||[]).join(", "))}" placeholder="BA, Aerial, Rescue"></td><td>${esc(a.status||"—")}</td><td><span class="statusBadge ${a.signedOn?"ok":"off"}">${a.signedOn?"SIGNED ON":"OFF DUTY"}</span></td><td><button class="danger" data-ap-del="${i}">DELETE</button></td></tr>`).join("");
 setContent(`<div class="card"><div class="sectionHead"><div><h3>Appliances</h3><p>Configured fleet. Configuration never signs an appliance on.</p></div><button id="addAppliance">ADD APPLIANCE</button></div><div id="applianceValidation" class="validationBox hidden"></div><div class="tableWrap"><table><thead><tr><th>Callsign</th><th>Home Station</th><th>Type</th><th>Skills</th><th>Live Status</th><th>Live</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">No appliances found.</td></tr>`}</tbody></table></div><button id="saveAppliances">VALIDATE & SAVE APPLIANCES</button></div>`);
 $("addAppliance").onclick=()=>{config.appliances.push({callsign:"NEW",station:stations[0]||"",type:types[0]||"Pump",skills:[],active:true});renderAppliances()};document.querySelectorAll("[data-ap-del]").forEach(b=>b.onclick=()=>{config.appliances.splice(+b.dataset.apDel,1);renderAppliances()});
 $("saveAppliances").onclick=async()=>{config.appliances.forEach((a,i)=>{a.callsign=document.querySelector(`[data-ap-cs="${i}"]`).value.trim().toUpperCase();a.station=document.querySelector(`[data-ap-st="${i}"]`).value;a.type=document.querySelector(`[data-ap-type="${i}"]`).value;a.skills=document.querySelector(`[data-ap-skills="${i}"]`).value.split(",").map(x=>x.trim()).filter(Boolean)});const calls=config.appliances.map(a=>a.callsign),errors=[];config.appliances.forEach((a,i)=>{if(!a.callsign)errors.push(`Row ${i+1}: callsign required`);if(calls.indexOf(a.callsign)!==i)errors.push(`Duplicate callsign: ${a.callsign}`);if(!a.station)errors.push(`${a.callsign||`Row ${i+1}`}: home station required`)});const box=$("applianceValidation");if(errors.length){box.classList.remove("hidden");box.innerHTML=errors.map(x=>`<div>⚠ ${esc(x)}</div>`).join("");return}box.classList.add("hidden");await api("/api/admin/appliances",{method:"POST",body:JSON.stringify({appliances:config.appliances})});notify("Appliances saved to Guardian");await refreshAll()};
}

async function renderMap(){
  const locked=!!operational.stationMapLocked;
  setContent(`<div class="card"><div class="sectionHead"><div><h3>Station Map</h3><p>This is the same map and coordinate system used by Control Centre. Dragging is only available here.</p></div><div><button id="lockMap">${locked?"UNLOCK STATIONS":"LOCK STATIONS"}</button></div></div><div class="mapHint">${locked?"Station positions are locked. Unlock before moving them.":"Drag a station marker, then save it. Unsaved markers use their postal position."}</div><div class="stationMapViewport"><div id="stationMap" class="stationMapEditor"></div></div><div class="mapActions"><button id="saveMap">SAVE MOVED STATIONS</button><button id="resetMap">RESET TO POSTAL</button><select id="resetStation"><option value="">Select station…</option>${(config.stations||[]).map(s=>`<option>${esc(s.name)}</option>`).join("")}</select></div></div>`);
  const map=$("stationMap"),pending=new Map(),saved=operational.stationMapPositions||{};
  let postals=new Map();
  try{postals=await loadSettingsPostals()}catch(err){console.error(err);notify("Postal map data could not be loaded")}

  (config.stations||[]).forEach(st=>{
    const key=String(st.name).trim().toLowerCase(),pos=saved[key]||saved[st.name]||{};
    let x=Number(pos.mapXPercent),y=Number(pos.mapYPercent);
    if(!Number.isFinite(x)||!Number.isFinite(y)){
      const p=postals.get(String(st.postal||"").trim());
      if(p){const pt=settingsMapPoint(p.x,p.y);x=pt.x;y=pt.y}
      else {x=50;y=50}
    }
    const b=document.createElement("button");b.className="stationPin";b.type="button";b.style.left=x+"%";b.style.top=y+"%";b.innerHTML=`<span>FS</span><b>${esc(st.name)}</b>`;
    let drag=false;
    b.onpointerdown=e=>{if(locked)return;e.preventDefault();drag=true;b.setPointerCapture?.(e.pointerId);b.classList.add("dragging")};
    b.onpointermove=e=>{if(!drag)return;const r=map.getBoundingClientRect();x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));b.style.left=x+"%";b.style.top=y+"%";pending.set(st.name,{x,y})};
    b.onpointerup=()=>{drag=false;b.classList.remove("dragging")};b.onpointercancel=b.onpointerup;map.appendChild(b)
  });
  $("lockMap").onclick=async()=>{await api("/api/admin/station-map/lock",{method:"POST",body:JSON.stringify({locked:!locked})});await refreshAll()};
  $("saveMap").onclick=async()=>{
    if(!pending.size){notify("No station positions changed");return}
    for(const [stationName,p] of pending){
      const result=await api("/api/admin/station-map/position",{method:"POST",body:JSON.stringify({stationName,mapXPercent:p.x,mapYPercent:p.y})});
      operational.stationMapPositions=result.stationMapPositions||operational.stationMapPositions||{};
    }
    pending.clear();
    notify("Station positions saved to Control");
    await refreshAll();
  };
  $("resetMap").onclick=async()=>{const name=$("resetStation").value;if(!name)return;await api("/api/admin/station-map/position/"+encodeURIComponent(name),{method:"DELETE"});notify("Station reset to its postal position");await refreshAll()};
}
function renderConfig(){
  config.general ||= {};
  config.alerts ||= {};
  const g=config.general,a=config.alerts;

  setContent(`
  <div class="configGrid">

    <div class="card">
      <div class="eyebrow">OPERATIONAL CORE</div>
      <h3>Guardian Core</h3>
      <div class="formGrid">
        <label>Standalone Mode
          <select id="cfgStandalone">
            <option value="true" ${g.standaloneEnabled!==false?"selected":""}>Enabled</option>
            <option value="false" ${g.standaloneEnabled===false?"selected":""}>Disabled</option>
          </select>
        </label>

        <label>FiveM Integration
          <select id="cfgFiveM">
            <option value="true" ${g.fivemEnabled!==false?"selected":""}>Enabled</option>
            <option value="false" ${g.fivemEnabled===false?"selected":""}>Disabled</option>
          </select>
        </label>

        <label>Reconnect Behaviour
          <select id="cfgPreserve">
            <option value="true" ${g.preserveStandaloneState!==false?"selected":""}>Preserve standalone incidents/state</option>
            <option value="false" ${g.preserveStandaloneState===false?"selected":""}>Prefer FiveM snapshot</option>
          </select>
        </label>

        <label>Current Mode
          <input value="${esc(operational.summary?.coreMode||"UNKNOWN")}" disabled>
        </label>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow">INCIDENT CONTROL</div>
      <h3>Incident Defaults</h3>
      <div class="formGrid">
        <label>Incident Numbering
          <select id="cfgNumbering">
            <option ${g.incidentNumbering==="AUTO"?"selected":""}>AUTO</option>
            <option ${g.incidentNumbering==="MANUAL"?"selected":""}>MANUAL</option>
          </select>
        </label>

        <label>Default Priority
          <select id="cfgPriority">
            ${["LOW","NORMAL","HIGH","URGENT"].map(x=>`<option ${String(g.defaultIncidentPriority||"NORMAL").toUpperCase()===x?"selected":""}>${x}</option>`).join("")}
          </select>
        </label>

        <label>Default Appliance Status
          <select id="cfgDefaultStatus">
            ${(config.statuses||[]).map(x=>`<option ${String(g.defaultApplianceStatus||"Available")===x?"selected":""}>${esc(x)}</option>`).join("")}
          </select>
        </label>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow">ALERTING</div>
      <h3>Sounds & Notifications</h3>
      <div class="toggleList">
        <label><input id="cfgTurnoutSound" type="checkbox" ${a.turnoutSound!==false?"checked":""}> Turnout alert sound</label>
        <label><input id="cfgMessageSound" type="checkbox" ${a.messageSound!==false?"checked":""}> New message sound</label>
        <label><input id="cfgStandbySound" type="checkbox" ${a.standbySound!==false?"checked":""}> Standby alert sound</label>
        <label><input id="cfgBrowserNotify" type="checkbox" ${a.browserNotifications===true?"checked":""}> Browser notifications</label>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow">APPLIANCE SETUP</div>
      <h3>Appliance Types</h3>
      <p>One type per line. These feed the Appliance editor.</p>
      <textarea id="cfgTypes" rows="10">${esc((config.applianceTypes||[]).join("\n"))}</textarea>
    </div>

    <div class="card">
      <div class="eyebrow">CAPABILITIES</div>
      <h3>Skills / Capabilities</h3>
      <p>One skill per line.</p>
      <textarea id="cfgSkills" rows="10">${esc((config.skills||[]).join("\n"))}</textarea>
    </div>

    <div class="card">
      <div class="eyebrow">STATUS BOARD</div>
      <h3>Appliance Statuses</h3>
      <p>One status per line. Keep operational wording consistent with MDT.</p>
      <textarea id="cfgStatuses" rows="12">${esc((config.statuses||[]).join("\n"))}</textarea>
    </div>

    <div class="card wide">
      <div class="sectionHead">
        <div>
          <div class="eyebrow">SYSTEM SUMMARY</div>
          <h3>Live Configuration</h3>
        </div>
        <span class="statusBadge ${operational.summary?.fivemConnected?"ok":"warn"}">
          ${operational.summary?.fivemConnected?"FIVEM CONNECTED":"STANDALONE"}
        </span>
      </div>
      <div class="configSummary">
        <div><b>${config.stations?.length||0}</b><span>Stations</span></div>
        <div><b>${config.appliances?.length||0}</b><span>Appliances</span></div>
        <div><b>${config.applianceTypes?.length||0}</b><span>Types</span></div>
        <div><b>${config.skills?.length||0}</b><span>Skills</span></div>
        <div><b>${config.statuses?.length||0}</b><span>Statuses</span></div>
      </div>
    </div>

  </div>

  <div class="card saveBar">
    <div>
      <h3>Save Guardian Configuration</h3>
      <p>Changes here become Guardian's shared configuration for Control, MDT and standalone operation.</p>
    </div>
    <button id="saveConfig">SAVE CONFIGURATION</button>
  </div>`);

  $("saveConfig").onclick=async()=>{
    config.applianceTypes=$("cfgTypes").value.split("\n").map(x=>x.trim()).filter(Boolean);
    config.skills=$("cfgSkills").value.split("\n").map(x=>x.trim()).filter(Boolean);
    config.statuses=$("cfgStatuses").value.split("\n").map(x=>x.trim()).filter(Boolean);

    config.general={
      ...config.general,
      standaloneEnabled:$("cfgStandalone").value==="true",
      fivemEnabled:$("cfgFiveM").value==="true",
      preserveStandaloneState:$("cfgPreserve").value==="true",
      incidentNumbering:$("cfgNumbering").value,
      defaultIncidentPriority:$("cfgPriority").value,
      defaultApplianceStatus:$("cfgDefaultStatus").value
    };

    config.alerts={
      ...config.alerts,
      turnoutSound:$("cfgTurnoutSound").checked,
      messageSound:$("cfgMessageSound").checked,
      standbySound:$("cfgStandbySound").checked,
      browserNotifications:$("cfgBrowserNotify").checked
    };

    await api("/api/admin/config",{method:"POST",body:JSON.stringify({config})});
    notify("Guardian configuration saved");
    await refreshAll();
  };
}

async function renderUsers(){
 setContent(`<div class="grid two"><div class="card"><h3>Users & Access</h3><p>Protected administration accounts.</p><div id="usersArea">Loading users…</div></div><div class="card"><h3>Role Access</h3><div class="roleGuide"><div><b>OWNER</b><span>Everything, including owner controls.</span></div><div><b>ADMIN</b><span>Full administration except owner-only actions.</span></div><div><b>DEV</b><span>Configuration/development access without destructive security actions.</span></div><div><b>READONLY</b><span>View Settings and Audit only.</span></div></div></div></div>`);
 try{const data=await api("/api/admin/users");$("usersArea").innerHTML=`<div class="createBar"><input id="newUser" placeholder="Username"><input id="newDisplay" placeholder="Display name"><input id="newPass" type="password" placeholder="Password 8+ chars"><select id="newRole"><option>admin</option><option>dev</option><option>readonly</option></select><button id="createUser">CREATE</button></div><div class="tableWrap"><table><thead><tr><th>User</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>${data.users.map(u=>`<tr><td><b>${esc(u.displayName||u.username)}</b><br><small>${esc(u.username)}</small></td><td><span class="badge ${u.role==="owner"?"owner":""}">${esc(u.role.toUpperCase())}</span></td><td>${u.createdAt?new Date(u.createdAt).toLocaleString():"—"}</td><td><button data-user-pass="${esc(u.username)}">RESET PASSWORD</button>${u.protected?` <span class="protectedText">PROTECTED OWNER</span>`:` <button class="danger" data-user-del="${esc(u.username)}">DELETE</button>`}</td></tr>`).join("")}</tbody></table></div>`;$("createUser").onclick=async()=>{await api("/api/admin/users",{method:"POST",body:JSON.stringify({username:$("newUser").value,displayName:$("newDisplay").value,password:$("newPass").value,role:$("newRole").value})});notify("User created");renderUsers()};document.querySelectorAll("[data-user-pass]").forEach(b=>b.onclick=async()=>{const pw=prompt(`New password for ${b.dataset.userPass} (minimum 8 characters)`);if(!pw)return;await api("/api/admin/users/"+encodeURIComponent(b.dataset.userPass)+"/password",{method:"POST",body:JSON.stringify({password:pw})});notify("Password updated")});document.querySelectorAll("[data-user-del]").forEach(b=>b.onclick=async()=>{if(confirm(`Delete ${b.dataset.userDel}?`)){await api("/api/admin/users/"+encodeURIComponent(b.dataset.userDel),{method:"DELETE"});notify("User deleted");renderUsers()}})}catch(e){errorView("Users & Access",e)}
}

function renderBackup(){
 setContent(`<div class="grid two"><div class="card"><div class="eyebrow">EXPORT</div><h3>Full Guardian Backup</h3><p>Configuration plus station map positions and lock state.</p><button id="exportBtn">DOWNLOAD FULL BACKUP</button></div><div class="card"><div class="eyebrow">RESTORE</div><h3>Restore Guardian</h3><p>Select a Guardian JSON backup or paste it below.</p><input id="restoreFile" type="file" accept=".json,application/json"><textarea id="restoreData" rows="12" placeholder="Backup JSON"></textarea><button class="danger" id="restoreBtn">VALIDATE & RESTORE</button></div></div>`);$("exportBtn").onclick=()=>location.href="/api/admin/export";$("restoreFile").onchange=async e=>{const f=e.target.files?.[0];if(f)$("restoreData").value=await f.text()};$("restoreBtn").onclick=async()=>{let data;try{data=JSON.parse($("restoreData").value)}catch{return alert("Backup JSON is invalid.")}if(!data?.config)return alert("This is not a Guardian backup.");if(!confirm("Restore this Guardian backup? Current configuration will be replaced."))return;await api("/api/admin/import",{method:"POST",body:JSON.stringify(data)});notify("Guardian backup restored");await refreshAll()}
}

async function renderAudit(){
 setContent(`<div class="card"><div class="sectionHead"><div><h3>Audit Log</h3><p>Administrative logins and configuration changes.</p></div><button id="refreshAudit">REFRESH</button></div><div class="auditTools"><input id="auditSearch" placeholder="Filter by user, action or detail"></div><div id="auditArea">Loading audit log…</div></div>`);
 try{const all=(await api("/api/admin/audit")).audit||[];const draw=()=>{const q=String($("auditSearch")?.value||"").toLowerCase(),a=all.filter(x=>!q||`${x.actor} ${x.action} ${JSON.stringify(x.details||{})}`.toLowerCase().includes(q));$("auditArea").innerHTML=`<p class="small">${a.length} of ${all.length} entries</p>`+(a.length?`<div class="tableWrap"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>${a.map(x=>`<tr><td>${new Date(x.at).toLocaleString()}</td><td>${esc(x.actor)}</td><td><span class="auditAction">${esc(x.action)}</span></td><td><code>${esc(JSON.stringify(x.details||{}))}</code></td></tr>`).join("")}</tbody></table></div>`:`<p>No matching audit entries.</p>`)};draw();$("auditSearch").oninput=draw;$("refreshAudit").onclick=renderAudit}catch(e){errorView("Audit Log",e)}
}

boot();
