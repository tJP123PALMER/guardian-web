


const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const upper=v=>String(v??"").trim().toUpperCase();

function skillText(value){
 if(Array.isArray(value)) return value.join(", ");
 if(value && typeof value==="object") return Object.keys(value).filter(k=>value[k]).join(", ");
 return String(value ?? "");
}
function stationFor(cs){
 const key=upper(cs);
 const map=state.callSignStations||{};
 return map[key] ?? map[cs] ?? "";
}
function allConfiguredCallsigns(){
 return [...new Set([...(state.callsigns||[]).map(upper),...Object.keys(state.units||{}).map(upper),...Object.keys(state.callSignStations||{}).map(upper)])].filter(Boolean).sort();
}

let state={connected:false,units:{},incidents:[],calls999:[],messages:[],callsigns:[],callSignStations:{},applianceSkills:{},stations:{},eventLog:[]};
let controlView="overview",selectedIncidentId=null;
const pending999Conversions=new Set();
const pending999Dismissals=new Set();

const incidentDrafts=new Map();

function incidentDraft(inc){
  const key=String(inc.id);
  if(incidentDrafts.has(key)) return incidentDrafts.get(key);
  const d={
    type:String(inc.type||"999 EMERGENCY"),
    priority:String(inc.priority||"Immediate"),
    address:String(inc.address||""),
    postal:String(inc.postal||""),
    caller:String(inc.caller||""),
    sceneStatus:String(inc.sceneStatus||""),
    casualties:Number(inc.casualties||0),
    details:String(inc.details||inc.notes||""),
    hazards:String(inc.hazards||""),
    resources:String(inc.resources||""),
    dirty:false,
    saving:false,
    saveStartedAt:0,
    confirmed:false
  };
  incidentDrafts.set(key,d);
  return d;
}
function setIncidentDraftField(id,field,value){
  const inc=incidentById(id); if(!inc)return;
  const d=incidentDraft(inc);
  d[field]=value;
  d.dirty=true;
  d.confirmed=false;
  incidentDrafts.set(String(id),d);
  const hint=document.getElementById("incidentSaveHint");
  if(hint){hint.textContent="Unsaved changes";hint.classList.remove("saved");hint.classList.add("dirty");}
}
function clearIncidentDraft(id){incidentDrafts.delete(String(id));}

function incidentStateMatchesDraft(inc,d){
  if(!inc||!d)return false;
  const norm=v=>String(v??"").trim();
  return norm(inc.type)===norm(d.type)
    && norm(inc.priority)===norm(d.priority)
    && norm(inc.address)===norm(d.address)
    && norm(inc.postal)===norm(d.postal)
    && norm(inc.caller)===norm(d.caller)
    && norm(inc.sceneStatus)===norm(d.sceneStatus)
    && Number(inc.casualties||0)===Number(d.casualties||0)
    && norm(inc.details||inc.notes)===norm(d.details)
    && norm(inc.hazards)===norm(d.hazards)
    && norm(inc.resources)===norm(d.resources);
}

function reconcileIncidentDrafts(){
  for(const [id,d] of incidentDrafts){
    if(!d.saving)continue;
    const inc=incidentById(id);
    if(incidentStateMatchesDraft(inc,d)){
      d.saving=false;
      d.dirty=false;
      d.confirmed=true;
      incidentDrafts.set(id,d);
      const hint=document.getElementById("incidentSaveHint");
      if(String(selectedIncidentId)===String(id)&&hint){
        hint.textContent="Saved and confirmed by Guardian Control.";
        hint.classList.remove("dirty");
        hint.classList.add("saved");
      }
    }else if(Date.now()-Number(d.saveStartedAt||0)>12000){
      d.saving=false;
      d.dirty=true;
      incidentDrafts.set(id,d);
      const hint=document.getElementById("incidentSaveHint");
      if(String(selectedIncidentId)===String(id)&&hint){
        hint.textContent="Save has not been confirmed yet — your draft is still protected.";
        hint.classList.remove("saved");
        hint.classList.add("dirty");
      }
    }
  }
}

function incidentEditorShouldHold(){
  if(!selectedIncidentId)return false;
  const d=incidentDrafts.get(String(selectedIncidentId));
  const active=document.activeElement;
  const detail=document.getElementById("incidentDetail");
  const focused=!!(active&&detail&&detail.contains(active)&&["INPUT","SELECT","TEXTAREA"].includes(active.tagName));
  return focused || !!d?.dirty || !!d?.saving;
}
function resourceSkill(v){
  if(Array.isArray(v)) return v.join(", ");
  if(v&&typeof v==="object") return Object.keys(v).filter(k=>v[k]).join(", ");
  return String(v??"");
}

let mdtView="status",mdtCallsign=localStorage.getItem("guardianMdtCallsign")||"",selectedMdtIncidentId=null,selectedStatus=null;
const statusOptions=["Mobile to Incident","In Attendance at Incident","Available At Incident","Mobile And Available","Home Station","Available Home Address","Available Pager","Available Telephone","Mobile to Standby Station","Available Standby Station"];

