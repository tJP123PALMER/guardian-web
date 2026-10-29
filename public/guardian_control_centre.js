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
 let guardianTicketAvailableRoles=[];
 let guardianTicketRolesLoaded=false;
 const ticketCategoryRow=cat=>{
  const savedRoleIds=Array.isArray(cat?.accessRoleIds)?cat.accessRoleIds.map(String):[];
  const selected=new Set(savedRoleIds);
  const roleOptions=guardianTicketRolesLoaded
   ?(guardianTicketAvailableRoles.map(role=>`<label class="gctlTicketRoleOption"><input type="checkbox" data-cat-role value="${E(role.id)}" ${selected.has(String(role.id))?"checked":""}><span class="gctlTicketRoleDot" style="--ticket-role-colour:${E(role.color||"#687078")}"></span><span>${E(role.name)}</span></label>`).join("")||'<small class="muted">No selectable roles found in this Discord server.</small>')
   :`<small class="muted">${savedRoleIds.length?`Saved role IDs: ${E(savedRoleIds.join(", "))}. `:""}Click “Load Discord Roles” to choose one or more roles.</small>`;
  return `<div class="gctlCategoryEditorRow" data-cat-saved-role-ids="${E(savedRoleIds.join(","))}">
   <div class="gctlCategoryFields">
    <label>Category name<input data-cat-label value="${E(cat?.label||"")}" maxlength="80" placeholder="e.g. Whitelist Application"></label>
    <label>Button ID<input data-cat-key value="${E(cat?.key||"")}" maxlength="40" placeholder="auto-generated-from-name"></label>
    <label>Button colour<select data-cat-style><option value="Primary" ${cat?.style==="Primary"?"selected":""}>Blue</option><option value="Secondary" ${!cat?.style||cat?.style==="Secondary"?"selected":""}>Grey</option><option value="Success" ${cat?.style==="Success"?"selected":""}>Green</option><option value="Danger" ${cat?.style==="Danger"?"selected":""}>Red</option></select></label>
    <label>Default priority<select data-cat-priority><option value="normal" ${cat?.priority!=="high"?"selected":""}>Normal</option><option value="high" ${cat?.priority==="high"?"selected":""}>High</option></select></label>
    <button type="button" class="danger gctlRemoveCategory">Remove</button>
   </div>
   <div class="gctlCategoryRoleAccess"><div class="gctlRoleAccessHeading"><strong>Roles allowed to access these tickets</strong><small>Selected roles can view and reply in the private ticket, and use the close button. Global ticket staff roles still have access to every ticket. This does not restrict who can see the public panel.</small></div><div class="gctlTicketRoleOptions" data-cat-roles>${roleOptions}</div></div>
  </div>`;
 };
 window.renderGuardianTickets=async function(){
  const c=document.getElementById("content");c.innerHTML='<div class="card"><h3>Loading Discord Tickets…</h3></div>';
  try{
   const d=await req("/api/admin/tickets"),tickets=d.tickets||[],categories=Array.isArray(d.categories)?d.categories:[];
   const categoryByKey=new Map(categories.map(x=>[String(x.key),x]));
   const loggedCategoryKeys=[...new Set([...categories.map(x=>String(x.key||"")),...tickets.map(t=>String(t.category||""))].filter(Boolean))];
   const loggedCategories=loggedCategoryKeys.map(key=>({key,label:categoryByKey.get(key)?.label||tickets.find(t=>String(t.category||"")===key)?.categoryLabel||tickets.find(t=>String(t.category||"")===key)?.title||key}));
   c.innerHTML=`<div class="gctlWrap"><div class="gctlHeader"><div><div class="eyebrow">COMMUNITY SUPPORT</div><h2>Discord Tickets</h2><p>Tickets opened in Discord are shared with this dashboard. Closed tickets are archived here with their transcript after the Discord channel is deleted.</p></div>${statusBadge(d.discordConnected,"Discord "+(d.discordConnected?"connected":"disconnected"))}</div>
   <div class="gctlTicketSetup card"><div><h3>Publish ticket panel</h3><p>Enter the Discord text channel where members will see the ticket buttons.</p></div><div class="gctlInline"><input id="gctlPanelChannel" value="${E(d.panel?.channelId||"")}" placeholder="Discord channel ID"><button type="button" id="gctlLoadRoles">Load Discord Roles</button><button id="gctlPostPanel">Post / Update Panel</button></div><small id="gctlRoleLoadStatus" class="muted">Load roles from the Discord server, choose the roles allowed into each private ticket, then save categories and publish the panel. The panel stays public; these roles control access after a ticket is opened.</small></div>
   <section class="card gctlCategoryManager"><div class="gctlSection"><div><h3>Ticket Categories</h3><p>Add, rename, recolour, set default priority, and choose which Discord roles can access tickets from each button.</p></div><span class="gctlBadge">${categories.length} / 25 categories</span></div>
    <div id="gctlCategoryList" class="gctlCategoryList">${categories.map(ticketCategoryRow).join("")}</div>
    <div class="gctlCategoryActions"><button type="button" id="gctlAddCategory">+ Add category</button><button type="button" id="gctlSaveCategories">Save categories</button></div>
    <small class="muted">Save categories before testing. Role access applies to newly created tickets; changing the category does not change permissions on existing ticket channels. Global ticket staff roles remain able to access every ticket. Reposting updates the visible Discord buttons when possible.</small>
   </section>
   <div class="gctlTicketFilters"><input id="gctlTicketSearch" placeholder="Search ticket number, player name or ID…" /><select id="gctlTicketCategory"><option value="">All categories</option>${loggedCategories.map(x=>`<option value="${E(x.key)}">${E(x.label)}</option>`).join("")}</select><select id="gctlTicketSource"><option value="">All sources</option><option value="discord">Discord</option><option value="fivem">FiveM / In-game</option><option value="website">Website</option></select><select id="gctlTicketStatus"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="closed">Closed / Archived</option></select><button id="gctlTicketRefresh">Refresh</button></div>
   <div class="gctlTicketLayout"><section class="card"><div class="gctlTableWrap"><table class="gctlTable"><thead><tr><th>Ticket</th><th>Player / Creator</th><th>Category</th><th>Source</th><th>Status</th><th>Assigned</th></tr></thead><tbody id="gctlTicketRows">${tickets.map(t=>{const cat=categoryByKey.get(String(t.category||""));const categoryLabel=t.categoryLabel||cat?.label||t.title||t.category||"Uncategorised";const source=t.source||"discord";return `<tr class="gctlTicketRow" data-id="${E(t.id)}" data-search="${E(`${t.number} ${t.title} ${categoryLabel} ${t.createdByName||""} ${t.createdByDiscordId||""} ${source}`.toLowerCase())}" data-status="${E(t.status)}" data-category="${E(t.category||"")}" data-source="${E(source)}"><td><b>${E(t.number)}</b>${t.channelDeleted?'<br><small class="gctlArchivedLabel">Archived transcript</small>':''}</td><td>${E(t.createdByName||"Unknown")}<br><small>${E(t.createdByType||"player")} · ${E(t.createdByDiscordId||"no Discord ID")}</small></td><td>${E(categoryLabel)}</td><td>${E(source==="fivem"?"FiveM / In-game":source.charAt(0).toUpperCase()+source.slice(1))}</td><td>${E(t.status)}${t.channelDeleted?" · archived":""}</td><td>${E(t.assignedTo||"Unassigned")}</td></tr>`}).join("")||'<tr><td colspan="6" class="muted">No tickets yet. Post the Discord panel to get started.</td></tr>'}</tbody></table></div></section><section class="card" id="gctlTicketDetail"><div class="gctlEmpty">Select a ticket to view its conversation.</div></section></div></div>`;
   const readTicketCategoryRows=()=>[...document.querySelectorAll("#gctlCategoryList .gctlCategoryEditorRow")].map(row=>({
    label:row.querySelector("[data-cat-label]").value.trim(),
    key:row.querySelector("[data-cat-key]").value.trim(),
    style:row.querySelector("[data-cat-style]").value,
    priority:row.querySelector("[data-cat-priority]").value,
    accessRoleIds:guardianTicketRolesLoaded?[...row.querySelectorAll("[data-cat-role]:checked")].map(el=>el.value):String(row.dataset.catSavedRoleIds||"").split(",").map(x=>x.trim()).filter(Boolean)
   }));
   const loadTicketRoles=async(quiet=false)=>{
    const status=document.getElementById("gctlRoleLoadStatus");
    const button=document.getElementById("gctlLoadRoles");
    const previousRows=readTicketCategoryRows();
    const channelId=document.getElementById("gctlPanelChannel").value.trim();
    if(button)button.disabled=true;
    if(status)status.textContent="Loading roles from Discord…";
    try{
     const endpoint="/api/admin/tickets/roles"+(channelId?`?channelId=${encodeURIComponent(channelId)}`:"");
     const data=await req(endpoint);
     guardianTicketAvailableRoles=Array.isArray(data.roles)?data.roles:[];
     guardianTicketRolesLoaded=true;
     const list=document.getElementById("gctlCategoryList");
     if(list)list.innerHTML=previousRows.map(ticketCategoryRow).join("");
     if(status)status.textContent=`Loaded ${guardianTicketAvailableRoles.length} roles from ${data.guild?.name||"your Discord server"}. Select one or more roles under each category, then click Save categories.`;
     if(!quiet)note(`Loaded ${guardianTicketAvailableRoles.length} Discord roles.`);
    }catch(e){
     if(status)status.textContent="Could not load Discord roles: "+e.message;
     if(!quiet)note(e.message,true);
    }finally{if(button)button.disabled=false;}
   };
   document.getElementById("gctlLoadRoles").onclick=()=>loadTicketRoles(false);
   document.getElementById("gctlPostPanel").onclick=async()=>{const channelId=document.getElementById("gctlPanelChannel").value.trim();if(!channelId)return note("Enter a Discord channel ID.",true);try{const result=await req("/api/admin/tickets/panel",{method:"POST",body:JSON.stringify({channelId})});note(result.updated?"Discord ticket panel updated.":"Discord ticket panel posted.");}catch(e){note(e.message,true)}};
   document.getElementById("gctlAddCategory").onclick=()=>{const list=document.getElementById("gctlCategoryList");if(list.querySelectorAll(".gctlCategoryEditorRow").length>=25)return note("Discord supports up to 25 categories in this panel.",true);list.insertAdjacentHTML("beforeend",ticketCategoryRow({label:"",key:"",style:"Secondary",priority:"normal",accessRoleIds:[]}));};
   document.getElementById("gctlCategoryList").onclick=e=>{const b=e.target.closest(".gctlRemoveCategory");if(b)b.closest(".gctlCategoryEditorRow")?.remove()};
   document.getElementById("gctlSaveCategories").onclick=async()=>{const categoryRows=readTicketCategoryRows();try{const result=await req("/api/admin/tickets/categories",{method:"POST",body:JSON.stringify({categories:categoryRows})});if(result.panelUpdated)note("Categories and role access saved; Discord panel updated.");else if(result.panelWarning)note("Categories saved, but panel update failed: "+result.panelWarning,true);else note("Categories and role access saved. Post / Update Panel to publish the buttons.");await window.renderGuardianTickets();}catch(e){note(e.message,true)}};
   if(!guardianTicketRolesLoaded)setTimeout(()=>loadTicketRoles(true),0);
   document.getElementById("gctlTicketRefresh").onclick=()=>window.renderGuardianTickets();
   const filter=()=>{const q=document.getElementById("gctlTicketSearch").value.toLowerCase(),st=document.getElementById("gctlTicketStatus").value,cat=document.getElementById("gctlTicketCategory").value,src=document.getElementById("gctlTicketSource").value;document.querySelectorAll(".gctlTicketRow").forEach(r=>r.hidden=!(r.dataset.search.includes(q)&&(!st||r.dataset.status===st)&&(!cat||r.dataset.category===cat)&&(!src||r.dataset.source===src)))};
   document.getElementById("gctlTicketSearch").oninput=filter;document.getElementById("gctlTicketStatus").onchange=filter;document.getElementById("gctlTicketCategory").onchange=filter;document.getElementById("gctlTicketSource").onchange=filter;
   document.querySelectorAll(".gctlTicketRow").forEach(r=>r.onclick=()=>showTicket(r.dataset.id));
   async function showTicket(id){
    const t=(await req("/api/admin/tickets")).tickets.find(x=>x.id===id);if(!t)return;
    const box=document.getElementById("gctlTicketDetail");
    const categoryInfo=categories.find(x=>x.key===t.category);
    const categoryLabel=t.categoryLabel||categoryInfo?.label||t.title||t.category||"Uncategorised";
    const sourceLabel=(t.source||"discord")==="fivem"?"FiveM / In-game":(t.source||"discord").charAt(0).toUpperCase()+(t.source||"discord").slice(1);
    const statusControl=t.status==="closed"?`<select id="gctlStatus" disabled><option value="closed" selected>Closed / archived</option></select>`:`<select id="gctlStatus">${["open","in_progress","waiting","closed"].map(x=>`<option value="${x}" ${x===t.status?"selected":""}>${x.replace("_"," ")}</option>`).join("")}</select>`;
    box.innerHTML=`<div class="gctlTicketDetailHead"><div><div class="eyebrow">${E(t.number)} · ${E(categoryLabel)}</div><h3>${E(t.title||categoryLabel)}</h3><p>Created by <strong>${E(t.createdByName||"Unknown player")}</strong> (${E(t.createdByType||"player")}) · ${E(sourceLabel)} · ${E(dt(t.createdAt))}</p><p>Discord user ID: ${E(t.createdByDiscordId||"Not available")} · Priority: ${E(String(t.priority||"normal").toUpperCase())}</p>${t.respondingTeam?`<p>Responding team: ${E(t.respondingTeam)}</p>`:""}</div>${statusControl}</div>
    <div class="gctlAssign"><label>Assigned staff<input id="gctlAssigned" value="${E(t.assignedTo||"")}" placeholder="Staff username" ${t.status==="closed"?"disabled":""}></label><button id="gctlAssignBtn" ${t.status==="closed"?"disabled":""}>Save assignment</button></div>
    ${t.channelDeleted?`<div class="gctlArchiveNotice"><strong>Archived ticket record</strong><span>${t.transcriptCaptureComplete?"The Discord channel was deleted after Guardian captured its message history. The transcript is retained below.":"The Discord channel was already missing, so Guardian could not download its full history. Only messages previously saved to Guardian are available below."}</span><small>Closed by ${E(t.closedBy||t.channelDeletedBy||"Unknown")} · ${E(dt(t.closedAt||t.channelDeletedAt))}${t.transcriptCaptureComplete?` · ${Number(t.transcriptMessageCount||0)} Discord messages captured`:""}</small></div>`:""}
    <div class="gctlMessages">${(t.messages||[]).map(m=>`<article class="gctlMessage ${m.source==="website"?"staff":""}"><header>${E(m.authorName||"Unknown")} · ${E(m.source||"discord")} · ${E(dt(m.createdAt))}</header><p>${E(m.content||"(attachment)")}</p>${(m.attachments||[]).map(a=>`<a href="${E(a.url)}" target="_blank" rel="noopener noreferrer">${E(a.name||"Attachment")}</a>`).join(" ")}</article>`).join("")||'<p class="muted">No messages recorded in this ticket yet.</p>'}</div>
    ${t.status==="closed"?`${t.channelDeleted?'<p class="muted">This ticket is closed and archived. Reopening is unavailable because its Discord channel has been deleted.</p>':'<div class="gctlArchiveNotice"><strong>Closure not yet completed</strong><span>The ticket is marked closed but the Discord channel still exists. Retry archive and deletion once the bot has permission to read history and manage channels.</span><button type="button" id="gctlRetryDelete">Retry archive &amp; delete Discord channel</button></div>'}`:'<form id="gctlReplyForm"><textarea id="gctlReply" maxlength="4000" placeholder="Reply to the ticket…"></textarea><button>Send reply</button></form>'}`;
    const statusSelect=box.querySelector("#gctlStatus");if(statusSelect)statusSelect.onchange=async e=>{const newStatus=e.target.value;try{const result=await req(`/api/admin/tickets/${id}/status`,{method:"POST",body:JSON.stringify({status:newStatus})});if(newStatus==="closed"&&result.channelDeleted)note("Ticket closed. Discord channel deleted and transcript saved in Guardian.");else if(newStatus==="closed")note("Ticket closed, but the Discord channel was not deleted. Check the warning and retry.",true);else if(!result.channelUpdated)note("Status saved, but Discord update failed: "+(result.channelWarning||"unknown error"),true);else note("Ticket status updated.");await window.renderGuardianTickets();}catch(err){note(err.message,true);await showTicket(id)}};
    const retryDelete=box.querySelector("#gctlRetryDelete");if(retryDelete)retryDelete.onclick=async()=>{retryDelete.disabled=true;try{const result=await req(`/api/admin/tickets/${id}/status`,{method:"POST",body:JSON.stringify({status:"closed"})});if(result.channelDeleted)note("Discord channel deleted; website transcript preserved.");else note("Channel deletion did not complete.",true);await window.renderGuardianTickets();}catch(err){note(err.message,true);await showTicket(id)}finally{retryDelete.disabled=false}};
    box.querySelector("#gctlAssignBtn").onclick=async()=>{try{await req(`/api/admin/tickets/${id}/assign`,{method:"POST",body:JSON.stringify({assignedTo:box.querySelector("#gctlAssigned").value})});note("Ticket assigned.");}catch(e){note(e.message,true)}};
    const form=box.querySelector("#gctlReplyForm");if(form)form.onsubmit=async e=>{e.preventDefault();const input=box.querySelector("#gctlReply"),content=input.value.trim();if(!content)return;try{await req(`/api/admin/tickets/${id}/messages`,{method:"POST",body:JSON.stringify({content})});note("Reply sent.");await showTicket(id)}catch(err){note(err.message,true)}};
   }
  }catch(e){c.innerHTML=`<div class="card"><h3>Ticket system unavailable</h3><p>${E(e.message)}</p><button onclick="renderGuardianTickets()">Retry</button></div>`}
 };
})();
