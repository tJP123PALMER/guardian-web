(()=>{
  const badge=document.createElement("div");
  badge.id="guardianCoreBadge";
  badge.textContent="CORE · CONNECTING";
  document.body.appendChild(badge);

  async function update(){
    try{
      const r=await fetch("/api/core/status",{cache:"no-store"});
      const s=await r.json();
      badge.dataset.mode=s.fivemConnected?"fivem":"standalone";
      badge.textContent=s.fivemConnected
        ?"GUARDIAN CORE · FIVEM CONNECTED"
        :"GUARDIAN CORE · STANDALONE";
    }catch{
      badge.dataset.mode="offline";
      badge.textContent="GUARDIAN CORE · RECONNECTING";
    }
  }
  update();
  setInterval(update,5000);
})();