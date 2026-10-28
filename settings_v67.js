// Guardian v67 — Patrol Operations Studio
(() => {
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAttend = b => ['attending','booked'].includes(String(b?.status||'').toLowerCase());
  const isDecline = b => String(b?.status||'').toLowerCase()==='not-attending';
  const localInput = value => {
    if(!value) return '';
    const d = new Date(value); if(!Number.isFinite(d.getTime())) return '';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const iso = value => { if(!value)return ''; const d=new Date(value); return Number.isFinite(d.getTime())?d.toISOString():''; };
  const fmt = value => { if(!value)return 'TBC'; const d=new Date(value); return Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'TBC'; };

  function modal(html, cls=''){
    document.querySelector('.g67ModalLayer')?.remove();
    const layer=document.createElement('div'); layer.className='g67ModalLayer';
    layer.innerHTML=`<div class="g67Modal ${cls}">${html}</div>`;
    document.body.appendChild(layer);
    layer.querySelectorAll('[data-g67-close]').forEach(b=>b.onclick=()=>layer.remove());
    layer.addEventListener('click',e=>{if(e.target===layer)layer.remove()});
    return layer;
  }
  async function confirmBox(title,body,confirmLabel='CONFIRM',danger=false){
    return await new Promise(resolve=>{
      const m=modal(`<div class="g67ModalHead"><div><div class="eyebrow">CONFIRM ACTION</div><h2>${E(title)}</h2><p>${E(body)}</p></div><button data-g67-close>×</button></div><div class="g67ModalActions"><button data-g67-close class="secondary">CANCEL</button><button id="g67Confirm" class="${danger?'danger':''}">${E(confirmLabel)}</button></div>`,'g67ConfirmModal');
      m.querySelectorAll('[data-g67-close]').forEach(b=>b.onclick=()=>{m.remove();resolve(false)});
      m.querySelector('#g67Confirm').onclick=()=>{m.remove();resolve(true)};
    });
  }

  let selectedPatrol='';
  let selectedMode='overview';
  let patrolPoll=null;
  let lastRenderToken=0;

  async function patrolStudio(){
    const token=++lastRenderToken;
    clearInterval(patrolPoll);
    try{
      const [d,dc]=await Promise.all([
        api('/api/admin/patrols'),
        api('/api/admin/discord/channels').catch(()=>({channels:[]}))
      ]);
      if(token!==lastRenderToken)return;
      let patrols=d.patrols||[], services=d.services||[], users=d.users||[], fleet=d.fleet||[], channels=dc.channels||[];
      if(!selectedPatrol || !patrols.some(p=>p.id===selectedPatrol))selectedPatrol=patrols[0]?.id||'';

      const serviceName=id=>services.find(s=>s.id===id)?.name||id||'Joint / Multi-service';
      const service=id=>services.find(s=>s.id===id)||null;
      const attendees=p=>(p.bookings||[]).filter(isAttend);
      const declined=p=>(p.bookings||[]).filter(isDecline);
      const userFor=b=>users.find(u=>u.username===b.username)||{};
      const assignmentDefaults=(b,p)=>{
        const u=userFor(b), current=b.deployment||{};
        const assigned=(u.serviceAssignments||[]).filter(a=>a?.serviceId);
        let sid=current.serviceId || (p.serviceId!=='joint'?p.serviceId:'') || assigned[0]?.serviceId || services.find(s=>s.enabled!==false)?.id || 'fire';
        if(!service(sid)?.enabled && service(sid)?.enabled!==undefined)sid=services.find(s=>s.enabled!==false)?.id||sid;
        const svc=service(sid)||{};
        let div=current.division || assigned.find(a=>a.serviceId===sid)?.division || svc.divisions?.[0] || '';
        return {sid,div,current};
      };
      const callsigns=(sid,div)=>{
        const svc=service(sid)||{};
        const rows=(svc.callsignDirectory||[]).filter(x=>x.active!==false&&x.callsign);
        if(rows.length)return rows.filter(x=>!div||!x.division||x.division===div);
        return (svc.manualCallsigns||[]).map(c=>({callsign:c,group:''}));
      };
      const vehicles=sid=>fleet.filter(v=>(!sid||v.serviceId===sid)&&!['retired','deleted'].includes(String(v.status||'').toLowerCase()));

      function draw(){
        const p=patrols.find(x=>x.id===selectedPatrol)||null;
        const open=!!p&&!p.bookingsClosed;
        const attending=p?attendees(p):[];
        const no=p?declined(p):[];
        setContent(`<div class="g67PatrolShell">
          <section class="g67PatrolTop">
            <div><div class="eyebrow">OPERATIONS WORKSPACE</div><h2>Patrol Management</h2><p>Create operations, manage live bookings, allocate callsigns and divisions, and keep Discord in sync.</p></div>
            <div class="g67TopActions"><button id="g67Refresh" class="secondary">↻ REFRESH</button><button id="g67New">+ NEW PATROL</button></div>
          </section>
          <div class="g67PatrolLayout">
            <aside class="g67PatrolRail card">
              <div class="g67RailHead"><b>Patrols</b><span>${patrols.length}</span></div>
              <div class="g67PatrolList">${patrols.map(x=>`<button class="g67PatrolItem ${x.id===selectedPatrol?'active':''}" data-g67-patrol="${E(x.id)}"><div><b>${E(x.title||'Official Patrol')}</b><small>${E(fmt(x.startsAt))}</small></div><span class="g67Status ${x.bookingsClosed?'closed':'open'}">${x.bookingsClosed?'CLOSED':'OPEN'}</span><em>${attendees(x).length} attending</em></button>`).join('')||'<div class="g67Empty">No patrols yet.</div>'}</div>
            </aside>
            <main class="g67PatrolWorkspace card">${p?`
              <div class="g67HeroHead"><div><div class="eyebrow">${E(serviceName(p.serviceId)).toUpperCase()}</div><h2>${E(p.title||'Official Patrol')}</h2><p>${E(fmt(p.startsAt))} · ${attending.length} attending · ${no.length} not attending</p></div><div class="g67HeroActions"><button id="g67Discord" class="secondary">${p.discordMessageId?'UPDATE DISCORD':'PUBLISH TO DISCORD'}</button><button id="g67BookingToggle" class="${open?'warn':'success'}">${open?'CLOSE BOOKINGS':'REOPEN BOOKINGS'}</button><button id="g67Delete" class="danger">DELETE</button></div></div>
              <div class="g67SummaryRow"><div><span>Booking status</span><b class="${open?'green':'red'}">${open?'OPEN':'CLOSED'}</b></div><div><span>Patrol starts</span><b>${E(fmt(p.startsAt))}</b></div><div><span>Bookings close</span><b>${E(fmt(p.bookingClosesAt))}</b></div><div><span>Capacity</span><b>${p.maxSlots||'∞'}</b></div><div><span>Discord</span><b>${p.discordMessageId?'LIVE':'NOT PUBLISHED'}</b></div></div>
              <div class="g67Tabs"><button data-g67-mode="overview" class="${selectedMode==='overview'?'active':''}">PATROL DETAILS</button><button data-g67-mode="bookings" class="${selectedMode==='bookings'?'active':''}">BOOKINGS <span>${attending.length+no.length}</span></button><button data-g67-mode="assignments" class="${selectedMode==='assignments'?'active':''}">DUTY ASSIGNMENTS <span>${attending.filter(b=>b.deployment?.callsign||b.deployment?.division).length}/${attending.length}</span></button></div>
              <div class="g67ModeBody">
                ${selectedMode==='overview'?detailsView(p):''}
                ${selectedMode==='bookings'?bookingsView(p):''}
                ${selectedMode==='assignments'?assignmentsView(p):''}
              </div>
            `:`<div class="g67EmptyBig"><b>No patrol selected</b><span>Create a patrol to start accepting bookings.</span><button id="g67NewEmpty">CREATE PATROL</button></div>`}</main>
          </div>
        </div>`);

        function detailsView(p){return `<div class="g67DetailGrid">
          <div class="g67InfoCard"><span>Operation</span><b>${E(serviceName(p.serviceId))}</b><small>Members only choose attending / not attending.</small></div>
          <div class="g67InfoCard"><span>Discord channel</span><b>${E(channels.find(c=>String(c.id)===String(p.discordChannelId))?.name||'Default patrol channel')}</b><small>${p.discordMessageId?'Announcement is linked and updateable.':'Publish when ready.'}</small></div>
          <div class="g67InfoCard wide"><span>Briefing</span><b>${E(p.briefing||'No briefing added.')}</b></div>
          <div class="g67Workflow wide"><div><i>1</i><b>Create</b><small>Set dates, capacity and operation.</small></div><div><i>2</i><b>Open bookings</b><small>Members RSVP on Home or Discord.</small></div><div><i>3</i><b>Allocate</b><small>Staff can assign division and callsign at any time.</small></div><div><i>4</i><b>Close</b><small>Lock further member responses when ready.</small></div></div>
          <div class="g67BottomActions wide"><button id="g67Edit">EDIT PATROL DETAILS</button></div>
        </div>`}
        function bookingsView(p){const all=p.bookings||[];return `<div class="g67BookingHeader"><div><b>${attending.length}</b><span>Attending</span></div><div><b>${no.length}</b><span>Not attending</span></div><div><b>${Math.max(0,users.length-all.length)}</b><span>No response</span></div><div class="live"><b>● LIVE</b><span>Auto-refreshes from Discord</span></div></div><div class="g67BookingList">${all.map(b=>`<article><div class="g67Avatar">${E((b.displayName||b.username||'?').slice(0,2).toUpperCase())}</div><div class="grow"><b>${E(b.displayName||b.username)}</b><small>${E(b.username)} · ${E((b.source||'guardian').toUpperCase())}</small></div><span class="g67Status ${isAttend(b)?'open':'closed'}">${isAttend(b)?'ATTENDING':'NOT ATTENDING'}</span><small>${E(fmt(b.respondedAt||b.bookedAt))}</small>${b.deployment?`<span class="g67DeployChip">${E(b.deployment.division||'No division')} · ${E(b.deployment.callsign||'No callsign')}</span>`:''}</article>`).join('')||'<div class="g67Empty">Nobody has responded yet. Discord and Home responses will appear here automatically.</div>'}</div>`}
        function assignmentsView(p){return `<div class="g67AssignIntro ${open?'open':''}"><div><b>${open?'Bookings are still open':'Bookings are closed'}</b><span>${open?'You can allocate duty now; new attendees can be assigned as they arrive.':'Attendance is locked. Finalise callsigns and divisions.'}</span></div>${open?'<button id="g67CloseFromAssign">CLOSE BOOKINGS</button>':''}</div><div class="g67AssignmentTable"><div class="head"><span>Member</span><span>Service</span><span>Division</span><span>Callsign</span><span>Vehicle</span><span>Action</span></div>${attending.map((b,i)=>assignmentRow(b,i,p)).join('')||'<div class="g67Empty">No attending members yet.</div>'}</div>`}
        function assignmentRow(b,i,p){const {sid,div,current}=assignmentDefaults(b,p),svc=service(sid)||{},divs=svc.divisions||[],cs=callsigns(sid,div),vs=vehicles(sid);return `<div class="row" data-g67-row="${i}"><div><b>${E(b.displayName||b.username)}</b><small>${E(userFor(b).role||'Member')}</small></div><select data-g67-service="${i}">${services.filter(s=>s.enabled!==false).map(s=>`<option value="${E(s.id)}" ${s.id===sid?'selected':''}>${E(s.name)}</option>`).join('')}</select><select data-g67-division="${i}">${divs.map(d=>`<option value="${E(d)}" ${d===div?'selected':''}>${E(d)}</option>`).join('')}${!divs.length?'<option value="">No division configured</option>':''}</select><select data-g67-callsign="${i}"><option value="">Unassigned</option>${cs.map(c=>`<option value="${E(c.callsign)}" ${String(c.callsign)===String(current.callsign||'')?'selected':''}>${E(c.callsign)}${c.group?' · '+E(c.group):''}</option>`).join('')}</select><select data-g67-vehicle="${i}"><option value="">No vehicle</option>${vs.map(v=>`<option value="${E(v.id||v.callsign)}" ${String(v.id||v.callsign)===String(current.vehicle||'')?'selected':''}>${E(v.callsign||v.registration||v.name||'Vehicle')} · ${E(v.name||v.type||'Vehicle')}</option>`).join('')}</select><button data-g67-assign="${i}">${current.assignedAt?'UPDATE':'ASSIGN'}</button></div>`}

        document.querySelectorAll('[data-g67-patrol]').forEach(b=>b.onclick=()=>{selectedPatrol=b.dataset.g67Patrol;selectedMode='overview';draw()});
        document.querySelectorAll('[data-g67-mode]').forEach(b=>b.onclick=()=>{selectedMode=b.dataset.g67Mode;draw()});
        document.querySelector('#g67Refresh')?.addEventListener('click',()=>patrolStudio());
        document.querySelector('#g67New')?.addEventListener('click',()=>openEditor(null));
        document.querySelector('#g67NewEmpty')?.addEventListener('click',()=>openEditor(null));
        document.querySelector('#g67Edit')?.addEventListener('click',()=>openEditor(p));
        document.querySelector('#g67BookingToggle')?.addEventListener('click',async()=>{
          const action=open?'close':'open';
          if(action==='close' && !(await confirmBox('Close patrol bookings?','Members will no longer be able to change their attendance. Staff can continue duty assignments.','CLOSE BOOKINGS',true)))return;
          try{await api(`/api/admin/patrols/${encodeURIComponent(p.id)}/bookings`,{method:'POST',body:JSON.stringify({action})});notify(action==='close'?'Bookings closed':'Bookings reopened');await patrolStudio()}catch(e){notify(e.message)}
        });
        document.querySelector('#g67CloseFromAssign')?.addEventListener('click',()=>document.querySelector('#g67BookingToggle')?.click());
        document.querySelector('#g67Discord')?.addEventListener('click',async()=>{try{await api(`/api/admin/patrols/${encodeURIComponent(p.id)}/discord`,{method:'POST',body:JSON.stringify({channelId:p.discordChannelId||''})});notify(p.discordMessageId?'Discord announcement updated':'Patrol published to Discord');await patrolStudio()}catch(e){notify(e.message)}});
        document.querySelector('#g67Delete')?.addEventListener('click',async()=>{if(!(await confirmBox('Delete this patrol?',`Delete “${p.title}”? Its linked Discord announcement will also be removed where possible.`,'DELETE PATROL',true)))return;try{const r=await api(`/api/admin/patrols/${encodeURIComponent(p.id)}`,{method:'DELETE'});notify(r.discordWarning?'Patrol deleted; Discord message could not be removed':'Patrol deleted');selectedPatrol='';await patrolStudio()}catch(e){notify(e.message)}});
        if(selectedMode==='assignments') bindAssignments(p);
      }

      function bindAssignments(p){
        const attending=attendees(p);
        document.querySelectorAll('[data-g67-service]').forEach(sel=>sel.onchange=()=>{
          const i=+sel.dataset.g67Service,sid=sel.value,svc=service(sid)||{},divSel=document.querySelector(`[data-g67-division="${i}"]`),csSel=document.querySelector(`[data-g67-callsign="${i}"]`),vSel=document.querySelector(`[data-g67-vehicle="${i}"]`);
          divSel.innerHTML=(svc.divisions||[]).map(d=>`<option value="${E(d)}">${E(d)}</option>`).join('')||'<option value="">No division configured</option>';
          const refresh=()=>{const div=divSel.value;csSel.innerHTML='<option value="">Unassigned</option>'+callsigns(sid,div).map(c=>`<option value="${E(c.callsign)}">${E(c.callsign)}${c.group?' · '+E(c.group):''}</option>`).join('');vSel.innerHTML='<option value="">No vehicle</option>'+vehicles(sid).map(v=>`<option value="${E(v.id||v.callsign)}">${E(v.callsign||v.registration||v.name||'Vehicle')} · ${E(v.name||v.type||'Vehicle')}</option>`).join('')};
          divSel.onchange=refresh;refresh();
        });
        document.querySelectorAll('[data-g67-assign]').forEach(btn=>btn.onclick=async()=>{const i=+btn.dataset.g67Assign,b=attending[i];if(!b)return;const payload={username:b.username,serviceId:document.querySelector(`[data-g67-service="${i}"]`).value,division:document.querySelector(`[data-g67-division="${i}"]`).value,callsign:document.querySelector(`[data-g67-callsign="${i}"]`).value,vehicle:document.querySelector(`[data-g67-vehicle="${i}"]`).value};try{await api(`/api/admin/patrols/${encodeURIComponent(p.id)}/deployment`,{method:'POST',body:JSON.stringify(payload)});notify(`Duty assigned to ${b.displayName||b.username}`);await patrolStudio()}catch(e){notify(e.message)}});
      }

      function openEditor(p){
        const fresh=!p; const base=p||{title:'Weekly Patrol',serviceId:'fire',startsAt:new Date(Date.now()+86400000).toISOString(),bookingClosesAt:new Date(Date.now()+82800000).toISOString(),maxSlots:0,briefing:'',discordChannelId:'',published:true};
        const m=modal(`<div class="g67ModalHead"><div><div class="eyebrow">${fresh?'CREATE OPERATION':'EDIT OPERATION'}</div><h2>${fresh?'New patrol':E(base.title)}</h2><p>Set the patrol once. Members RSVP on Home or Discord; staff handle allocations here.</p></div><button data-g67-close>×</button></div><div class="g67FormGrid"><label>Patrol title<input id="g67FTitle" value="${E(base.title||'Weekly Patrol')}"></label><label>Operation / service<select id="g67FService"><option value="joint" ${base.serviceId==='joint'?'selected':''}>Joint / Multi-service</option>${services.filter(s=>s.enabled!==false).map(s=>`<option value="${E(s.id)}" ${s.id===base.serviceId?'selected':''}>${E(s.name)}</option>`).join('')}</select></label><label>Patrol starts<input id="g67FStarts" type="datetime-local" value="${E(localInput(base.startsAt))}"></label><label>Bookings close<input id="g67FClose" type="datetime-local" value="${E(localInput(base.bookingClosesAt))}"><small>Leave blank to default to 1 hour before start.</small></label><label>Maximum attendees<input id="g67FMax" type="number" min="0" value="${Number(base.maxSlots||0)}"><small>0 = unlimited</small></label><label>Discord channel<select id="g67FChannel"><option value="">Use default patrol channel</option>${channels.map(c=>`<option value="${E(c.id)}" ${String(c.id)===String(base.discordChannelId||'')?'selected':''}>#${E(c.name)}</option>`).join('')}</select></label><label class="wide">Briefing / notes<textarea id="g67FBrief" rows="6" placeholder="Meeting point, briefing time, patrol focus, server notes…">${E(base.briefing||'')}</textarea></label><label class="g67Check wide"><input id="g67FDiscord" type="checkbox" ${fresh?'checked':''}> Publish / update the Discord patrol announcement after saving</label></div><div id="g67FormError" class="g67FormError"></div><div class="g67ModalActions"><button data-g67-close class="secondary">CANCEL</button><button id="g67SavePatrol">${fresh?'CREATE PATROL':'SAVE CHANGES'}</button></div>`,'g67PatrolModal');
        m.querySelector('#g67SavePatrol').onclick=async()=>{const title=m.querySelector('#g67FTitle').value.trim(),startsAt=iso(m.querySelector('#g67FStarts').value),bookingClosesAt=iso(m.querySelector('#g67FClose').value);if(!title||!startsAt){m.querySelector('#g67FormError').textContent='Patrol title and start date/time are required.';return}if(bookingClosesAt&&new Date(bookingClosesAt)>=new Date(startsAt)){m.querySelector('#g67FormError').textContent='Bookings must close before the patrol starts.';return}const payload={...(fresh?{}:base),title,serviceId:m.querySelector('#g67FService').value,startsAt,bookingClosesAt,maxSlots:Number(m.querySelector('#g67FMax').value||0),discordChannelId:m.querySelector('#g67FChannel').value,briefing:m.querySelector('#g67FBrief').value.trim(),published:true};try{const r=await api('/api/admin/patrols',{method:'POST',body:JSON.stringify({patrol:payload})});selectedPatrol=r.patrol.id;if(m.querySelector('#g67FDiscord').checked){await api(`/api/admin/patrols/${encodeURIComponent(r.patrol.id)}/discord`,{method:'POST',body:JSON.stringify({channelId:payload.discordChannelId||''})}).catch(e=>notify('Patrol saved, but Discord publish failed: '+e.message))}m.remove();notify(fresh?'Patrol created':'Patrol updated');await patrolStudio()}catch(e){m.querySelector('#g67FormError').textContent=e.message}};
      }

      draw();
      patrolPoll=setInterval(async()=>{
        if(active!=='patrols'||document.hidden||document.querySelector('.g67ModalLayer'))return;
        if(selectedMode==='overview')return;
        try{const fresh=await api('/api/admin/patrols');patrols=fresh.patrols||patrols;users=fresh.users||users;fleet=fresh.fleet||fleet;services=fresh.services||services;draw()}catch{}
      },4000);
    }catch(e){errorView('Patrol Management',e)}
  }

  // Install after all previous version layers. This deliberately replaces the legacy prompt-based patrol editor.
  window.renderPatrols = patrolStudio;
  try{renderPatrols = patrolStudio}catch{}
})();
