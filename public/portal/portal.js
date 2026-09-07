let portal = {};
let me = {};
const $ = (s) => document.querySelector(s);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function get(url) {
  const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  return r.json();
}

function lockCards(locked) {
  document.querySelectorAll('.sys').forEach((a) => {
    a.classList.toggle('locked', locked);
    a.onclick = (e) => {
      e.preventDefault();
      if (locked) {
        location.href = me.authenticated ? '/portal/?access=whitelist' : '/login/?next=%2Fportal%2F';
      } else {
        location.href = a.dataset.route;
      }
    };
  });
}

async function boot() {
  try {
    portal = (await get('/api/portal/config')).portal || {};
    me = await get('/api/portal/me');
  } catch {}

  const title = portal.welcomeTitle || 'Welcome to Guardian Operations';
  $('#welcomeTitle').innerHTML = esc(title).replace('Guardian Operations', '<span>Guardian Operations</span>');
  $('#welcomeSubtitle').textContent = portal.welcomeSubtitle || '';

  $('#discordBtn').href = portal.discordUrl || '#';
  $('#discordBtn').style.display = portal.discordUrl ? 'inline-flex' : 'none';
  $('#formsLink').href = portal.formsUrl || '#';
  $('#supportNav').href = portal.supportUrl || '#';
  $('#ambulanceLabel').textContent = portal.ambulanceLabel || 'Coming later';
  $('#policeLabel').textContent = portal.policeLabel || 'Coming later';

  $('#ambulanceModule').style.display = portal.showAmbulance === false ? 'none' : '';
  $('#policeModule').style.display = portal.showPolice === false ? 'none' : '';
  $('#fireModule').style.display = portal.showFire === false ? 'none' : '';
  $('#mdtCard').style.display = portal.showMdt === false ? 'none' : '';
  $('#controlCard').style.display = portal.showControl === false ? 'none' : '';
  $('#radioCard').style.display = portal.showRadio === false ? 'none' : '';

  const sa = $('#sessionActions');
  const state = $('#memberState');
  const profile = $('#profileBox');
  const banner = $('#accessBanner');

  if (me.authenticated) {
    sa.innerHTML = `<a class="sessionBtn" href="#profile">${esc(me.user?.displayName || me.user?.username)}</a>`;
    $('#enterBtn').textContent = 'MY PORTAL';
    $('#enterBtn').href = '#profile';
    profile.innerHTML = `<b>${esc(me.user?.displayName || me.user?.username)}</b><br><span>Role: ${esc((me.user?.role || '').toUpperCase())}</span><br><span>Whitelist: ${esc((me.user?.whitelistStatus || 'pending').toUpperCase())}</span>`;

    if (me.whitelisted) {
      state.textContent = 'WHITELIST APPROVED · OPERATIONAL ACCESS';
      state.className = 'memberState ok';
      lockCards(false);
    } else {
      state.textContent = `WHITELIST ${(me.user?.whitelistStatus || 'pending').toUpperCase()} · SYSTEMS LOCKED`;
      state.className = 'memberState pending';
      lockCards(true);
      banner.classList.remove('hidden');
      banner.textContent = me.user?.whitelistStatus === 'rejected'
        ? 'Your application was not approved. Contact staff or submit a new request if applications are open.'
        : 'Your whitelist application is awaiting staff review. MDT, Control and Radio remain locked until approval.';
    }
  } else {
    sa.innerHTML = '<a class="sessionBtn" href="/login/?next=%2Fportal%2F">SIGN IN</a>';
    state.textContent = 'SIGN IN / APPLY TO UNLOCK';
    lockCards(true);
    profile.textContent = 'Sign in to view your Guardian profile.';
  }

  if (!portal.applyEnabled) $('#applyBtn').style.display = 'none';
  const q = new URLSearchParams(location.search);
  if (q.get('access') === 'whitelist') {
    banner.classList.remove('hidden');
    banner.textContent = 'Operational access is locked until your whitelist application has been approved.';
  }
}

boot();
