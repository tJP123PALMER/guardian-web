(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const items=[
    {section:'Guardian customisation',tab:'training',icon:'▦',name:'Training & Qualifications',hint:'Courses, qualifications, competencies and specialist roles'},
    {section:'Guardian customisation',tab:'services',icon:'⌁',name:'Services / Ranks / Callsigns',hint:'Emergency services, rank structure, divisions and manual callsigns'},
    {section:'Guardian customisation',tab:'stations',icon:'⌂',name:'Stations / Locations',hint:'Fire stations, police stations, ambulance bases and locations'},
    {section:'Guardian customisation',tab:'appliances',icon:'▣',name:'Appliances / Vehicles',hint:'One fleet directory for MDT, Control and FiveM'},
    {section:'Guardian customisation',tab:'formsbuilder',icon:'▤',name:'Forms',hint:'Folders, forms and response workflows'},
    {section:'Guardian customisation',tab:'guides',icon:'▧',name:'Rules & Guides',hint:'Knowledge base, SOPs and how-to content'},
    {section:'Guardian customisation',tab:'announcements',icon:'◫',name:'Announcements',hint:'Portal notices and Discord publishing'},
    {section:'Guardian customisation',tab:'radio',icon:'⌁',name:'Radio',hint:'Radio and operational talkgroup configuration'},
    {section:'Guardian customisation',tab:'portal',icon:'◩',name:'Portal & Access',hint:'Member portal, branding and system visibility'},
    {section:'Guardian customisation',tab:'discord',icon:'◎',name:'Discord Integration',hint:'Server, channels, roles and publishing'},
    {section:'Guardian customisation',tab:'templates',icon:'▱',name:'Template Library',hint:'Reusable application, training, SOP and workflow templates'},
    {section:'Guardian customisation',tab:'map',icon:'⌖',name:'Station Map',hint:'Manage service locations and map positions'},

    {section:'Configure',tab:'config',icon:'⚙',name:'Core Configuration',hint:'FiveM behaviour, incidents, alerts and defaults'},
    {section:'Configure',tab:'patrols',icon:'◷',name:'Patrols / Duty',hint:'Events, bookings, attendance and duty assignments'},
    {section:'Configure',tab:'applications',icon:'✓',name:'Applications',hint:'Whitelist application review and status workflow'},
    {section:'Configure',tab:'platform',icon:'◉',name:'Status / Platform',hint:'Public status and platform presentation'},

    {section:'Logs',tab:'audit',icon:'≡',name:'Audit Log',hint:'Who changed what and when'},
    {section:'Logs',tab:'backup',icon:'↺',name:'Backups / Restore',hint:'Create and restore configuration snapshots'},

    {section:'Administration',tab:'permissions',icon:'◆',name:'Roles & Permissions',hint:'System access, permissions and admin scopes',danger:true},
    {section:'Administration',tab:'users',icon:'●',name:'Users & Access',hint:'Accounts, whitelist status and service assignment',danger:true},
    {section:'Administration',tab:'governance',icon:'⚑',name:'People & Governance',hint:'Personnel, discipline, promotions, duty and history',danger:true}
  ];
  const go=tab=>{location.hash='#'+tab;setTimeout(()=>document.querySelector(`.nav[data-tab="${tab}"]`)?.click(),0)};
  function installTop(){
    q('.g60-navbar')?.remove();
    if(q('.g61-topnav'))return;
    const top=q('.topbar'); if(!top)return;
    const n=document.createElement('div');n.className='g61-topnav';
    n.innerHTML=`<button data-g61go="overview">ADMIN HOME</button><span class="g61-sep"></span><button data-g61go="services">SERVICES</button><button data-g61go="training">TRAINING</button><button data-g61go="patrols">OPERATIONS</button><button data-g61go="formsbuilder">FORMS</button><button data-g61go="governance">PEOPLE</button><span class="g61-spacer"></span><button id="g61All">ALL SETTINGS</button><button class="g61-signout" id="g61Signout">SIGN OUT</button>`;
    top.appendChild(n);
    qa('[data-g61go]').forEach(b=>b.onclick=()=>go(b.dataset.g61go));
    q('#g61All').onclick=()=>go('overview');q('#g61Signout').onclick=()=>q('#logoutBtn')?.click();
  }
  function renderHome(){
    const old=window.renderOverview;
    window.renderOverview=function(){
      document.getElementById('pageTitle').textContent='Administration & Customisation';
      const sections=['Guardian customisation','Configure','Logs','Administration'];
      setContent(`<div class="g61-console">
        <div class="g61-console-head">
          <div><div class="g61-kicker">GUARDIAN SETTINGS</div><h2>Administration & Customisation</h2><p>Everything is grouped by purpose so you can get to the right workspace quickly.</p></div>
          <div class="g61-searchbox"><span>⌕</span><input id="g61Find" type="search" placeholder="Find a setting…" autocomplete="off"></div>
        </div>
        <div class="g61-quick"><button data-g61jump="Guardian customisation" class="active">CUSTOMISATION</button><button data-g61jump="Configure">CONFIGURE</button><button data-g61jump="Logs">LOGS</button><button data-g61jump="Administration">ADMINISTRATION</button></div>
        <div id="g61Sections">${sections.map(sec=>`<section class="g61-section ${sec==='Administration'?'careful':''}" data-g61section="${esc(sec)}"><div class="g61-section-title"><b>${esc(sec)}</b>${sec==='Administration'?'<small>RESTRICTED / CAREFUL ZONE</small>':''}</div><div class="g61-grid">${items.filter(x=>x.section===sec).map(x=>`<button class="g61-tile ${x.danger?'danger':''}" data-g61tab="${esc(x.tab)}" data-search="${esc((x.name+' '+x.hint).toLowerCase())}" title="${esc(x.hint)}"><span class="g61-icon">${esc(x.icon)}</span><span>${esc(x.name)}</span></button>`).join('')}</div></section>`).join('')}</div>
        <div class="g61-footerhint"><span>TIP</span> Use the search above to filter every Settings tool instantly.</div>
      </div>`);
      qa('[data-g61tab]').forEach(b=>b.onclick=()=>go(b.dataset.g61tab));
      qa('[data-g61jump]').forEach(b=>b.onclick=()=>{const s=q(`[data-g61section="${CSS.escape(b.dataset.g61jump)}"]`);s?.scrollIntoView({behavior:'smooth',block:'start'})});
      q('#g61Find').oninput=e=>{const term=e.target.value.trim().toLowerCase();qa('.g61-tile').forEach(b=>b.classList.toggle('hidden',term&&!b.dataset.search.includes(term)));qa('.g61-section').forEach(s=>s.classList.toggle('empty',s.querySelectorAll('.g61-tile:not(.hidden)').length===0))};
    };
    if(location.hash==='#overview'||!location.hash) window.renderOverview();
  }
  function improveHeadings(){
    const title=q('#pageTitle'); if(!title)return;
    if(!q('.g61-backhome') && location.hash && location.hash!=='#overview'){
      const b=document.createElement('button');b.className='g61-backhome';b.textContent='← SETTINGS HOME';b.onclick=()=>go('overview');title.parentElement?.insertBefore(b,title);
    }
  }
  const boot=()=>{document.documentElement.classList.add('guardian-v61');document.body.classList.add('guardian-v61');installTop();renderHome();improveHeadings();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));else setTimeout(boot,80);
  addEventListener('hashchange',()=>setTimeout(()=>{installTop();improveHeadings()},80));
})();
