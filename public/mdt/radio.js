(() => {
  const $ = id => document.getElementById(id);
  if (!$('tab-radio')) return;

  let identity = null, clientId = '', eventSource = null, config = { services: [] };
  const vehicleMode = new URLSearchParams(location.search).get('vehicle') === '1';
  const radioRole = vehicleMode ? 'vehicle' : 'mdt';
  let selectedService = null, selectedChannel = null, dial = '';
  let activeCall = null, pc = null, localStream = null, localTrack = null, remoteAudio = null;
  let iceServers = [], floorHeld = false, callHoldTimer = null;
  let reconnectTimer = null, connecting = false, bound = false, lastIdentityKey = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentCallsign = () => {
    const vals = [
      $('guardianWebAssignedCallsign')?.textContent,
      $('callsignBox')?.textContent,
      $('guardianWebCallsign')?.value
    ].map(v => String(v || '').trim().toUpperCase());
    return vals.find(v => v && !['UNSET','UNASSIGNED','AWAITING CALLSIGN','SELECT APPLIANCE…'].includes(v)) || '';
  };
  const roleQs = () => `role=${encodeURIComponent(radioRole)}${radioRole === 'mdt' ? `&callsign=${encodeURIComponent(currentCallsign())}` : ''}`;
  const withIdentity = (obj = {}) => ({ ...obj, role: radioRole, ...(radioRole === 'mdt' ? { callsign: currentCallsign() } : {}) });
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json', ...(opts.headers||{})}, ...opts });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  };

  function state(text, cls='') { const el=$('radioCallState'); if(el){el.className='radioCallState'+(cls?' '+cls:'');el.textContent=text;} }
  function setLink(text) { if($('radioLinkState')) $('radioLinkState').textContent=text; }
  function setCallsign() { if($('radioVehicleCallsign')) $('radioVehicleCallsign').textContent=identity?.callsign || currentCallsign() || 'UNSET'; }
  function renderDial(){ if($('radioDialDisplay')) $('radioDialDisplay').textContent=dial || '\u00a0'; }

  function bindControlsOnce(){
    if(bound) return; bound=true; remoteAudio=$('radioVehicleRemote');
    document.querySelectorAll('[data-radio-key]').forEach(b=>b.addEventListener('click',()=>{if(activeCall)return;dial=(dial+b.dataset.radioKey).slice(0,24);renderDial();}));
    $('radioClearDial')?.addEventListener('click',()=>{if(activeCall)return;dial='';renderDial();});
    $('radioRedEnd')?.addEventListener('click',endCall);
    const btn=$('radioGreenCall');
    if(btn){
      btn.addEventListener('pointerdown',e=>{e.preventDefault();if(activeCall?.status==='connected'){startPtt();return;}if(activeCall)return;beginCallHold();});
      const up=e=>{e.preventDefault();if(activeCall?.status==='connected'){stopPtt();return;}cancelCallHold();};
      btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',e=>{if(e.buttons)up(e);});
    }
    $('radioStatusBtn')?.addEventListener('click',()=>ensureRadio(true));
  }

  function scheduleRetry(message){
    clearTimeout(reconnectTimer);
    if(message) state(message);
    reconnectTimer=setTimeout(()=>ensureRadio(false),1500);
  }

  async function ensureRadio(force=false){
    if(connecting)return;
    const cs=currentCallsign();
    const key=`${radioRole}:${cs}`;
    if(!force && identity && clientId && lastIdentityKey===key) return;
    if(radioRole==='mdt'&&!cs){ setLink('WAITING FOR BOOK ON'); setCallsign(); scheduleRetry('BOOK ON TO USE RADIO'); return; }
    connecting=true; setLink('RADIO CONNECTING');
    try{
      // Load the directory independently on normal MDTs so open channels are visible
      // even while the realtime client is reconnecting.
      try{const cfg=await api(`/api/radio/config?${roleQs()}`);config=cfg.config||{services:[]};renderDirectory();}catch{}
      const sess=await api(`/api/radio/session?${roleQs()}`);
      identity=sess.identity; iceServers=sess.iceServers||[]; lastIdentityKey=key; setCallsign();
      if(vehicleMode && !identity?.callsign) throw new Error('Awaiting callsign assignment — contact Control');
      await connectEvents();
      const cfg=await api(`/api/radio/config?${roleQs()}`); config=cfg.config||{services:[]};renderDirectory();
      setLink('RADIO ONLINE'); if(!activeCall) state(selectedChannel?'READY':'SELECT AN OPEN CHANNEL');
    }catch(e){
      identity=null;clientId='';eventSource?.close();eventSource=null;setCallsign();setLink('RADIO RECONNECTING');
      const msg=e.message||'RADIO UNAVAILABLE';state(msg);scheduleRetry(msg);
    }finally{connecting=false;}
  }

  function renderDirectory(){
    const sf=$('radioServiceFolders'),cl=$('radioChannelList');if(!sf||!cl)return;
    const services=(config.services||[]).filter(s=>(s.channels||[]).length);
    if(selectedService&&!services.some(s=>s.id===selectedService.id))selectedService=null;
    if(!selectedService&&services.length)selectedService=services[0];
    sf.innerHTML=services.map(s=>`<button type="button" data-service="${esc(s.id)}" class="${selectedService?.id===s.id?'active':''}">${esc(s.name)}</button>`).join('')||'<div class="radioEmpty">NO OPEN SERVICES</div>';
    sf.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{selectedService=services.find(s=>s.id===b.dataset.service)||null;selectedChannel=null;renderDirectory();updateSelected();});
    const channels=selectedService?.channels||[];
    cl.innerHTML=channels.map(c=>`<button type="button" data-channel="${esc(c.id)}" class="${selectedChannel?.id===c.id?'active':''}">${esc(c.name)}</button>`).join('')||'<div class="radioEmpty">NO OPEN CHANNELS</div>';
    cl.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>selectChannel(channels.find(c=>c.id===b.dataset.channel)));
    updateSelected();
  }

  async function selectChannel(ch){
    if(activeCall||!ch)return;
    if(!clientId){state('RADIO CONNECTING');await ensureRadio(true);if(!clientId)return;}
    try{await api('/api/radio/channel',{method:'POST',body:JSON.stringify(withIdentity({clientId,channelId:ch.id}))});selectedChannel=ch;renderDirectory();state('READY');}
    catch(e){state(e.message||'CHANNEL UNAVAILABLE');ensureRadio(true);}
  }
  function updateSelected(){
    if($('radioSelectedService'))$('radioSelectedService').textContent=selectedService?.name||'SELECT SERVICE';
    if($('radioSelectedChannel'))$('radioSelectedChannel').textContent=selectedChannel?.name||'SELECT OPEN CHANNEL';
  }

  function connectEvents(){
    return new Promise((resolve,reject)=>{
      eventSource?.close();clientId='';
      const temp=`radio-${Math.random().toString(36).slice(2)}`;
      const es=new EventSource(`/api/radio/events?${roleQs()}&clientId=${encodeURIComponent(temp)}`);eventSource=es;
      let settled=false;
      const timer=setTimeout(()=>{if(!settled){settled=true;es.close();reject(new Error('Radio realtime connection timed out'));}},7000);
      es.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
        if(m.type==='hello'){clientId=m.client?.id||'';setLink('RADIO ONLINE');if(!settled){settled=true;clearTimeout(timer);resolve();}}
        else if(m.type==='radio_config'){config=m.config||config;renderDirectory();}
        else if(m.type==='radio_call')handleCallEvent(m);
        else if(m.type==='signal')handleSignal(m).catch(console.error);
        else if(m.type==='floor')handleFloor(m.floor);
      };
      es.onerror=()=>{setLink('RADIO RECONNECTING');if(!settled){settled=true;clearTimeout(timer);es.close();reject(new Error('Radio realtime connection failed'));}};
    });
  }

  function beginCallHold(){
    if(!selectedChannel){state('SELECT AN OPEN CHANNEL');return;}
    if(!clientId){state('RADIO CONNECTING');ensureRadio(true);return;}
    const btn=$('radioGreenCall');btn?.classList.add('holding');if(btn)btn.textContent='KEEP HOLDING…';state('HOLD TO CALL');
    clearTimeout(callHoldTimer);callHoldTimer=setTimeout(()=>{callHoldTimer=null;placeCall().catch(e=>{state(e.message||'CALL FAILED');ensureRadio(true);});},850);
  }
  function cancelCallHold(){if(callHoldTimer){clearTimeout(callHoldTimer);callHoldTimer=null;state(selectedChannel?'READY':'SELECT AN OPEN CHANNEL');}const btn=$('radioGreenCall');btn?.classList.remove('holding');if(btn&&!activeCall)btn.textContent='HOLD TO CALL';}
  async function placeCall(){const btn=$('radioGreenCall');btn?.classList.remove('holding');if(btn)btn.textContent='CALLING…';const j=await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'request',channelId:selectedChannel.id,dialed:dial}))});activeCall=j.call;state('RINGING CONTROL','ringing');$('radioRedEnd').disabled=false;}
  function handleCallEvent(m){const c=m.call;if(!c)return;if(activeCall&&c.id!==activeCall.id)return;if(m.action==='answered'){activeCall=c;state('CONNECTED — READY','connected');const btn=$('radioGreenCall');if(btn)btn.textContent='HOLD TO TALK';$('radioRedEnd').disabled=false;beginPeer(true).catch(e=>{console.error(e);state('MIC / AUDIO ERROR');});}else if(m.action==='rejected'){state('CALL REJECTED');resetCallSoon();}else if(m.action==='ended'){state('CALL ENDED');teardownPeer();resetCallSoon();}}

  async function ensureMic(){if(localStream)return localStream;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone unavailable on this device');localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});localTrack=localStream.getAudioTracks()[0]||null;if(localTrack)localTrack.enabled=false;return localStream;}
  function makePeer(){if(pc)return pc;pc=new RTCPeerConnection({iceServers});pc.onicecandidate=e=>{if(e.candidate&&activeCall?.controlClientId)signal('ice',e.candidate,activeCall.controlClientId);};pc.ontrack=e=>{if(remoteAudio){remoteAudio.srcObject=e.streams[0];remoteAudio.play().catch(()=>{});}};pc.onconnectionstatechange=()=>{if(pc&&['failed','disconnected'].includes(pc.connectionState))state('RADIO LINK INTERRUPTED');};return pc;}
  async function beginPeer(offerer){await ensureMic();const peer=makePeer();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);if(offerer&&activeCall?.controlClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.controlClientId);}}
  async function handleSignal(m){if(!activeCall||!m.from)return;if(activeCall.controlClientId&&m.from.id!==activeCall.controlClientId)return;const peer=makePeer();await ensureMic();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);if(m.kind==='answer')await peer.setRemoteDescription(new RTCSessionDescription(m.data));else if(m.kind==='offer'){await peer.setRemoteDescription(new RTCSessionDescription(m.data));const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,m.from.id);}else if(m.kind==='ice'&&m.data)try{await peer.addIceCandidate(new RTCIceCandidate(m.data));}catch{}else if(m.kind==='hangup'){state('CALL ENDED');teardownPeer();resetCallSoon();}}
  async function signal(kind,data,target){if(!clientId)return;await api('/api/radio/signal',{method:'POST',body:JSON.stringify(withIdentity({fromId:clientId,target,kind,data}))});}
  async function startPtt(){if(!activeCall||floorHeld)return;try{await ensureMic();const j=await api('/api/radio/floor',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'request'}))});if(!j.granted){state('CHANNEL BUSY','rx');return;}floorHeld=true;if(localTrack)localTrack.enabled=true;const btn=$('radioGreenCall');btn?.classList.add('tx');if(btn)btn.textContent='TRANSMITTING';state(`TX — ${identity?.callsign||currentCallsign()}`,'tx');}catch(e){state(e.message||'PTT FAILED');}}
  async function stopPtt(){if(localTrack)localTrack.enabled=false;if(!floorHeld)return;floorHeld=false;try{await api('/api/radio/floor',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'release'}))});}catch{}const btn=$('radioGreenCall');btn?.classList.remove('tx');if(btn)btn.textContent='HOLD TO TALK';state('CONNECTED — READY','connected');}
  function handleFloor(f){if(!activeCall)return;if(f?.holder&&f.holder!==clientId)state(`RX — ${f.callsign||'CONTROL'}`,'rx');else if(!floorHeld)state('CONNECTED — READY','connected');}
  async function endCall(){if(!activeCall)return;const id=activeCall.id,target=activeCall.controlClientId;try{if(target)await signal('hangup',{},target);}catch{}try{await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'end',callId:id}))});}catch{}teardownPeer();resetCall();}
  function teardownPeer(){if(localTrack)localTrack.enabled=false;floorHeld=false;try{pc?.close();}catch{}pc=null;activeCall=null;}
  function resetCall(){activeCall=null;const btn=$('radioGreenCall');btn?.classList.remove('tx','holding');if(btn)btn.textContent='HOLD TO CALL';if($('radioRedEnd'))$('radioRedEnd').disabled=true;state(selectedChannel?'READY':'SELECT AN OPEN CHANNEL');}
  function resetCallSoon(){setTimeout(resetCall,1400);}

  function watchIdentity(){
    const box=$('callsignBox');if(box)new MutationObserver(()=>{const k=`${radioRole}:${currentCallsign()}`;if(k!==lastIdentityKey){identity=null;clientId='';eventSource?.close();eventSource=null;ensureRadio(true);}}).observe(box,{childList:true,subtree:true,characterData:true});
    const assigned=$('guardianWebAssignedCallsign');if(assigned)new MutationObserver(()=>ensureRadio(true)).observe(assigned,{childList:true,subtree:true,characterData:true});
    const select=$('guardianWebCallsign');if(select)select.addEventListener('change',()=>setTimeout(()=>ensureRadio(true),150));
  }

  window.addEventListener('beforeunload',()=>{clearTimeout(reconnectTimer);try{eventSource?.close();}catch{}try{localStream?.getTracks().forEach(t=>t.stop());}catch{}});
  const start=()=>{bindControlsOnce();watchIdentity();renderDial();ensureRadio(true);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
