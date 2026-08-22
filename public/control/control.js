let state={connected:false,units:{},incidents:[],calls999:[]};
const $=id=>document.getElementById(id);
function render(){
  $("incidentCount").textContent=(state.incidents||[]).length;
  $("unitCount").textContent=Object.keys(state.units||{}).length;
  $("callCount").textContent=(state.calls999||[]).length;
  $("connection").textContent=state.connected?"ONLINE":"OFFLINE";
  $("link").textContent=state.connected?"LIVE SERVER LINK":"WAITING FOR FIVEM";
}
async function load(){
  const r=await fetch("/api/state",{cache:"no-store"});
  const j=await r.json();
  if(j.state){state=j.state;render()}
}
function connect(){
  const es=new EventSource("/api/events");
  es.onmessage=e=>{
    try{
      const m=JSON.parse(e.data);
      if(m.type==="state"){state=m.payload;render()}
    }catch{}
  };
}
load();
connect();