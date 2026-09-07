let portal = {};
let me = {};
const $ = (s) => document.querySelector(s);
const setText=(id,v)=>{const e=$(id);if(e&&v!==undefined&&v!==null)e.textContent=v};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function get(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});return r.json()}
function isAdmin(){return ['owner','admin','dev'].includes(String(me.user?.role||'').toLowerCase())}
function lockCards(locked){document.querySelectorAll('.systemCard').forEach(a=>{a.classList.toggle('locked',locked);a.onclick=e=>{e.preventDefault();if(locked){location.href=me.authenticated?'/portal/?access=whitelist':'/login/?next=%2Fportal%2F'}else location.href=a.dataset.route}})}
function applyTheme(){const root=document.documentElement.style; if(portal.primaryColor)root.setProperty('--primary',portal.primaryColor);if(portal.backgroundColor)root.setProperty('--bg',portal.backgroundColor);if(portal.panelColor)root.setProperty('--panel',portal.panelColor)}
function setHref(sel,url,fallback='#'){const e=$(sel);if(e)e.href=url||fallback}

async function boot(){
  try{portal=(await get('/api/portal/config')).portal||{};me=await get('/api/portal/me')}catch{}
  applyTheme();
  setText('#brandName',(portal.siteName||'Guardian Operations').toUpperCase());
  setText('#brandTagline',portal.tagline||'Fire & Rescue Command Platform');
  setText('#footerBrand',(portal.siteName||'Guardian Operations').toUpperCase());
  setText('#footerTagline',portal.tagline||'Fire & Rescue Command Platform');
  const logo=portal.brandLogoUrl||'/assets/lothian-borders-logo.png';$('#brandLogo').src=logo;$('#heroWatermark').src=portal.communityLogoUrl||logo;
  setText('#heroEyebrow',portal.heroEyebrow||'LOTHIAN & BORDERS | GUARDIAN OPERATIONS');
  const title=portal.welcomeTitle||'Welcome to Guardian Operations';$('#welcomeTitle').innerHTML=esc(title).replace(/Guardian Operations/i,'<span>Guardian Operations</span>');
  setText('#heroDescription',portal.heroDescription||portal.welcomeSubtitle||'Access your operational systems, manage your profile, complete forms and use community tools — all in one place.');
  setText('#heroStrapline',portal.heroStrapline||'PEOPLE | PROFESSIONALISM | COMMUNITY');
  if(portal.heroImageUrl){$('#heroCard').style.backgroundImage=`linear-gradient(90deg,#07131de8 0%,#07131dbf 50%,#07131d44 100%),url("${String(portal.heroImageUrl).replace(/"/g,'')}")`}
  setHref('#guidesBtn',portal.guidesUrl,'#forms');setHref('#supportNav',portal.supportUrl);setHref('#supportBtn',portal.supportUrl);setHref('#leaveBtn',portal.leaveUrl||portal.formsUrl);setHref('#discordBtn',portal.discordUrl);
  setText('#operationalTitle',portal.operationalTitle||'Core Operational Systems');setText('#operationalIntro',portal.operationalIntro||'Access the core systems used across Guardian Operations. Tools are available once your whitelist application is approved.');
  setText('#mdtTitle',portal.mdtTitle||'Player MDT');setText('#mdtDescription',portal.mdtDescription||'Incidents, appliance status, messages and operational information.');
  setText('#controlTitle',portal.controlTitle||'Control Centre');setText('#controlDescription',portal.controlDescription||'Call handling, mobilisation, resources and live radio control.');
  setText('#radioTitle',portal.radioTitle||'Radio');setText('#radioDescription',portal.radioDescription||'Guardian IP radio channels and point-to-point communications.');
  setText('#formsTitle',portal.formsTitle||'Community Forms');setText('#formsIntro',portal.formsIntro||'Submit applications and requests to the Guardian team.');
  setText('#whitelistFormTitle',portal.whitelistFormTitle||'Whitelist Application');setText('#whitelistFormSubtitle',portal.whitelistFormSubtitle||'Join our community');setText('#leaveTitle',portal.leaveTitle||'Leave of Absence');setText('#leaveSubtitle',portal.leaveSubtitle||'Request time away');setText('#supportTitle',portal.supportTitle||'Support Request');setText('#supportSubtitle',portal.supportSubtitle||'Get help from staff');
  setText('#futureTitle',portal.futureTitle||'Expanding Our Services');setText('#futureIntro',portal.futureIntro||'More emergency services coming soon to Guardian Operations.');setText('#footerText',portal.footerText||'Built by the community, for the community.');
  setText('#ambulanceLabel',portal.ambulanceLabel||'Coming Soon');setText('#policeLabel',portal.policeLabel||'Coming Soon');
  $('#ambulanceModule').style.display=portal.showAmbulance===false?'none':'';$('#policeModule').style.display=portal.showPolice===false?'none':'';$('#fireModule').style.display=portal.showFire===false?'none':'';$('#mdtCard').style.display=portal.showMdt===false?'none':'';$('#controlCard').style.display=portal.showControl===false?'none':'';$('#radioCard').style.display=portal.showRadio===false?'none':'';

  const sa=$('#sessionActions'),banner=$('#accessBanner'),profile=$('#profileBox');
  if(me.authenticated){
    const name=me.user?.displayName||me.user?.username||'Member';sa.innerHTML=`<a class="userChip" href="#profile"><i>${esc(name.slice(0,1).toUpperCase())}</i><span>${esc(name)}<br><small>${esc(me.user?.role||'member')}</small></span></a>`;$('#enterBtn').textContent='OPEN PORTAL';$('#enterBtn').href='#systems';
    setText('#accountStatusText','Active Member');setText('#accountStatusBadge','ACTIVE');$('#accountStatusBadge').className='ok';setText('#whitelistText',me.user?.whitelistStatus||'pending');setText('#whitelistBadge',String(me.user?.whitelistStatus||'pending').toUpperCase());setText('#roleText',me.user?.displayName||name);setText('#roleBadge',String(me.user?.role||'member').toUpperCase());$('#roleBadge').className='blue';
    profile.innerHTML=`<b>${esc(name)}</b><br><span>Role: ${esc(String(me.user?.role||'').toUpperCase())}</span><span>Whitelist: ${esc(String(me.user?.whitelistStatus||'pending').toUpperCase())}</span>`;
    if(me.whitelisted){setText('#accessText','Fire & Rescue');setText('#accessBadge','ENABLED');$('#accessBadge').className='ok';$('#whitelistBadge').className='ok';lockCards(false)}else{setText('#accessText','Awaiting approval');setText('#accessBadge','LOCKED');lockCards(true);banner.classList.remove('hidden');banner.textContent=me.user?.whitelistStatus==='rejected'?'Your whitelist application was not approved. Contact staff or submit a new application if applications are open.':'Your whitelist application is awaiting review. MDT, Control Centre and Radio stay locked until approval.'}
    if(isAdmin()){document.querySelectorAll('#adminSettingsNav,#footerSettings,#adminPanel').forEach(e=>e.classList.remove('hidden'))}
  }else{
    sa.innerHTML='<a class="sessionBtn" href="/login/?next=%2Fportal%2F">SIGN IN</a>';setText('#accountStatusText','Guest');setText('#accountStatusBadge','SIGNED OUT');setText('#whitelistText','Sign in required');setText('#whitelistBadge','LOCKED');setText('#roleText','Guest');setText('#roleBadge','GUEST');setText('#accessText','Sign in / apply');setText('#accessBadge','LOCKED');lockCards(true)
  }
  if(portal.applyEnabled===false){document.querySelector('a[href="/apply/"]')?.classList.add('hidden')}
  const q=new URLSearchParams(location.search);if(q.get('access')==='whitelist'){banner.classList.remove('hidden');banner.textContent='Operational access is locked until your whitelist application has been approved.'}
}
boot();
