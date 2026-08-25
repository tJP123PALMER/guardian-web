
const $=id=>document.getElementById(id);
let me=null,config=null,operational=null,active="overview";

async function api(url,opt={}){
  const r=await fetch(url,{cache:"no-store",headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setContent(html){$("content").innerHTML=html}
function errorView(title,e){setContent(`<div class="card errorCard"><h3>${esc(title)}</h3><p>${esc(e?.message||e||"Unknown error")}</p><button id="retryBtn">RETRY</button></div>`);$("retryBtn").onclick=refreshAll}
function notify(msg){const n=document.createElement("div");n.className="toast";n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2400)}

async function boot(){
  try{me=(await api("/api/admin/me")).user;showApp();await refreshAll()}
  catch(_){}
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
    const [c,o]=await Promise.all([api("/api/admin/config"),api("/api/admin/operational")]);
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
  const s=operational.summary||{};
  setContent(`<div class="grid stats">
    <div class="card"><div class="eyebrow">STATIONS</div><div class="big">${s.stations||0}</div><p>Configured operational stations</p></div>
    <div class="card"><div class="eyebrow">APPLIANCES</div><div class="big">${s.appliances||0}</div><p>Known Guardian callsigns</p></div>
    <div class="card"><div class="eyebrow">BOOKED ON</div><div class="big">${s.booked||0}</div><p>Current MDT bookings</p></div>
    <div class="card"><div class="eyebrow">OPEN INCIDENTS</div><div class="big">${s.incidents||0}</div><p>Currently active</p></div>
    <div class="card"><div class="eyebrow">999 QUEUE</div><div class="big">${s.calls999||0}</div><p>Awaiting Control action</p></div>
    <div class="card"><div class="eyebrow">STANDBY</div><div class="big">${s.standby||0}</div><p>Active standby moves</p></div>
    <div class="card wide"><div class="eyebrow">GUARDIAN CORE</div><h3>${esc(s.coreMode||"UNKNOWN")}</h3><p>FiveM: <b>${s.fivemConnected?"CONNECTED":"OFFLINE / OPTIONAL"}</b>${s.lastHeartbeat?` · Last heartbeat ${new Date(s.lastHeartbeat).toLocaleString()}`:""}</p></div>
  </div>`);
}

function renderStations(){
  const rows=(config.stations||[]).map((s,i)=>`<tr><td><input data-st-name="${i}" value="${esc(s.name)}"></td><td><input data-st-postal="${i}" value="${esc(s.postal||"")}"></td><td>${(operational.appliances||[]).filter(a=>a.station===s.name).map(a=>`<span class="pill">${esc(a.callsign)}</span>`).join(" ")||"—"}</td><td><label><input type="checkbox" data-st-active="${i}" ${s.active!==false?"checked":""}> Active</label></td><td><button class="danger" data-st-del="${i}">DELETE</button></td></tr>`).join("");
  setContent(`<div class="card"><div class="sectionHead"><div><h3>Stations</h3><p>These are the stations used by Guardian Control and MDT.</p></div><button id="addStation">ADD STATION</button></div><div class="tableWrap"><table><thead><tr><th>Station</th><th>Postal</th><th>Appliances</th><th>Status</th><th></th></tr></thead><tbody id="stationRows">${rows||`<tr><td colspan="5">No stations configured.</td></tr>`}</tbody></table></div><button id="saveStations">SAVE STATIONS</button></div>`);
  $("addStation").onclick=()=>{config.stations.push({name:"New Station",postal:"",active:true});renderStations()};
  document.querySelectorAll("[data-st-del]").forEach(b=>b.onclick=()=>{config.stations.splice(+b.dataset.stDel,1);renderStations()});
  $("saveStations").onclick=async()=>{
    config.stations.forEach((s,i)=>{s.name=document.querySelector(`[data-st-name="${i}"]`).value.trim();s.postal=document.querySelector(`[data-st-postal="${i}"]`).value.trim();s.active=document.querySelector(`[data-st-active="${i}"]`).checked});
    await api("/api/admin/stations",{method:"POST",body:JSON.stringify({stations:config.stations})});notify("Stations saved");await refreshAll()
  };
}

function renderAppliances(){
  const stations=(config.stations||[]).map(s=>s.name);
  const types=config.applianceTypes||[];
  const rows=(config.appliances||[]).map((a,i)=>`<tr>
    <td><input data-ap-cs="${i}" value="${esc(a.callsign)}"></td>
    <td><select data-ap-st="${i}"><option value="">—</option>${stations.map(x=>`<option ${x===a.station?"selected":""}>${esc(x)}</option>`).join("")}</select></td>
    <td><select data-ap-type="${i}">${types.map(x=>`<option ${x===a.type?"selected":""}>${esc(x)}</option>`).join("")}</select></td>
    <td><input data-ap-skills="${i}" value="${esc((a.skills||[]).join(", "))}" placeholder="BA, Aerial, Rescue"></td>
    <td>${esc(a.status||"—")}</td>
    <td><button class="danger" data-ap-del="${i}">DELETE</button></td></tr>`).join("");
  setContent(`<div class="card"><div class="sectionHead"><div><h3>Appliances</h3><p>Callsign, home station, type and skills used throughout Guardian.</p></div><button id="addAppliance">ADD APPLIANCE</button></div><div class="tableWrap"><table><thead><tr><th>Callsign</th><th>Home Station</th><th>Type</th><th>Skills</th><th>Live Status</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="6">No appliances found.</td></tr>`}</tbody></table></div><button id="saveAppliances">SAVE APPLIANCES</button></div>`);
  $("addAppliance").onclick=()=>{config.appliances.push({callsign:"NEW",station:stations[0]||"",type:types[0]||"Pump",skills:[],active:true});renderAppliances()};
  document.querySelectorAll("[data-ap-del]").forEach(b=>b.onclick=()=>{config.appliances.splice(+b.dataset.apDel,1);renderAppliances()});
  $("saveAppliances").onclick=async()=>{
    config.appliances.forEach((a,i)=>{a.callsign=document.querySelector(`[data-ap-cs="${i}"]`).value.trim().toUpperCase();a.station=document.querySelector(`[data-ap-st="${i}"]`).value;a.type=document.querySelector(`[data-ap-type="${i}"]`).value;a.skills=document.querySelector(`[data-ap-skills="${i}"]`).value.split(",").map(x=>x.trim()).filter(Boolean)});
    await api("/api/admin/appliances",{method:"POST",body:JSON.stringify({appliances:config.appliances})});notify("Appliances saved");await refreshAll()
  };
}

async function renderMap(){
  const locked=!!operational.stationMapLocked;
  setContent(`<div class="card"><div class="sectionHead"><div><h3>Station Map</h3><p>Station markers are managed here. Control Centre stations are read-only.</p></div><div><button id="lockMap">${locked?"UNLOCK STATIONS":"LOCK STATIONS"}</button></div></div><div class="mapHint">${locked?"Station positions are locked. Unlock before moving them.":"Drag a station marker, then save it."}</div><div id="stationMap" class="stationMapEditor"></div><div class="mapActions"><button id="saveMap">SAVE MOVED STATIONS</button><button id="resetMap">RESET SELECTED</button><select id="resetStation"><option value="">Select station…</option>${(config.stations||[]).map(s=>`<option>${esc(s.name)}</option>`).join("")}</select></div></div>`);
  const map=$("stationMap"),pending=new Map(),saved=operational.stationMapPositions||{};
  const defaults={};
  (config.stations||[]).forEach((st,i)=>{
    const key=String(st.name).trim().toLowerCase(),pos=saved[key]||saved[st.name]||{};
    let x=Number(pos.mapXPercent),y=Number(pos.mapYPercent);
    if(!Number.isFinite(x)||!Number.isFinite(y)){x=35+(i%3)*12;y=35+Math.floor(i/3)*12}
    const b=document.createElement("button");b.className="stationPin";b.type="button";b.style.left=x+"%";b.style.top=y+"%";b.innerHTML=`<span>FS</span><b>${esc(st.name)}</b>`;
    let drag=false;
    b.onpointerdown=e=>{if(locked)return;e.preventDefault();drag=true;b.setPointerCapture?.(e.pointerId);b.classList.add("dragging")};
    b.onpointermove=e=>{if(!drag)return;const r=map.getBoundingClientRect();x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));b.style.left=x+"%";b.style.top=y+"%";pending.set(st.name,{x,y})};
    b.onpointerup=()=>{drag=false;b.classList.remove("dragging")};b.onpointercancel=b.onpointerup;map.appendChild(b)
  });
  $("lockMap").onclick=async()=>{await api("/api/admin/station-map/lock",{method:"POST",body:JSON.stringify({locked:!locked})});await refreshAll()};
  $("saveMap").onclick=async()=>{for(const [stationName,p] of pending)await api("/api/admin/station-map/position",{method:"POST",body:JSON.stringify({stationName,mapXPercent:p.x,mapYPercent:p.y})});notify("Station positions saved");await refreshAll()};
  $("resetMap").onclick=async()=>{const name=$("resetStation").value;if(!name)return;await api("/api/admin/station-map/position/"+encodeURIComponent(name),{method:"DELETE"});notify("Station position reset");await refreshAll()};
}

function renderConfig(){
  const types=(config.applianceTypes||[]).join("\n"),skills=(config.skills||[]).join("\n"),statuses=(config.statuses||[]).join("\n");
  setContent(`<div class="grid two">
    <div class="card"><h3>Appliance Types</h3><p>One per line.</p><textarea id="cfgTypes" rows="10">${esc(types)}</textarea></div>
    <div class="card"><h3>Skills / Capabilities</h3><p>One per line.</p><textarea id="cfgSkills" rows="10">${esc(skills)}</textarea></div>
    <div class="card"><h3>Status Options</h3><p>Statuses available to Guardian.</p><textarea id="cfgStatuses" rows="13">${esc(statuses)}</textarea></div>
    <div class="card"><h3>Integration</h3><p><b>Current mode:</b> ${esc(operational.summary?.coreMode||"UNKNOWN")}</p><p>FiveM integration is optional. Guardian Core continues operating in standalone mode when FiveM is offline.</p></div>
  </div><div class="card"><button id="saveConfig">SAVE CONFIGURATION</button></div>`);
  $("saveConfig").onclick=async()=>{config.applianceTypes=$("cfgTypes").value.split("\n").map(x=>x.trim()).filter(Boolean);config.skills=$("cfgSkills").value.split("\n").map(x=>x.trim()).filter(Boolean);config.statuses=$("cfgStatuses").value.split("\n").map(x=>x.trim()).filter(Boolean);await api("/api/admin/config",{method:"POST",body:JSON.stringify({config})});notify("Configuration saved");await refreshAll()}
}

async function renderUsers(){
  setContent(`<div class="card"><h3>Users & Access</h3><div id="usersArea">Loading users…</div></div>`);
  try{
    const data=await api("/api/admin/users");
    $("usersArea").innerHTML=`<div class="createBar"><input id="newUser" placeholder="Username"><input id="newDisplay" placeholder="Display name"><input id="newPass" type="password" placeholder="Password 8+ chars"><select id="newRole"><option>admin</option><option>dev</option><option>readonly</option></select><button id="createUser">CREATE USER</button></div><div class="tableWrap"><table><thead><tr><th>User</th><th>Role</th><th>Created</th><th></th></tr></thead><tbody>${data.users.map(u=>`<tr><td><b>${esc(u.displayName||u.username)}</b><br><small>${esc(u.username)}</small></td><td><span class="badge ${u.role==="owner"?"owner":""}">${esc(u.role.toUpperCase())}</span></td><td>${u.createdAt?new Date(u.createdAt).toLocaleString():"—"}</td><td>${u.protected?"PROTECTED OWNER":`<button class="danger" data-user-del="${esc(u.username)}">DELETE</button>`}</td></tr>`).join("")}</tbody></table></div>`;
    $("createUser").onclick=async()=>{await api("/api/admin/users",{method:"POST",body:JSON.stringify({username:$("newUser").value,displayName:$("newDisplay").value,password:$("newPass").value,role:$("newRole").value})});notify("User created");renderUsers()};
    document.querySelectorAll("[data-user-del]").forEach(b=>b.onclick=async()=>{if(confirm(`Delete ${b.dataset.userDel}?`)){await api("/api/admin/users/"+encodeURIComponent(b.dataset.userDel),{method:"DELETE"});renderUsers()}})
  }catch(e){errorView("Users & Access",e)}
}

function renderBackup(){
  setContent(`<div class="grid two"><div class="card"><h3>Backup Guardian</h3><p>Download the current Guardian configuration as JSON.</p><button id="exportBtn">DOWNLOAD BACKUP</button></div><div class="card"><h3>Restore Guardian</h3><p>Paste a Guardian backup below.</p><textarea id="restoreData" rows="14" placeholder="Paste backup JSON"></textarea><button id="restoreBtn">RESTORE BACKUP</button></div></div>`);
  $("exportBtn").onclick=()=>location.href="/api/admin/export";
  $("restoreBtn").onclick=async()=>{if(!confirm("Restore this Guardian configuration?"))return;const data=JSON.parse($("restoreData").value);await api("/api/admin/import",{method:"POST",body:JSON.stringify(data)});notify("Backup restored");await refreshAll()}
}

async function renderAudit(){
  setContent(`<div class="card"><div class="sectionHead"><div><h3>Audit Log</h3><p>Administrative actions and sign-ins.</p></div><button id="refreshAudit">REFRESH</button></div><div id="auditArea">Loading audit log…</div></div>`);
  try{
    const a=(await api("/api/admin/audit")).audit||[];
    $("auditArea").innerHTML=a.length?`<div class="tableWrap"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>${a.map(x=>`<tr><td>${new Date(x.at).toLocaleString()}</td><td>${esc(x.actor)}</td><td>${esc(x.action)}</td><td><code>${esc(JSON.stringify(x.details||{}))}</code></td></tr>`).join("")}</tbody></table></div>`:`<p>No audit entries yet.</p>`;
    $("refreshAudit").onclick=renderAudit
  }catch(e){errorView("Audit Log",e)}
}
boot();
