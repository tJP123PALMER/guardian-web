let portal={};let me={};let currentView='portal';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(id,v)=>{const e=$(id);if(e&&v!==undefined&&v!==null)e.textContent=v};
async function get(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(`${r.status}`);return r.json()}
function isAdmin(){return ['owner','admin','dev'].includes(String(me.user?.role||'').toLowerCase())}
function setHref(sel,url,fallback='#'){const e=$(sel);if(e)e.href=url||fallback}
function cleanView(v){return ['portal','profile','forms','misc'].includes(v)?v:'portal'}
function showView(view,{push=true}={}){
  currentView=cleanView(view);
  $$('.appView').forEach(v=>{const active=v.dataset.view===currentView;v.hidden=!active;v.classList.toggle('active',active)});
  $$('[data-view-link]').forEach(n=>{const active=n.dataset.viewLink===currentView;n.classList.toggle('active',active);if(n.matches('.navTab')){if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current')}});
  if(push){history.pushState({view:currentView},'',`#${currentView}`)}
  window.scrollTo({top:0,behavior:'instant'});$('#appMain')?.focus({preventScroll:true});
}
function bindTabs(){
  $$('[data-view-link]').forEach(el=>el.addEventListener('click',e=>{const v=el.dataset.viewLink;if(v){e.preventDefault();showView(v)}}));
  addEventListener('popstate',()=>showView(location.hash.slice(1)||'portal',{push:false}));
}
function applyTheme(){const root=document.documentElement.style;if(portal.primaryColor)root.setProperty('--primary',portal.primaryColor);if(portal.backgroundColor)root.setProperty('--bg',portal.backgroundColor);if(portal.panelColor)root.setProperty('--panel',portal.panelColor)}
function setCardLocked(a,locked){a.classList.toggle('locked',locked);a.setAttribute('aria-disabled',locked?'true':'false');a.onclick=e=>{e.preventDefault();if(locked){showView('profile');const n=$('#accessBanner');n.classList.remove('hidden');n.textContent=me.authenticated?'Operational systems remain locked until your whitelist is approved.':'Sign in and complete the whitelist application to unlock operational systems.'}else location.href=a.dataset.route}}
function lockCards(locked){$$('.systemCard').forEach(a=>setCardLocked(a,locked))}
function profileHtml(){
  if(!me.authenticated)return '<p>You are not signed in.</p><a class="button primary" href="/login/?next=%2Fportal%2F">Sign in</a>';
  const u=me.user||{};return `<dl><dt>Name</dt><dd>${esc(u.displayName||u.username||'Member')}</dd><dt>Username</dt><dd>${esc(u.username||'')}</dd><dt>Role</dt><dd>${esc(String(u.role||'member').toUpperCase())}</dd><dt>Whitelist</dt><dd>${esc(String(u.whitelistStatus||'pending').toUpperCase())}</dd></dl>`
}
function applicationHtml(){
  if(!me.authenticated)return '<p>Sign in to view your application status.</p>';
  const a=me.application;if(!a)return '<p>No whitelist application is linked to this account.</p><a class="button secondary" href="/apply/">Start application</a>';
  return `<dl><dt>Status</dt><dd>${esc(String(a.status||'pending').toUpperCase())}</dd><dt>Submitted</dt><dd>${a.submittedAt?new Date(a.submittedAt).toLocaleString():'—'}</dd><dt>Reviewed</dt><dd>${a.reviewedAt?new Date(a.reviewedAt).toLocaleString():'Awaiting review'}</dd></dl>`
}
function splitWelcomeTitle(title){const s=String(title||'Welcome to Guardian Operations');const m=s.match(/^(.*?)(Guardian Operations)(.*)$/i);if(m){text('#welcomePrefix',m[1].trim()||'Welcome to');text('#welcomeBrand',`${m[2]}${m[3]}`.trim())}else{text('#welcomePrefix','');text('#welcomeBrand',s)}}
function applyConfig(){
  applyTheme();text('#brandName',(portal.siteName||'Guardian Operations').toUpperCase());text('#brandTagline',portal.tagline||'Fire & Rescue Command Platform');text('#footerBrand',(portal.siteName||'Guardian Operations').toUpperCase());text('#footerTagline',portal.tagline||'Fire & Rescue Command Platform');text('#footerText',portal.footerText||'Built by the community, for the community.');
  const logo=portal.brandLogoUrl||'/assets/lothian-borders-logo.png';$('#brandLogo').src=logo;splitWelcomeTitle(portal.welcomeTitle);text('#heroEyebrow',portal.heroEyebrow||'GUARDIAN OPERATIONS');text('#heroDescription',portal.heroDescription||portal.welcomeSubtitle||'Access your operational systems, manage your profile, complete forms and use community tools — all in one place.');text('#heroStrapline',(portal.heroStrapline||'PEOPLE | PROFESSIONALISM | COMMUNITY').replaceAll('|','·'));
  if(portal.heroImageUrl){$('#heroCard').style.backgroundImage=`url("${String(portal.heroImageUrl).replace(/["\n\r]/g,'')}")`}else $('#heroCard').style.backgroundImage='none';
  text('#systemsHeading',portal.operationalTitle||'Core operational systems');text('#operationalIntro',portal.operationalIntro||'Access the main Guardian systems from one place.');text('#mdtTitle',portal.mdtTitle||'Player MDT');text('#mdtDescription',portal.mdtDescription||'Incidents, appliance status, messages and operational information.');text('#controlTitle',portal.controlTitle||'Control Centre');text('#controlDescription',portal.controlDescription||'Call handling, mobilisation, resources and live radio control.');text('#radioTitle',portal.radioTitle||'Radio');text('#radioDescription',portal.radioDescription||'Guardian IP radio channels and point-to-point communications.');
  text('#formsHeading',portal.formsTitle||'Forms & requests');text('#formsIntro',portal.formsIntro||'Submit applications and requests to the Guardian team.');text('#whitelistFormTitle',portal.whitelistFormTitle||'Whitelist application');text('#whitelistFormSubtitle',portal.whitelistFormSubtitle||'Join our community');text('#leaveTitle',portal.leaveTitle||'Leave of absence');text('#leaveSubtitle',portal.leaveSubtitle||'Request time away');text('#supportTitle',portal.supportTitle||'Support request');text('#supportSubtitle',portal.supportSubtitle||'Get help from staff');text('#futureTitle',portal.futureTitle||'Expanding our services');text('#futureIntro',portal.futureIntro||'More emergency services coming soon to Guardian Operations.');text('#ambulanceLabel',portal.ambulanceLabel||'Coming Soon');text('#policeLabel',portal.policeLabel||'Coming Soon');
  setHref('#guidesBtn',portal.guidesUrl);setHref('#miscGuides',portal.guidesUrl);setHref('#supportBtn',portal.supportUrl);setHref('#supportNav',portal.supportUrl);setHref('#leaveBtn',portal.leaveUrl||portal.formsUrl);setHref('#discordBtn',portal.discordUrl);
  $('#ambulanceModule').style.display=portal.showAmbulance===false?'none':'';$('#policeModule').style.display=portal.showPolice===false?'none':'';$('#fireModule').style.display=portal.showFire===false?'none':'';$('#mdtCard').style.display=portal.showMdt===false?'none':'';$('#controlCard').style.display=portal.showControl===false?'none':'';$('#radioCard').style.display=portal.showRadio===false?'none':'';
}
function applySession(){
  const sa=$('#sessionActions'),banner=$('#accessBanner');banner.classList.add('hidden');
  if(me.authenticated){
    const u=me.user||{},name=u.displayName||u.username||'Member';sa.innerHTML=`<a class="userChip" href="#profile" data-view-link="profile"><i>${esc(name.slice(0,1).toUpperCase())}</i><span>${esc(name)}<br><small>${esc(u.role||'member')}</small></span></a>`;bindDynamicTab(sa.querySelector('[data-view-link]'));
    text('#accountStatusText','Active member');text('#accountStatusBadge','ACTIVE');$('#accountStatusBadge').className='badge ok';text('#whitelistText',u.whitelistStatus||'pending');text('#whitelistBadge',String(u.whitelistStatus||'pending').toUpperCase());text('#roleText',u.role||'member');text('#roleBadge',String(u.role||'member').toUpperCase());$('#roleBadge').className='badge blue';
    if(me.whitelisted){text('#accessText','Fire & Rescue');text('#accessBadge','ENABLED');$('#accessBadge').className='badge ok';$('#whitelistBadge').className='badge ok';lockCards(false)}else{text('#accessText','Awaiting approval');text('#accessBadge','LOCKED');lockCards(true);banner.classList.remove('hidden');banner.textContent=u.whitelistStatus==='rejected'?'Your whitelist application was not approved. Contact staff or submit a new application if applications are open.':'Your whitelist application is awaiting review. Operational systems remain locked until approval.'}
    if(isAdmin())$$('#adminSettingsNav,#adminQuick,#profileSettingsBtn').forEach?.(()=>{});
    if(isAdmin()){['#adminSettingsNav','#adminQuick','#profileSettingsBtn'].forEach(s=>$(s)?.classList.remove('hidden'))}
  }else{sa.innerHTML='<a class="sessionBtn" href="/login/?next=%2Fportal%2F">Sign in</a>';text('#accountStatusText','Guest');text('#accountStatusBadge','SIGNED OUT');text('#whitelistText','Sign in required');text('#whitelistBadge','LOCKED');text('#roleText','Guest');text('#roleBadge','GUEST');text('#accessText','Sign in / apply');text('#accessBadge','LOCKED');lockCards(true)}
  $('#profileBox').innerHTML=profileHtml();$('#applicationBox').innerHTML=applicationHtml();
}
function bindDynamicTab(el){if(!el)return;el.addEventListener('click',e=>{e.preventDefault();showView(el.dataset.viewLink||'profile')})}
async function refreshConfig(){try{const j=await get(`/api/portal/config?t=${Date.now()}`);const next=j.portal||{};const changed=JSON.stringify(next)!==JSON.stringify(portal);portal=next;if(changed)applyConfig()}catch{}}
async function boot(){
  bindTabs();$('#getStartedBtn').addEventListener('click',()=>me.authenticated?showView('portal'):location.assign('/login/?next=%2Fportal%2F'));
  try{const [pc,pm]=await Promise.all([get(`/api/portal/config?t=${Date.now()}`),get(`/api/portal/me?t=${Date.now()}`)]);portal=pc.portal||{};me=pm||{}}catch{}
  applyConfig();applySession();showView(location.hash.slice(1)||'portal',{push:false});
  addEventListener('storage',e=>{if(e.key==='guardianPortalUpdatedAt')refreshConfig()});
  if('BroadcastChannel' in window){const ch=new BroadcastChannel('guardian-portal');ch.onmessage=e=>{if(e.data?.type==='portal-updated')refreshConfig()}}
  setInterval(refreshConfig,15000);
}
boot();

async function loadDynamicForms(){
  const box=$('#dynamicForms');if(!box)return;
  try{const d=await fetch('/api/community/forms',{cache:'no-store'}).then(r=>r.json());const forms=(d.forms||[]).filter(f=>f.id!=='whitelist'&&f.id!=='loa'&&f.id!=='support');box.innerHTML=forms.map(f=>`<button class="formCard dynamicFormBtn" type="button" data-form-id="${esc(f.id)}"><span>▤</span><div><h2>${esc(f.title)}</h2><p>${esc(f.description||f.category||'Guardian form')}</p></div><b>→</b></button>`).join('');box.querySelectorAll('[data-form-id]').forEach(b=>b.onclick=()=>openDynamicForm((d.forms||[]).find(f=>f.id===b.dataset.formId)))}catch(e){box.innerHTML=''}
}
function openDynamicForm(f){if(!f)return;const answers={};const html=(f.fields||[]).map(x=>{const id='gf_'+x.id;if(x.type==='textarea')return `<label>${esc(x.label)}<textarea id="${id}" rows="4"></textarea></label>`;if(x.type==='checkbox')return `<label><input id="${id}" type="checkbox"> ${esc(x.label)}</label>`;return `<label>${esc(x.label)}<input id="${id}" type="${x.type==='date'?'date':x.type==='number'?'number':'text'}"></label>`}).join('');const modal=document.createElement('dialog');modal.className='guardianDialog';modal.innerHTML=`<form method="dialog"><h2>${esc(f.title)}</h2><p>${esc(f.description||'')}</p><div class="dialogFields">${html}</div><div class="actionRow"><button type="button" class="button primary" id="submitGForm">Submit</button><button class="button secondary">Cancel</button></div><div id="gFormError" class="notice hidden"></div></form>`;document.body.appendChild(modal);modal.showModal();modal.querySelector('#submitGForm').onclick=async()=>{for(const x of f.fields||[]){const el=modal.querySelector('#gf_'+CSS.escape(x.id));answers[x.id]=x.type==='checkbox'?!!el.checked:el.value}const r=await fetch('/api/community/forms/'+encodeURIComponent(f.id)+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})});const d=await r.json();if(!r.ok){const e=modal.querySelector('#gFormError');e.textContent=d.error||'Unable to submit';e.classList.remove('hidden');return}modal.close();modal.remove();alert('Form submitted successfully. You can track it in Your Profile.')};modal.addEventListener('close',()=>modal.remove(),{once:true})}
async function loadPatrols(){const box=$('#patrolCards');if(!box)return;try{const r=await fetch('/api/community/patrols',{cache:'no-store'}),d=await r.json();const patrols=d.patrols||[];box.innerHTML=patrols.length?patrols.map(p=>{const mine=(p.bookings||[]).find(b=>b.isMe&&b.status==='booked');return `<section class="card patrolCard"><div class="panelHead"><div><div class="eyebrow">${esc(p.serviceId||'OPERATIONS')}</div><h2>${esc(p.title)}</h2></div><span class="badge ${mine?'ok':'blue'}">${mine?'BOOKED':'OPEN'}</span></div><p>${esc(p.startsAt||'Date TBC')}</p><p>${esc(p.briefing||'')}</p>${mine&&mine.deployment?`<div class="deployment"><b>Your deployment</b><span>${esc(mine.deployment.callsign||'No callsign')} · ${esc(mine.deployment.rank||'')} · ${esc(mine.deployment.division||'')}</span><small>${esc(mine.deployment.role||'')} ${mine.deployment.talkgroup?'· '+esc(mine.deployment.talkgroup):''}</small></div>`:''}<button class="button ${mine?'secondary':'primary'}" data-patrol-book="${p.id}" data-booked="${mine?'1':'0'}">${mine?'Cancel booking':'Book on'}</button></section>`}).join(''):'<section class="card"><h2>No upcoming patrols</h2><p>Staff have not published any patrols yet.</p></section>';box.querySelectorAll('[data-patrol-book]').forEach(b=>b.onclick=async()=>{const booked=b.dataset.booked==='1';let body={};if(!booked){body.servicePreference=prompt('Preferred service (optional)','')||'';body.rolePreference=prompt('Preferred role (optional)','')||''}await fetch('/api/community/patrols/'+b.dataset.patrolBook+(booked?'/cancel':'/book'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});loadPatrols()})}catch(e){box.innerHTML='<section class="card"><p>Sign in and become whitelisted to view patrols.</p></section>'}}

addEventListener('DOMContentLoaded',()=>{loadDynamicForms();loadPatrols()});

document.addEventListener('click',e=>{const b=e.target.closest('[data-view-link]');if(!b)return;if(b.dataset.viewLink==='forms')setTimeout(loadDynamicForms,0);if(b.dataset.viewLink==='patrols')setTimeout(loadPatrols,0)});
