/* Guardian v56 — Administration Centre Glow-Up
   Loaded after the legacy settings bundle so these renderers are authoritative. */
(() => {
  const V56_BUILD = '56.0.0';
  window.GUARDIAN_SETTINGS_BUILD = V56_BUILD;

  const svcAccent = (s) => s?.accentColor || ({police:'#3188d8',ambulance:'#29a36a',fire:'#cf4c48',control:'#8c6fd1',sas:'#d09b45'}[String(s?.id||'').toLowerCase()] || '#48a5d5');
  const navTo = (tab) => {
    const b=document.querySelector(`.nav[data-tab="${tab}"]`);
    if(!b)return;
    document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===b));
    active=tab; location.hash=tab; $('pageTitle').textContent=b.textContent; render();
  };

  renderOverview = function(){
    const groups = [
      ['Services & Operations',[
        ['services','Services, Ranks & Callsigns','Build service structures, manual callsign directories, ranks and divisions.','SERVICES'],
        ['stations','Stations / Locations','Manage Fire stations, Police stations, Ambulance bases and operational locations.','LOCATIONS'],
        ['appliances','Appliances / Vehicles','One fleet directory for SFRS/NFRS, Police Scotland, Scottish Ambulance and specialist assets.','FLEET'],
        ['map','Station Map','Place and maintain operational locations on the Guardian map.','MAP'],
        ['patrols','Operations & Deployment','Create patrols, Discord bookings and staff duty assignments.','OPERATIONS'],
        ['radio','Radio','Configure Guardian radio services and operational channels.','RADIO']
      ]],
      ['People, Training & Community',[
        ['applications','Applications','Review membership and service applications.','APPLICATIONS'],
        ['governance','People & Governance','Personnel files, promotions, discipline and service history.','PEOPLE'],
        ['training','Training & Qualifications','Courses, competencies, qualifications and prerequisites.','TRAINING'],
        ['formsbuilder','Forms Builder','Build application, incident, LOA and staff workflow forms.','FORMS'],
        ['guides','Rules & Guides','Write once, publish to Guardian and Discord.','KNOWLEDGE'],
        ['announcements','Announcements','Targeted notices and Discord publishing.','COMMS']
      ]],
      ['Administration & Platform',[
        ['permissions','Roles & Permissions','Control what each Guardian role can view and change.','ACCESS'],
        ['users','Users & Access','Admin accounts, protected owner access and role management.','SECURITY'],
        ['discord','Discord Integration','Channels, role mappings, bot health and publishing integration.','DISCORD'],
        ['portal','Portal & Access','Branding, homepage, public access and member experience.','PORTAL'],
        ['templates','Template Library','Reusable forms, guides, training and workflow templates.','TEMPLATES'],
        ['backup','Backups / Restore Points','Snapshot Guardian before major configuration changes.','BACKUPS'],
        ['audit','Audit Log','See who changed what and when.','AUDIT'],
        ['platform','Status & Platform','Public status, platform health and integrations.','STATUS'],
        ['config','Core Configuration','Technical defaults and operational dictionaries.','CORE']
      ]]
    ];
    const s=operational?.summary||{};
    setContent(`<div class="v56SettingsHome">
      <section class="v56Hero card"><div><div class="eyebrow">GUARDIAN ADMINISTRATION CENTRE</div><h2>Customise Guardian</h2><p>Everything is organised into focused workspaces. Configure the roleplay platform without digging through giant configuration forms.</p></div><div class="v56Build"><span>BUILD</span><b>v${V56_BUILD}</b></div></section>
      <section class="v56Health"><div><b>${s.stations||0}</b><span>Locations</span></div><div><b>${s.appliances||0}</b><span>Operational vehicles</span></div><div><b>${s.incidents||0}</b><span>Open incidents</span></div><div><b>${s.booked||0}</b><span>Booked on</span></div><div><b>${s.fivemConnected?'LIVE':'OFFLINE'}</b><span>FiveM link</span></div></section>
      ${groups.map(([title,items])=>`<section class="v56LauncherSection"><div class="v56SectionTitle"><div class="eyebrow">${esc(title.toUpperCase())}</div><h3>${esc(title)}</h3></div><div class="v56LauncherGrid">${items.map(([tab,name,desc,kicker])=>`<button class="v56Launcher" data-v56-nav="${tab}"><span>${esc(kicker)}</span><b>${esc(name)}</b><small>${esc(desc)}</small><i>OPEN →</i></button>`).join('')}</div></section>`).join('')}
    </div>`);
    document.querySelectorAll('[data-v56-nav]').forEach(b=>b.onclick=()=>navTo(b.dataset.v56Nav));
  };

  renderServices = async function(){
    try{
      const [sd,ud]=await Promise.all([api('/api/admin/services'),api('/api/admin/users').catch(()=>({users:[]}))]);
      let services=Array.isArray(sd.services)?sd.services:[], users=ud.users||[];
      let selected=services[0]?.id||'', view='identity', search='', groupFilter='all';
      const assignedMap=()=>{const m=new Map();for(const u of users){for(const a of (u.serviceAssignments||[])){const c=String(a.callsign||'').trim().toUpperCase();if(c)m.set(c,{name:u.displayName||u.username,username:u.username});}}return m};
      const saveServices=async()=>{await api('/api/admin/services',{method:'POST',body:JSON.stringify({services})});};
      const ensureDirectory=(svc)=>{
        if(!Array.isArray(svc.callsignDirectory)) svc.callsignDirectory=[];
        // Migrate any genuinely manual legacy entries, but never generate patterns.
        if(!svc.callsignDirectory.length && Array.isArray(svc.manualCallsigns)){
          svc.callsignDirectory=svc.manualCallsigns.filter(Boolean).map((x,i)=>({id:'manual-'+Date.now()+'-'+i,callsign:String(x).trim().toUpperCase(),group:'General',division:'',description:'',active:true}));
        }
        return svc.callsignDirectory;
      };
      const draw=()=>{
        if(!services.length){setContent(`<div class="card v56Empty"><h2>No services configured</h2><p>Create the first emergency service to start building Guardian.</p><button id="v56FirstService">ADD SERVICE</button></div>`);$('v56FirstService').onclick=()=>{services.push({id:'police',name:'Police Scotland',shortCode:'PS',enabled:true,accentColor:'#3188d8',ranks:['Police Constable'],divisions:['Response'],roles:[],qualifications:[],callsignDirectory:[]});selected='police';draw()};return;}
        let svc=services.find(x=>x.id===selected)||services[0];selected=svc.id;const accent=svcAccent(svc);const directory=ensureDirectory(svc);const used=assignedMap();
        const serviceTabs=[['identity','Service'],['ranks','Ranks'],['divisions','Divisions'],['callsigns','Callsigns']];
        let body='';
        if(view==='identity') body=`<section class="card v56Panel" style="--svc:${esc(accent)}"><div class="sectionHead"><div><div class="eyebrow">SERVICE PROFILE</div><h2>${esc(svc.name||'Service')}</h2><p>Identity and access state for this Guardian service.</p></div><span class="v56ServiceBadge" style="--svc:${esc(accent)}">${esc(svc.shortCode||svc.id)}</span></div><div class="v56FormGrid"><label>Service name<input id="v56SvcName" value="${esc(svc.name||'')}"></label><label>Service ID<input id="v56SvcId" value="${esc(svc.id||'')}"></label><label>Short code<input id="v56SvcShort" value="${esc(svc.shortCode||'')}" placeholder="PS / SFRS / NFRS / SAS"></label><label>Accent colour<input id="v56SvcAccent" type="color" value="${esc(accent)}"></label></div><label class="v56Check"><input id="v56SvcEnabled" type="checkbox" ${svc.enabled!==false?'checked':''}> Service enabled in Guardian</label><div class="saveBar"><button id="v56DeleteService" class="danger">DELETE SERVICE</button><button id="v56SaveIdentity">SAVE SERVICE</button></div></section>`;
        if(view==='ranks') body=`<section class="card v56Panel" style="--svc:${esc(accent)}"><div class="sectionHead"><div><div class="eyebrow">RANK HIERARCHY</div><h2>${esc(svc.name)} ranks</h2><p>Put ranks in your preferred hierarchy order. Promotions are controlled separately through permissions and pathways.</p></div><button id="v56AddRank">+ ADD RANK</button></div><div id="v56RankList" class="v56SimpleList">${(svc.ranks||[]).map((r,i)=>`<div><span>${i+1}</span><input data-v56-rank="${i}" value="${esc(r)}"><button class="danger" data-v56-del-rank="${i}">×</button></div>`).join('')||'<div class="emptyState">No ranks configured.</div>'}</div><div class="saveBar"><span>${(svc.ranks||[]).length} ranks</span><button id="v56SaveRanks">SAVE RANKS</button></div></section>`;
        if(view==='divisions') body=`<section class="card v56Panel" style="--svc:${esc(accent)}"><div class="sectionHead"><div><div class="eyebrow">DIVISIONS & BRANCHES</div><h2>${esc(svc.name)} organisation</h2><p>Examples: Response, Roads Policing, CID, SFRS East Scotland, NFRS, Ambulance East.</p></div><button id="v56AddDivision">+ ADD DIVISION</button></div><div id="v56DivisionList" class="v56SimpleList">${(svc.divisions||[]).map((r,i)=>`<div><span>${i+1}</span><input data-v56-div="${i}" value="${esc(r)}"><button class="danger" data-v56-del-div="${i}">×</button></div>`).join('')||'<div class="emptyState">No divisions configured.</div>'}</div><div class="saveBar"><span>${(svc.divisions||[]).length} divisions</span><button id="v56SaveDivisions">SAVE DIVISIONS</button></div></section>`;
        if(view==='callsigns'){
          const groups=[...new Set(directory.map(x=>String(x.group||'General').trim()).filter(Boolean))].sort();
          const visible=directory.map((r,i)=>({...r,_i:i})).filter(r=>{
            const hay=[r.callsign,r.group,r.division,r.description].join(' ').toLowerCase();
            return (!search||hay.includes(search))&&(groupFilter==='all'||String(r.group||'General')===groupFilter);
          });
          body=`<section class="card v56Panel v56CallsignPanel" style="--svc:${esc(accent)}"><div class="sectionHead"><div><div class="eyebrow">MANUAL CALLSIGN DIRECTORY</div><h2>${esc(svc.name)} callsigns</h2><p>Enter the exact callsigns used in your FiveM server. Guardian does not generate or rewrite them.</p></div><div class="buttonGroup"><button id="v56AddCallsign">+ ADD CALLSIGN</button><button id="v56BulkCallsign">BULK ADD</button></div></div>
          <div class="v56CallsignStats"><div><b>${directory.length}</b><span>Total</span></div><div><b>${directory.filter(x=>x.active!==false).length}</b><span>Active</span></div><div><b>${directory.filter(x=>used.has(String(x.callsign||'').toUpperCase())).length}</b><span>Assigned</span></div><div><b>${directory.filter(x=>x.active!==false&&!used.has(String(x.callsign||'').toUpperCase())).length}</b><span>Available</span></div></div>
          <div class="v56Toolbar"><input id="v56CsSearch" value="${esc(search)}" placeholder="Search callsign, group, division or notes"><select id="v56CsGroup"><option value="all">All groups</option>${groups.map(g=>`<option value="${esc(g)}" ${groupFilter===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div>
          <div class="v56CallsignTable"><div class="v56CallsignHeader"><span>Callsign</span><span>Group / Type</span><span>Division</span><span>Description</span><span>Assignment</span><span>Active</span><span></span></div><div class="v56CallsignRows">${visible.map(r=>{const a=used.get(String(r.callsign||'').toUpperCase());return `<div class="v56CallsignRow"><input data-v56-cs="${r._i}" value="${esc(r.callsign||'')}" placeholder="SIERRA-01"><input data-v56-csgroup="${r._i}" value="${esc(r.group||'General')}" placeholder="Response / Roads / Pump"><select data-v56-csdiv="${r._i}"><option value="">Any / General</option>${(svc.divisions||[]).map(d=>`<option value="${esc(d)}" ${d===r.division?'selected':''}>${esc(d)}</option>`).join('')}</select><input data-v56-csdesc="${r._i}" value="${esc(r.description||'')}" placeholder="Optional RP note"><span class="v56Assigned ${a?'used':'free'}">${a?`IN USE · ${esc(a.name)}`:'AVAILABLE'}</span><label class="v56MiniCheck"><input type="checkbox" data-v56-csactive="${r._i}" ${r.active!==false?'checked':''}></label><button class="danger" data-v56-delcs="${r._i}">×</button></div>`}).join('')||'<div class="emptyState">No callsigns match this filter.</div>'}</div></div>
          <div id="v56BulkBox" class="v56BulkBox hidden"><div class="sectionHead"><div><h3>Bulk add callsigns</h3><p>One per line. Optional format: <code>CALLSIGN | GROUP | DIVISION | DESCRIPTION</code></p></div><button id="v56CloseBulk" class="secondary">CLOSE</button></div><textarea id="v56BulkText" rows="9" placeholder="SIERRA-01 | Response | Response | Response unit\nRPU-21 | Roads Policing | Roads Policing | Roads unit\nJ27P6 | Pump | SFRS East Scotland | Pump appliance"></textarea><button id="v56ImportBulk">ADD THESE CALLSIGNS</button></div>
          <div class="saveBar"><span>Manual directory only — no forced callsign patterns.</span><button id="v56SaveCallsigns">SAVE CALLSIGNS</button></div></section>`;
        }
        setContent(`<div class="v56ServiceWorkspace"><aside class="card v56ServiceRail"><div class="eyebrow">EMERGENCY SERVICES</div><h3>Services</h3>${services.map(s=>`<button class="v56ServicePick ${s.id===selected?'active':''}" data-v56-service="${esc(s.id)}" style="--svc:${esc(svcAccent(s))}"><i></i><span><b>${esc(s.name)}</b><small>${esc(s.shortCode||s.id)} · ${s.enabled!==false?'ENABLED':'DISABLED'}</small></span></button>`).join('')}<button id="v56AddService" class="v56Dashed">+ ADD SERVICE</button></aside><main><div class="v56Subtabs">${serviceTabs.map(([id,label])=>`<button data-v56-view="${id}" class="${view===id?'active':''}">${label}</button>`).join('')}</div>${body}</main></div>`);
        document.querySelectorAll('[data-v56-service]').forEach(b=>b.onclick=()=>{selected=b.dataset.v56Service;view='identity';search='';groupFilter='all';draw()});
        document.querySelectorAll('[data-v56-view]').forEach(b=>b.onclick=()=>{view=b.dataset.v56View;draw()});
        $('v56AddService').onclick=()=>{const name=prompt('Service name','New Service');if(!name)return;const id=(prompt('Service ID',name.toLowerCase().replace(/[^a-z0-9]+/g,'-'))||'').trim();if(!id||services.some(x=>x.id===id))return alert('Use a unique service ID.');services.push({id,name,shortCode:'',enabled:true,accentColor:'#48a5d5',ranks:[],divisions:[],roles:[],qualifications:[],callsignDirectory:[]});selected=id;view='identity';draw()};
        if(view==='identity'){
          $('v56SaveIdentity').onclick=async()=>{const old=svc.id;svc.name=$('v56SvcName').value.trim();svc.id=$('v56SvcId').value.trim();svc.shortCode=$('v56SvcShort').value.trim().toUpperCase();svc.accentColor=$('v56SvcAccent').value;svc.enabled=$('v56SvcEnabled').checked;if(!svc.name||!svc.id)return alert('Service name and ID are required.');if(services.some(x=>x!==svc&&x.id===svc.id))return alert('That Service ID is already in use.');selected=svc.id;await saveServices();notify('Service saved');draw()};
          $('v56DeleteService').onclick=async()=>{if(!confirm(`Delete ${svc.name}? This affects Guardian service configuration.`))return;services=services.filter(x=>x!==svc);selected=services[0]?.id||'';await saveServices();notify('Service removed');draw()};
        }
        if(view==='ranks'){
          $('v56AddRank').onclick=()=>{svc.ranks=Array.isArray(svc.ranks)?svc.ranks:[];svc.ranks.push('New Rank');draw()};
          document.querySelectorAll('[data-v56-del-rank]').forEach(b=>b.onclick=()=>{svc.ranks.splice(+b.dataset.v56DelRank,1);draw()});
          $('v56SaveRanks').onclick=async()=>{svc.ranks=(svc.ranks||[]).map((_,i)=>document.querySelector(`[data-v56-rank="${i}"]`)?.value.trim()).filter(Boolean);await saveServices();notify('Ranks saved');draw()};
        }
        if(view==='divisions'){
          $('v56AddDivision').onclick=()=>{svc.divisions=Array.isArray(svc.divisions)?svc.divisions:[];svc.divisions.push('New Division');draw()};
          document.querySelectorAll('[data-v56-del-div]').forEach(b=>b.onclick=()=>{svc.divisions.splice(+b.dataset.v56DelDiv,1);draw()});
          $('v56SaveDivisions').onclick=async()=>{svc.divisions=(svc.divisions||[]).map((_,i)=>document.querySelector(`[data-v56-div="${i}"]`)?.value.trim()).filter(Boolean);await saveServices();notify('Divisions saved');draw()};
        }
        if(view==='callsigns'){
          const collect=()=>{directory.forEach((r,i)=>{const a=document.querySelector(`[data-v56-cs="${i}"]`);if(!a)return;r.callsign=a.value.trim().toUpperCase();r.group=document.querySelector(`[data-v56-csgroup="${i}"]`).value.trim()||'General';r.division=document.querySelector(`[data-v56-csdiv="${i}"]`).value;r.description=document.querySelector(`[data-v56-csdesc="${i}"]`).value.trim();r.active=document.querySelector(`[data-v56-csactive="${i}"]`).checked;});};
          $('v56AddCallsign').onclick=()=>{collect();directory.unshift({id:'callsign-'+Date.now(),callsign:'',group:'General',division:'',description:'',active:true});draw()};
          document.querySelectorAll('[data-v56-delcs]').forEach(b=>b.onclick=()=>{collect();directory.splice(+b.dataset.v56Delcs,1);draw()});
          $('v56CsSearch').oninput=e=>{collect();search=e.target.value.toLowerCase();draw()};$('v56CsGroup').onchange=e=>{collect();groupFilter=e.target.value;draw()};
          $('v56BulkCallsign').onclick=()=>{$('v56BulkBox').classList.remove('hidden');$('v56BulkText').focus()};$('v56CloseBulk').onclick=()=>$('v56BulkBox').classList.add('hidden');
          $('v56ImportBulk').onclick=()=>{collect();const rows=$('v56BulkText').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);for(const line of rows){const [callsign,group='General',division='',description='']=line.split('|').map(x=>x.trim());if(!callsign)continue;directory.push({id:'callsign-'+Date.now()+'-'+Math.random().toString(36).slice(2),callsign:callsign.toUpperCase(),group:group||'General',division,description,active:true});}draw()};
          $('v56SaveCallsigns').onclick=async()=>{collect();svc.callsignDirectory=directory.filter(x=>x.callsign);const seen=new Set(),dupes=[];for(const r of svc.callsignDirectory){const k=r.callsign.toUpperCase();if(seen.has(k))dupes.push(k);seen.add(k)}if(dupes.length)return alert('Duplicate callsigns: '+[...new Set(dupes)].join(', '));svc.manualCallsigns=svc.callsignDirectory.map(x=>x.callsign);svc.callsignPattern='';svc.callsignSets=[];await saveServices();notify('Manual callsign directory saved');draw()};
        }
      };
      draw();
    }catch(e){errorView('Services / Ranks / Callsigns',e)}
  };

  renderAppliances = async function(){
    try{
      const [fd,sd,od]=await Promise.all([api('/api/admin/fleet').catch(()=>({fleet:[]})),api('/api/admin/services').catch(()=>({services:[]})),api('/api/admin/operational').catch(()=>({stations:[],appliances:[]}))]);
      const services=sd.services||[];const stations=od.stations||[];
      let fleet=Array.isArray(fd.fleet)&&fd.fleet.length?fd.fleet:(od.appliances||[]).map((a,i)=>({id:a.id||'legacy-'+i,serviceId:a.serviceId||'fire',callsign:a.callsign||'',name:a.name||a.type||'',type:a.type||'',station:a.station||'',status:a.status||'available',registration:a.registration||'',spawnCode:a.spawnCode||'',liveryNumber:a.liveryNumber||'',capabilities:a.capabilities||a.skills||[],requiredQualifications:a.requiredQualifications||[],mileage:a.mileage||0,defects:a.defects||'',notes:a.notes||'',active:a.active!==false}));
      let selected=fleet[0]?.id||'', serviceFilter='all', statusFilter='all', search='';
      const serviceName=id=>services.find(s=>s.id===id)?.name||id||'Unassigned';
      const save=async()=>{await api('/api/admin/fleet',{method:'POST',body:JSON.stringify({fleet})});await api('/api/admin/appliances',{method:'POST',body:JSON.stringify({appliances:fleet.filter(x=>x.active!==false&&String(x.status).toLowerCase()!=='retired').map(v=>({id:v.id,serviceId:v.serviceId,callsign:v.callsign,station:v.station,type:v.type||v.name,skills:v.capabilities||[],status:v.status,registration:v.registration,spawnCode:v.spawnCode,liveryNumber:v.liveryNumber,active:v.active!==false}))})});};
      const draw=()=>{
        const visible=fleet.filter(v=>(serviceFilter==='all'||v.serviceId===serviceFilter)&&(statusFilter==='all'||String(v.status||'available')===statusFilter)&&(!search||[v.callsign,v.name,v.type,v.station,v.registration,v.spawnCode].join(' ').toLowerCase().includes(search)));
        let v=fleet.find(x=>x.id===selected)||visible[0]||fleet[0]||null;if(v)selected=v.id;
        const count=s=>fleet.filter(x=>String(x.status||'available').toLowerCase()===s).length;
        setContent(`<div class="v56Fleet"><section class="card v56FleetDirectory"><div class="sectionHead"><div><div class="eyebrow">GUARDIAN FLEET</div><h2>Appliances / Vehicles</h2><p>One fleet system for Fire, Police, Scottish Ambulance and specialist assets.</p></div><button id="v56NewVehicle">+ ADD VEHICLE</button></div><div class="v56CallsignStats"><div><b>${fleet.length}</b><span>Total</span></div><div><b>${count('available')}</b><span>Available</span></div><div><b>${count('deployed')}</b><span>Deployed</span></div><div><b>${fleet.filter(x=>['maintenance','workshop','off-run'].includes(String(x.status).toLowerCase())).length}</b><span>Off run</span></div></div><div class="v56FleetFilters"><input id="v56FleetSearch" value="${esc(search)}" placeholder="Search callsign, registration, model, station or spawn code"><select id="v56FleetService"><option value="all">All services</option>${services.map(s=>`<option value="${esc(s.id)}" ${serviceFilter===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><select id="v56FleetStatus"><option value="all">All statuses</option>${['available','deployed','standby','training','maintenance','workshop','off-run','retired'].map(s=>`<option value="${s}" ${statusFilter===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="v56FleetList">${visible.map(x=>`<button data-v56-fleet="${esc(x.id)}" class="v56FleetItem ${x.id===selected?'active':''}"><div><span>${esc(x.callsign||'NO CALLSIGN')}</span><b>${esc(x.name||x.type||'Unnamed vehicle')}</b><small>${esc(serviceName(x.serviceId))} · ${esc(x.station||'No home station')} ${x.registration?'· '+esc(x.registration):''}</small></div><i class="statusBadge ${String(x.status).toLowerCase()==='available'?'ok':String(x.status).toLowerCase()==='deployed'?'warn':'off'}">${esc(x.status||'available')}</i></button>`).join('')||'<div class="emptyState">No vehicles match the filters.</div>'}</div></section><section class="card v56FleetRecord">${v?`<div class="sectionHead"><div><div class="eyebrow">VEHICLE RECORD</div><h2>${esc(v.callsign||'New Vehicle')}</h2><p>${esc(v.name||v.type||'Guardian fleet asset')}</p></div><div class="buttonGroup"><button id="v56CloneVehicle" class="secondary">CLONE</button><button id="v56SaveVehicle">SAVE</button></div></div><div class="v56VehicleStatus"><div><span>Status</span><b>${esc(v.status||'available')}</b></div><div><span>Service</span><b>${esc(serviceName(v.serviceId))}</b></div><div><span>Home</span><b>${esc(v.station||'Unassigned')}</b></div></div><div class="v56FormGrid three"><label>Service<select id="v56VService">${services.map(s=>`<option value="${esc(s.id)}" ${s.id===v.serviceId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Callsign / fleet number<input id="v56VCallsign" value="${esc(v.callsign||'')}"></label><label>Registration / VRM<input id="v56VReg" value="${esc(v.registration||'')}"></label><label>Make / vehicle name<input id="v56VName" value="${esc(v.name||'')}"></label><label>Model / type<input id="v56VType" value="${esc(v.type||'')}"></label><label>Home station / base<select id="v56VStation"><option value="">Unassigned</option>${stations.filter(s=>!v.serviceId||(s.serviceId||'fire')===v.serviceId).map(s=>`<option value="${esc(s.name)}" ${s.name===v.station?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Spawn code<input id="v56VSpawn" value="${esc(v.spawnCode||'')}" placeholder="police3 / firetruk"></label><label>Livery number<input id="v56VLivery" value="${esc(v.liveryNumber||'')}"></label><label>Status<select id="v56VStatus">${['available','deployed','standby','training','maintenance','workshop','off-run','retired'].map(s=>`<option value="${s}" ${s===String(v.status||'available').toLowerCase()?'selected':''}>${s}</option>`).join('')}</select><label>Mileage<input id="v56VMileage" type="number" min="0" value="${Number(v.mileage||0)}"></label><label>Next service date<input id="v56VServiceDate" type="date" value="${esc(v.nextServiceDate||'')}"></label><label>Inspection / MOT expiry<input id="v56VMot" type="date" value="${esc(v.motExpiry||'')}"></label></div><div class="v56FormGrid"><label>Capabilities / equipment<textarea id="v56VCaps" rows="4" placeholder="One per line">${esc((v.capabilities||[]).join('\n'))}</textarea></label><label>Qualifications required<textarea id="v56VQuals" rows="4" placeholder="One per line">${esc((v.requiredQualifications||[]).join('\n'))}</textarea></label></div><label>Defects / damage / off-run reason<textarea id="v56VDefects" rows="4">${esc(v.defects||'')}</textarea></label><label>Fleet notes<textarea id="v56VNotes" rows="4">${esc(v.notes||'')}</textarea></label><div class="saveBar"><button id="v56DeleteVehicle" class="danger">DELETE VEHICLE</button><button id="v56SaveVehicleBottom">SAVE VEHICLE</button></div>`:'<div class="emptyState">Select or add a vehicle.</div>'}</section></div>`);
        document.querySelectorAll('[data-v56-fleet]').forEach(b=>b.onclick=()=>{selected=b.dataset.v56Fleet;draw()});
        $('v56FleetSearch').oninput=e=>{search=e.target.value.toLowerCase();draw()};$('v56FleetService').onchange=e=>{serviceFilter=e.target.value;draw()};$('v56FleetStatus').onchange=e=>{statusFilter=e.target.value;draw()};
        $('v56NewVehicle').onclick=()=>{const id='vehicle-'+Date.now();fleet.unshift({id,serviceId:serviceFilter==='all'?(services[0]?.id||'police'):serviceFilter,callsign:'',name:'New Vehicle',type:'',station:'',status:'available',registration:'',spawnCode:'',liveryNumber:'',capabilities:[],requiredQualifications:[],mileage:0,defects:'',notes:'',active:true});selected=id;draw()};
        if(v){
          const collect=()=>{v.serviceId=$('v56VService').value;v.callsign=$('v56VCallsign').value.trim().toUpperCase();v.registration=$('v56VReg').value.trim().toUpperCase();v.name=$('v56VName').value.trim();v.type=$('v56VType').value.trim();v.station=$('v56VStation').value;v.spawnCode=$('v56VSpawn').value.trim();v.liveryNumber=$('v56VLivery').value.trim();v.status=$('v56VStatus').value;v.mileage=Number($('v56VMileage').value||0);v.nextServiceDate=$('v56VServiceDate').value;v.motExpiry=$('v56VMot').value;v.capabilities=$('v56VCaps').value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);v.requiredQualifications=$('v56VQuals').value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);v.defects=$('v56VDefects').value.trim();v.notes=$('v56VNotes').value.trim();};
          const doSave=async()=>{collect();if(!v.callsign)return alert('A callsign / fleet number is required.');if(fleet.some(x=>x!==v&&String(x.callsign).toUpperCase()===v.callsign))return alert('That vehicle callsign already exists.');await save();notify('Vehicle saved');draw()};$('v56SaveVehicle').onclick=doSave;$('v56SaveVehicleBottom').onclick=doSave;
          $('v56DeleteVehicle').onclick=async()=>{if(!confirm(`Delete ${v.callsign||v.name||'this vehicle'}?`))return;fleet=fleet.filter(x=>x!==v);selected=fleet[0]?.id||'';await save();notify('Vehicle deleted');draw()};
          $('v56CloneVehicle').onclick=()=>{collect();const clone=JSON.parse(JSON.stringify(v));clone.id='vehicle-'+Date.now();clone.callsign='';clone.registration='';clone.name=(clone.name||'Vehicle')+' Copy';fleet.unshift(clone);selected=clone.id;draw()};
        }
      };
      draw();
    }catch(e){errorView('Appliances / Vehicles',e)}
  };
  renderFleet = renderAppliances;

  // Legacy #fleet bookmarks should land in the one canonical fleet workspace.
  if(location.hash==='#fleet'){location.hash='appliances';}
  document.querySelectorAll('.nav[data-tab="fleet"]').forEach(x=>x.remove());
})();
