(() => {
  const $ = id => document.getElementById(id);
  if(!$('tab-radio')) return;

  let identity=null, clientId='', eventSource=null, config={services:[]};
  let selectedService=null, selectedChannel=null, dial='';
  let activeCall=null, pc=null, localStream=null, localTrack=null, remoteAudio=null;
  let iceServers=[], floorHeld=false, callHoldTimer=null, callHoldStarted=0;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const api=async(url,opts={})=>{const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j};

  function state(text,cls=''){
    const el=$('radioCallState');if(!el)return;el.className='radioCallState'+(cls?' '+cls:'');el.textContent=text;
  }
  function setLink(text){if($('radioLinkState'))$('radioLinkState').textContent=text}
  function setCallsign(){if($('radioVehicleCallsign'))$('radioVehicleCallsign').textContent=identity?.callsign||'UNSET'}

  async function init(){
    remoteAudio=$('radioVehicleRemote');
    document.querySelectorAll('[data-radio-key]').forEach(b=>b.addEventListener('click',()=>{if(activeCall)return;dial=(dial+b.dataset.radioKey).slice(0,24);renderDial()}));
    $('radioClearDial')?.addEventListener('click',()=>{if(activeCall)return;dial='';renderDial()});
    bindCallButton();$('radioRedEnd')?.addEventListener('click',endCall);
    try{
      const sess=await api('/api/radio/session?role=vehicle'); identity=sess.identity;iceServers=sess.iceServers||[];setCallsign();
      const cfg=await api('/api/radio/config?role=vehicle');config=cfg.config||{services:[]};renderDirectory();connectEvents();setLink('RADIO ONLINE');
    }catch(e){setLink('RADIO UNAVAILABLE');state(e.message||'LOGIN REQUIRED');console.warn('[Guardian vehicle radio]',e)}
  }

  function renderDial(){if($('radioDialDisplay'))$('radioDialDisplay').textContent=dial||' '}
  function renderDirectory(){
    const sf=$('radioServiceFolders'),cl=$('radioChannelList');if(!sf||!cl)return;
    const services=(config.services||[]).filter(s=>(s.channels||[]).length);
    if(selectedService&&!services.some(s=>s.id===selectedService.id))selectedService=null;
    if(!selectedService&&services.length)selectedService=services[0];
    sf.innerHTML=services.map(s=>`<button type="button" data-service="${esc(s.id)}" class="${selectedService?.id===s.id?'active':''}">${esc(s.name)}</button>`).join('')||'<div class="radioEmpty">NO OPEN SERVICES</div>';
    sf.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{selectedService=services.find(s=>s.id===b.dataset.service)||null;selectedChannel=null;renderDirectory();updateSelected()});
    const channels=selectedService?.channels||[];
    cl.innerHTML=channels.map(c=>`<button type="button" data-channel="${esc(c.id)}" class="${selectedChannel?.id===c.id?'active':''}">${esc(c.name)}</button>`).join('')||'<div class="radioEmpty">NO OPEN CHANNELS</div>';
    cl.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>selectChannel(channels.find(c=>c.id===b.dataset.channel)));
    updateSelected();
  }
  async function selectChannel(ch){
    if(activeCall||!ch||!clientId)return;
    try{await api('/api/radio/channel',{method:'POST',body:JSON.stringify({role:'vehicle',clientId,channelId:ch.id})});selectedChannel=ch;renderDirectory();state('READY')}
    catch(e){state(e.message||'CHANNEL UNAVAILABLE')}
  }
  function updateSelected(){
    if($('radioSelectedService'))$('radioSelectedService').textContent=selectedService?.name||'SELECT SERVICE';
    if($('radioSelectedChannel'))$('radioSelectedChannel').textContent=selectedChannel?.name||'SELECT OPEN CHANNEL';
  }

  function connectEvents(){
    eventSource?.close();const temp=`veh-${Math.random().toString(36).slice(2)}`;
    eventSource=new EventSource(`/api/radio/events?role=vehicle&clientId=${encodeURIComponent(temp)}`);
    eventSource.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.type==='hello'){clientId=m.client?.id||'';setLink('RADIO ONLINE')}
      else if(m.type==='radio_config'){config=m.config||config;renderDirectory()}
      else if(m.type==='radio_call')handleCallEvent(m)
      else if(m.type==='signal')handleSignal(m).catch(console.error)
      else if(m.type==='floor')handleFloor(m.floor)
    };
    eventSource.onerror=()=>setLink('RADIO RECONNECTING');
  }

  function bindCallButton(){
    const btn=$('radioGreenCall');if(!btn)return;
    btn.addEventListener('pointerdown',e=>{e.preventDefault(); if(activeCall?.status==='connected'){startPtt();return} if(activeCall)return; beginCallHold()});
    const up=e=>{e.preventDefault(); if(activeCall?.status==='connected'){stopPtt();return} cancelCallHold()};
    btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',e=>{if(e.buttons)up(e)});
  }
  function beginCallHold(){
    if(!selectedChannel){state('SELECT AN OPEN CHANNEL');return}
    const btn=$('radioGreenCall');callHoldStarted=Date.now();btn?.classList.add('holding');if(btn)btn.textContent='KEEP HOLDING…';state('HOLD TO CALL');
    clearTimeout(callHoldTimer);callHoldTimer=setTimeout(()=>{callHoldTimer=null;placeCall().catch(e=>state(e.message||'CALL FAILED'))},850);
  }
  function cancelCallHold(){
    if(callHoldTimer){clearTimeout(callHoldTimer);callHoldTimer=null;state('READY')}
    const btn=$('radioGreenCall');btn?.classList.remove('holding');if(btn&&!activeCall)btn.textContent='HOLD TO CALL';
  }
  async function placeCall(){
    const btn=$('radioGreenCall');btn?.classList.remove('holding');if(btn)btn.textContent='CALLING…';
    const j=await api('/api/radio/call',{method:'POST',body:JSON.stringify({role:'vehicle',clientId,action:'request',channelId:selectedChannel.id,dialed:dial})});
    activeCall=j.call;state('RINGING CONTROL','ringing');$('radioRedEnd').disabled=false;
  }
  function handleCallEvent(m){
    const c=m.call;if(!c)return;
    if(activeCall&&c.id!==activeCall.id)return;
    if(m.action==='answered'){
      activeCall=c;state('CONNECTED — READY','connected');const btn=$('radioGreenCall');if(btn)btn.textContent='HOLD TO TALK';$('radioRedEnd').disabled=false;
      beginPeer(true).catch(e=>{console.error(e);state('MIC / AUDIO ERROR')});
    } else if(m.action==='rejected'){state('CALL REJECTED');resetCallSoon()}
    else if(m.action==='ended'){state('CALL ENDED');teardownPeer();resetCallSoon()}
  }

  async function ensureMic(){
    if(localStream)return localStream;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone unavailable on this device');
    localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    localTrack=localStream.getAudioTracks()[0]||null;if(localTrack)localTrack.enabled=false;return localStream;
  }
  function makePeer(){
    if(pc)return pc;pc=new RTCPeerConnection({iceServers});
    pc.onicecandidate=e=>{if(e.candidate&&activeCall?.controlClientId)signal('ice',e.candidate,activeCall.controlClientId)};
    pc.ontrack=e=>{if(remoteAudio){remoteAudio.srcObject=e.streams[0];remoteAudio.play().catch(()=>{})}};
    pc.onconnectionstatechange=()=>{if(pc&&['failed','disconnected'].includes(pc.connectionState))state('RADIO LINK INTERRUPTED')};
    return pc;
  }
  async function beginPeer(offerer){
    await ensureMic();const peer=makePeer();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(offerer&&activeCall?.controlClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.controlClientId)}
  }
  async function handleSignal(m){
    if(!activeCall||!m.from)return;if(activeCall.controlClientId&&m.from.id!==activeCall.controlClientId)return;
    const peer=makePeer();await ensureMic();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(m.kind==='answer')await peer.setRemoteDescription(new RTCSessionDescription(m.data));
    else if(m.kind==='offer'){await peer.setRemoteDescription(new RTCSessionDescription(m.data));const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,m.from.id)}
    else if(m.kind==='ice'&&m.data)try{await peer.addIceCandidate(new RTCIceCandidate(m.data))}catch{}
    else if(m.kind==='hangup'){state('CALL ENDED');teardownPeer();resetCallSoon()}
  }
  async function signal(kind,data,target){if(!clientId)return;await api('/api/radio/signal',{method:'POST',body:JSON.stringify({role:'vehicle',fromId:clientId,target,kind,data})})}
  async function startPtt(){
    if(!activeCall||floorHeld)return;
    try{await ensureMic();const j=await api('/api/radio/floor',{method:'POST',body:JSON.stringify({role:'vehicle',clientId,action:'request'})});if(!j.granted){state('CHANNEL BUSY','rx');return}
      floorHeld=true;if(localTrack)localTrack.enabled=true;const btn=$('radioGreenCall');btn?.classList.add('tx');if(btn)btn.textContent='TRANSMITTING';state(`TX — ${identity?.callsign||''}`,'tx');
    }catch(e){state(e.message||'PTT FAILED')}
  }
  async function stopPtt(){
    if(localTrack)localTrack.enabled=false;const btn=$('radioGreenCall');btn?.classList.remove('tx');if(btn&&activeCall)btn.textContent='HOLD TO TALK';
    if(!floorHeld){if(activeCall)state('CONNECTED — READY','connected');return}floorHeld=false;
    try{await api('/api/radio/floor',{method:'POST',body:JSON.stringify({role:'vehicle',clientId,action:'release'})})}catch{}
    if(activeCall)state('CONNECTED — READY','connected');
  }
  function handleFloor(floor){
    if(!activeCall||floorHeld)return;
    if(floor?.holder&&floor.holder!==clientId)state(`${floor.callsign||'CONTROL'} TRANSMITTING`,'rx');
    else state('CONNECTED — READY','connected');
  }
  async function endCall(){
    if(!activeCall)return;const id=activeCall.id,target=activeCall.controlClientId;try{if(target)await signal('hangup',{},target)}catch{}
    try{await api('/api/radio/call',{method:'POST',body:JSON.stringify({role:'vehicle',clientId,action:'end',callId:id})})}catch{}
    state('CALL ENDED');teardownPeer();resetCallSoon();
  }
  function teardownPeer(){if(localTrack)localTrack.enabled=false;floorHeld=false;try{pc?.close()}catch{}pc=null;activeCall=null}
  function resetCallSoon(){setTimeout(()=>{if(activeCall)return;state('READY');const btn=$('radioGreenCall');if(btn)btn.textContent='HOLD TO CALL';if($('radioRedEnd'))$('radioRedEnd').disabled=true},1200)}

  window.addEventListener('beforeunload',()=>{try{eventSource?.close()}catch{};try{localStream?.getTracks().forEach(t=>t.stop())}catch{}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
