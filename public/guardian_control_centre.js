/* Guardian FiveM Operations + Discord Tickets add-on */
(()=>{
 const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const req=async(url,opt={})=>{const r=await fetch(url,{credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`Request failed (${r.status})`);return d};
 const note=(msg,bad=false)=>{const n=document.createElement("div");n.className="gctlNotice"+(bad?" bad":"");n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),4000)};
 const dt=v=>v?new Date(v).toLocaleString():"Never";
 const dur=v=>{v=Math.max(0,Number(v)||0);const d=Math.floor(v/86400),h=Math.floor(v%86400/3600),m=Math.floor(v%3600/60);return d?`${d}d ${h}h ${m}m`:`${h}h ${m}m`};
 const statusBadge=(ok,text)=>`<span class="gctlBadge ${ok?'good':'bad'}">${E(text)}</span>`;
 window.renderGuardianFiveM=async function(){
  const c=document.getElementById("content");c.innerHTML='<div class="card"><h3>Loading FiveM Operations…</h3></div>';
  try{
   const d=await req("/api/admin/fivem/monitor"),m=d.metrics||{},players=Array.isArray(d.players)?d.players:[],resources=Array.isArray(d.resources)?d.resources:[];
   c.innerHTML=`<div class="gctlWrap">
    <div class="gctlHeader"><div><div class="eyebrow">GUARDIAN OPERATIONS</div><h2>FiveM Control Centre</h2><p>Live monitoring and authorised server actions.</p></div><div>${statusBadge(d.connected,d.connected?"BRIDGE CONNECTED":"BRIDGE OFFLINE")} <button id="gctlRefresh">Refresh</button></div></div>
    <div class="gctlStats">
     <div class="card"><small>SERVER STATUS</small><strong>${d.connected?"ONLINE":"OFFLINE"}</strong><span>Heartbeat: ${E(dt(d.lastHeartbeat))}</span></div>
     <div class="card"><small>PLAYERS</small><strong>${Number(m.playerCount??players.length)} / ${Number(m.maxPlayers||0)||"—"}</strong><span>Live connected players</span></div>
     <div class="card"><small>SERVER UPTIME</small><strong>${m.uptimeSeconds!=null?E(dur(m.uptimeSeconds)):"—"}</strong><span>Since resource/server start</span></div>
     <div class="card"><small>RESOURCES</small><strong>${resources.length}</strong><span>${resources.filter(r=>r.state==="started").length} started</span></div>
    </div>
    <div class="gctlCols">
     <section class="card"><div class="gctlSection"><div><h3>Live Players</h3><p>Kick actions require a reason and are recorded in the audit log.</p></div><input id="gctlPlayerSearch" placeholder="Search players…"></div>
      <div class="gctlTableWrap"><table class="gctlTable"><thead><tr><th>ID</th><th>Player</th><th>Ping</th><th>Action</th></tr></thead><tbody id="gctlPlayers">${players.map(p=>`<tr data-player="${E((p.name||"")+" "+p.serverId)}"><td>${E(p.serverId)}</td><td>${E(p.name)}</td><td>${E(p.ping)} ms</td><td><button class="danger" data-kick="${E(p.serverId)}">Kick</button></td></tr>`).join("")||'<tr><td colspan="4" class="muted">No live player data. Check that the Guardian FiveM resource is installed and running.</td></tr>'}</tbody></table></div>
     </section>
     <section class="card"><div class="gctlSection"><div><h3>Resource Management</h3><p>Critical resources are protected by the FiveM bridge.</p></div><input id="gctlResourceSearch" placeholder="Search resources…"></div>
      <div class="gctlTableWrap"><table class="gctlTable"><thead><tr><th>Resource</th><th>Status</th><th>Actions</th></tr></thead><tbody id="gctlResources">${resources.map(r=>`<tr data-resource="${E(r.name)}"><td>${E(r.name)}</td><td>${statusBadge(r.state==="started",r.state||"unknown")}</td><td><div class="gctlButtons"><button data-resource-action="startResource" data-resource="${E(r.name)}">Start</button><button data-resource-action="restartResource" data-resource="${E(r.name)}">Restart</button><button class="danger" data-resource-action="stopResource" data-resource="${E(r.name)}">Stop</button></div></td></tr>`).join("")||'<tr><td colspan="3" class="muted">No resource telemetry received.</td></tr>'}</tbody></table></div>
     </section>
    </div>
    <section class="card"><div class="gctlSection"><div><h3>Restart Management</h3><p>Use txAdmin for actual server restart scheduling. Guardian can display a schedule and notify Discord, but a server restart must be explicitly connected to a supported txAdmin control.</p></div></div>
     <div class="gctlRestart"><label>Next scheduled restart (local time)<input id="gctlRestartAt" type="datetime-local"></label><label>Announcement channel ID (optional)<input id="gctlRestartChannel" placeholder="Discord channel ID"></label><button id="gctlSaveRestart">Save schedule</button><button id="gctlNotifyRestart">Send test announcement</button></div><p id="gctlRestartInfo" class="muted">Schedule is stored in Guardian. Configure the actual restart in txAdmin unless your host provides a supported restart API.</p>
    </section>
   </div>`;
   const saved=await req("/api/admin/fivem/restart-schedule").catch(()=>({schedule:{}}));if(saved.schedule?.at)document.getElementById("gctlRestartAt").value=saved.schedule.at; if(saved.schedule?.channelId)document.getElementById("gctlRestartChannel").value=saved.schedule.channelId;
   document.getElementById("gctlRefresh").onclick=()=>window.renderGuardianFiveM();
   document.getElementById("gctlPlayerSearch").oninput=e=>document.querySelectorAll("#gctlPlayers tr[data-player]").forEach(r=>r.hidden=!r.dataset.player.toLowerCase().includes(e.target.value.toLowerCase()));
   document.getElementById("gctlResourceSearch").oninput=e=>document.querySelectorAll("#gctlResources tr[data-resource]").forEach(r=>r.hidden=!r.dataset.resource.toLowerCase().includes(e.target.value.toLowerCase()));
   document.querySelectorAll("[data-kick]").forEach(b=>b.onclick=async()=>{const reason=prompt(`Reason for kicking player ${b.dataset.kick}:`);if(!reason?.trim())return; if(!confirm(`Kick player ${b.dataset.kick}?`))return;try{await req("/api/admin/fivem/action",{method:"POST",body:JSON.stringify({operation:"kickPlayer",data:{serverId:Number(b.dataset.kick),reason}})});note("Kick command sent to FiveM bridge.");}catch(e){note(e.message,true)}});
   document.querySelectorAll("[data-resource-action]").forEach(b=>b.onclick=async()=>{const op=b.dataset.resourceAction,name=b.dataset.resource;if(!confirm(`${op.replace("Resource","")} resource "${name}"?`))return;try{await req("/api/admin/fivem/action",{method:"POST",body:JSON.stringify({operation:op,data:{resource:name}})});note("Resource command sent. Refresh to verify status.");}catch(e){note(e.message,true)}});
   document.getElementById("gctlSaveRestart").onclick=async()=>{try{const at=document.getElementById("gctlRestartAt").value,channelId=document.getElementById("gctlRestartChannel").value.trim();await req("/api/admin/fivem/restart-schedule",{method:"POST",body:JSON.stringify({at,channelId})});note("Restart schedule saved in Guardian.");}catch(e){note(e.message,true)}};
   document.getElementById("gctlNotifyRestart").onclick=async()=>{try{await req("/api/admin/fivem/restart-schedule/announce",{method:"POST",body:JSON.stringify({channelId:document.getElementById("gctlRestartChannel").value.trim(),message:"Guardian test: server restart announcement integration check."})});note("Test announcement sent.");}catch(e){note(e.message,true)}};
  }catch(e){c.innerHTML=`<div class="card"><h3>FiveM Control Centre unavailable</h3><p>${E(e.message)}</p><button onclick="renderGuardianFiveM()">Retry</button></div>`}
 };
 window.renderGuardianTickets=async function(){
  const c=document.getElementById("content");c.innerHTML='<div class="card"><h3>Loading Discord Tickets…</h3></div>';
  try{
   const d=await req("/api/admin/tickets"),tickets=d.tickets||[];
   c.innerHTML=`<div class="gctlWrap"><div class="gctlHeader"><div><div class="eyebrow">COMMUNITY SUPPORT</div><h2>Discord Tickets</h2><p>Tickets opened in Discord are shared with this dashboard.</p></div>${statusBadge(d.discordConnected,"Discord "+(d.discordConnected?"connected":"disconnected"))}</div>
   <div class="gctlTicketSetup card"><div><h3>Publish ticket panel</h3><p>Enter a Discord text-channel ID where members can open private tickets.</p></div><div class="gctlInline"><input id="gctlPanelChannel" placeholder="Discord channel ID"><button id="gctlPostPanel">Post ticket panel</button></div><small>Requires a connected bot with permission to view/send messages and manage channels.</small></div>
   <div class="gctlSection"><input id="gctlTicketSearch" placeholder="Search tickets…" /><select id="gctlTicketStatus"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="closed">Closed</option></select><button id="gctlTicketRefresh">Refresh</button></div>
   <div class="gctlTicketLayout"><section class="card"><div class="gctlTableWrap"><table class="gctlTable"><thead><tr><th>Ticket</th><th>Category</th><th>Status</th><th>Assigned</th></tr></thead><tbody id="gctlTicketRows">${tickets.map(t=>`<tr class="gctlTicketRow" data-id="${E(t.id)}" data-search="${E(`${t.number} ${t.title} ${t.createdByName} ${t.category}`.toLowerCase())}" data-status="${E(t.status)}"><td><b>${E(t.number)}</b><br><small>${E(t.createdByName||"Unknown")}</small></td><td>${E(t.title)}</td><td>${E(t.status)}</td><td>${E(t.assignedTo||"Unassigned")}</td></tr>`).join("")||'<tr><td colspan="4" class="muted">No tickets yet. Post the Discord panel to get started.</td></tr>'}</tbody></table></div></section><section class="card" id="gctlTicketDetail"><div class="gctlEmpty">Select a ticket to view its conversation.</div></section></div></div>`;
   document.getElementById("gctlPostPanel").onclick=async()=>{const channelId=document.getElementById("gctlPanelChannel").value.trim();if(!channelId)return note("Enter a Discord channel ID.",true);try{await req("/api/admin/tickets/panel",{method:"POST",body:JSON.stringify({channelId})});note("Discord ticket panel posted.");}catch(e){note(e.message,true)}};
   document.getElementById("gctlTicketRefresh").onclick=()=>window.renderGuardianTickets();
   const filter=()=>{const q=document.getElementById("gctlTicketSearch").value.toLowerCase(),st=document.getElementById("gctlTicketStatus").value;document.querySelectorAll(".gctlTicketRow").forEach(r=>r.hidden=!(r.dataset.search.includes(q)&&(!st||r.dataset.status===st)))};
   document.getElementById("gctlTicketSearch").oninput=filter;document.getElementById("gctlTicketStatus").onchange=filter;
   document.querySelectorAll(".gctlTicketRow").forEach(r=>r.onclick=()=>showTicket(r.dataset.id));
   async function showTicket(id){
    const t=(await req("/api/admin/tickets")).tickets.find(x=>x.id===id);if(!t)return;
    const box=document.getElementById("gctlTicketDetail");
    box.innerHTML=`<div class="gctlTicketDetailHead"><div><div class="eyebrow">${E(t.number)}</div><h3>${E(t.title)}</h3><p>Opened by ${E(t.createdByName)} · ${E(dt(t.createdAt))}</p></div><select id="gctlStatus">${["open","in_progress","waiting","closed"].map(x=>`<option value="${x}" ${x===t.status?"selected":""}>${x.replace("_"," ")}</option>`).join("")}</select></div>
    <div class="gctlAssign"><label>Assigned staff<input id="gctlAssigned" value="${E(t.assignedTo||"")}" placeholder="Staff username"></label><button id="gctlAssignBtn">Save assignment</button></div>
    <div class="gctlMessages">${(t.messages||[]).map(m=>`<article class="gctlMessage ${m.source==="website"?"staff":""}"><header>${E(m.authorName||"Unknown")} · ${E(m.source||"discord")} · ${E(dt(m.createdAt))}</header><p>${E(m.content||"(attachment)")}</p>${(m.attachments||[]).map(a=>`<a href="${E(a.url)}" target="_blank" rel="noopener">${E(a.name||"Attachment")}</a>`).join(" ")}</article>`).join("")||'<p class="muted">No messages recorded yet. Incoming Discord message capture requires the Message Content intent to be enabled for the bot.</p>'}</div>
    <form id="gctlReplyForm"><textarea id="gctlReply" maxlength="4000" placeholder="Reply to the ticket…"></textarea><button>Send reply</button></form>`;
    box.querySelector("#gctlStatus").onchange=async e=>{try{await req(`/api/admin/tickets/${id}/status`,{method:"POST",body:JSON.stringify({status:e.target.value})});note("Ticket status updated.");}catch(err){note(err.message,true)}};
    box.querySelector("#gctlAssignBtn").onclick=async()=>{try{await req(`/api/admin/tickets/${id}/assign`,{method:"POST",body:JSON.stringify({assignedTo:box.querySelector("#gctlAssigned").value})});note("Ticket assigned.");}catch(e){note(e.message,true)}};
    box.querySelector("#gctlReplyForm").onsubmit=async e=>{e.preventDefault();const input=box.querySelector("#gctlReply"),content=input.value.trim();if(!content)return;try{await req(`/api/admin/tickets/${id}/messages`,{method:"POST",body:JSON.stringify({content})});note("Reply sent.");await showTicket(id)}catch(err){note(err.message,true)}};
   }
  }catch(e){c.innerHTML=`<div class="card"><h3>Ticket system unavailable</h3><p>${E(e.message)}</p><button onclick="renderGuardianTickets()">Retry</button></div>`}
 };
})();
