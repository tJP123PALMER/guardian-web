let state={connected:false};
function render(){document.getElementById("link").textContent=state.connected?"LIVE SERVER LINK":"WAITING FOR FIVEM"}
async function load(){const r=await fetch("/api/state",{cache:"no-store"});const j=await r.json();if(j.state){state=j.state;render()}}
function connect(){const es=new EventSource("/api/events");es.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==="state"){state=m.payload;render()}}catch{}}}
load();
connect();