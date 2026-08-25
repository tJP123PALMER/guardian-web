
const $=id=>document.getElementById(id);
let me=null,config=null,active="overview";

async function api(url,opt={}){
  const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
async function boot(){
  try{
    const d=await api("/api/admin/me");
    me=d.user;showApp();await loadConfig();
  }catch{}
}
$("loginBtn").onclick=async()=>{
  try{
    const d=await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("loginUser").value,password:$("loginPass").value})});
    me=d.user;$("loginError").textContent="";showApp();await loadConfig();
  }catch(e){$("loginError").textContent=e.message}
};
$("logoutBtn").onclick=async()=>{await api("/api/admin/logout",{method:"POST"});location.reload()};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");active=b.dataset.tab;$("pageTitle").textContent=b.textContent;render()});
function showApp(){
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("who").innerHTML=`${me.displayName||me.username} · <span class="badge ${me.role==="owner"?"owner":""}">${me.role.toUpperCase()}</span>`;
}
async function loadConfig(){config=(await api("/api/admin/config")).config;render()}
async function save(){await api("/api/admin/config",{method:"POST",body:JSON.stringify({config})});alert("Saved")}
function render(){
  if(!config)return;
  if(active==="overview")return renderOverview();
  if(active==="stations")return renderStations();
  if(active==="appliances")return renderAppliances();
  if(active==="map")return renderMap();
  if(active==="config")return renderConfig();
  if(active==="users")return renderUsers();
  if(active==="backup")return renderBackup();
  if(active==="audit")return renderAudit();
}
function renderOverview(){
  $("content").innerHTML=`<div class="grid">
    <div class="card"><h3>Stations</h3><b>${config.stations?.length||0}</b></div>
    <div class="card"><h3>Appliances</h3><b>${config.appliances?.length||0}</b></div>
    <div class="card"><h3>Access</h3><p>Owner / Creator account is protected.</p></div>
    <div class="card"><h3>Operational Map</h3><p>Station editing is managed here, not on the main Control map.</p></div>
  </div>`;
}
function renderStations(){
  $("content").innerHTML=`<div class="card"><h3>Stations</h3>
    <div class="row"><input id="stationName" placeholder="Station name"><input id="stationPostal" placeholder="Postal"><button id="addStation">ADD</button></div>
    <div id="stationList"></div><button id="saveStations">SAVE CHANGES</button></div>`;
  const list=$("stationList");
  (config.stations||[]).forEach((s,i)=>{const r=document.createElement("div");r.className="listRow";r.innerHTML=`<input value="${s.name||""}" data-i="${i}" data-k="name"><input value="${s.postal||""}" data-i="${i}" data-k="postal"><button data-del="${i}">DELETE</button>`;list.appendChild(r)});
  list.querySelectorAll("input").forEach(x=>x.oninput=()=>config.stations[+x.dataset.i][x.dataset.k]=x.value);
  list.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{config.stations.splice(+b.dataset.del,1);renderStations()});
  $("addStation").onclick=()=>{const n=$("stationName").value.trim(),p=$("stationPostal").value.trim();if(!n)return;config.stations||=[];config.stations.push({name:n,postal:p});renderStations()};
  $("saveStations").onclick=save;
}
function renderAppliances(){
  $("content").innerHTML=`<div class="card"><h3>Appliances / Callsigns</h3>
  <div class="row"><input id="appCs" placeholder="Callsign"><input id="appStation" placeholder="Home station"><select id="appType">${(config.applianceTypes||[]).map(x=>`<option>${x}</option>`).join("")}</select><button id="addApp">ADD</button></div>
  <div id="appList"></div><button id="saveApps">SAVE CHANGES</button></div>`;
  const list=$("appList");
  (config.appliances||[]).forEach((a,i)=>{const r=document.createElement("div");r.className="listRow";r.innerHTML=`<input value="${a.callsign||""}" data-i="${i}" data-k="callsign"><input value="${a.station||""}" data-i="${i}" data-k="station"><button data-del="${i}">DELETE</button>`;list.appendChild(r)});
  list.querySelectorAll("input").forEach(x=>x.oninput=()=>config.appliances[+x.dataset.i][x.dataset.k]=x.value);
  list.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{config.appliances.splice(+b.dataset.del,1);renderAppliances()});
  $("addApp").onclick=()=>{const c=$("appCs").value.trim().toUpperCase();if(!c)return;config.appliances||=[];config.appliances.push({callsign:c,station:$("appStation").value.trim(),type:$("appType").value});renderAppliances()};
  $("saveApps").onclick=save;
}
function renderMap(){
  $("content").innerHTML=`<div class="card"><h3>Station Map Editor</h3><p>Drag station markers here. Main Control map stays operational/read-only.</p><div id="stationMap" class="mapCanvas"></div><button id="saveMap">SAVE MAP POSITIONS</button></div>`;
  const canvas=$("stationMap");config.map||={stations:{}};config.map.stations||={};
  (config.stations||[]).forEach((s,i)=>{
    const pos=config.map.stations[s.name]||{x:50+(i%4)*4,y:50+Math.floor(i/4)*4};
    const m=document.createElement("div");m.className="stationMarker";m.textContent="FS";m.title=s.name;m.style.left=pos.x+"%";m.style.top=pos.y+"%";
    let dragging=false;
    m.onpointerdown=e=>{dragging=true;m.setPointerCapture?.(e.pointerId)};
    m.onpointermove=e=>{if(!dragging)return;const r=canvas.getBoundingClientRect();const x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));m.style.left=x+"%";m.style.top=y+"%";config.map.stations[s.name]={x,y}};
    m.onpointerup=()=>dragging=false;canvas.appendChild(m);
  });
  $("saveMap").onclick=save;
}
function renderConfig(){
  $("content").innerHTML=`<div class="grid">
    <div class="card"><h3>Appliance Types</h3><textarea id="types" rows="8">${(config.applianceTypes||[]).join("\n")}</textarea></div>
    <div class="card"><h3>Status Options</h3><textarea id="statuses" rows="12">${(config.statuses||[]).join("\n")}</textarea></div>
  </div><button id="saveConfig">SAVE CONFIGURATION</button>`;
  $("saveConfig").onclick=()=>{config.applianceTypes=$("types").value.split("\n").map(x=>x.trim()).filter(Boolean);config.statuses=$("statuses").value.split("\n").map(x=>x.trim()).filter(Boolean);save()};
}
async function renderUsers(){
  $("content").innerHTML=`<div class="card"><h3>Users & Access</h3><div class="row"><input id="newUser" placeholder="Username"><input id="newDisplay" placeholder="Display name"><input id="newPass" type="password" placeholder="Password 8+ chars"><select id="newRole"><option>admin</option><option>dev</option><option>readonly</option></select><button id="createUser">CREATE</button></div><div id="usersList">Loading...</div></div>`;
  const data=await api("/api/admin/users");const host=$("usersList");host.innerHTML="";
  data.users.forEach(u=>{const r=document.createElement("div");r.className="listRow";r.innerHTML=`<div><b>${u.displayName||u.username}</b><br><small>${u.username}</small></div><span class="badge ${u.role==="owner"?"owner":""}">${u.role.toUpperCase()}</span>${u.protected?`<span>PROTECTED OWNER</span>`:`<button data-del="${u.username}">DELETE</button>`}`;host.appendChild(r)});
  host.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Delete user?")){await api("/api/admin/users/"+encodeURIComponent(b.dataset.del),{method:"DELETE"});renderUsers()}});
  $("createUser").onclick=async()=>{await api("/api/admin/users",{method:"POST",body:JSON.stringify({username:$("newUser").value,displayName:$("newDisplay").value,password:$("newPass").value,role:$("newRole").value})});renderUsers()};
}
function renderBackup(){
  $("content").innerHTML=`<div class="grid"><div class="card"><h3>Export</h3><p>Download current Guardian configuration.</p><button id="exportBtn">DOWNLOAD BACKUP</button></div><div class="card"><h3>Restore</h3><textarea id="restoreData" rows="12" placeholder="Paste backup JSON"></textarea><button id="restoreBtn">RESTORE</button></div></div>`;
  $("exportBtn").onclick=()=>location.href="/api/admin/export";
  $("restoreBtn").onclick=async()=>{const data=JSON.parse($("restoreData").value);await api("/api/admin/import",{method:"POST",body:JSON.stringify(data)});await loadConfig()};
}
async function renderAudit(){
  $("content").innerHTML=`<div class="card"><h3>Audit Log</h3><div id="auditList">Loading...</div></div>`;
  const a=(await api("/api/admin/audit")).audit;$("auditList").innerHTML=a.map(x=>`<div class="listRow"><span>${new Date(x.at).toLocaleString()}</span><b>${x.actor}</b><span>${x.action}</span></div>`).join("");
}
boot();
