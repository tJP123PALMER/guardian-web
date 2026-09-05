(() => {
  const $ = id => document.getElementById(id);
  const tab = $('tab-radio');
  if (!tab) return;

  const vehicleMode = new URLSearchParams(location.search).get('vehicle') === '1';
  const radioRole = vehicleMode ? 'vehicle' : 'mdt';
  let powered = false, connecting = false, identity = null, clientId = '', eventSource = null;
  let config = {services:[]}, iceServers = [], selectedChannel = null, selectedService = null;
  let menuLevel = 'main', cursor = 0, activeCall = null, pc = null, localStream = null, localTrack = null;
  let remoteAudio = null, keyHoldTimer = null, keyHoldFired = false, reconnectTimer = null, lastIdentityKey = '';
  const mainItems = [
    {id:'messages', label:'Messages', icon:'✉', disabled:true},
    {id:'contacts', label:'Contacts', icon:'▣'},
    {id:'radio-info', label:'Radio Info', icon:'ⓘ', disabled:true}
  ];

  const currentCallsign = () => {
    const vals = [$('guardianWebAssignedCallsign')?.textContent,$('callsignBox')?.textContent,$('guardianWebCallsign')?.value]
      .map(v=>String(v||'').trim().toUpperCase());
    return vals.find(v=>v && !['UNSET','UNASSIGNED','AWAITING CALLSIGN','SELECT APPLIANCE…'].includes(v)) || '';
  };
  const roleQs = () => `role=${encodeURIComponent(radioRole)}${radioRole==='mdt'?`&callsign=${encodeURIComponent(currentCallsign())}`:''}`;
  const withIdentity = obj => ({...(obj||{}),role:radioRole,...(radioRole==='mdt'?{callsign:currentCallsign()}:{})});
  const api = async (url,opts={}) => {
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});
    let j={};try{j=await r.json()}catch{};if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;
  };
  const state=(text,cls='')=>{const e=$('radioCallState');if(e){e.className='mtmLcdState'+(cls?' '+cls:'');e.textContent=text}};
  const hint=(text,cls='')=>{const e=$('radioUrgencyState');if(e){e.className=cls;e.textContent=text}};
  const setLink=t=>{if($('radioLinkState'))$('radioLinkState').textContent=t};
  const setCallsign=()=>{if($('radioVehicleCallsign'))$('radioVehicleCallsign').textContent=identity?.callsign||currentCallsign()||'UNSET'};
  const setMic=t=>{if($('radioMicState'))$('radioMicState').textContent=t};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const micIsLive=()=>!!(localStream&&localStream.getAudioTracks().some(t=>t.readyState==='live'));
  function releaseMic(){if(localStream){try{localStream.getTracks().forEach(t=>t.stop())}catch{}}localStream=null;localTrack=null;}

  function services(){return (config.services||[]).filter(s=>(s.channels||[]).some(c=>c.open===true));}
  function openChannels(s){return (s?.channels||[]).filter(c=>c.open===true);}
  function currentMenu(){
    if(menuLevel==='main')return mainItems;
    if(menuLevel==='services')return services().map(s=>({id:s.id,label:s.name,icon:'▸',raw:s}));
    if(menuLevel==='channels')return openChannels(selectedService).map(c=>({id:c.id,label:c.name,icon:'•',raw:c}));
    return mainItems;
  }
  function renderMenu(){
    const title=$('radioMenuTitle'),list=$('radioMenuList');if(!title||!list)return;
    title.textContent=menuLevel==='main'?'Main Menu':menuLevel==='services'?'Contacts':(selectedService?.name||'Talkgroups');
    const items=currentMenu();if(cursor>=items.length)cursor=Math.max(0,items.length-1);
    list.innerHTML=items.length?items.map((x,i)=>`<div class="mtmMenuItem${i===cursor?' selected':''}${x.disabled?' disabled':''}" data-mi="${i}"><span class="mtmMenuIcon">${x.icon||'•'}</span><span>${String(x.label||'')}</span></div>`).join(''):'<div class="mtmMenuItem selected">NO OPEN TALKGROUPS</div>';
    list.querySelectorAll('[data-mi]').forEach(el=>el.addEventListener('click',()=>{cursor=Number(el.dataset.mi);renderMenu();selectMenuItem()}));
    if($('radioSelectedService'))$('radioSelectedService').textContent=selectedService?.name||'CONTACTS';
    if($('radioSelectedChannel'))$('radioSelectedChannel').textContent=selectedChannel?.name||'NONE';
  }
  function moveCursor(delta){if(!powered)return;const items=currentMenu();if(!items.length)return;cursor=(cursor+delta+items.length)%items.length;renderMenu()}
  function goBack(){if(!powered)return;if(menuLevel==='channels'){menuLevel='services';cursor=Math.max(0,services().findIndex(s=>s.id===selectedService?.id));}else if(menuLevel==='services'){menuLevel='main';cursor=1;}renderMenu()}
  async function selectMenuItem(){
    if(!powered)return;const item=currentMenu()[cursor];if(!item||item.disabled)return;
    if(menuLevel==='main'&&item.id==='contacts'){menuLevel='services';cursor=0;renderMenu();return;}
    if(menuLevel==='services'){selectedService=item.raw;menuLevel='channels';cursor=0;renderMenu();return;}
    if(menuLevel==='channels'){await selectChannel(item.raw);}
  }

  async function powerOn(){
    if(powered){
      if(micIsLive()){setMic('MIC READY');hint('MIC READY — SELECT CONTACTS / TALKGROUP');return;}
      setMic('RETRYING MIC…');hint('RELEASING AUDIO DEVICE AND RETRYING…');releaseMic();await sleep(650);
      try{await ensureMic();if(localTrack)localTrack.enabled=false;setMic('MIC READY');state(selectedChannel?`REGISTERED ${selectedChannel.name}`:'REGISTERED — OPEN CONTACTS');hint('MIC READY — HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH');}
      catch(e){console.error('[Guardian vehicle mic retry]',e);setMic('MIC ERROR');state('MIC / AUDIO ERROR','error');hint(friendlyMicError(e),'error');}
      return;
    }
    powered=true;tab.classList.remove('radioOff');$('radioPowerOn')?.classList.add('on');
    setMic('CHECKING MIC…');state('REGISTERING…');hint('INITIALISING RADIO AUDIO');
    // Open the microphone from the user's green-button gesture. Android WebView is
    // much more reliable when getUserMedia starts from an explicit tap instead of
    // waiting for a later SSE/WebRTC event from Control.
    try{
      await ensureMic();
      if(localTrack)localTrack.enabled=false;
      setMic('MIC READY');
      hint('SELECT CONTACTS AND AN OPEN TALKGROUP');
    }catch(e){
      console.error('[Guardian vehicle mic]',e);
      setMic('MIC ERROR');
      state('MIC / AUDIO ERROR','error');
      hint(friendlyMicError(e),'error');
      // Keep the radio UI usable so the operator can retry after connecting/changing a mic.
    }
    menuLevel='main';cursor=1;renderMenu();await ensureRadio(true);
  }
  async function powerOff(){
    if(activeCall)await endCall();powered=false;clearTimeout(reconnectTimer);eventSource?.close();eventSource=null;clientId='';identity=null;lastIdentityKey='';selectedChannel=null;selectedService=null;menuLevel='main';cursor=1;
    teardownPeer(true);tab.classList.add('radioOff');$('radioPowerOn')?.classList.remove('on');setLink('OFF');setMic('RADIO OFF');state('PRESS GREEN TO START RADIO');hint('RADIO OFF');setCallsign();renderMenu();
  }
  function scheduleRetry(msg){clearTimeout(reconnectTimer);if(!powered)return;if(msg)state(msg,'error');reconnectTimer=setTimeout(()=>ensureRadio(false),1800)}
  async function ensureRadio(force=false){
    if(!powered||connecting)return;const cs=currentCallsign(),key=`${radioRole}:${cs}`;
    if(!force&&identity&&clientId&&lastIdentityKey===key)return;
    if(radioRole==='mdt'&&!cs){setLink('WAITING');setCallsign();scheduleRetry('BOOK ON TO USE RADIO');return;}
    connecting=true;setLink('CONNECTING');
    try{
      const sess=await api(`/api/radio/session?${roleQs()}`);identity=sess.identity;iceServers=sess.iceServers||[];lastIdentityKey=key;setCallsign();
      const cfg=await api(`/api/radio/config?${roleQs()}`);config=cfg.config||{services:[]};renderMenu();
      await connectEvents();setLink('REGISTERED');state(selectedChannel?`REGISTERED ${selectedChannel.name}`:'REGISTERED — OPEN CONTACTS');
    }catch(e){identity=null;clientId='';eventSource?.close();eventSource=null;setLink('RECONNECTING');scheduleRetry(e.message||'RADIO UNAVAILABLE');}
    finally{connecting=false}
  }
  function connectEvents(){return new Promise((resolve,reject)=>{
    eventSource?.close();clientId='';const temp=`radio-${Math.random().toString(36).slice(2)}`;const es=new EventSource(`/api/radio/events?${roleQs()}&clientId=${encodeURIComponent(temp)}`);eventSource=es;let done=false;
    const timer=setTimeout(()=>{if(!done){done=true;es.close();reject(new Error('Radio connection timed out'))}},7000);
    es.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.type==='hello'){clientId=m.client?.id||'';setLink('REGISTERED');if(!done){done=true;clearTimeout(timer);resolve()}}
      else if(m.type==='radio_config'){config=m.config||config;renderMenu()}
      else if(m.type==='radio_call')handleCallEvent(m)
      else if(m.type==='signal')handleSignal(m).catch(err=>{console.error(err);state('AUDIO LINK ERROR','error')});
    };
    es.onerror=()=>{setLink('RECONNECTING');if(!done){done=true;clearTimeout(timer);es.close();reject(new Error('Radio realtime connection failed'))}}
  })}
  async function selectChannel(ch){
    if(!ch||activeCall)return;if(!clientId){await ensureRadio(true);if(!clientId)return}
    try{const j=await api('/api/radio/channel',{method:'POST',body:JSON.stringify(withIdentity({clientId,channelId:ch.id}))});selectedChannel={id:j.channel.id,name:j.channel.name};state(`REGISTERED ${selectedChannel.name}`);hint('HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH');renderMenu()}
    catch(e){state(e.message||'TALKGROUP UNAVAILABLE','error')}
  }

  function bindNumberKeys(){
    document.querySelectorAll('[data-radio-key]').forEach(btn=>{
      const key=btn.dataset.radioKey;
      const down=e=>{e.preventDefault();if(!powered||activeCall||!/^[0-9]$/.test(key))return;keyHoldFired=false;btn.classList.add('holding');hint(`HOLDING ${key}…`);clearTimeout(keyHoldTimer);keyHoldTimer=setTimeout(()=>{keyHoldFired=true;btn.classList.add('sent');requestSpeech(key).finally(()=>setTimeout(()=>btn.classList.remove('sent'),500))},2000)};
      const up=e=>{e.preventDefault();clearTimeout(keyHoldTimer);keyHoldTimer=null;btn.classList.remove('holding');if(!keyHoldFired&&powered&&!activeCall){hint(key==='1'?'HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH':`HOLD ${key} FOR 2 SECONDS TO SEND URGENCY ${key}`)}keyHoldFired=false};
      btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',e=>{if(e.buttons)up(e)});
    });
  }
  async function requestSpeech(urgency){
    if(!selectedChannel){state('SELECT A TALKGROUP FIRST','error');hint('CONTACTS → SERVICE → TALKGROUP');return}
    if(!clientId){await ensureRadio(true);if(!clientId)return}
    try{const j=await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'request',channelId:selectedChannel.id,urgency:String(urgency)}))});activeCall=j.call;state('CALL REQUEST SENT','ringing');hint(`WAITING FOR CONTROL — URGENCY ${urgency}`,'ringing');setMic('MIC STANDBY')}
    catch(e){state(e.message||'CALL REQUEST FAILED','error');hint('TRY AGAIN','error')}
  }
  function handleCallEvent(m){const c=m.call;if(!c)return;if(activeCall&&c.id!==activeCall.id)return;
    if(m.action==='answered'){activeCall=c;state('CONNECTING AUDIO…','connected');hint('CONTROL ANSWERED — OPENING VOICE LINK','connected');beginPeer(true).then(()=>{setMic('MIC LIVE')}).catch(e=>{console.error(e);setMic('MIC ERROR');state('MIC / AUDIO ERROR','error');hint(friendlyMicError(e),'error')})}
    else if(m.action==='rejected'){state('CALL REJECTED','error');hint('CONTROL REJECTED REQUEST','error');resetCallSoon()}
    else if(m.action==='ended'){state('CALL ENDED');hint('HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH');teardownPeer(false);resetCallSoon()}
  }

  function friendlyMicError(e){
    const n=String(e?.name||'');
    if(n==='NotAllowedError'||n==='SecurityError')return 'MICROPHONE PERMISSION DENIED — ALLOW GUARDIAN MICROPHONE ACCESS';
    if(n==='NotFoundError'||n==='DevicesNotFoundError')return 'NO MICROPHONE DETECTED — CONNECT MIC THEN PRESS GREEN AGAIN';
    if(n==='NotReadableError'||n==='TrackStartError')return 'MICROPHONE BUSY — CLOSE OTHER AUDIO APPS AND RETRY';
    if(n==='OverconstrainedError'||n==='ConstraintNotSatisfiedError')return 'MIC SETTINGS NOT SUPPORTED — RETRYING DEFAULT MIC';
    return e?.message||'COULD NOT START AUDIO SOURCE';
  }
  async function openDefaultMic(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone unavailable on this device');
    let firstErr=null;
    // Head units sometimes leave the audio device in a transient busy state after
    // Bluetooth/phone/WebView activity. Retry the platform default before pinning a deviceId.
    for(let attempt=0;attempt<3;attempt++){
      try{return await navigator.mediaDevices.getUserMedia({audio:true,video:false})}
      catch(e){if(!firstErr)firstErr=e;if(!['NotReadableError','TrackStartError','AbortError'].includes(String(e?.name||'')))break;await sleep(650+attempt*350)}
    }
    try{
      const devs=await navigator.mediaDevices.enumerateDevices();
      const inputs=devs.filter(d=>d.kind==='audioinput'&&d.deviceId);
      for(const d of inputs){
        try{return await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:d.deviceId}},video:false})}
        catch(e){if(!firstErr)firstErr=e;await sleep(250)}
      }
    }catch{}
    throw firstErr||new DOMException('Could not start audio source','NotReadableError');
  }
  async function ensureMic(){
    if(micIsLive()){localTrack=localStream.getAudioTracks()[0]||null;return localStream;}
    releaseMic();
    await sleep(300);
    localStream=await openDefaultMic();
    localTrack=localStream.getAudioTracks()[0]||null;
    if(!localTrack)throw new DOMException('No microphone detected','NotFoundError');
    localTrack.onended=()=>{setMic('MIC DISCONNECTED');};
    return localStream;
  }
  async function playRemote(){
    if(!remoteAudio)return;
    remoteAudio.autoplay=true;remoteAudio.muted=false;remoteAudio.volume=1;
    try{await remoteAudio.play()}catch(e){console.warn('[Guardian remote audio autoplay]',e);hint('TAP RADIO SCREEN ONCE TO ENABLE SPEAKER AUDIO','error')}
  }
  function makePeer(){if(pc)return pc;pc=new RTCPeerConnection({iceServers});pc.onicecandidate=e=>{if(e.candidate&&activeCall?.controlClientId)signal('ice',e.candidate,activeCall.controlClientId)};pc.ontrack=e=>{if(remoteAudio){remoteAudio.srcObject=e.streams[0]||new MediaStream([e.track]);playRemote()}};pc.onconnectionstatechange=()=>{if(!pc)return;if(pc.connectionState==='connected'){state('CONNECTED TO CONTROL','connected');hint('LIVE VOICE — SPEAK NORMALLY','connected');playRemote()}else if(['failed','disconnected'].includes(pc.connectionState)){state('VOICE LINK INTERRUPTED','error')}};return pc}
  async function beginPeer(offerer){await ensureMic();if(localTrack)localTrack.enabled=true;const peer=makePeer();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);if(offerer&&activeCall?.controlClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.controlClientId)}}
  async function handleSignal(m){if(!activeCall||!m.from)return;if(activeCall.controlClientId&&m.from.id!==activeCall.controlClientId)return;const peer=makePeer();await ensureMic();if(localTrack)localTrack.enabled=true;if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(m.kind==='answer')await peer.setRemoteDescription(new RTCSessionDescription(m.data));
    else if(m.kind==='offer'){await peer.setRemoteDescription(new RTCSessionDescription(m.data));const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,m.from.id)}
    else if(m.kind==='ice'&&m.data)try{await peer.addIceCandidate(new RTCIceCandidate(m.data))}catch{}
    else if(m.kind==='hangup'){state('CALL ENDED');teardownPeer(false);resetCallSoon()}}
  async function signal(kind,data,target){if(!clientId)return;await api('/api/radio/signal',{method:'POST',body:JSON.stringify(withIdentity({fromId:clientId,target,kind,data}))})}
  async function endCall(){if(!activeCall)return;const id=activeCall.id,target=activeCall.controlClientId;try{if(target)await signal('hangup',{},target)}catch{};try{await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'end',callId:id}))})}catch{};teardownPeer(false);resetCall()}
  function teardownPeer(stopStream){try{pc?.close()}catch{};pc=null;if(localTrack)localTrack.enabled=false;if(stopStream)releaseMic()activeCall=null}
  function resetCall(){activeCall=null;if(localTrack)localTrack.enabled=false;setMic(powered?'RADIO ON':'RADIO OFF');if(powered){state(selectedChannel?`REGISTERED ${selectedChannel.name}`:'REGISTERED — OPEN CONTACTS');hint('HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH')}else{state('PRESS GREEN TO START RADIO');hint('RADIO OFF')}}
  function resetCallSoon(){setTimeout(resetCall,1300)}

  function bindControls(){
    remoteAudio=$('radioVehicleRemote');$('radioPowerOn')?.addEventListener('click',powerOn);$('radioPowerOff')?.addEventListener('click',powerOff);
    $('radioNavUp')?.addEventListener('click',()=>moveCursor(-1));$('radioNavDown')?.addEventListener('click',()=>moveCursor(1));$('radioNavLeft')?.addEventListener('click',goBack);$('radioNavRight')?.addEventListener('click',selectMenuItem);$('radioNavSelect')?.addEventListener('click',selectMenuItem);$('radioSelectSoft')?.addEventListener('click',selectMenuItem);$('radioBackSoft')?.addEventListener('click',goBack);bindNumberKeys();
    $('radioStatusBtn')?.addEventListener('click',()=>{if(powered)ensureRadio(false);renderMenu();playRemote()});tab.addEventListener('pointerdown',()=>{if(remoteAudio?.srcObject)playRemote()},{passive:true});
  }
  function watchIdentity(){
    const reauth=()=>{if(!powered)return;const k=`${radioRole}:${currentCallsign()}`;if(k!==lastIdentityKey){identity=null;clientId='';eventSource?.close();eventSource=null;ensureRadio(true)}};
    const box=$('callsignBox');if(box)new MutationObserver(reauth).observe(box,{childList:true,subtree:true,characterData:true});
    const assigned=$('guardianWebAssignedCallsign');if(assigned)new MutationObserver(reauth).observe(assigned,{childList:true,subtree:true,characterData:true});
    const select=$('guardianWebCallsign');if(select)select.addEventListener('change',()=>setTimeout(reauth,100));
  }
  window.addEventListener('beforeunload',()=>{clearTimeout(reconnectTimer);clearTimeout(keyHoldTimer);try{eventSource?.close()}catch{};teardownPeer(true)});
  const start=()=>{tab.classList.add('radioOff');bindControls();watchIdentity();cursor=1;renderMenu();setCallsign();setLink('OFF');state('PRESS GREEN TO START RADIO');hint('RADIO OFF')};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
