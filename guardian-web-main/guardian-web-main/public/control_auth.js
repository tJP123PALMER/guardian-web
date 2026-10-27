(()=>{
  let redirecting=false;
  const login=()=>{if(redirecting)return;redirecting=true;location.href='/login/?next=%2Fcontrol%2F&reason=expired'};
  async function check(){
    try{
      const r=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)return login();
      const j=await r.json();
      if(!j?.authenticated)return login();
      const allowed=['control','supervisor','admin','dev','owner'];
      if(!allowed.includes(j.user?.role))return login();
      let box=document.getElementById('guardianAccountBox');
      if(!box){
        box=document.createElement('div');box.id='guardianAccountBox';
        box.style.cssText='position:fixed;right:96px;top:12px;z-index:10000;height:34px;display:flex;align-items:center;gap:8px;padding:0 9px;border:1px solid #315b72;border-radius:5px;background:#081d29;color:#cfe8f6;font:800 9px Arial';
        box.innerHTML='<span id="guardianAccountName"></span><button id="guardianLogoutBtn" style="border:0;border-left:1px solid #315b72;background:transparent;color:#ff9aa2;font:900 9px Arial;padding:5px 0 5px 8px;cursor:pointer">SIGN OUT</button>';
        document.body.appendChild(box);
        document.getElementById('guardianLogoutBtn').onclick=async()=>{try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'})}finally{location.href='/login/?next=%2Fcontrol%2F'}};
      }
      const name=document.getElementById('guardianAccountName');if(name)name.textContent=(j.user?.displayName||j.user?.username||'SIGNED IN').toUpperCase();
    }catch{ /* transient network issue: do not log operator out */ }
  }
  check(); setInterval(check,60000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
