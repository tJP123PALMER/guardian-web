(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const items=[
    ['Core platform','services','◈','Services / Ranks / Callsigns','Service structure, ranks, divisions and callsign directories'],
    ['Core platform','stations','⌂','Stations / Locations','Operational bases, stations and locations'],
    ['Core platform','appliances','▣','Appliances / Vehicles','Fleet, appliance and vehicle directory'],
    ['Core platform','map','⌖','Station Map','Map positions and operational geography'],
    ['Core platform','radio','⌁','Radio','Talkgroups and radio configuration'],
    ['People & development','training','▦','Training & Qualifications','Courses, qualifications and member development'],
    ['People & development','applications','✓','Applications','Application review and membership workflow'],
    ['People & development','governance','◉','People & Governance','Personnel, promotions, discipline and history'],
    ['People & development','users','●','Users & Access','Accounts, whitelist access and service assignment'],
    ['Operations & content','patrols','◷','Patrol Management','Create patrols, duty assignments and attendance rules'],
    ['Operations & content','formsbuilder','▤','Forms','Forms, folders, submissions and workflows'],
    ['Operations & content','announcements','◫','Announcements','Portal notices and Discord publishing'],
    ['Operations & content','guides','▧','Rules & Guides','SOPs, guides and knowledge content'],
    ['Operations & content','templates','▱','Template Library','Reusable content and workflow templates'],
    ['Integrations & platform','discord','◎','Discord Integration','Channels, role mapping and bot automation'],
    ['Integrations & platform','portal','◩','Portal & Access','Member portal presentation and visibility'],
    ['Integrations & platform','config','⚙','Core Configuration','FiveM behaviour, incidents and platform defaults'],
    ['Integrations & platform','platform','◌','Status / Platform','Public status, branding and platform presentation'],
    ['Governance & recovery','permissions','◆','Roles & Permissions','Guardian module permissions and admin scopes'],
    ['Governance & recovery','audit','≡','Audit Log','Administration and security activity'],
    ['Governance & recovery','backup','↺','Backups / Restore','Create and restore configuration snapshots']
  ];
  const go=tab=>{location.hash='#'+tab;setTimeout(()=>q(`.nav[data-tab="${tab}"]`)?.click(),0)};
  function polishShell(){
    document.documentElement.classList.add('guardian-v63');document.body.classList.add('guardian-v63');
    const renames={overview:'Platform Settings',patrols:'Patrol Management',appliances:'Duty & Fleet',formsbuilder:'Applications & Forms'};
    Object.entries(renames).forEach(([tab,name])=>{const b=q(`.nav[data-tab="${tab}"]`);if(b)b.textContent=name});
    const brand=q('.sidebar .brand');if(brand)brand.innerHTML='GUARDIAN<br><span>OPERATIONS PLATFORM</span>';
    if(!q('.g63-home-link')&&brand){const a=document.createElement('a');a.className='g63-home-link';a.href='/';a.textContent='← HOME / COMMAND CENTRE';a.style.cssText='display:block;margin:0 8px 8px;padding:9px 10px;border:1px solid #1e4b64;border-radius:8px;color:#8fd4ff;text-decoration:none;font-size:11px;font-weight:800;background:#082131';brand.after(a)}
  }
  window.renderOverview=function(){
    const s=window.operational?.summary||operational?.summary||{};
    const warnings=(window.operational?.warnings||operational?.warnings||[]);
    const groups=[...new Set(items.map(x=>x[0]))];
    q('#pageTitle').textContent='Platform Settings';
    setContent(`<div class="g63-settings">
      <section class="g63-settings-head"><div><div class="g63-kicker">GUARDIAN ADMINISTRATION</div><h2>Platform Settings</h2><p>Configure the Guardian platform without mixing member-facing actions into administration. Patrol attendance now lives on the Home / Command Centre.</p></div><div><div class="g63-statusline"><i></i> Platform configuration loaded</div><div class="g63-find"><input id="g63Find" type="search" placeholder="Search settings, services or tools…"></div></div></section>
      <div class="g63-layout"><main class="g63-groups">${groups.map(g=>`<section class="g63-group ${g==='Governance & recovery'?'g63-careful':''}" data-g63group="${E(g)}"><div class="g63-group-head"><h3>${E(g)}</h3><small>${g==='Governance & recovery'?'Restricted administration':'Configuration workspace'}</small></div><div class="g63-toolgrid">${items.filter(x=>x[0]===g).map(x=>`<button class="g63-tool" data-g63tab="${E(x[1])}" data-find="${E((x[3]+' '+x[4]).toLowerCase())}"><span class="ico">${E(x[2])}</span><span><b>${E(x[3])}</b><small>${E(x[4])}</small></span></button>`).join('')}</div></section>`).join('')}</main>
      <aside class="g63-side"><section class="g63-sidecard"><h3>Platform health</h3><div class="g63-healthrow"><span>Core mode</span><span>${E(s.coreMode||'Guardian')}</span></div><div class="g63-healthrow"><span>FiveM</span><span>${s.fivemConnected?'Connected':'Standalone'}</span></div><div class="g63-healthrow"><span>Stations</span><span>${Number(s.stations||0)}</span></div><div class="g63-healthrow"><span>Vehicles</span><span>${Number(s.appliances||0)}</span></div><div class="g63-healthrow"><span>Warnings</span><span>${warnings.length}</span></div></section>
      <section class="g63-sidecard"><h3>Quick administration</h3><div class="g63-linklist"><button data-g63tab="discord">Discord integration</button><button data-g63tab="services">Service structure</button><button data-g63tab="training">Training management</button><button data-g63tab="permissions">Roles & permissions</button></div></section>
      <section class="g63-sidecard"><h3>Member-facing actions</h3><p style="margin-top:0">Attendance, patrol RSVP and day-to-day member actions belong on the Home / Command Centre, not Settings.</p><a href="/" class="buttonLike" style="display:inline-block;text-decoration:none">OPEN COMMAND CENTRE</a></section></aside></div></div>`);
    qa('[data-g63tab]').forEach(b=>b.onclick=()=>go(b.dataset.g63tab));
    q('#g63Find').oninput=e=>{const t=e.target.value.trim().toLowerCase();qa('.g63-tool').forEach(b=>b.style.display=!t||b.dataset.find.includes(t)?'flex':'none');qa('[data-g63group]').forEach(s=>s.style.display=s.querySelector('.g63-tool[style="display: flex;"]')||!t?'block':'none')};
  };
  function afterRender(){polishShell();const title=q('#pageTitle');if(title&&location.hash==='#patrols')title.textContent='Patrol Management';if(title&&location.hash==='#appliances')title.textContent='Duty & Fleet';if(title&&location.hash==='#formsbuilder')title.textContent='Applications & Forms'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{polishShell();if(!location.hash||location.hash==='#overview')window.renderOverview()},120));else setTimeout(()=>{polishShell();if(!location.hash||location.hash==='#overview')window.renderOverview()},120);
  addEventListener('hashchange',()=>setTimeout(afterRender,100));
})();
