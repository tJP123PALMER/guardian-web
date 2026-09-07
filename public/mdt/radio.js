(() => {
  const $ = id => document.getElementById(id);
  const tab = $('tab-radio');
  if (!tab) return;

  const params = new URLSearchParams(location.search);
  const vehicleMode = params.get('vehicle') === '1';
  const fivemMode = params.get('fivem') === '1';
  const radioRole = vehicleMode ? 'vehicle' : 'mdt';
  let powered = false, connecting = false, identity = null, clientId = '', eventSource = null;
  let config = {services:[]}, iceServers = [], selectedChannel = null, selectedService = null;
  let menuLevel = 'main', cursor = 0, activeCall = null, pc = null, localStream = null, localTrack = null;
  let remoteAudio = null, keyHoldTimer = null, keyHoldFired = false, reconnectTimer = null, lastIdentityKey = '';
  let toneCtx=null, holdTone=null, incomingRingTimer=null, softwarePttTimer=null, softwarePttDown=false;
  let presence=[], groupPeers=new Map(), groupTx=false;
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
  function audioCtx(){try{toneCtx=toneCtx||new (window.AudioContext||window.webkitAudioContext)();if(toneCtx.state==='suspended')toneCtx.resume();return toneCtx}catch{return null}}
  function chirp(freq=880,dur=.12,gain=.055,delay=0){const c=audioCtx();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(gain,c.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+dur);o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur)}
  function connectTone(){chirp(660,.10,.055,0);chirp(990,.14,.06,.12)}
  function requestAckTone(){chirp(1050,.10,.05,0);chirp(1250,.10,.05,.11)}
  function startHoldTone(){if(holdTone)return;const c=audioCtx();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=425;g.gain.value=.022;o.connect(g);g.connect(c.destination);o.start();holdTone={o,g};}
  function stopHoldTone(){if(!holdTone)return;try{holdTone.g.gain.exponentialRampToValueAtTime(.001,toneCtx.currentTime+.05);holdTone.o.stop(toneCtx.currentTime+.06)}catch{}holdTone=null;}
  function ringBurst(){chirp(760,.18,.055,0);chirp(760,.18,.055,.28)}
  function keyTone(key){const map={'1':697,'2':770,'3':852,'4':697,'5':770,'6':852,'7':697,'8':770,'9':852,'*':697,'0':770,'#':852};chirp(map[key]||740,.075,.035,0)}
  function startIncomingRing(){if(incomingRingTimer)return;ringBurst();incomingRingTimer=setInterval(ringBurst,1450);tab.classList.add('controlIncoming')}
  function stopIncomingRing(){if(incomingRingTimer){clearInterval(incomingRingTimer);incomingRingTimer=null}tab.classList.remove('controlIncoming')}
  function notifyParent(type,payload={}){try{parent.postMessage({type,...payload},'*')}catch{}}
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
  function goHome(){if(!powered)return;menuLevel='main';cursor=1;renderMenu();state(selectedChannel?`CHANNEL ${selectedChannel.name} — MONITORING`:'MAIN MENU');hint(selectedChannel?'CHANNEL REMAINS ACTIVE · SELECT CONTACTS TO CHANGE':'CONTACTS → SELECT SERVICE / TALKGROUP');}
  async function selectMenuItem(){
    if(!powered)return;const item=currentMenu()[cursor];if(!item||item.disabled)return;
    if(menuLevel==='main'&&item.id==='contacts'){menuLevel='services';cursor=0;renderMenu();return;}
    if(menuLevel==='services'){selectedService=item.raw;menuLevel='channels';cursor=0;renderMenu();return;}
    if(menuLevel==='channels'){await selectChannel(item.raw);}
  }

  async function powerOn(){
    if(activeCall?.direction==='control_to_unit'&&activeCall.status==='ringing'){
      stopIncomingRing();
      try{
        const j=await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'answer',callId:activeCall.id}))});
        activeCall=j.call;state('CONNECTING AUDIO…','connected');hint('CONTROL CALL ACCEPTED — OPENING VOICE LINK','connected');connectTone();
        beginPeer(true).then(()=>setMic('MIC LIVE')).catch(e=>{setMic('MIC ERROR');state('MIC / AUDIO ERROR','error');hint(friendlyMicError(e),'error')});
      }catch(e){state(e.message||'UNABLE TO ANSWER CONTROL','error');}
      return;
    }
    if(powered){
      if(micIsLive()){setMic('MIC READY');hint('MIC READY — SELECT CONTACTS / TALKGROUP');return;}
      setMic('RETRYING MIC…');hint('RELEASING AUDIO DEVICE AND RETRYING…');releaseMic();
      await sleep(450);
      try{await ensureMic();if(localTrack)localTrack.enabled=false;setMic('MIC READY');hint('MIC READY — HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH');}
      catch(e){console.error('[Guardian vehicle mic retry]',e);setMic('MIC ERROR');hint(friendlyMicError(e),'error');}
      return;
    }

    // Power/register immediately. Microphone acquisition must never prevent the
    // radio UI from switching on; some Android head units take several seconds
    // to return getUserMedia().
    powered=true;
    tab.classList.remove('radioOff');
    $('radioPowerOn')?.classList.add('on');
    setLink('REGISTERING');
    setCallsign();
    setMic('CHECKING MIC…');
    state('RADIO ON — REGISTERING…');
    hint('OPEN CONTACTS AND SELECT A TALKGROUP');
    menuLevel='main';cursor=1;renderMenu();

    // Start backend registration immediately, independently of the microphone.
    ensureRadio(true).catch(e=>console.error('[Guardian radio register]',e));

    // The physical green-key gesture also primes the microphone, but any audio
    // failure is reported separately and does not switch the radio back off.
    try{
      await ensureMic();
      if(localTrack)localTrack.enabled=false;
      setMic('MIC READY');
      hint('SELECT CONTACTS AND AN OPEN TALKGROUP');
    }catch(e){
      console.error('[Guardian vehicle mic]',e);
      setMic('MIC ERROR');
      hint(friendlyMicError(e),'error');
    }
  }
  async function powerOff(){
    if(activeCall?.direction==='control_to_unit'&&activeCall.status==='ringing'){
      stopIncomingRing();
      try{await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'reject',callId:activeCall.id}))})}catch{}
      activeCall=null;state('CONTROL CALL REJECTED','error');hint('RADIO READY');return;
    }
    if(activeCall)await endCall();closeAllGroupPeers();powered=false;clearTimeout(reconnectTimer);eventSource?.close();eventSource=null;clientId='';identity=null;lastIdentityKey='';selectedChannel=null;selectedService=null;menuLevel='main';cursor=1;
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
      else if(m.type==='presence'){presence=m.clients||[];syncGroupPeers().catch(console.error)}
      else if(m.type==='radio_call')handleCallEvent(m)
      else if(m.type==='signal'){const gp=m.data&&m.data.guardianChannel===true?handleGroupSignal(m):handleSignal(m);Promise.resolve(gp).catch(err=>{console.error('[Guardian signal]',err);state('AUDIO LINK ERROR','error');hint(`VOICE SETUP FAILED: ${String(err?.name||'ERROR')} — ${String(err?.message||err||'UNKNOWN').slice(0,110)}`,'error')})}
    };
    es.onerror=()=>{setLink('RECONNECTING');if(!done){done=true;clearTimeout(timer);es.close();reject(new Error('Radio realtime connection failed'))}}
  })}
  async function selectChannel(ch){
    if(!ch||activeCall)return;if(!clientId){await ensureRadio(true);if(!clientId)return}
    try{const j=await api('/api/radio/channel',{method:'POST',body:JSON.stringify(withIdentity({clientId,channelId:ch.id}))});selectedChannel={id:j.channel.id,name:j.channel.name};closeAllGroupPeers();state(`CHANNEL ${selectedChannel.name} — MONITORING`);hint(fivemMode?'HOLD PTT TO TALK ON CHANNEL · HOLD 1 TO CALL CONTROL':'HOLD PTT TO TALK ON CHANNEL · HOLD 1 TO CALL CONTROL');renderMenu();syncGroupPeers().catch(console.error)}
    catch(e){state(e.message||'TALKGROUP UNAVAILABLE','error')}
  }


  function groupRemoteAudio(peerId){
    const safe=String(peerId).replace(/[^a-zA-Z0-9_-]/g,'');
    let a=document.getElementById(`guardianGroupAudio_${safe}`);
    if(!a){a=document.createElement('audio');a.id=`guardianGroupAudio_${safe}`;a.autoplay=true;a.playsInline=true;a.style.display='none';document.body.appendChild(a)}
    return a;
  }
  function closeGroupPeer(id){const g=groupPeers.get(id);if(!g)return;try{g.pc.close()}catch{};try{g.audio.remove()}catch{};groupPeers.delete(id)}
  function closeAllGroupPeers(){for(const id of [...groupPeers.keys()])closeGroupPeer(id)}
  async function attachTrackToGroupPeers(){if(!localTrack)return;for(const g of groupPeers.values()){const has=g.pc.getSenders().some(x=>x.track===localTrack);if(!has){try{g.pc.addTrack(localTrack,localStream)}catch{}}}}
  function createGroupPeer(peer){
    const rtc=new RTCPeerConnection({iceServers});const audio=groupRemoteAudio(peer.id);const g={pc:rtc,audio,peer};groupPeers.set(peer.id,g);
    rtc.onicecandidate=e=>{if(e.candidate&&selectedChannel)signal('ice',{guardianChannel:true,channelId:selectedChannel.id,candidate:e.candidate},peer.id).catch(console.error)};
    rtc.ontrack=e=>{const st=e.streams&&e.streams[0];if(st)audio.srcObject=st;else if(e.track){const ms=new MediaStream();ms.addTrack(e.track);audio.srcObject=ms}audio.muted=false;audio.volume=1;audio.play().catch(()=>{})};
    rtc.onconnectionstatechange=()=>{if(['failed','closed'].includes(rtc.connectionState))closeGroupPeer(peer.id)};
    if(localTrack){try{rtc.addTrack(localTrack,localStream)}catch{}}else{try{rtc.addTransceiver('audio',{direction:'recvonly'})}catch{}}
    return g;
  }
  async function startGroupOffer(peer){const g=groupPeers.get(peer.id)||createGroupPeer(peer);const offer=await g.pc.createOffer();await g.pc.setLocalDescription(offer);await signal('offer',{guardianChannel:true,channelId:selectedChannel.id,sdp:offer},peer.id)}
  async function syncGroupPeers(){
    if(!powered||!clientId||!selectedChannel){closeAllGroupPeers();return}
    const wanted=(presence||[]).filter(c=>c.id!==clientId&&['mdt','vehicle'].includes(c.role)&&c.channelId===selectedChannel.id);const ids=new Set(wanted.map(c=>c.id));
    for(const id of [...groupPeers.keys()])if(!ids.has(id))closeGroupPeer(id);
    for(const peer of wanted){if(!groupPeers.has(peer.id)){createGroupPeer(peer);if(String(clientId)<String(peer.id))await startGroupOffer(peer)}}
  }
  async function handleGroupSignal(m){
    const d=m.data||{},peer=m.from;if(!peer||!selectedChannel||d.channelId!==selectedChannel.id)return;
    let g=groupPeers.get(peer.id)||createGroupPeer(peer);
    if(d.sdp&&m.kind==='offer'){await g.pc.setRemoteDescription(d.sdp);const ans=await g.pc.createAnswer();await g.pc.setLocalDescription(ans);await signal('answer',{guardianChannel:true,channelId:selectedChannel.id,sdp:ans},peer.id)}
    else if(d.sdp&&m.kind==='answer'){await g.pc.setRemoteDescription(d.sdp)}
    else if(d.candidate&&m.kind==='ice'){try{await g.pc.addIceCandidate(d.candidate)}catch(e){console.warn('[Guardian channel ICE]',e)}}
  }
  async function channelPttStart(){
    if(!powered||!selectedChannel||groupTx)return;groupTx=true;startHoldTone();
    try{await ensureMic();await attachTrackToGroupPeers();if(localTrack)localTrack.enabled=true;document.getElementById('radioChannelPtt')?.classList.add('tx');setMic('TX');state(`TX ${selectedChannel.name}`,'connected');hint(`TRANSMITTING ON ${selectedChannel.name}`,'connected')}
    catch(e){groupTx=false;stopHoldTone();setMic('MIC ERROR');hint(friendlyMicError(e),'error')}
  }
  function channelPttStop(){if(!groupTx)return;groupTx=false;stopHoldTone();if(localTrack)localTrack.enabled=false;document.getElementById('radioChannelPtt')?.classList.remove('tx');setMic('RX');state(`CHANNEL ${selectedChannel?.name||''} — MONITORING`,'connected');hint('CHANNEL MONITORING · HOLD PTT TO TALK · HOLD 1 TO CALL CONTROL','connected')}

  function bindNumberKeys(){
    const buttons=new Map([...document.querySelectorAll('[data-radio-key]')].map(btn=>[String(btn.dataset.radioKey),btn]));
    const heldKeyboard=new Set();
    const pressKey=(key,btn,event)=>{
      if(event)event.preventDefault();
      keyTone(key);
      if(!powered||activeCall||!/^[0-9]$/.test(key))return;
      keyHoldFired=false;btn?.classList.add('holding');startHoldTone();hint(`HOLDING ${key}…`);
      clearTimeout(keyHoldTimer);
      keyHoldTimer=setTimeout(()=>{keyHoldFired=true;btn?.classList.add('sent');stopHoldTone();requestAckTone();requestSpeech(key).finally(()=>setTimeout(()=>btn?.classList.remove('sent'),500))},2000);
    };
    const releaseKey=(key,btn,event)=>{
      if(event)event.preventDefault();
      stopHoldTone();clearTimeout(keyHoldTimer);keyHoldTimer=null;btn?.classList.remove('holding');
      if(!keyHoldFired&&powered&&!activeCall&&/^[0-9]$/.test(key)){hint(key==='1'?'HOLD 1 FOR 2 SECONDS TO REQUEST SPEECH':`HOLD ${key} FOR 2 SECONDS TO SEND URGENCY ${key}`)}
      keyHoldFired=false;
    };
    buttons.forEach((btn,key)=>{
      const down=e=>pressKey(key,btn,e), up=e=>releaseKey(key,btn,e);
      btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',e=>{if(e.buttons)up(e)});
    });
    const keyFromEvent=e=>{
      if(/^Digit[0-9]$/.test(e.code))return e.code.slice(5);
      if(/^Numpad[0-9]$/.test(e.code))return e.code.slice(6);
      if(e.code==='NumpadMultiply'||e.key==='*')return '*';
      if(e.key==='#')return '#';
      return null;
    };
    window.addEventListener('keydown',e=>{
      const key=keyFromEvent(e);if(key===null)return;
      if(heldKeyboard.has(e.code)) { e.preventDefault(); return; }
      heldKeyboard.add(e.code);pressKey(key,buttons.get(key),e);
    },true);
    window.addEventListener('keyup',e=>{
      const key=keyFromEvent(e);if(key===null)return;
      heldKeyboard.delete(e.code);releaseKey(key,buttons.get(key),e);
    },true);
    window.addEventListener('blur',()=>{for(const code of [...heldKeyboard])heldKeyboard.delete(code);stopHoldTone();clearTimeout(keyHoldTimer);keyHoldTimer=null;buttons.forEach(b=>b.classList.remove('holding'));});
  }
  async function requestSpeech(urgency){
    if(!selectedChannel){state('SELECT A TALKGROUP FIRST','error');hint('CONTACTS → SERVICE → TALKGROUP');return}
    if(!clientId){await ensureRadio(true);if(!clientId)return}
    try{closeAllGroupPeers();const j=await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'request',channelId:selectedChannel.id,urgency:String(urgency)}))});activeCall=j.call;state('CALL REQUEST SENT','ringing');hint(`WAITING FOR CONTROL — URGENCY ${urgency}`,'ringing');setMic('MIC STANDBY')}
    catch(e){state(e.message||'CALL REQUEST FAILED','error');hint('TRY AGAIN','error')}
  }
  function handleCallEvent(m){const c=m.call;if(!c)return;if(activeCall&&c.id!==activeCall.id)return;
    if(m.action==='control_ringing'){
      closeAllGroupPeers();activeCall=c;activeCall.status='ringing';powered=true;tab.classList.remove('radioOff');$('radioPowerOn')?.classList.add('on');setLink('INCOMING');setCallsign();
      state('CONTROL CALLING','ringing');hint('PRESS GREEN OR PTT TO ANSWER — RED TO REJECT','ringing');setMic('MIC STANDBY');startIncomingRing();notifyParent('guardianRadioIncoming',{active:true,callsign:c.callsign||'',channel:c.channelName||''});
    }
    else if(m.action==='answered'){stopIncomingRing();notifyParent('guardianRadioIncoming',{active:false});activeCall=c;connectTone();state('CONNECTING AUDIO…','connected');hint(fivemMode?'CONTROL ANSWERED — HOLD PTT TO TRANSMIT':'CONTROL ANSWERED — OPENING VOICE LINK','connected');beginPeer(true).then(()=>{if(localTrack)localTrack.enabled=!fivemMode;setMic(fivemMode?'PTT READY':'MIC LIVE')}).catch(e=>{console.error(e);setMic('MIC ERROR');state('MIC / AUDIO ERROR','error');hint(friendlyMicError(e),'error')})}
    else if(m.action==='rejected'){stopIncomingRing();notifyParent('guardianRadioIncoming',{active:false});state('CALL REJECTED','error');hint('CONTROL REJECTED REQUEST','error');resetCallSoon()}
    else if(m.action==='ended'){stopIncomingRing();notifyParent('guardianRadioIncoming',{active:false});state('CALL ENDED');hint('HOLD 1 OR PTT FOR 2 SECONDS TO REQUEST SPEECH');teardownPeer(false);resetCallSoon()}
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
    await attachTrackToGroupPeers();
    return localStream;
  }
  async function playRemote(){
    if(!remoteAudio)return;
    remoteAudio.autoplay=true;remoteAudio.muted=false;remoteAudio.volume=1;
    try{await remoteAudio.play()}catch(e){console.warn('[Guardian remote audio autoplay]',e);hint('TAP RADIO SCREEN ONCE TO ENABLE SPEAKER AUDIO','error')}
  }
  let pendingIce=[];
  function makePeer(){
    if(pc)return pc;
    pc=new RTCPeerConnection({iceServers});
    pendingIce=[];
    pc.onicecandidate=e=>{if(e.candidate&&activeCall?.controlClientId)signal('ice',e.candidate,activeCall.controlClientId).catch(console.error)};
    pc.ontrack=e=>{
      if(!remoteAudio)return;
      const stream=e.streams&&e.streams[0];
      remoteAudio.srcObject=stream||remoteAudio.srcObject;
      if(!stream&&e.track){try{const ms=new MediaStream();ms.addTrack(e.track);remoteAudio.srcObject=ms}catch{}}
      playRemote();
    };
    const update=()=>{
      if(!pc)return;
      const st=pc.connectionState||pc.iceConnectionState||'';
      if(st==='connected'||st==='completed'){state('CONNECTED TO CONTROL','connected');if(fivemMode){if(localTrack)localTrack.enabled=false;setMic('PTT READY');hint('HOLD PTT TO TRANSMIT · RELEASE TO LISTEN','connected')}else{hint('LIVE VOICE — SPEAK NORMALLY','connected')}playRemote()}
      else if(st==='failed'){state('VOICE LINK FAILED','error');hint('WEBRTC CONNECTION FAILED — CHECK NETWORK / TURN','error')}
      else if(st==='disconnected'){state('VOICE LINK INTERRUPTED','error')}
    };
    pc.onconnectionstatechange=update;pc.oniceconnectionstatechange=update;
    return pc;
  }
  async function flushIce(peer){if(!peer.remoteDescription)return;const q=pendingIce.splice(0);for(const c of q){try{await peer.addIceCandidate(c)}catch(e){console.warn('[Guardian ICE]',e)}}}
  async function beginPeer(offerer){await ensureMic();if(localTrack)localTrack.enabled=!fivemMode;const peer=makePeer();if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);if(offerer&&activeCall?.controlClientId){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('offer',offer,activeCall.controlClientId)}}
  async function handleSignal(m){
    if(!activeCall||!m.from)return;
    if(activeCall.controlClientId&&m.from.id!==activeCall.controlClientId)return;
    const peer=makePeer();
    await ensureMic();
    if(localTrack)localTrack.enabled=!fivemMode;
    if(localTrack&&!peer.getSenders().some(s=>s.track===localTrack))peer.addTrack(localTrack,localStream);
    if(m.kind==='answer'){
      await peer.setRemoteDescription(m.data);
      await flushIce(peer);
    }else if(m.kind==='offer'){
      await peer.setRemoteDescription(m.data);
      await flushIce(peer);
      const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans,m.from.id);
    }else if(m.kind==='ice'&&m.data){
      if(peer.remoteDescription){try{await peer.addIceCandidate(m.data)}catch(e){console.warn('[Guardian ICE]',e)}}else pendingIce.push(m.data);
    }else if(m.kind==='hangup'){state('CALL ENDED');teardownPeer(false);resetCallSoon()}
  }
  async function signal(kind,data,target){if(!clientId)return;await api('/api/radio/signal',{method:'POST',body:JSON.stringify(withIdentity({fromId:clientId,target,kind,data}))})}
  async function endCall(){if(!activeCall)return;const id=activeCall.id,target=activeCall.controlClientId;try{if(target)await signal('hangup',{},target)}catch{};try{await api('/api/radio/call',{method:'POST',body:JSON.stringify(withIdentity({clientId,action:'end',callId:id}))})}catch{};teardownPeer(false);resetCall()}
  function teardownPeer(stopStream){try{pc?.close()}catch{};pc=null;if(localTrack)localTrack.enabled=false;if(stopStream)releaseMic();activeCall=null}
  function resetCall(){activeCall=null;if(localTrack)localTrack.enabled=false;setMic(powered?'RX':'RADIO OFF');if(powered){state(selectedChannel?`CHANNEL ${selectedChannel.name} — MONITORING`:'REGISTERED — OPEN CONTACTS');hint(selectedChannel?'HOLD PTT TO TALK · HOLD 1 TO CALL CONTROL':'SELECT CONTACTS / CHANNEL');syncGroupPeers().catch(console.error)}else{state('PRESS GREEN TO START RADIO');hint('RADIO OFF')}}
  function resetCallSoon(){setTimeout(resetCall,1300)}

  async function softwarePttStart(){
    if(!fivemMode||softwarePttDown||!powered)return;
    softwarePttDown=true;
    // Incoming direct call: PTT doubles as answer.
    if(activeCall?.direction==='control_to_unit'&&activeCall.status==='ringing'){
      requestAckTone();
      await powerOn();
      softwarePttDown=false;
      return;
    }
    // Connected call: hold-to-transmit.
    if(activeCall?.status==='connected'){
      try{await ensureMic();if(localTrack)localTrack.enabled=true;setMic('TX');state('TRANSMITTING','connected');hint('PTT HELD — TRANSMITTING TO CONTROL','connected');startHoldTone()}
      catch(e){setMic('MIC ERROR');hint(friendlyMicError(e),'error')}
      return;
    }
    // Idle on a selected channel: PTT is normal open-channel transmission.
    // Keypad 1 remains the point-to-point request to Control.
    if(activeCall)return;
    if(selectedChannel){await channelPttStart();return;}
    hint('SELECT A CHANNEL FIRST');
  }
  function softwarePttStop(){
    if(!fivemMode)return;
    softwarePttDown=false;clearTimeout(softwarePttTimer);softwarePttTimer=null;stopHoldTone();
    if(activeCall?.status==='connected'){if(localTrack)localTrack.enabled=false;setMic('PTT READY');state('CONNECTED TO CONTROL','connected');hint('HOLD PTT TO TRANSMIT · RELEASE TO LISTEN','connected')}
    else if(powered&&!activeCall){channelPttStop();hint(selectedChannel?'HOLD PTT TO TALK · HOLD 1 TO CALL CONTROL':'SELECT A TALKGROUP')}
  }

  function bindControls(){
    remoteAudio=$('radioVehicleRemote');
    // Android aftermarket WebViews do not all synthesize click reliably from
    // touch. Listen to pointer/touch directly and de-duplicate the later click.
    let lastPowerGesture=0;
    const invokePower=(fn,e)=>{
      if(e){try{e.preventDefault()}catch{}}
      const now=Date.now();
      if(now-lastPowerGesture<500)return;
      lastPowerGesture=now;
      fn();
    };
    const onBtn=$('radioPowerOn'), offBtn=$('radioPowerOff');
    ['pointerdown','touchstart','click'].forEach(ev=>onBtn?.addEventListener(ev,e=>invokePower(powerOn,e),{passive:false}));
    ['pointerdown','touchstart','click'].forEach(ev=>offBtn?.addEventListener(ev,e=>invokePower(powerOff,e),{passive:false}));
    // Capture fallback in case the head unit dispatches the event to a child/text node.
    tab.addEventListener('pointerdown',e=>{const b=e.target?.closest?.('#radioPowerOn,#radioPowerOff');if(b)invokePower(b.id==='radioPowerOn'?powerOn:powerOff,e)},{capture:true});
    tab.addEventListener('touchstart',e=>{const b=e.target?.closest?.('#radioPowerOn,#radioPowerOff');if(b)invokePower(b.id==='radioPowerOn'?powerOn:powerOff,e)},{capture:true,passive:false});
    $('radioChannelPtt')?.addEventListener('pointerdown',e=>{e.preventDefault();channelPttStart()});$('radioChannelPtt')?.addEventListener('pointerup',e=>{e.preventDefault();channelPttStop()});$('radioChannelPtt')?.addEventListener('pointercancel',channelPttStop);$('radioScreenBack')?.addEventListener('click',goBack);$('radioScreenSelect')?.addEventListener('click',selectMenuItem);
    $('radioPhysicalBack')?.addEventListener('click',goBack);$('radioMenuHome')?.addEventListener('click',goHome);$('radioPhysicalEnter')?.addEventListener('click',selectMenuItem);
    $('radioNavUp')?.addEventListener('click',()=>moveCursor(-1));$('radioNavDown')?.addEventListener('click',()=>moveCursor(1));$('radioNavLeft')?.addEventListener('click',goBack);$('radioNavRight')?.addEventListener('click',selectMenuItem);$('radioNavSelect')?.addEventListener('click',selectMenuItem);$('radioSelectSoft')?.addEventListener('click',selectMenuItem);$('radioBackSoft')?.addEventListener('click',goBack);bindNumberKeys();
    $('radioStatusBtn')?.addEventListener('click',()=>{if(powered)ensureRadio(false);renderMenu();playRemote()});tab.addEventListener('pointerdown',()=>{if(remoteAudio?.srcObject)playRemote()},{passive:true});
    if(fivemMode){window.addEventListener('message',e=>{const d=e.data||{};if(d.type==='guardianFivemPtt'){d.down?softwarePttStart():softwarePttStop();return}if(d.type==='guardianFivemControl'){const c=String(d.control||'');if(c==='up')moveCursor(-1);else if(c==='down')moveCursor(1);else if(c==='left'||c==='back')goBack();else if(c==='right'||c==='select'||c==='enter')selectMenuItem();else if(c==='menu'||c==='home')goHome();return}if(d.type==='guardianRadioKeyboardKey'){const key=String(d.key||'');const btn=document.querySelector(`[data-radio-key="${CSS.escape(key)}"]`);if(!btn)return;const ev=new PointerEvent(d.down?'pointerdown':'pointerup',{bubbles:true,cancelable:true,pointerId:88,pointerType:'mouse',buttons:d.down?1:0});btn.dispatchEvent(ev);}})}
  }
  function watchIdentity(){
    const reauth=()=>{setCallsign();if(!powered)return;const k=`${radioRole}:${currentCallsign()}`;if(k!==lastIdentityKey){identity=null;clientId='';eventSource?.close();eventSource=null;ensureRadio(true)}};
    const box=$('callsignBox');if(box)new MutationObserver(reauth).observe(box,{childList:true,subtree:true,characterData:true});
    const assigned=$('guardianWebAssignedCallsign');if(assigned)new MutationObserver(reauth).observe(assigned,{childList:true,subtree:true,characterData:true});
    const select=$('guardianWebCallsign');if(select)select.addEventListener('change',()=>setTimeout(reauth,100));
  }
  window.addEventListener('beforeunload',()=>{clearTimeout(reconnectTimer);clearTimeout(keyHoldTimer);clearTimeout(softwarePttTimer);stopHoldTone();stopIncomingRing();try{eventSource?.close()}catch{};closeAllGroupPeers();teardownPeer(true)});
  const start=()=>{tab.classList.add('radioOff');bindControls();watchIdentity();cursor=1;renderMenu();setCallsign();setLink('OFF');state('PRESS GREEN TO START RADIO');hint('RADIO OFF')};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
