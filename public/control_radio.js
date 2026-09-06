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
  let ringTimer=null; let audioCtx=null; let presence=[]; let outboundRinging=null;

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
      renderDirectory(); renderCalls(); bindOutbound(); connectEvents(); setOnline(true,'RADIO ONLINE');
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
      if(m.type==='presence'){presence=(m.clients||[]).filter(c=>['vehicle','mdt'].includes(c.role));renderPresence();}
      if(m.type==='radio_call') handleCallEvent(m);
      if(m.type==='radio_config_admin'){ config=m.config||config; renderDirectory(); }
      if(m.type==='signal') handleSignal(m).catch(err=>{console.error('[Guardian control signal]',err);const el=$('radioTxState');if(el)el.textContent=`AUDIO ERROR: ${String(err?.name||'ERROR')}`;});
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
  function controlDialTone(){
    try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const now=audioCtx.currentTime;[620,820].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;g.gain.value=.045;o.connect(g);g.connect(audioCtx.destination);o.start(now+i*.13);o.stop(now+i*.13+.11)})}catch{}
  }
  function connectAckTone(){
    try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const now=audioCtx.currentTime;[700,1050].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;g.gain.value=.05;o.connect(g);g.connect(audioCtx.destination);o.start(now+i*.12);o.stop(now+i*.12+.1)})}catch{}
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
    if(m.action==='control_ringing'){
      if(c.controlClientId===clientId){outboundRinging=c;controlDialTone();renderOutboundState();}
    }
    if(m.action==='answered'){
      if(c.controlClientId===clientId){ outboundRinging=null; activeCall=c; connectAckTone(); beginPeer(false).catch(console.error); renderOutboundState(); }
      else if(activeCall?.id===c.id) activeCall=c;
    }
    if(['ended','rejected'].includes(m.action)){
      if(outboundRinging?.id===c.id){outboundRinging=null;renderOutboundState();}
      if(activeCall?.id===c.id) teardownPeer();
    }
    renderCalls(); renderActive(); updateRinger();
  }

  function bindOutbound(){
    $('radioCallUnit')?.addEventListener('click',callSelectedUnit);
    renderPresence();renderOutboundState();
  }
  function renderPresence(){
    const sel=$('radioContactUnit');if(!sel)return;
    const current=sel.value;
    const rows=presence.filter(c=>c.id&&c.callsign&&c.callsign!=='CONTROL').sort((a,b)=>String(a.callsign).localeCompare(String(b.callsign)));
    sel.innerHTML=rows.length?rows.map(c=>`<option value="${esc(c.id)}">${esc(c.callsign)}${c.channelName?` — ${esc(c.channelName)}`:''}</option>`).join(''):'<option value="">No online units</option>';
    if(rows.some(c=>c.id===current))sel.value=current;
  }
  function renderOutboundState(){
    const box=document.querySelector('.radioOutbound'),btn=$('radioCallUnit');if(!box||!btn)return;
    box.classList.toggle('ringing',!!outboundRinging);
    btn.textContent=outboundRinging?`RINGING ${outboundRinging.callsign}`:'CALL UNIT';
    btn.disabled=!!outboundRinging||!!activeCall;
  }
  async function callSelectedUnit(){
    const target=$('radioContactUnit')?.value;if(!target)return alert('No online Guardian radio selected.');
    try{
      const j=await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'control_request',targetClientId:target})});
      outboundRinging=j.call;controlDialTone();renderOutboundState();
    }catch(e){alert(`Unable to call unit: ${e.message}`)}
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
    }catch(e){alert(`Unable to answer: ${friendlyMicError(e)}`)}
  }
  async function rejectCall(id){
    try{await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'reject',callId:id})});calls=calls.filter(c=>c.id!==id);renderCalls()}catch(e){alert(e.message)}
  }

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function releaseMic(){if(localStream){try{localStream.getTracks().forEach(t=>t.stop())}catch{}}localStream=null;localTrack=null;}

  function friendlyMicError(e){
    const n=String(e?.name||'');
    if(n==='NotAllowedError'||n==='SecurityError')return 'Microphone permission denied. Allow microphone access for Guardian Control.';
    if(n==='NotFoundError'||n==='DevicesNotFoundError')return 'No microphone detected by the browser. Plug in/enable a mic and refresh Control.';
    if(n==='NotReadableError'||n==='TrackStartError')return 'Microphone is busy or unavailable. Close other audio apps and try again.';
    return e?.message||'Could not start microphone';
  }
  async function openDefaultMic(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not support microphone capture');
    let firstErr=null;
    for(let attempt=0;attempt<3;attempt++){
      try{return await navigator.mediaDevices.getUserMedia({audio:true,video:false})}
      catch(e){if(!firstErr)firstErr=e;if(!['NotReadableError','TrackStartError','AbortError'].includes(String(e?.name||'')))break;await sleep(600+attempt*300)}
    }
    try{
      const devs=await navigator.mediaDevices.enumerateDevices();
      for(const d of devs.filter(d=>d.kind==='audioinput'&&d.deviceId)){
        try{return await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:d.deviceId}},video:false})}catch(e){if(!firstErr)firstErr=e;await sleep(200)}
      }
    }catch{}
    throw firstErr||new DOMException('Could not start microphone','NotReadableError');
  }
  async function ensureMic(){
    if(localStream&&localStream.getAudioTracks().some(t=>t.readyState==='live')){localTrack=localStream.getAudioTracks()[0]||null;if(localTrack)localTrack.enabled=true;return localStream}
    releaseMic();await sleep(250);
    localStream=await openDefaultMic();
    localTrack=localStream.getAudioTracks()[0]||null;
    if(!localTrack)throw new DOMException('No microphone detected','NotFoundError');
    localTrack.enabled=true;
    return localStream;
  }
  async function playRemote(){
    if(!remoteAudio)return;
    remoteAudio.autoplay=true;remoteAudio.muted=false;remoteAudio.volume=1;
    try{await remoteAudio.play()}catch(e){console.warn('[Guardian control remote audio]',e)}
  }
  let pendingIce=[];
  function makePeer(){
    if(pc)return pc;
    pc=new RTCPeerConnection({iceServers});
    pendingIce=[];
    pc.onicecandidate=e=>{if(e.candidate&&activeCall?.vehicleClientId)signal('ice',e.candidate,activeCall.vehicleClientId).catch(console.error)};
    pc.ontrack=e=>{
      if(!remoteAudio)return;
      const stream=e.streams&&e.streams[0];
      remoteAudio.srcObject=stream||remoteAudio.srcObject;
      if(!stream&&e.track){try{const ms=new MediaStream();ms.addTrack(e.track);remoteAudio.srcObject=ms}catch{}}
      playRemote();
    };
    return pc;
  }
  async function flushIce(peer){if(!peer.remoteDescription)return;const q=pendingIce.splice(0);for(const c of q){try{await peer.addIceCandidate(c)}catch(e){console.warn('[Guardian control ICE]',e)}}}
  async function beginPeer(offerer){
    await ensureMic(); const peer=makePeer();
    if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack)) peer.addTrack(localTrack,localStream);
    if(offerer&&activeCall?.vehicleClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.vehicleClientId)}
  }
  async function handleSignal(m){
    const from=m.from;if(!activeCall||!from)return;
    if(from.id!==activeCall.vehicleClientId)return;
    const peer=makePeer();await ensureMic();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(m.kind==='offer'){
      await peer.setRemoteDescription(m.data);await flushIce(peer);
      const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,from.id);
    }else if(m.kind==='answer'){await peer.setRemoteDescription(m.data);await flushIce(peer);}
    else if(m.kind==='ice'&&m.data){if(peer.remoteDescription){try{await peer.addIceCandidate(m.data)}catch(e){console.warn('[Guardian control ICE]',e)}}else pendingIce.push(m.data);}
    else if(m.kind==='hangup')teardownPeer();
  }
  async function signal(kind,data,target){if(!clientId)return;await radioFetch('/api/radio/signal',{method:'POST',body:JSON.stringify({role:'control',fromId:clientId,target,kind,data})})}

  function renderActive(){
    const box=$('radioActiveCall');if(!box)return;
    if(!activeCall){box.innerHTML='';renderOutboundState();return}
    box.innerHTML=`<div class="radioConnectedCard"><div class="radioConnectedTop"><div><span class="panelKicker">CONNECTED RADIO CALL</span><h3>${esc(activeCall.callsign)}</h3><div class="radioConnectedMeta">${esc(activeCall.serviceName)} · ${esc(activeCall.channelName)} · URGENCY ${esc(activeCall.urgency||'1')}</div></div><strong id="radioTxState">LIVE VOICE</strong></div><div class="radioConnectedActions"><div class="radioLiveVoice">MICROPHONES OPEN — SPEAK NORMALLY</div><button id="radioEndCall" class="radioEnd">END CALL</button></div></div>`;
    $('radioEndCall').onclick=endCall;renderOutboundState();
  }
  async function endCall(){
    if(!activeCall)return;const id=activeCall.id;const target=activeCall.vehicleClientId;
    try{await signal('hangup',{},target)}catch{}
    try{await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'end',callId:id})})}catch{}
    teardownPeer();
  }
  function teardownPeer(){if(localTrack)localTrack.enabled=false;floorHeld=false;try{pc?.close()}catch{}pc=null;activeCall=null;outboundRinging=null;renderActive();renderOutboundState()}

  function renderDirectory(){
    const box=$('radioDirectoryAdmin');if(!box)return;
    box.innerHTML=(config.services||[]).map((s,si)=>`<details class="radioServiceAdmin" ${si<3?'open':''}><summary>${esc(s.name)}</summary><div>${(s.channels||[]).map(c=>`<div class="radioChannelAdmin radioChannelStatus"><strong>${esc(c.name)}</strong><label class="radioOpenToggle"><input type="checkbox" data-ropen-id="${esc(c.id)}" ${c.open?'checked':''}> OPEN</label><span>${c.open?'AVAILABLE':'CLOSED'}</span></div>`).join('')||'<div class="radioChannelAdmin"><span>No channels configured</span></div>'}</div></details>`).join('');
    box.querySelectorAll('[data-ropen-id]').forEach(el=>el.onchange=async()=>{
      const id=el.dataset.ropenId,open=el.checked;
      el.disabled=true;
      try{await radioFetch('/api/radio/open',{method:'POST',body:JSON.stringify({channelId:id,open})});const found=(config.services||[]).flatMap(s=>s.channels||[]).find(c=>c.id===id);if(found)found.open=open;renderDirectory()}
      catch(e){el.checked=!open;alert(`Unable to change channel state: ${e.message}`)}
      finally{el.disabled=false}
    });
  }

  window.addEventListener('beforeunload',()=>{try{eventSource?.close()}catch{};try{localStream?.getTracks().forEach(t=>t.stop())}catch{}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
