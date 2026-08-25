(()=>{
 const el=document.createElement("div");el.id="guardianCoreStatus";el.textContent="GUARDIAN CORE · CONNECTING";document.body.appendChild(el);
 const update=async()=>{try{const r=await fetch("/api/core/status",{cache:"no-store"}),s=await r.json();el.textContent=s.fivemConnected?"GUARDIAN CORE · ONLINE · FIVEM CONNECTED":"GUARDIAN CORE · ONLINE · STANDALONE";el.className=s.fivemConnected?"fivem":"standalone"}catch{el.textContent="GUARDIAN CORE · RECONNECTING";el.className="offline"}};
 update();setInterval(update,5000);
})();