function pathMode(){return location.pathname.toLowerCase().startsWith("/mdt")?"mdt":"control"}
function setMode(){
 const mode=pathMode();
 $("controlApp").classList.toggle("hidden",mode!=="control");$("mdtApp").classList.toggle("hidden",mode!=="mdt");
 $("controlMode").classList.toggle("active",mode==="control");$("mdtMode").classList.toggle("active",mode==="mdt");
 document.title=mode==="control"?"Guardian Control Centre":"Guardian Player MDT";
}
function statusClass(s){s=upper(s);if(s.includes("AVAILABLE")||s.includes("HOME STATION"))return"available";if(s.includes("MOBILE"))return"mobile";if(s.includes("ATTENDANCE")||s.includes("ON SCENE"))return"scene";return""}
function liveUnits(){return Object.entries(state.units||{}).map(([callsign,u])=>({callsign:upper(callsign),...(u||{})}))}
function currentStatus(cs){return state.units?.[upper(cs)]?.status||"OFF RUN"}
function availableUnit(u){return /AVAILABLE|HOME STATION/i.test(u.status||"")}
function assignedUnits(inc){return Array.isArray(inc.assignedUnits)?inc.assignedUnits.map(upper):[]}
function assignedToOther(callsign,incidentId){return state.incidents.some(i=>String(i.id)!==String(incidentId)&&assignedUnits(i).includes(upper(callsign)))}
function incidentById(id){return state.incidents.find(i=>String(i.id)===String(id))}
async function command(action,data){
 const r=await fetch("/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data})});
 if(!r.ok)throw new Error(await r.text());return r.json().catch(()=>({}));
}
function setControlView(v){
 controlView=v;document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+v));
 document.querySelectorAll(".railBtn").forEach(x=>x.classList.toggle("active",x.dataset.view===v));render();
}
function setMdtView(v){
 mdtView=v;document.querySelectorAll(".mdtView").forEach(x=>x.classList.toggle("active",x.id==="mdt-"+v));
 document.querySelectorAll(".mdtNav button").forEach(x=>x.classList.toggle("active",x.dataset.mdtview===v));renderMdt();
}
function render(){
 reconcileIncidentDrafts();
 const units=liveUnits(),incs=state.incidents||[],calls=state.calls999||[];
 $("liveDot").classList.toggle("online",!!state.connected);$("liveText").textContent=state.connected?"LIVE SERVER LINK":"SERVER OFFLINE";
 $("lastSync").textContent=state.updatedAt?`Last sync ${new Date(state.updatedAt).toLocaleTimeString()}`:"Awaiting sync";
 $("incidentBadge").textContent=incs.length;$("callBadge").textContent=calls.length;
 $("mIncidents").textContent=incs.length;$("mAvailable").textContent=units.filter(availableUnit).length;$("mMobile").textContent=units.filter(u=>/MOBILE|ATTENDANCE/i.test(u.status||"")).length;$("mCalls").textContent=calls.length;
 $("overviewIncidents").innerHTML=incs.length?incs.slice(0,6).map(i=>`<div class="row"><div class="rowMeta"><strong>#${esc(i.id)} · ${esc(i.type||"Incident")}</strong><span>${esc(i.address||i.postal||"No location")}</span></div><span class="status">${assignedUnits(i).length} assigned</span></div>`).join(""):empty("No active incidents");
 $("overviewUnits").innerHTML=units.length?units.slice(0,8).map(u=>`<div class="row"><div class="rowMeta"><strong>${esc(u.callsign)}</strong><span>${esc(stationFor(u.callsign)||"")}</span></div><span class="status ${statusClass(u.status)}">${esc(u.status||"OFF RUN")}</span></div>`).join(""):empty("No live appliances");
 renderIncidentList();
 if(!incidentEditorShouldHold())renderIncidentDetail();
 renderUnits();renderCalls();renderMessages();renderStations();renderCover();renderMdt();
}
function empty(text){return `<div class="emptyState"><strong>${esc(text)}</strong><span>Live server data will appear here automatically.</span></div>`}
function renderIncidentList(){
 $("incidentList").innerHTML=state.incidents.length?state.incidents.map(i=>`<div class="incidentCard ${String(i.id)===String(selectedIncidentId)?"active":""}" data-incident="${esc(i.id)}"><strong>#${esc(i.id)} · ${esc(i.type||"Incident")}</strong><p>${esc(i.address||i.postal||"No location")} · ${assignedUnits(i).length} appliance(s)</p></div>`).join(""):empty("No open incidents");
}
function renderIncidentDetail(){
 const el=$("incidentDetail"),inc=incidentById(selectedIncidentId);
 if(!inc){
   el.innerHTML='<div class="emptyState"><strong>No incident selected</strong><span>Select an incident from the list to manage the live incident record.</span></div>';
   return;
 }

 const assigned=assignedUnits(inc),units=liveUnits();
 const draft=incidentDraft(inc);

 const prefsKey=`guardianDispatchPrefs:${inc.id}`;
 let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefsKey))||{}}catch{}
 const mdt=prefs.mdt??(inc.sendMDT!==false);
 const turnout=prefs.turnout??(inc.sendTurnout===true);
 const pager=prefs.pager??(inc.sendPager===true);

 const candidates=units.filter(u=>!assigned.includes(u.callsign)&&!assignedToOther(u.callsign,inc.id));
 const typeOptions=[...new Set([draft.type,"999 EMERGENCY","DWELLING FIRE","SHED / OUTBUILDING FIRE","COMMERCIAL FIRE","VEHICLE FIRE","RTC","FIRE ALARM","CHIMNEY FIRE","GRASS / WILDFIRE","WATER RESCUE","ROPE RESCUE","HEIGHT RESCUE","SPECIAL SERVICE","EFFECTING ENTRY","OTHER"].filter(Boolean))];
 const priorityOptions=[...new Set([draft.priority,"Immediate","Prompt","Non Emergency"].filter(Boolean))];
 const sceneOptions=[...new Set([draft.sceneStatus,"","Being Attended","Under Control","Making Pumps","Rescue Underway","Evacuation","All Clear"])];
 const timeline=Array.isArray(inc.timeline)?inc.timeline:[];
 const crews=inc.applianceCrew||{}, members=inc.crewMembers||{};

 el.innerHTML=`<div class="incidentDetailContent commandRecord">
   <div class="detailTop commandRecordTop">
     <div>
       <span class="eyebrow">INCIDENT #${esc(inc.id)}</span>
       <h2>${esc(inc.type||"Incident")}</h2>
       <p>${esc(inc.address||"No location")}${inc.postal?` · ${esc(inc.postal)}`:""}${inc.priority?` · ${esc(inc.priority)}`:""}</p>
     </div>
     <div class="incidentTopActions">
       <span class="status">${esc(inc.status||"ONGOING")}</span>
       <button class="dangerBtn" id="closeIncidentBtn">CLOSE INCIDENT</button>
     </div>
   </div>

   <div class="incidentCommandGrid">
     <section class="incidentOpsCard">
       <header><span class="panelKicker">INCIDENT COMMAND RECORD</span><h3>Live Incident Details</h3></header>
       <div class="incidentEditGrid">
         <label>Incident Type
           <select id="editIncidentType">${typeOptions.map(v=>`<option ${v===draft.type?"selected":""}>${esc(v)}</option>`).join("")}</select>
         </label>
         <label>Priority
           <select id="editIncidentPriority">${priorityOptions.map(v=>`<option ${v===draft.priority?"selected":""}>${esc(v)}</option>`).join("")}</select>
         </label>
         <label>Location / Address<input id="editIncidentAddress" value="${esc(draft.address)}"></label>
         <label>Postal<input id="editIncidentPostal" value="${esc(draft.postal)}"></label>
         <label>Caller<input id="editIncidentCaller" value="${esc(draft.caller)}"></label>
         <label>Scene Status
           <select id="editSceneStatus">${sceneOptions.map(v=>`<option value="${esc(v)}" ${v===draft.sceneStatus?"selected":""}>${esc(v||"Not set")}</option>`).join("")}</select>
         </label>
         <label>Casualties<input id="editCasualties" type="number" min="0" value="${esc(draft.casualties)}"></label>

         <label class="wideField">Additional Details
           <textarea id="editDetails" rows="5" placeholder="Add incident details as the incident develops...">${esc(draft.details)}</textarea>
         </label>
         <label class="wideField">Hazards
           <textarea id="editHazards" rows="3" placeholder="Gas, electricity, chemicals, structural instability, cylinders...">${esc(draft.hazards)}</textarea>
         </label>
         <label class="wideField">Additional Resources / Notes
           <textarea id="editResources" rows="3" placeholder="Additional pumps, specialist teams, water, police, ambulance...">${esc(draft.resources)}</textarea>
         </label>
       </div>
       <div class="recordActions">
         <span class="draftHint" id="incidentSaveHint">Changes remain here until you press Save.</span>
         <button class="primary" id="saveIncidentRecord">SAVE INCIDENT DETAILS</button>
       </div>
     </section>

     <section class="incidentOpsCard timelineCard">
       <header><span class="panelKicker">AUDIT TRAIL</span><h3>Incident Timeline</h3></header>
       <div class="timelineList">
         ${timeline.length?timeline.slice().reverse().map(ev=>`
           <div class="timelineEntry">
             <time>${esc(ev.time||"")}</time>
             <div><strong>${esc(ev.text||"Activity")}</strong>${ev.callsign?`<small>${esc(ev.callsign)}</small>`:""}</div>
           </div>`).join(""):'<div class="miniEmpty">No activity recorded yet.</div>'}
       </div>
     </section>
   </div>

   <section class="incidentOpsCard dispatchCard">
     <header><span class="panelKicker">MOBILISATION</span><h3>Appliances & Dispatch Channels</h3></header>
     <div class="dispatchChannels">
       <label><input id="prefMDT" type="checkbox" ${mdt?"checked":""}> Send to MDT</label>
       <label><input id="prefTurnout" type="checkbox" ${turnout?"checked":""}> Send to Turnout</label>
       <label><input id="prefPager" type="checkbox" ${pager?"checked":""}> Send to Pager</label>
     </div>
     <table class="resourceTable">
       <thead><tr><th>CALLSIGN</th><th>STATION</th><th>STATUS</th><th>ACTION</th></tr></thead>
       <tbody>
         ${assigned.map(cs=>`<tr>
           <td><strong>${esc(cs)}</strong></td>
           <td>${esc(stationFor(cs)||"")}</td>
           <td>${esc(state.units?.[cs]?.status||inc.applianceStatuses?.[cs]||"Mobilised")}</td>
           <td><button class="remove" data-unassign="${esc(cs)}">RELEASE</button></td>
         </tr>`).join("")}
         ${candidates.map(u=>`<tr>
           <td><strong>${esc(u.callsign)}</strong></td>
           <td>${esc(stationFor(u.callsign)||"")}</td>
           <td>${esc(u.status||"AVAILABLE")}</td>
           <td><button data-mobilise="${esc(u.callsign)}">MOBILISE</button></td>
         </tr>`).join("")}
         ${!assigned.length&&!candidates.length?'<tr><td colspan="4" class="tableEmpty">No active appliances currently available.</td></tr>':""}
       </tbody>
     </table>
   </section>

   <section class="incidentOpsCard">
     <header><span class="panelKicker">CREW MANAGEMENT</span><h3>Assigned Appliance Crews</h3></header>
     <div class="webCrewList">
       ${assigned.length?assigned.map(cs=>{
         const crew=crews[cs]||{}, count=Math.max(0,Number(crew.count||0)), roster=members[cs]||{};
         const crewRows=Array.from({length:count},(_,n)=>{
           const slot=n+1, person=roster[slot]||roster[String(slot)]||{};
           return `<div class="webCrewMember">
             <span class="crewSlot">${slot}</span>
             <label>Name<input class="crewName" data-cs="${esc(cs)}" data-slot="${slot}" value="${esc(person.name||"")}"></label>
             <label>Rank<input class="crewRank" data-cs="${esc(cs)}" data-slot="${slot}" value="${esc(person.rank||"")}"></label>
             <label>Radio Role<select class="crewRole" data-cs="${esc(cs)}" data-slot="${slot}">
               ${["Crew","Crew Commander","Watch Commander","Incident Commander","Safety Officer","Pump Commander","Sector Commander","Other"].map(r=>`<option ${r===(person.role||"Crew")?"selected":""}>${esc(r)}</option>`).join("")}
             </select></label>
             <button class="secondary saveCrewMember" data-cs="${esc(cs)}" data-slot="${slot}">SAVE</button>
           </div>`;
         }).join("");
         return `<article class="webCrewAppliance">
           <div class="webCrewHead">
             <div><strong>${esc(cs)}</strong><span>${esc(stationFor(cs)||"")}</span></div>
             <div class="crewCountEditor"><label>Crew Count <input class="crewCountInput" data-cs="${esc(cs)}" type="number" min="0" value="${count}"></label><button class="secondary saveCrewCount" data-cs="${esc(cs)}">SAVE COUNT</button></div>
           </div>
           <div class="webCrewMembers">${crewRows||'<div class="miniEmpty">Set the crew count to add named crew members.</div>'}</div>
         </article>`;
       }).join(""):'<div class="miniEmpty">Assign an appliance before adding crew.</div>'}
     </div>
   </section>

   <section class="incidentOpsCard">
     <header><span class="panelKicker">ADDITIONAL RESOURCES</span><h3>Raise Resource Request</h3></header>
     <div class="resourceRequestGrid">
       <label>Resource Type<select id="resourceRequestType">
         ${["Pump","Rescue","Aerial","Water Carrier","Wildfire","Command Unit","Specialist","Other"].map(v=>`<option>${esc(v)}</option>`).join("")}
       </select></label>
       <label>Priority<select id="resourceRequestPriority"><option>Normal</option><option>Urgent</option></select></label>
       <label class="wideField">Reason / Details<textarea id="resourceRequestNotes" rows="3"></textarea></label>
     </div>
     <div class="recordActions"><span></span><button class="secondary" id="raiseResourceRequest">CREATE RESOURCE REQUEST</button></div>
     <div class="openRequests">
       ${(inc.resourceRequests||[]).filter(r=>String(r.status||"OPEN")==="OPEN").map(r=>`
         <div class="requestRow"><strong>${esc(r.resourceType||r.type||"Other")}</strong><span>${esc(r.priority||"Normal")}</span><small>${esc(r.notes||"No details")}</small></div>
       `).join("")||'<div class="miniEmpty">No open resource requests.</div>'}
     </div>
   </section>
 </div>`;

 // Keep every editable field as a local draft while heartbeats arrive.
 const draftBindings={
   editIncidentType:"type",editIncidentPriority:"priority",editIncidentAddress:"address",
   editIncidentPostal:"postal",editIncidentCaller:"caller",editSceneStatus:"sceneStatus",
   editCasualties:"casualties",editDetails:"details",editHazards:"hazards",editResources:"resources"
 };
 Object.entries(draftBindings).forEach(([id,field])=>{
   const input=$(id); if(!input)return;
   input.addEventListener("input",()=>setIncidentDraftField(inc.id,field,field==="casualties"?Number(input.value||0):input.value));
   input.addEventListener("change",()=>setIncidentDraftField(inc.id,field,field==="casualties"?Number(input.value||0):input.value));
 });

 const savePrefs=()=>localStorage.setItem(prefsKey,JSON.stringify({
   mdt:$("prefMDT")?.checked===true,
   turnout:$("prefTurnout")?.checked===true,
   pager:$("prefPager")?.checked===true
 }));
 ["prefMDT","prefTurnout","prefPager"].forEach(id=>$(id)?.addEventListener("change",savePrefs));

 $("saveIncidentRecord").onclick=async()=>{
   const btn=$("saveIncidentRecord"),hint=$("incidentSaveHint");
   const d=incidentDraft(inc);
   d.saving=true;
   d.dirty=true;
   d.confirmed=false;
   d.saveStartedAt=Date.now();
   incidentDrafts.set(String(inc.id),d);

   btn.disabled=true;
   btn.textContent="SAVING...";
   hint.textContent="Sending changes to Guardian Control…";
   hint.classList.remove("saved");
   hint.classList.add("dirty");

   try{
     await command("updateIncidentDetails",{
       incidentId:inc.id,type:d.type,priority:d.priority,address:d.address,postal:d.postal,
       caller:d.caller,sceneStatus:d.sceneStatus,casualties:Number(d.casualties||0),
       details:d.details,hazards:d.hazards,resources:d.resources
     });
     hint.textContent="Sent — waiting for FiveM confirmation…";

     // Do not clear or rebuild the form here. Poll state until the exact
     // values return from Guardian_control; SSE usually confirms first.
     let checks=0;
     const confirmTimer=setInterval(async()=>{
       checks++;
       try{await load();}catch{}
       const current=incidentById(inc.id);
       const currentDraft=incidentDrafts.get(String(inc.id));
       if(!currentDraft?.saving || incidentStateMatchesDraft(current,currentDraft) || checks>=12){
         clearInterval(confirmTimer);
         reconcileIncidentDrafts();
       }
     },750);
   }catch(err){
     console.error(err);
     d.saving=false;
     d.dirty=true;
     incidentDrafts.set(String(inc.id),d);
     hint.textContent="Save failed — your draft has been kept.";
     hint.classList.remove("saved");
     hint.classList.add("dirty");
   }finally{
     btn.disabled=false;
     btn.textContent="SAVE INCIDENT DETAILS";
   }
 };

 $("closeIncidentBtn").onclick=async()=>{
   if(!confirm(`Close incident #${inc.id}? Assigned appliances will be released.`))return;
   const btn=$("closeIncidentBtn");btn.disabled=true;btn.textContent="CLOSING...";
   try{
     await command("closeIncident",{incidentId:inc.id});
     clearIncidentDraft(inc.id); selectedIncidentId=null;
     setTimeout(()=>load().catch(()=>{}),300);
   }catch(err){
     console.error(err);alert("Unable to close incident.");btn.disabled=false;btn.textContent="CLOSE INCIDENT";
   }
 };

 el.querySelectorAll("[data-mobilise]").forEach(b=>b.onclick=async()=>{
   savePrefs();
   await command("assignAppliance",{
     incidentId:inc.id,callsign:b.dataset.mobilise,assign:true,
     enableMDT:$("prefMDT")?.checked===true,
     enableTurnout:$("prefTurnout")?.checked===true,
     enablePager:$("prefPager")?.checked===true
   });
 });
 el.querySelectorAll("[data-unassign]").forEach(b=>b.onclick=()=>command("assignAppliance",{incidentId:inc.id,callsign:b.dataset.unassign,assign:false}));

 el.querySelectorAll(".saveCrewCount").forEach(btn=>btn.onclick=async()=>{
   const cs=btn.dataset.cs,input=el.querySelector(`.crewCountInput[data-cs="${CSS.escape(cs)}"]`);
   await command("setApplianceCrew",{incidentId:inc.id,callsign:cs,count:Number(input?.value||0)});
   setTimeout(()=>load().catch(()=>{}),250);
 });
 el.querySelectorAll(".saveCrewMember").forEach(btn=>btn.onclick=async()=>{
   const cs=btn.dataset.cs,slot=Number(btn.dataset.slot);
   const q=s=>el.querySelector(`${s}[data-cs="${CSS.escape(cs)}"][data-slot="${slot}"]`);
   await command("setCrewMember",{incidentId:inc.id,callsign:cs,slot,name:q(".crewName")?.value||"",rank:q(".crewRank")?.value||"",role:q(".crewRole")?.value||"Crew"});
   setTimeout(()=>load().catch(()=>{}),250);
 });

 $("raiseResourceRequest").onclick=async()=>{
   const btn=$("raiseResourceRequest");btn.disabled=true;btn.textContent="CREATING...";
   try{
     await command("createResourceRequest",{
       incidentId:inc.id,
       resourceType:$("resourceRequestType").value,
       type:$("resourceRequestType").value,
       priority:$("resourceRequestPriority").value,
       notes:$("resourceRequestNotes").value
     });
     $("resourceRequestNotes").value="";
     setTimeout(()=>load().catch(()=>{}),250);
   }finally{btn.disabled=false;btn.textContent="CREATE RESOURCE REQUEST";}
 };
}
function renderUnits(){
 const configured=[...new Set([...(state.callsigns||[]).map(upper),...Object.keys(state.units||{}).map(upper)])].sort();
 $("unitTable").innerHTML=`<div class="tableHead"><div>CALLSIGN</div><div>STATION</div><div>SKILL / TYPE</div><div>STATUS</div><div>LIVE</div></div>`+configured.map(cs=>`<div class="tableRow"><div><strong>${esc(cs)}</strong></div><div>${esc(stationFor(cs)||"—")}</div><div>${esc(skillText(state.applianceSkills?.[cs])||"—")}</div><div><span class="status ${statusClass(currentStatus(cs))}">${esc(currentStatus(cs))}</span></div><div>${state.units?.[cs]?"SIGNED ON":"OFF RUN"}</div></div>`).join("");
}
function renderCalls(){
 const calls=state.calls999||[];
 $("callsList").innerHTML=calls.length?calls.map(c=>{
   const idv=esc(c.id||"");
   const location=esc(c.location||c.address||"Location not supplied");
   const postal=esc(c.postal||c.postcode||"");
   const caller=esc(c.caller||c.name||"Unknown caller");
   const phone=esc(c.phone||c.telephone||"");
   const description=esc(c.description||c.details||c.message||"No further details supplied");
   const priority=esc(c.priority||"Immediate");
   return `<article class="callCard">
     <div class="callHead"><div><span class="panelKicker">INCOMING 999</span><strong>CALL #${idv}</strong></div><span class="callPriority">${priority}</span></div>
     <div class="callFacts"><div><span>LOCATION</span><b>${location}</b></div><div><span>POSTAL</span><b>${postal||"—"}</b></div><div><span>CALLER</span><b>${caller}</b></div><div><span>CONTACT</span><b>${phone||"—"}</b></div></div>
     <div class="callNarrative">${description}</div>
     <div class="callActions">
       <button class="secondary" data-dismiss-call="${idv}" ${pending999Dismissals.has(String(idv))?"disabled":""}>${pending999Dismissals.has(String(idv))?"DISMISSING...":"DISMISS"}</button>
       <button class="primary" data-call="${idv}" ${pending999Conversions.has(String(idv))?"disabled":""}>${pending999Conversions.has(String(idv))?"CREATING...":"CREATE INCIDENT"}</button>
     </div>
   </article>`;
 }).join(""):empty("999 queue clear");
 document.querySelectorAll("[data-call]").forEach(b=>b.onclick=async()=>{
   const callId=String(b.dataset.call||"");
   if(pending999Conversions.has(callId))return;
   pending999Conversions.add(callId);
   b.disabled=true;b.textContent="CREATING...";
   try{
     await command("createIncidentFrom999",{callId});
     setControlView("incidents");
     setTimeout(()=>load().catch(()=>{}),300);
   }catch(err){
     console.error(err);
     if(err?.status!==409) alert("Unable to create incident from this 999 call. The call has been left in the queue.");
     pending999Conversions.delete(callId);
   }
 });
 document.querySelectorAll("[data-dismiss-call]").forEach(b=>b.onclick=async()=>{
   const callId=String(b.dataset.dismissCall||"");
   if(pending999Dismissals.has(callId))return;
   if(!confirm(`Dismiss 999 call #${callId}?`))return;
   pending999Dismissals.add(callId);
   b.disabled=true;b.textContent="DISMISSING...";
   try{
     await command("dismiss999Call",{id:callId,callId,reason:"Dismissed by Web Control"});
     setTimeout(()=>load().catch(()=>{}),200);
   }catch(err){
     console.error(err);alert("Unable to dismiss the call.");
     pending999Dismissals.delete(callId);
   }
 });
}
function renderMessages(){
 $("messageTarget").innerHTML='<option value="ALL">All units</option>'+liveUnits().map(u=>`<option>${esc(u.callsign)}</option>`).join("");
 $("messageList").innerHTML=state.messages.length?state.messages.slice().reverse().map(m=>`<div class="message"><strong>${esc(m.sender||"CONTROL")}</strong><p>${esc(m.text||"")}</p><small>${esc(m.time||"")}</small></div>`).join(""):empty("No operational messages");
}
function renderStations(){
 const groups={};
 for(const cs of allConfiguredCallsigns()){
   const station=stationFor(cs)||"Unassigned / Command";
   (groups[station]=groups[station]||[]).push(cs);
 }
 const entries=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]));
 $("stationGrid").innerHTML=entries.length?entries.map(([st,list])=>{
   const rows=list.sort().map(cs=>{
     const status=currentStatus(cs);
     return `<div class="stationUnit">
       <div><strong>${esc(cs)}</strong><small>${esc(skillText(state.applianceSkills?.[cs])||"General Appliance")}</small></div>
       <span class="status ${statusClass(status)}">${esc(status)}</span>
     </div>`;
   }).join("");
   const live=list.filter(cs=>!!state.units?.[cs]).length;
   return `<article class="station stationFull">
     <header><div><span>FIRE STATION</span><strong>${esc(st)}</strong></div><b>${live}/${list.length} LIVE</b></header>
     <div class="stationUnits">${rows}</div>
     <footer>${list.length} configured appliance${list.length===1?"":"s"}</footer>
   </article>`;
 }).join(""):empty("No station configuration received");
}
function coverData(){
 const groups={};
 for(const cs of allConfiguredCallsigns()){
   const station=stationFor(cs)||"Unassigned / Command";
   (groups[station]=groups[station]||[]).push(cs);
 }
 return Object.entries(groups).map(([station,list])=>{
   const rows=list.map(cs=>({callsign:cs,status:currentStatus(cs),live:!!state.units?.[cs]}));
   const available=rows.filter(r=>/AVAILABLE|HOME STATION/i.test(r.status)).length;
   const mobile=rows.filter(r=>/MOBILE|ATTENDANCE|INCIDENT/i.test(r.status)).length;
   return {station,list,rows,available,mobile,live:rows.filter(r=>r.live).length,level:available===0?"red":available===1?"amber":"green"};
 }).sort((a,b)=>a.station.localeCompare(b.station));
}
function renderCover(){
 const summary=$("coverSummary"),suggestions=$("coverSuggestions"); if(!summary||!suggestions)return;
 const data=coverData();
 summary.innerHTML=data.length?data.map(s=>`<article class="coverCard ${s.level}"><header><div><span>STATION COVER</span><strong>${esc(s.station)}</strong></div><b>${s.available} AVAILABLE</b></header><div class="coverStats"><span>${s.live}/${s.list.length} live</span><span>${s.mobile} committed</span><span>${s.list.length} configured</span></div></article>`).join(""):empty("No station configuration received");
 const deficits=data.filter(s=>s.available===0);
 const donors=data.filter(s=>s.available>=2);
 const moves=[];
 for(const target of deficits){
   const donor=donors.sort((a,b)=>b.available-a.available)[0]; if(!donor)continue;
   const unit=donor.rows.find(r=>/AVAILABLE|HOME STATION/i.test(r.status)); if(!unit)continue;
   moves.push({unit:unit.callsign,from:donor.station,to:target.station});
 }
 suggestions.innerHTML=`
 <div class="sectionTitle"><span>Manual Standby Move</span><span class="small">Standby appliances remain available for emergency mobilisation</span></div>
 <div class="formGrid">
  <div class="field"><label>Appliance</label><select id="standbyUnit"><option value="">Select appliance...</option>${Object.entries(state.units||{}).filter(([cs,u])=>{const s=String(u.status||"").toLowerCase();return !u.incidentId&&!/off run|unavailable|mobile to incident|in attendance|on scene|committed/.test(s)}).map(([cs,u])=>`<option value="${esc(cs)}">${esc(cs)} — ${esc(u.status||"Available")}</option>`).join("")}</select></div>
  <div class="field"><label>Destination Station</label><select id="standbyDestination"><option value="">Select station...</option>${Object.keys(state.stations||{}).sort().map(st=>`<option value="${esc(st)}">${esc(st)}</option>`).join("")}</select></div>
  <div class="field" style="grid-column:1/-1"><label>Control Note</label><input id="standbyNote" placeholder="Maintain cover while another appliance is committed"></div>
  <div class="formActions" style="grid-column:1/-1"><button class="primary" id="sendStandbyMove">SEND STANDBY MOVE</button></div>
 </div>
 <div class="sectionTitle"><span>Active Standby Moves</span><span class="small">Real incidents automatically override standby</span></div>
 ${(state.standbyMoves||[]).filter(m=>!["cancelled","completed","superseded"].includes(m.state)).map(m=>`<div class="coverMove"><div class="rowMeta"><strong>${esc(m.callsign)} → ${esc(m.destination)}</strong><span>${esc(m.status||m.state)}${m.note?` · ${esc(m.note)}`:""}</span></div><div class="callActions"><button class="secondary" data-return-standby="${esc(m.id)}">RETURN HOME</button><button class="danger" data-cancel-standby="${esc(m.id)}">CANCEL</button></div></div>`).join("")||'<div class="emptyState"><strong>No active standby moves</strong></div>'}
 <div class="sectionTitle"><span>Standby Suggestions</span><span class="small">Based on current live cover</span></div>
 ${moves.length?moves.map(m=>`<div class="coverMove"><div class="rowMeta"><strong>${esc(m.unit)} → ${esc(m.to)}</strong><span>Suggested standby move from ${esc(m.from)}</span></div><button class="secondary" data-suggest-standby="${esc(m.unit)}" data-cover-target="${esc(m.to)}">USE SUGGESTION</button></div>`).join(""):'<div class="emptyState"><strong>No standby move suggested</strong><span>Current configured stations do not provide a clear donor appliance.</span></div>'}`;

 document.getElementById("sendStandbyMove")?.addEventListener("click",async()=>{
   const callsign=document.getElementById("standbyUnit")?.value||"";
   const destination=document.getElementById("standbyDestination")?.value||"";
   const note=document.getElementById("standbyNote")?.value||"";
   if(!callsign||!destination)return alert("Select an appliance and destination station.");
   try{await command("createStandbyMove",{callsign,destination,note});await load()}catch(e){alert(e.message||"Unable to send standby move")}
 });
 document.querySelectorAll("[data-suggest-standby]").forEach(b=>b.onclick=async()=>{
   try{await command("createStandbyMove",{callsign:b.dataset.suggestStandby,destination:b.dataset.coverTarget,note:"Standby move recommended by Guardian cover board"});await load()}catch(e){alert(e.message)}
 });
 document.querySelectorAll("[data-cancel-standby]").forEach(b=>b.onclick=async()=>{try{await command("cancelStandbyMove",{id:b.dataset.cancelStandby});await load()}catch(e){alert(e.message)}});
 document.querySelectorAll("[data-return-standby]").forEach(b=>b.onclick=async()=>{try{await command("returnStandbyMove",{id:b.dataset.returnStandby});await load()}catch(e){alert(e.message)}});

}
function renderMdt(){
 const callsigns=[...new Set([...(state.callsigns||[]).map(upper),...Object.keys(state.units||{}).map(upper)])].sort();
 const sel=$("mdtCallsign"),old=upper(mdtCallsign||sel.value);
 sel.innerHTML='<option value="">Select callsign</option>'+callsigns.map(cs=>`<option value="${esc(cs)}">${esc(cs)}${state.units?.[cs]?" · LIVE":""}</option>`).join("");
 if(old&&callsigns.includes(old)){sel.value=old;mdtCallsign=old}
 $("mdtTitle").textContent=mdtCallsign||"Select your callsign";$("mdtCurrentStatus").textContent=mdtCallsign?currentStatus(mdtCallsign):"UNSET";
 $("statusGrid").innerHTML=statusOptions.map(s=>`<button class="statusBtn ${selectedStatus===s?"selected":""}" data-status="${esc(s)}">${esc(s)}</button>`).join("");
 const assigned=mdtCallsign?state.incidents.filter(i=>assignedUnits(i).includes(upper(mdtCallsign))):[];
 $("mdtIncidentBadge").textContent=assigned.length;
 $("mdtIncidentList").innerHTML=assigned.length?assigned.map(i=>`<div class="incidentCard ${String(i.id)===String(selectedMdtIncidentId)?"active":""}" data-mdtincident="${esc(i.id)}"><strong>#${esc(i.id)} · ${esc(i.type||"Incident")}</strong><p>${esc(i.address||i.postal||"")}</p></div>`).join(""):'<div class="emptyState"><strong>No assigned incidents</strong><span>Mobilisations for this callsign will appear here.</span></div>';
 const inc=assigned.find(i=>String(i.id)===String(selectedMdtIncidentId));
 $("mdtIncidentDetail").innerHTML=inc?`<div class="incidentInfo"><span class="eyebrow">INCIDENT #${esc(inc.id)}</span><h2>${esc(inc.type||"Incident")}</h2><dl><dt>Address</dt><dd>${esc(inc.address||"—")}</dd><dt>Postal</dt><dd>${esc(inc.postal||"—")}</dd><dt>Priority</dt><dd>${esc(inc.priority||"—")}</dd><dt>Notes</dt><dd>${esc(inc.notes||"—")}</dd><dt>Assigned</dt><dd>${esc(assignedUnits(inc).join(", "))}</dd></dl><div class="actions"><button class="primary" id="mdtAck">ACKNOWLEDGE</button></div></div>`:'<div class="emptyState"><strong>No incident selected</strong><span>Click an assigned incident to view it. New incidents will not steal focus.</span></div>';
 $("mdtMessageList").innerHTML=state.messages.length?state.messages.slice().reverse().map(m=>`<div class="message"><strong>${esc(m.sender||"CONTROL")}</strong><p>${esc(m.text||"")}</p><small>${esc(m.time||"")}</small></div>`).join(""):empty("No messages");
 document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{selectedStatus=b.dataset.status;renderMdt()});
 document.querySelectorAll("[data-mdtincident]").forEach(b=>b.onclick=()=>{selectedMdtIncidentId=b.dataset.mdtincident;renderMdt()});
 $("mdtAck")&&($("mdtAck").onclick=()=>command("webMdtAck",{callsign:mdtCallsign,incidentId:inc.id}));
}
function openModal(){ $("incidentModal").classList.remove("hidden") } function closeModal(){ $("incidentModal").classList.add("hidden") }
document.addEventListener("click",e=>{
 const v=e.target.closest("[data-view]");if(v)setControlView(v.dataset.view);
 const j=e.target.closest("[data-jump]");if(j)setControlView(j.dataset.jump);
 const inc=e.target.closest("[data-incident]");if(inc){
   selectedIncidentId=inc.dataset.incident;
   renderIncidentList();
   renderIncidentDetail();
 }
 const mv=e.target.closest("[data-mdtview]");if(mv)setMdtView(mv.dataset.mdtview);
});
$("openCreate").onclick=$("openCreate2").onclick=openModal;$("closeModal").onclick=$("cancelCreate").onclick=closeModal;
$("createIncident").onclick=async()=>{await command("createIncident",{type:$("fType").value,address:$("fAddress").value,postal:$("fPostal").value,priority:$("fPriority").value,caller:$("fCaller").value,notes:$("fNotes").value,enableMDT:$("fMDT").checked,enableTurnout:$("fTurnout").checked,enablePager:$("fPager").checked});closeModal()};
$("sendMessage").onclick=async()=>{if(!$("messageText").value.trim())return;await command("sendMessage",{target:$("messageTarget").value,message:$("messageText").value.trim()});$("messageText").value=""};
$("mdtCallsign").onchange=()=>{mdtCallsign=upper($("mdtCallsign").value);localStorage.setItem("guardianMdtCallsign",mdtCallsign);selectedMdtIncidentId=null;renderMdt()};
$("sendStatus").onclick=()=>{if(!mdtCallsign)return alert("Select your callsign first.");if(!selectedStatus)return alert("Select a status first.");command("webMdtStatus",{callsign:mdtCallsign,status:selectedStatus})};
$("mdtSendMessage").onclick=async()=>{if(!mdtCallsign)return alert("Select your callsign first.");const t=$("mdtMessageText").value.trim();if(!t)return;await command("webMdtMessage",{callsign:mdtCallsign,message:t});$("mdtMessageText").value=""};
async function load(){try{const j=await (await fetch("/api/state",{cache:"no-store"})).json();if(j.state){state={...state,...j.state};render()}}catch(e){console.error(e)}}
function connect(){const es=new EventSource("/api/events");es.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==="state"){state={...state,...m.payload};render()}}catch(err){console.error(err)}}}
setMode();load();connect();
window.addEventListener("online",()=>load().catch?.(()=>{}));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)load();});


