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
  let controlChannel=null, channelPeers=new Map(), channelTx=false;

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
      renderDirectory(); renderCalls(); bindOutbound(); renderControlChannelOps(); connectEvents(); setOnline(true,'RADIO ONLINE');
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
      if(m.type==='presence'){presence=(m.clients||[]).filter(c=>['vehicle','mdt'].includes(c.role));renderPresence();renderDirectory();syncControlChannelPeers().catch(console.error);}
      if(m.type==='radio_call') handleCallEvent(m);
      if(m.type==='radio_config_admin'){ config=m.config||config; renderDirectory(); renderControlChannelOps(); }
      if(m.type==='signal'){ const task=(m.data&&m.data.guardianChannel===true)?handleControlGroupSignal(m):handleSignal(m); Promise.resolve(task).catch(err=>{console.error('[Guardian control signal]',err);const el=$('radioTxState');if(el)el.textContent=`AUDIO ERROR: ${String(err?.name||'ERROR')}`;}); }
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
      if(c.controlClientId===clientId){ outboundRinging=null; activeCall=c; closeAllControlChannelPeers(); connectAckTone(); beginPeer(false).catch(console.error); renderOutboundState(); }
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
      activeCall=j.call; closeAllControlChannelPeers(); calls=calls.filter(c=>c.id!==id); renderCalls(); renderActive();
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
    if(localStream&&localStream.getAudioTracks().some(t=>t.readyState==='live')){localTrack=localStream.getAudioTracks()[0]||null;return localStream}
    releaseMic();await sleep(250);
    localStream=await openDefaultMic();
    localTrack=localStream.getAudioTracks()[0]||null;
    if(!localTrack)throw new DOMException('No microphone detected','NotFoundError');
    localTrack.enabled=false;
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
    box.innerHTML=`<div class="radioConnectedCard"><div class="radioConnectedTop"><div><span class="panelKicker">CONNECTED RADIO CALL</span><h3>${esc(activeCall.callsign)}</h3><div class="radioConnectedMeta">${esc(activeCall.serviceName)} · ${esc(activeCall.channelName)} · URGENCY ${esc(activeCall.urgency||'1')}</div></div><strong id="radioTxState">LIVE VOICE</strong></div><div class="radioConnectedActions"><button id="radioDirectPtt" class="radioPtt">HOLD TO TALK TO UNIT</button><button id="radioEndCall" class="radioEnd">END CALL</button></div></div>`;
    $('radioEndCall').onclick=endCall;const dp=$('radioDirectPtt');if(dp){dp.onpointerdown=e=>{e.preventDefault();controlDirectPtt(true)};dp.onpointerup=e=>{e.preventDefault();controlDirectPtt(false)};dp.onpointercancel=()=>controlDirectPtt(false)}renderOutboundState();
  }
  async function endCall(){
    if(!activeCall)return;const id=activeCall.id;const target=activeCall.vehicleClientId;
    try{await signal('hangup',{},target)}catch{}
    try{await radioFetch('/api/radio/call',{method:'POST',body:JSON.stringify({role:'control',clientId,action:'end',callId:id})})}catch{}
    teardownPeer();
  }
  function teardownPeer(){if(localTrack)localTrack.enabled=false;floorHeld=false;try{pc?.close()}catch{}pc=null;activeCall=null;outboundRinging=null;renderActive();renderOutboundState();syncControlChannelPeers().catch(console.error)}

  async function controlDirectPtt(down){
    if(!activeCall)return;
    const btn=$('radioDirectPtt');
    if(down){
      try{await ensureMic();const peer=makePeer();if(localTrack){const sender=peer.getSenders().find(s=>s.track?.kind==='audio');if(sender){try{await sender.replaceTrack(localTrack)}catch{}}else peer.addTrack(localTrack,localStream);localTrack.enabled=true;}if(btn){btn.classList.add('tx');btn.textContent='TRANSMITTING'}const st=$('radioTxState');if(st)st.textContent='CONTROL TX';}
      catch(e){alert(friendlyMicError(e))}
    }else{
      if(localTrack)localTrack.enabled=false;if(btn){btn.classList.remove('tx');btn.textContent='HOLD TO TALK TO UNIT'}const st=$('radioTxState');if(st)st.textContent='LIVE VOICE';
    }
  }

  function channelAudio(peerId){
    const id='guardianControlChannelAudio_'+String(peerId).replace(/[^a-zA-Z0-9_-]/g,'');
    let a=document.getElementById(id);if(!a){a=document.createElement('audio');a.id=id;a.autoplay=true;a.playsInline=true;a.style.display='none';document.body.appendChild(a)}return a;
  }
  function closeControlChannelPeer(id){const g=channelPeers.get(id);if(!g)return;try{g.pc.close()}catch{};try{g.audio.remove()}catch{}channelPeers.delete(id)}
  function closeAllControlChannelPeers(){for(const id of [...channelPeers.keys()])closeControlChannelPeer(id)}
  function makeControlChannelPeer(peer){
    const rtc=new RTCPeerConnection({iceServers}),audio=channelAudio(peer.id);const g={pc:rtc,audio,peer};channelPeers.set(peer.id,g);
    rtc.onicecandidate=e=>{if(e.candidate&&controlChannel)signal('ice',{guardianChannel:true,channelId:controlChannel.id,candidate:e.candidate},peer.id).catch(console.error)};
    rtc.ontrack=e=>{const st=e.streams&&e.streams[0];if(st)audio.srcObject=st;else if(e.track){const ms=new MediaStream();ms.addTrack(e.track);audio.srcObject=ms}audio.muted=false;audio.volume=1;audio.play().catch(()=>{})};
    rtc.onconnectionstatechange=()=>{if(['failed','closed'].includes(rtc.connectionState))closeControlChannelPeer(peer.id)};
    try{rtc.addTransceiver('audio',{direction:'sendrecv'})}catch{}
    return g;
  }
  async function startControlChannelOffer(peer){const g=channelPeers.get(peer.id)||makeControlChannelPeer(peer);const offer=await g.pc.createOffer();await g.pc.setLocalDescription(offer);await signal('offer',{guardianChannel:true,channelId:controlChannel.id,sdp:offer},peer.id)}
  async function syncControlChannelPeers(){
    if(!clientId||!controlChannel){closeAllControlChannelPeers();return}
    const wanted=(presence||[]).filter(c=>c.channelId===controlChannel.id);const ids=new Set(wanted.map(c=>c.id));
    for(const id of [...channelPeers.keys()])if(!ids.has(id))closeControlChannelPeer(id);
    for(const peer of wanted)if(!channelPeers.has(peer.id)){makeControlChannelPeer(peer);if(String(clientId)<String(peer.id))await startControlChannelOffer(peer)}
    renderControlChannelOps();
  }
  async function handleControlGroupSignal(m){
    const d=m.data||{},peer=m.from;if(!peer||!controlChannel||d.channelId!==controlChannel.id)return;
    const g=channelPeers.get(peer.id)||makeControlChannelPeer(peer);
    if(d.sdp&&m.kind==='offer'){await g.pc.setRemoteDescription(d.sdp);const ans=await g.pc.createAnswer();await g.pc.setLocalDescription(ans);await signal('answer',{guardianChannel:true,channelId:controlChannel.id,sdp:ans},peer.id)}
    else if(d.sdp&&m.kind==='answer')await g.pc.setRemoteDescription(d.sdp);
    else if(d.candidate&&m.kind==='ice'){try{await g.pc.addIceCandidate(d.candidate)}catch(e){console.warn('[Guardian control channel ICE]',e)}}
  }
  async function setControlChannel(channelId){
    if(!clientId)return alert('Control radio is still connecting.');
    if(!channelId){await radioFetch('/api/radio/channel',{method:'POST',body:JSON.stringify({role:'control',clientId,channelId:''})});controlChannel=null;closeAllControlChannelPeers();renderControlChannelOps();renderDirectory();return;}
    const found=(config.services||[]).flatMap(s=>(s.channels||[]).map(c=>({service:s,channel:c}))).find(x=>x.channel.id===channelId);
    if(!found||!found.channel.open)return alert('That channel is closed.');
    await radioFetch('/api/radio/channel',{method:'POST',body:JSON.stringify({role:'control',clientId,channelId})});controlChannel={id:found.channel.id,name:found.channel.name,serviceName:found.service.name};closeAllControlChannelPeers();renderControlChannelOps();renderDirectory();await syncControlChannelPeers();
  }
  async function controlChannelPtt(down){
    if(!controlChannel)return;
    const btn=$('radioControlChannelPtt');
    if(down){
      try{await ensureMic();for(const g of channelPeers.values()){const sender=g.pc.getSenders().find(s=>s.track?.kind==='audio')||g.pc.getTransceivers().find(t=>t.sender&&t.receiver?.track?.kind==='audio')?.sender;if(sender&&localTrack){try{await sender.replaceTrack(localTrack)}catch{}}}if(localTrack)localTrack.enabled=true;channelTx=true;if(btn){btn.classList.add('tx');btn.textContent='TRANSMITTING'}}catch(e){alert(friendlyMicError(e))}
    }else{channelTx=false;if(localTrack)localTrack.enabled=false;if(btn){btn.classList.remove('tx');btn.textContent='HOLD PTT'}}
  }
  function renderControlChannelOps(){
    const box=$('radioControlChannelOps');if(!box)return;
    const open=(config.services||[]).flatMap(s=>(s.channels||[]).filter(c=>c.open).map(c=>({service:s,channel:c})));
    box.innerHTML=`<select id="radioControlChannelSelect"><option value="">NULL — NO CHANNEL</option>${open.map(x=>`<option value="${esc(x.channel.id)}">${esc(x.channel.name)} — ${esc(x.service.name)}</option>`).join('')}</select><button id="radioControlJoin" class="secondaryBtn">${controlChannel?'CHANGE':'MONITOR'}</button><button id="radioControlChannelPtt" class="channelPtt" ${controlChannel?'':'disabled'}>HOLD PTT</button><div class="radioControlChannelStatus"><span>CONTROL TALKGROUP</span><strong>${esc(controlChannel?.name||'NULL')}</strong><span>${controlChannel?`${(presence||[]).filter(c=>c.channelId===controlChannel.id).length} units · monitoring live audio`:'Select a channel to hear everyone on that net'}</span></div>`;
    const sel=$('radioControlChannelSelect');if(controlChannel&&sel)sel.value=controlChannel.id;
    $('radioControlJoin').onclick=()=>setControlChannel(sel?.value||'').catch(e=>alert(e.message));
    const ptt=$('radioControlChannelPtt');if(ptt){ptt.onpointerdown=e=>{e.preventDefault();controlChannelPtt(true)};ptt.onpointerup=e=>{e.preventDefault();controlChannelPtt(false)};ptt.onpointercancel=()=>controlChannelPtt(false)}
  }

  function renderDirectory(){
    const box=$('radioDirectoryAdmin');if(!box)return;
    box.innerHTML=(config.services||[]).map((s,si)=>`<details class="radioServiceAdmin" ${si<3?'open':''}><summary>${esc(s.name)}</summary><div>${(s.channels||[]).map(c=>{const listeners=(presence||[]).filter(x=>x.channelId===c.id).length;const active=controlChannel?.id===c.id;return `<div class="radioChannelAdmin radioChannelStatus"><strong>${esc(c.name)}<small>${listeners} UNIT${listeners===1?'':'S'} ON CHANNEL${active?' · CONTROL MONITORING':''}</small></strong><label class="radioOpenToggle"><input type="checkbox" data-ropen-id="${esc(c.id)}" ${c.open?'checked':''}> OPEN</label><button class="radioMonitorBtn" data-rmonitor-id="${esc(c.id)}" ${c.open?'':'disabled'}>${active?'ON CHANNEL':'MONITOR'}</button></div>`}).join('')||'<div class="radioChannelAdmin"><span>No channels configured</span></div>'}</div></details>`).join('');
    box.querySelectorAll('[data-ropen-id]').forEach(el=>el.onchange=async()=>{
      const id=el.dataset.ropenId,open=el.checked;el.disabled=true;
      try{await radioFetch('/api/radio/open',{method:'POST',body:JSON.stringify({channelId:id,open})});const found=(config.services||[]).flatMap(s=>s.channels||[]).find(c=>c.id===id);if(found)found.open=open;if(!open&&controlChannel?.id===id)await setControlChannel('');renderDirectory();renderControlChannelOps()}
      catch(e){el.checked=!open;alert(`Unable to change channel state: ${e.message}`)}finally{el.disabled=false}
    });
    box.querySelectorAll('[data-rmonitor-id]').forEach(btn=>btn.onclick=()=>setControlChannel(btn.dataset.rmonitorId).catch(e=>alert(e.message)));
  }

  window.addEventListener('beforeunload',()=>{try{eventSource?.close()}catch{};closeAllControlChannelPeers();try{localStream?.getTracks().forEach(t=>t.stop())}catch{}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
