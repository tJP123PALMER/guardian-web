(() => {
  const $ = id => document.getElementById(id);
  let clientId = "";
  let eventSource = null;
  let config = { services: [] };
  let calls = [];
  let activeCall = null;
  let pc = null;
  let localStream = null;
  let localTrack = null;
  let remoteAudio = null;
  let iceServers = [];
  let floorHeld = false;
  let ringTimer=null; let audioCtx=null;

  const esc = s => String(s ?? "").replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const radioFetch = async (url, opts={}) => {
    const r = await fetch(url, { credentials:"same-origin", headers:{"Content-Type":"application/json", ...(opts.headers||{})}, ...opts });
    let j={}; try{j=await r.json()}catch{}
    if(!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  };

  function setOnline(ok, text){
    const box=$('radioControlState')?.parentElement?.querySelector('.radioControlState') || document.querySelector('.radioControlState');
    if(box) box.classList.toggle('online',!!ok);
    if($('radioControlState')) $('radioControlState').textContent=text || (ok?'ONLINE':'OFFLINE');
  }

  async function init(){
    remoteAudio=$('radioControlRemote');
    try{
      const sess=await radioFetch('/api/radio/session?role=control');
      iceServers=sess.iceServers||[];
      const cfg=await radioFetch('/api/radio/config?role=control'); config=cfg.config||{services:[]};
      const cq=await radioFetch('/api/radio/calls'); calls=cq.calls||[];
      renderDirectory(); renderCalls(); connectEvents(); setOnline(true,'RADIO ONLINE');
    }catch(e){
      console.warn('[Guardian radio control]',e); setOnline(false,'LOGIN REQUIRED');
      if($('radioIncomingCalls')) $('radioIncomingCalls').innerHTML=`<div class="emptyState"><strong>Radio unavailable</strong><span>${esc(e.message)}</span></div>`;
    }
  }

  function connectEvents(){
    eventSource?.close();
    const temp=`ctrl-${Math.random().toString(36).slice(2)}`;
    eventSource=new EventSource(`/api/radio/events?role=control&clientId=${encodeURIComponent(temp)}`);
    eventSource.onmessage=e=>{
      let m; try{m=JSON.parse(e.data)}catch{return}
      if(m.type==='hello'){ clientId=m.client?.id||''; setOnline(true,'RADIO ONLINE'); }
      if(m.type==='radio_call') handleCallEvent(m);
      if(m.type==='radio_config'){ config=m.config||config; renderDirectory(); }
      if(m.type==='signal') handleSignal(m).catch(console.error);
      if(m.type==='floor') renderActive();
    };
    eventSource.onerror=()=>setOnline(false,'RECONNECTING');
  }

  function radioBeep(){
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.frequency.value=780;g.gain.value=.055;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.16);
    }catch{}
  }
  function updateRinger(){
    const ringing=calls.some(c=>c.status==='ringing');
    if(ringing&&!ringTimer){radioBeep();ringTimer=setInterval(radioBeep,1800)}
    if(!ringing&&ringTimer){clearInterval(ringTimer);ringTimer=null}
  }

  function handleCallEvent(m){
    const c=m.call;if(!c)return;
    calls=calls.filter(x=>x.id!==c.id);
    if(m.action==='ringing') calls.unshift(c);
    if(m.action==='answered'){
      if(c.controlClientId===clientId){ activeCall=c; beginPeer(false).catch(console.error); }
      else if(activeCall?.id===c.id) activeCall=c;
    }
    if(['ended','rejected'].includes(m.action)){
      if(activeCall?.id===c.id) teardownPeer();
    }
    renderCalls(); renderActive(); updateRinger();
  }

  function renderCalls(){
    const box=$('radioIncomingCalls'); if(!box)return;
    const ringing=calls.filter(c=>c.status==='ringing');
    if($('radioCallBadge')) $('radioCallBadge').textContent=String(ringing.length);
    box.innerHTML=ringing.length?ringing.map(c=>`<div class="radioCallCard">
      <div><strong>${esc(c.callsign)}</strong><span>${esc(c.serviceName)} · ${esc(c.channelName)} · URGENCY ${esc(c.urgency||'1')}</span><span>Incoming Guardian radio call</span></div>
      <div class="radioCallActions"><button class="radioAnswer" data-radio-answer="${esc(c.id)}">ANSWER</button><button class="radioReject" data-radio-reject="${esc(c.id)}">REJECT</button></div>
    </div>`).join(''):`<div class="emptyState"><strong>No incoming radio calls</strong><span>Vehicle call requests will ring here.</span></div>`;
    box.querySelectorAll('[data-radio-answer]').forEach(b=>b.onclick=()=>answerCall(b.dataset.radioAnswer));
    box.querySelectorAll('[data-radio-reject]').forEach(b=>b.onclick=()=>rejectCall(b.dataset.radioReject));
    updateRinger();
  }

  async function answerCall(id){
    try{
      await ensureMic();
      const j=await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'answer',callId:id})});
      activeCall=j.call; calls=calls.filter(c=>c.id!==id); renderCalls(); renderActive();
    }catch(e){alert(`Unable to answer: ${e.message}`)}
  }
  async function rejectCall(id){
    try{await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'reject',callId:id})});calls=calls.filter(c=>c.id!==id);renderCalls()}catch(e){alert(e.message)}
  }

  async function ensureMic(){
    if(localStream)return localStream;
    localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    localTrack=localStream.getAudioTracks()[0]||null;
    if(localTrack)localTrack.enabled=true;
    return localStream;
  }
  function makePeer(){
    if(pc)return pc;
    pc=new RTCPeerConnection({iceServers});
    pc.onicecandidate=e=>{if(e.candidate&&activeCall?.vehicleClientId)signal('ice',e.candidate,activeCall.vehicleClientId)};
    pc.ontrack=e=>{if(remoteAudio){remoteAudio.srcObject=e.streams[0];remoteAudio.play().catch(()=>{})}};
    return pc;
  }
  async function beginPeer(offerer){
    await ensureMic(); const peer=makePeer();
    if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack)) peer.addTrack(localTrack,localStream);
    if(offerer&&activeCall?.vehicleClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.vehicleClientId)}
  }
  async function handleSignal(m){
    const from=m.from;if(!activeCall||!from)return;
    if(from.id!==activeCall.vehicleClientId)return;
    const peer=makePeer(); await ensureMic(); if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(m.kind==='offer'){
      await peer.setRemoteDescription(new RTCSessionDescription(m.data));
      const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,from.id);
    } else if(m.kind==='answer') await peer.setRemoteDescription(new RTCSessionDescription(m.data));
    else if(m.kind==='ice'&&m.data) try{await peer.addIceCandidate(new RTCIceCandidate(m.data))}catch{}
    else if(m.kind==='hangup') teardownPeer();
  }
  async function signal(kind,data,target){if(!clientId)return;await radioFetch('/api/radio/signal',{method:'POST',body:JSON.stringify({role:'control',fromId:clientId,target,kind,data})})}

  function renderActive(){
    const box=$('radioActiveCall');if(!box)return;
    if(!activeCall){box.innerHTML='';return}
    box.innerHTML=`<div class="radioConnectedCard"><div class="radioConnectedTop"><div><span class="panelKicker">CONNECTED RADIO CALL</span><h3>${esc(activeCall.callsign)}</h3><div class="radioConnectedMeta">${esc(activeCall.serviceName)} · ${esc(activeCall.channelName)} · URGENCY ${esc(activeCall.urgency||'1')}</div></div><strong id="radioTxState">LIVE VOICE</strong></div><div class="radioConnectedActions"><div class="radioLiveVoice">MICROPHONES OPEN — SPEAK NORMALLY</div><button id="radioEndCall" class="radioEnd">END CALL</button></div></div>`;
    $('radioEndCall').onclick=endCall;
  }
  async function endCall(){
    if(!activeCall)return;const id=activeCall.id;const target=activeCall.vehicleClientId;
    try{await signal('hangup',{},target)}catch{}
    try{await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'end',callId:id})})}catch{}
    teardownPeer();
  }
  function teardownPeer(){if(localTrack)localTrack.enabled=false;floorHeld=false;try{pc?.close()}catch{}pc=null;activeCall=null;renderActive()}

  function renderDirectory(){
    const box=$('radioDirectoryAdmin');if(!box)return;
    box.innerHTML=(config.services||[]).map((s,si)=>`<details class="radioServiceAdmin" ${si<3?'open':''}><summary>${esc(s.name)}</summary><div>${(s.channels||[]).map((c,ci)=>`<div class="radioChannelAdmin"><input type="text" value="${esc(c.name)}" data-rname="${si}:${ci}"><label class="radioOpenToggle"><input type="checkbox" data-ropen="${si}:${ci}" ${c.open?'checked':''}> OPEN</label><span>${c.open?'AVAILABLE':'CLOSED'}</span></div>`).join('')||'<div class="radioChannelAdmin"><span>No channels configured</span></div>'}<button class="secondary radioChannelSave" data-add-channel="${si}">ADD CHANNEL</button></div></details>`).join('');
    box.querySelectorAll('[data-rname]').forEach(el=>el.onchange=()=>{const [si,ci]=el.dataset.rname.split(':').map(Number);config.services[si].channels[ci].name=el.value.trim()||config.services[si].channels[ci].name;saveConfig()});
    box.querySelectorAll('[data-ropen]').forEach(el=>el.onchange=()=>{const [si,ci]=el.dataset.ropen.split(':').map(Number);config.services[si].channels[ci].open=el.checked;saveConfig()});
    box.querySelectorAll('[data-add-channel]').forEach(b=>b.onclick=()=>{const si=Number(b.dataset.addChannel);const name=prompt(`New channel for ${config.services[si].name}:`);if(!name)return;config.services[si].channels.push({id:`${config.services[si].id}-${Date.now().toString(36)}`,name:name.trim(),open:true});saveConfig()});
  }
  async function saveConfig(){try{const j=await radioFetch('/api/radio/config',{method:'POST',body:JSON.stringify({config})});config=j.config;renderDirectory()}catch(e){alert(`Unable to save radio channels: ${e.message}`)}}

  window.addEventListener('beforeunload',()=>{try{eventSource?.close()}catch{};try{localStream?.getTracks().forEach(t=>t.stop())}catch{}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
