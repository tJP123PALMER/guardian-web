let state={units:[],incidents:[],calls999:[],messages:[],connected:false};const $=id=>document.getElementById(id);
const pages={dashboard:["Dashboard","Live operational overview"],incidents:["Incidents","Live incidents received from Guardian Control."],calls:["999 Calls","Incoming calls awaiting control action."],units:["Units","Appliance and callsign status."],messages:["Messages","Shared Control ↔ MDT conversation."]};

function showPage(name){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===name));document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===name));$("pageTitle").textContent=pages[name][0];$("pageSubtitle").textContent=pages[name][1];render();}
document.addEventListener("click",e=>{const p=e.target.closest("[data-page]");if(p)showPage(p.dataset.page)});
function statusClass(s){if(/mobile|attendance/i.test(s))return"red";if(/available|station/i.test(s))return"green";return"grey"}
function render(){
 $("unitCount").textContent=state.units.length;$("incidentCount").textContent=state.incidents.filter(i=>i.status!=="Closed").length;$("callCount").textContent=state.calls999.length;$("liveState").textContent=state.connected?"ONLINE":"OFFLINE";
 $("connectionDot").className="dot "+(state.connected?"online":"offline");$("connectionText").textContent=state.connected?"FiveM connected":"Waiting for FiveM";$("lastUpdate").textContent=state.updatedAt?new Date(state.updatedAt).toLocaleTimeString():"No live update yet";
 $("dashboardUnits").innerHTML=state.units.slice(0,6).map(u=>`<div class="unitrow"><div><strong>${esc(u.callsign)}</strong><div class="muted">${esc(u.station||"")}</div></div><span class="badge ${statusClass(u.status)}">${esc(u.status)}</span></div>`).join("")||empty("No units received");
 $("dashboardIncidents").innerHTML=state.incidents.slice(0,6).map(i=>`<div class="incidentrow"><div><strong>#${i.id} · ${esc(i.type)}</strong><div class="muted">${esc(i.address||"")}</div></div><span class="badge">${(i.units||[]).length} units</span></div>`).join("")||empty("No active incidents");
 $("incidentTable").innerHTML=table(["ID","Type","Location","Units"],state.incidents.map(i=>[`#${i.id}`,esc(i.type),esc(i.address||i.postal||"—"),(i.units||[]).join(", ")||"None"]));
 $("unitsTable").innerHTML=table(["Callsign","Status","Station","Crew"],state.units.map(u=>[esc(u.callsign),`<span class="${statusClass(u.status)}">${esc(u.status)}</span>`,esc(u.station||"—"),u.crew??"—"]));
 $("callsTable").innerHTML=table(["ID","Type","Location","Time"],state.calls999.map(c=>[`#${c.id??"—"}`,esc(c.type||"999 Call"),esc(c.address||c.location||"—"),esc(c.time||"—")]));
 $("messagesList").innerHTML=state.messages.slice().reverse().map(m=>`<div class="messagerow"><div><strong>${esc(m.sender||"Control")}</strong><div>${esc(m.text||"")}</div></div><span class="muted">${esc(m.time||"")}</span></div>`).join("")||empty("No messages");
}
function table(head,rows){return `<div class="tablehead">${head.map(x=>`<div>${x}</div>`).join("")}</div>`+(rows.length?rows.map(r=>`<div class="tablerow">${r.map(x=>`<div>${x}</div>`).join("")}</div>`).join(""):`<div class="tablerow"><div>No data</div></div>`)}
function empty(x){return `<div class="muted" style="padding:25px 0">${x}</div>`}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function load(){try{const r=await fetch("/api/state");const j=await r.json();state=j.state;render()}catch(e){console.error(e)}}
function connect(){const es=new EventSource("/api/events");es.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="state"){state=m.payload;render()}};es.onerror=()=>{}}
$("refresh").onclick=load;$("newIncident").onclick=()=>$("modal").classList.remove("hidden");$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("createBtn").onclick=async()=>{await command("createIncident",{type:$("incType").value,postal:$("incPostal").value,address:$("incAddress").value,description:$("incDescription").value});$("modal").classList.add("hidden")};
$("sendMessage").onclick=async()=>{const input=$("messageInput");if(!input.value.trim())return;await command("sendMessage",{message:input.value.trim()});input.value=""};
async function command(action,data){const r=await fetch("/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data})});if(!r.ok)alert("Command could not be queued");}
load();connect();