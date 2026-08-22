let selectedStatus=null,currentStatus='Home Station',incidents=[],messages=[],mapScale=.65,mapX=-420,mapY=-250,dragging=false,dragStartX=0,dragStartY=0;const statuses=["Mobile to Incident","In Attendance at Incident","Available At Incident","Mobile And Available","Home Station","Available Home Address","Available Pager","Available Telephone","Mobile to Standby Station","Available Standby Station"];const body=document.body,statusesDiv=document.getElementById('statuses'),incidentTabs=document.getElementById('incidentTabs'),incidentDetail=document.getElementById('incidentDetail'),messageList=document.getElementById('messageList'),messageView=document.getElementById('messageView'),msgBox=document.getElementById('msgBox'),liveStatus=document.getElementById('liveStatus'),callsignBox=document.getElementById('callsignBox'),sendStatusBtn=document.getElementById('sendStatus'),mobilisingOverlay=document.getElementById('mobilisingOverlay');let currentAgency='LAB';const agencyNames=['FLAB','FRS','SFR','NFR'];function nui(name,data){return fetch(`https://${GetParentResourceName()}/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})}).catch(()=>{});}function closeMDT(){nui('close');body.style.display='none'}function switchTab(name){document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));const t={status:'Request Status from Control',incidents:'This Incident',messages:'Messages',map:'SatNav',browser:'Browser',agency:'Agency Login','update-history':'Update History'};document.getElementById('pageTitle').textContent=t[name]||'Guardian MDT';if(name==='map')showSatnavMainMenu()}document.querySelectorAll('[data-tab]').forEach(x=>x.addEventListener('click',()=>switchTab(x.dataset.tab)));document.getElementById('closeBtn').onclick=closeMDT;document.getElementById('closeBottom').onclick=closeMDT;document.getElementById('satnavBtn').onclick=()=>{switchTab('map');showSatnavMainMenu()};document.getElementById('liveStatus').onclick=()=>switchTab('status');document.getElementById('browserBtn').onclick=()=>switchTab('browser');document.getElementById('radioStatusBtn').onclick=()=>switchTab('agency');document.getElementById('agencyBackBtn').onclick=()=>switchTab('status');document.getElementById('loginAgencyBtn').onclick=()=>openAgencyChoices();const testAlertsBtn=document.getElementById('testAlertsBtn');if(testAlertsBtn){testAlertsBtn.onclick=()=>{const a=document.getElementById('alert');if(a){a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{})}}};function showSatnavMainMenu(){const main=document.getElementById('satnavMainMenu'),admin=document.getElementById('satnavAdminMenu'),mapMenu=document.getElementById('satnavMapMenu'),messagesMenu=document.getElementById('satnavMessagesMenu');if(main)main.hidden=false;if(admin)admin.hidden=true;if(mapMenu)mapMenu.hidden=true;if(messagesMenu)messagesMenu.hidden=true}function showSatnavAdminMenu(){const main=document.getElementById('satnavMainMenu'),admin=document.getElementById('satnavAdminMenu'),mapMenu=document.getElementById('satnavMapMenu'),messagesMenu=document.getElementById('satnavMessagesMenu');if(main)main.hidden=true;if(admin)admin.hidden=false;if(mapMenu)mapMenu.hidden=true;if(messagesMenu)messagesMenu.hidden=true}function showSatnavMapMenu(){const main=document.getElementById('satnavMainMenu'),admin=document.getElementById('satnavAdminMenu'),mapMenu=document.getElementById('satnavMapMenu'),messagesMenu=document.getElementById('satnavMessagesMenu');if(main)main.hidden=true;if(admin)admin.hidden=true;if(mapMenu)mapMenu.hidden=false;if(messagesMenu)messagesMenu.hidden=true}function showSatnavMessagesMenu(){const main=document.getElementById('satnavMainMenu'),admin=document.getElementById('satnavAdminMenu'),mapMenu=document.getElementById('satnavMapMenu'),messagesMenu=document.getElementById('satnavMessagesMenu');if(main)main.hidden=true;if(admin)admin.hidden=true;if(mapMenu)mapMenu.hidden=true;if(messagesMenu)messagesMenu.hidden=false}const mapMenuBtn=document.querySelector('#satnavMainMenu .spanBoth');if(mapMenuBtn)mapMenuBtn.onclick=showSatnavMapMenu;const adminMenuBtn=document.getElementById('adminMenuBtn');if(adminMenuBtn)adminMenuBtn.onclick=showSatnavAdminMenu;const messagesMenuBtn=document.getElementById('messagesMenuBtn');if(messagesMenuBtn)messagesMenuBtn.onclick=showSatnavMessagesMenu;const satnavMessagesBack=document.getElementById('satnavMessagesBack');if(satnavMessagesBack)satnavMessagesBack.onclick=showSatnavMainMenu;const textMessagesBtn=document.getElementById('textMessagesBtn');if(textMessagesBtn)textMessagesBtn.onclick=()=>switchTab('messages');const messageHistoryBtn=document.getElementById('messageHistoryBtn');if(messageHistoryBtn)messageHistoryBtn.onclick=()=>switchTab('messages');const statusUpdateBtn=document.getElementById('statusUpdateBtn');if(statusUpdateBtn)statusUpdateBtn.onclick=()=>switchTab('status');const mapAdminBack=document.getElementById('mapAdminBack');if(mapAdminBack)mapAdminBack.onclick=showSatnavMainMenu;const zoomOutMenu=document.getElementById('zoomOutMenu');if(zoomOutMenu)zoomOutMenu.onclick=()=>document.getElementById('zoomOut').click();const zoomInMenu=document.getElementById('zoomInMenu');if(zoomInMenu)zoomInMenu.onclick=()=>document.getElementById('zoomIn').click();const mapMenuZoomOut=document.getElementById('mapMenuZoomOut');if(mapMenuZoomOut)mapMenuZoomOut.onclick=()=>document.getElementById('zoomOut').click();const mapMenuZoomIn=document.getElementById('mapMenuZoomIn');if(mapMenuZoomIn)mapMenuZoomIn.onclick=()=>document.getElementById('zoomIn').click();const mapMenuBack=document.getElementById('mapMenuBack');if(mapMenuBack)mapMenuBack.onclick=showSatnavMainMenu;let scaleFrozen=false;const freezeScaleBtn=document.getElementById('freezeScale');if(freezeScaleBtn)freezeScaleBtn.onclick=()=>{scaleFrozen=!scaleFrozen;freezeScaleBtn.classList.toggle('mapOptionActive',scaleFrozen)};const dimMapBtn=document.getElementById('dimMap');if(dimMapBtn)dimMapBtn.onclick=()=>{document.getElementById('mapViewport').classList.toggle('mapDimmed');dimMapBtn.classList.toggle('mapOptionActive')};const gotoMapRef=document.getElementById('gotoMapRef');if(gotoMapRef)gotoMapRef.onclick=()=>{const ref=prompt('Enter map reference:');if(ref)document.getElementById('mapRefReadout').textContent=ref};const getMapRef=document.getElementById('getMapRef');if(getMapRef)getMapRef.onclick=()=>{document.getElementById('mapRefReadout').textContent='E (433751), N (386852)'};const measuringTool=document.getElementById('measuringTool');if(measuringTool)measuringTool.onclick=()=>{document.getElementById('mapViewport').classList.toggle('measuringMode');measuringTool.classList.toggle('mapOptionActive')};const printMap=document.getElementById('printMap');if(printMap)printMap.onclick=()=>window.print();const gisLayers=document.getElementById('gisLayers');if(gisLayers)gisLayers.onclick=()=>{document.getElementById('dispatchMap').classList.toggle('gisLayerHint');gisLayers.classList.toggle('mapOptionActive')};const defaultMap=document.getElementById('defaultMap');if(defaultMap)defaultMap.onclick=()=>document.getElementById('mapReset').click();const browserHome=document.getElementById('browserHome');if(browserHome)browserHome.onclick=()=>switchTab('status');const browserPrev=document.getElementById('browserPrev');if(browserPrev)browserPrev.onclick=()=>{};const browserNext=document.getElementById('browserNext');if(browserNext)browserNext.onclick=()=>{};const browserRefresh=document.getElementById('browserRefresh');if(browserRefresh)browserRefresh.onclick=()=>{const b=document.querySelector('.browserLegend');if(b)b.scrollTop=0};const browserLock=document.getElementById('browserLock');if(browserLock)browserLock.onclick=()=>{};function updateAgencyDisplay(){const cs=document.getElementById('agencyCallsign');const nm=document.getElementById('agencyName');const msg=document.getElementById('agencyMessage');if(cs)cs.textContent=callsignBox.textContent||'UNSET';if(nm)nm.textContent=currentAgency;if(msg)msg.textContent=`Logged in to ${currentAgency} as call sign ${callsignBox.textContent||'UNSET'}.`;const rf=document.getElementById('radioStatusBtn');if(rf)rf.textContent=`${currentAgency} Online`;}function openAgencyChoices(){const existing=document.getElementById('agencyChoiceOverlay');if(existing)existing.remove();const overlay=document.createElement('div');overlay.id='agencyChoiceOverlay';overlay.innerHTML=`<div class=\"agencyChoiceCard\"><div class=\"agencyChoiceTitle\">Select Agency</div><div class=\"agencyChoiceGrid\">${agencyNames.map(a=>`<button type=\"button\" data-agency=\"${a}\">${a}</button>`).join('')}</div><button type=\"button\" class=\"agencyChoiceCancel\">Cancel</button></div>`;document.body.appendChild(overlay);overlay.querySelectorAll('[data-agency]').forEach(b=>b.onclick=()=>{currentAgency=b.dataset.agency;updateAgencyDisplay();overlay.remove();switchTab('agency')});overlay.querySelector('.agencyChoiceCancel').onclick=()=>overlay.remove();}updateAgencyDisplay();function buildStatuses(){statusesDiv.innerHTML='';statuses.forEach((s,i)=>{const b=document.createElement('button');b.className='statusBtn';b.textContent=s;if(i===8)b.style.gridColumn='2';if(i===9)b.style.gridColumn='3';if(s===currentStatus)b.classList.add('current');b.onclick=()=>{document.querySelectorAll('.statusBtn').forEach(x=>x.classList.remove('pending'));b.classList.add('pending');selectedStatus=s};statusesDiv.appendChild(b)})}buildStatuses();sendStatusBtn.onclick=()=>{if(!selectedStatus)return;currentStatus=selectedStatus;document.querySelectorAll('.statusBtn').forEach(b=>b.classList.remove('sent','active','pending','current'));const b=[...document.querySelectorAll('.statusBtn')].find(x=>x.textContent===selectedStatus);if(b)b.classList.add('current');liveStatus.textContent=selectedStatus;selectedStatus=null;nui('sendStatus',{status:currentStatus})};
/* Message conversation + incidents + NUI events */
function escapeHtml(v){
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let selectedMessageIndex = -1;
let messageAlarmMuted = false;
let unreadMessageIndexes = new Set();

function sendMessage(){
  const text = msgBox && msgBox.value ? msgBox.value.trim() : '';
  if(!text) return;
  nui('sendMessage',{message:text});
  msgBox.value='';
  msgBox.focus();
}

function markMessagesRead(){
  unreadMessageIndexes.clear();
}

function renderMessages(){
  if(!messageList || !messageView) return;
  messageList.innerHTML='';

  const thread=document.createElement('button');
  thread.type='button';
  thread.className='referenceMessageItem selected';
  const latest=messages.length ? messages[messages.length-1] : null;
  thread.innerHTML='<span class="messageTick">✓✓</span>'+
    '<span class="messageTime">'+escapeHtml(latest && latest.time || '')+'</span>'+
    '<span class="messageItemType">Control ('+messages.length+')</span>';
  thread.onclick=()=>{
    selectedMessageIndex=messages.length ? messages.length-1 : -1;
    markMessagesRead();
    renderMessageView();
  };
  messageList.appendChild(thread);
  renderMessageView();
  const top=document.getElementById('topMessagesTab');
  if(top) top.textContent='Messages ('+messages.length+')';
}

function renderMessageView(){
  if(!messageView) return;
  messageView.innerHTML='';
  if(!messages.length){
    const empty=document.createElement('div');
    empty.className='chatMessage control';
    empty.textContent='No messages';
    messageView.appendChild(empty);
    return;
  }
  messages.forEach((m,i)=>{
    const row=document.createElement('div');
    const mine=String(m.sender||'').toUpperCase()===String(callsignBox && callsignBox.textContent || '').toUpperCase();
    row.className='chatMessage '+(mine?'crew':'control')+(i===selectedMessageIndex?' selectedMessage':'');
    row.dataset.index=i;
    row.onclick=()=>{selectedMessageIndex=i; markMessagesRead(); renderMessageView();};
    const head=document.createElement('div'); head.className='chatHeader';
    const sender=document.createElement('span'); sender.textContent=m.sender||'CONTROL';
    const time=document.createElement('span'); time.textContent=m.time||'';
    head.appendChild(sender); head.appendChild(time);
    const body=document.createElement('div'); body.className='chatText'; body.textContent=m.text||'';
    row.appendChild(head); row.appendChild(body); messageView.appendChild(row);
  });
  const selected=messageView.querySelector('.selectedMessage');
  if(selected) selected.scrollIntoView({block:'nearest'});
  else messageView.scrollTop=messageView.scrollHeight;
}

function playMessagePing(){
  if(messageAlarmMuted) return;
  const p=document.getElementById('ping');
  if(!p) return;
  try{
    p.pause();
    p.currentTime=0;
    const promise=p.play();
    if(promise && promise.catch) promise.catch(()=>{});
  }catch(e){}
}

function openSendPanel(){
  const panel=document.getElementById('sendMessagePanel');
  if(panel){ panel.hidden=false; if(msgBox) msgBox.focus(); }
}

function closeSendPanel(){
  const panel=document.getElementById('sendMessagePanel');
  if(panel) panel.hidden=true;
}

function removeSelectedMessage(){
  if(!messages.length) return;
  const idx=(selectedMessageIndex>=0 && selectedMessageIndex<messages.length) ? selectedMessageIndex : messages.length-1;
  messages.splice(idx,1);
  selectedMessageIndex=Math.min(idx,messages.length-1);
  renderMessages();
}

function clearReadMessages(){
  if(!messages.length) return;
  const keep=[];
  messages.forEach((m,i)=>{ if(unreadMessageIndexes.has(i)) keep.push(m); });
  messages=keep;
  unreadMessageIndexes.clear();
  selectedMessageIndex=messages.length-1;
  renderMessages();
}

function clearAllMessages(){
  messages=[]; unreadMessageIndexes.clear(); selectedMessageIndex=-1; renderMessages();
}

function selectLastReceived(){
  if(!messages.length) return;
  selectedMessageIndex=messages.length-1;
  renderMessageView();
}

function findFirstUnread(){
  const idx=[...unreadMessageIndexes][0];
  if(idx==null){ selectLastReceived(); return; }
  selectedMessageIndex=Math.min(idx,messages.length-1);
  renderMessageView();
}

function wireMessageControls(){
  const send=document.getElementById('sendMsg');
  if(send) send.onclick=sendMessage;
  if(msgBox) msgBox.onkeydown=(e)=>{ if(e.key==='Enter'){e.preventDefault();sendMessage();} };

  const remove=document.getElementById('removeMessage'); if(remove) remove.onclick=removeSelectedMessage;
  const alarm=document.getElementById('alarmOff'); if(alarm) alarm.onclick=()=>{ messageAlarmMuted=true; const p=document.getElementById('ping'); if(p){p.pause();p.currentTime=0;} alarm.textContent='Audible Alarm On'; alarm.onclick=()=>{messageAlarmMuted=false;alarm.textContent='Audible Alarm Off';}; };
  const last=document.getElementById('lastReceived'); if(last) last.onclick=selectLastReceived;
  const unread=document.getElementById('firstUnread'); if(unread) unread.onclick=findFirstUnread;
  const clearRead=document.getElementById('clearRead'); if(clearRead) clearRead.onclick=clearReadMessages;
  const clearAll=document.getElementById('clearMessages'); if(clearAll) clearAll.onclick=clearAllMessages;
  const openSend=document.getElementById('openSendMessage'); if(openSend) openSend.onclick=openSendPanel;
  const closeMessages=document.getElementById('closeMessages'); if(closeMessages) closeMessages.onclick=()=>switchTab('status');
  const panelSend=document.querySelector('#sendMessagePanel button'); if(panelSend) panelSend.onclick=sendMessage;
}

wireMessageControls();

function renderIncidents(){
  incidentTabs.innerHTML='';
  if(!incidents.length){ incidentDetail.innerHTML='<h3>Mobile Available</h3><p>No active incidents.</p>'; return; }
  incidents.forEach((inc,i)=>{
    const b=document.createElement('button'); b.className='incident'; b.textContent=`#${inc.id} ${inc.type||'Incident'}`;
    b.onclick=()=>{document.querySelectorAll('.incident').forEach(x=>x.classList.remove('activeIncident'));b.classList.add('activeIncident');showIncident(i);};
    incidentTabs.appendChild(b);
  });
  showIncident(incidents.length-1);
}
function showIncident(i){
  const inc=incidents[i]; if(!inc)return;
  incidentDetail.innerHTML=`<h3>Selected Event Details</h3><p><strong>Incident:</strong><br>${escapeHtml(inc.type||'')}</p><p><strong>Postal:</strong><br>${escapeHtml(inc.postal||'None')}</p><p><strong>Address:</strong><br>${escapeHtml(inc.address||'')}</p><p><strong>Details:</strong><br>${escapeHtml(inc.description||'')}</p><button id="ackBtn">ACKNOWLEDGE</button><button id="clearBtn">CLEAR INCIDENT</button>`;
  document.getElementById('ackBtn').onclick=()=>{nui('ackIncident',{id:inc.id});const b=document.getElementById('ackBtn');b.textContent='ACKNOWLEDGED';b.disabled=true;b.classList.add('acked');};
  document.getElementById('clearBtn').onclick=()=>{incidents.splice(i,1);renderIncidents();};
}

window.addEventListener('message',e=>{
  const d=e.data||{};
  switch(d.type){
    case 'open': body.style.display='block'; switchTab('status'); buildStatuses(); updateAgencyDisplay(); renderMessages(); break;
    case 'close': body.style.display='none'; break;
    case 'setCallsign': callsignBox.textContent=d.callsign||'UNSET'; updateAgencyDisplay(); renderMessages(); break;
    case 'setStatus': currentStatus=d.status||currentStatus; liveStatus.textContent=currentStatus; if(!d.preserveSelection) selectedStatus=null; buildStatuses(); if(selectedStatus){const pb=[...document.querySelectorAll('.statusBtn')].find(x=>x.textContent===selectedStatus);if(pb)pb.classList.add('pending');} break;
    case 'loadIncidents': incidents=Array.isArray(d.incidents)?d.incidents:incidents; renderIncidents(); break;
    case 'incident': if(d.item) { incidents.push(d.item); renderIncidents(); } break;
    case 'message': {
      if(!d.item) break;
      const item=d.item;
      const key=[item.sender||'',item.time||'',item.text||''].join('|');
      const duplicate=messages.some(m=>[m.sender||'',m.time||'',m.text||''].join('|')===key);
      if(!duplicate){
        messages.push({sender:item.sender||'CONTROL',text:item.text||'',time:item.time||'',direction:item.direction||'',conversation:'CONTROL'});
        if(String(item.sender||'').toUpperCase()==='CONTROL'){
          unreadMessageIndexes.add(messages.length-1);
          playMessagePing();
        }
      }
      selectedMessageIndex=messages.length-1;
      renderMessages();
      break;
    }
    case 'alert': { const a=document.getElementById('alert'); if(a){a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{});} break; }
    case 'mobilising': body.style.display='block'; mobilisingOverlay.style.display='block'; switchTab('incidents'); break;
  }
});

if(mobilisingOverlay) mobilisingOverlay.onclick=()=>{mobilisingOverlay.style.display='none';};

/* Map controls */
const viewport=document.getElementById('mapViewport'),map=document.getElementById('dispatchMap');
function applyMap(){ if(map) map.style.transform=`translate(${mapX}px,${mapY}px) scale(${mapScale})`; }
const zoomIn=document.getElementById('zoomIn'); if(zoomIn) zoomIn.onclick=()=>{if(scaleFrozen)return;mapScale=Math.min(2,mapScale+.1);applyMap();};
const zoomOut=document.getElementById('zoomOut'); if(zoomOut) zoomOut.onclick=()=>{if(scaleFrozen)return;mapScale=Math.max(.25,mapScale-.1);applyMap();};
const mapReset=document.getElementById('mapReset'); if(mapReset) mapReset.onclick=()=>{mapScale=.65;mapX=-420;mapY=-250;applyMap();};
if(viewport){
  viewport.addEventListener('mousedown',e=>{dragging=true;dragStartX=e.clientX-mapX;dragStartY=e.clientY-mapY;});
  window.addEventListener('mouseup',()=>dragging=false);
  window.addEventListener('mousemove',e=>{if(!dragging)return;mapX=e.clientX-dragStartX;mapY=e.clientY-dragStartY;applyMap();});
}
applyMap();

/* Admin menu controls — deliberately self-contained so later UI additions cannot break them. */
(function(){
  function wireAdminControls(){
    const batteryBtn=document.getElementById('batteryStatusBtn');
    const battery=document.getElementById('batteryStatusOverlay');
    const batteryOk=document.getElementById('batteryOk');
    if(batteryBtn && battery){
      batteryBtn.onclick=function(){
        const pct=70+Math.floor(Math.random()*27);
        const hrs=2+Math.floor(Math.random()*2);
        const mins=Math.floor(Math.random()*60);
        document.getElementById('batteryPercent').textContent=pct+'%';
        document.getElementById('batteryState').textContent=pct>=85?'High':pct>=65?'Medium':'Low';
        document.getElementById('batteryFull').textContent='03:42:18';
        document.getElementById('batteryRemaining').textContent=String(hrs).padStart(2,'0')+':'+String(mins).padStart(2,'0')+':00';
        battery.hidden=false;
      };
    }
    if(batteryOk && battery) batteryOk.onclick=()=>battery.hidden=true;

    const screenBtn=document.getElementById('screenSettingsBtn');
    const screen=document.getElementById('screenSettingsOverlay');
    if(screenBtn && screen) screenBtn.onclick=()=>screen.hidden=false;
    const screenClose=document.getElementById('screenSettingsClose');
    if(screenClose && screen) screenClose.onclick=()=>screen.hidden=true;
    const slider=document.getElementById('brightnessSlider');
    if(slider) slider.oninput=()=>document.querySelector('.frame')?.style.setProperty('filter','brightness('+Number(slider.value)/92+')');
    const invert=document.getElementById('invertColoursBtn');
    if(invert) invert.onclick=()=>document.querySelector('.frame')?.classList.toggle('screenInverted');

    const aboutBtn=document.getElementById('aboutBtn');
    const about=document.getElementById('aboutScreen');
    if(aboutBtn && about) aboutBtn.onclick=()=>about.hidden=false;
    const aboutClose=document.getElementById('aboutClose');
    if(aboutClose && about) aboutClose.onclick=()=>about.hidden=true;

    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape') return;
      [battery,screen,about].forEach(x=>{if(x)x.hidden=true});
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wireAdminControls);
  else wireAdminControls();
})();


/* Coordinates footer -> GPS Rules Monitor / Diagnostics */
(function(){
  function initGpsDiagnostics(){
    const coords=document.getElementById('coordsFooter');
    const overlay=document.getElementById('gpsDiagnosticsOverlay');
    const summary=document.getElementById('gpsSummary');
    const close=document.getElementById('gpsClose');
    const send=document.getElementById('gpsSendNow');
    const ruleSeconds=document.getElementById('gpsRuleSeconds');
    if(!coords || !overlay || !summary) return;

    let timer=null;
    let lastE=433990, lastN=664073;

    function pad(n){return String(n).padStart(2,'0')}
    function stamp(){
      const d=new Date();
      return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+
        'T'+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+'.000Z';
    }
    function refresh(){
      /* Small realistic variation so the diagnostic values are not identical every time. */
      const e=433985+Math.floor(Math.random()*18);
      const n=664066+Math.floor(Math.random()*18);
      const course=Math.floor(Math.random()*360);
      const speed=Math.random()<.78 ? 0 : (Math.random()*4).toFixed(1);
      const sats=7+Math.floor(Math.random()*5);
      const accuracy=(Math.random()*2.8).toFixed(1);
      const seconds=10+Math.floor(Math.random()*1650);
      const moved=Math.floor(Math.random()*7);
      const rule=Math.random()<.45 ? 0 : 10;
      lastE=e; lastN=n;
      coords.textContent=`E (${e}), N (${n})`;
      ruleSeconds.textContent=rule;
      summary.textContent=
        `Last AVL transmission ${e}E ${n}N, course ${course}, speed ${speed},\n`+
        `${sats} satellites, position accuracy ${accuracy} at ${stamp()}\n`+
        `Last GPS fix ${e}E,${n}N, course ${course}, speed ${speed},\n`+
        `${sats} satellites, position accuracy ${accuracy} at ${stamp()}\n`+
        `${seconds} seconds since last update, moved ${moved} metres from last update`;
    }
    function open(){
      refresh();
      overlay.hidden=false;
      clearInterval(timer);
      timer=setInterval(refresh,6000);
    }
    function shut(){
      overlay.hidden=true;
      clearInterval(timer);
      timer=null;
    }
    coords.onclick=open;
    close && (close.onclick=shut);
    send && (send.onclick=function(){
      refresh();
      send.textContent='Sent';
      setTimeout(()=>send.textContent='Send Now',900);
    });
    overlay.addEventListener('click',e=>{if(e.target===overlay)shut()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)shut()});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initGpsDiagnostics);
  else initGpsDiagnostics();
})();

/* ============================================================
   Guardian MDT - Control conversation message system
   All Control/MDT messages share one conversation thread.
   ============================================================ */
(function () {
  function safeText(v) {
    return String(v == null ? "" : v);
  }

  function renderControlConversation() {
    if (!messageList || !messageView) return;

    messageList.innerHTML = "";

    const thread = document.createElement("button");
    thread.type = "button";
    thread.className = "referenceMessageItem selected";
    thread.innerHTML =
      '<span class="messageTick">✓✓</span>' +
      '<span class="messageTime">' +
      (messages.length ? safeText(messages[messages.length - 1].time) : "") +
      '</span>' +
      '<span class="messageItemType">Control</span>';

    thread.onclick = function () {
      messageView.innerHTML = "";

      if (!messages.length) {
        const empty = document.createElement("div");
        empty.className = "chatMessage control";
        empty.textContent = "No messages";
        messageView.appendChild(empty);
        return;
      }

      messages.forEach(function (m) {
        const row = document.createElement("div");
        row.className =
          "chatMessage " +
          (safeText(m.sender).toUpperCase() === safeText(callsignBox && callsignBox.textContent).toUpperCase()
            ? "crew" : "control");

        const head = document.createElement("div");
        head.className = "chatHeader";

        const sender = document.createElement("span");
        sender.textContent = safeText(m.sender || "CONTROL");

        const time = document.createElement("span");
        time.textContent = safeText(m.time);

        head.appendChild(sender);
        head.appendChild(time);

        const body = document.createElement("div");
        body.className = "chatText";
        body.textContent = safeText(m.text);

        row.appendChild(head);
        row.appendChild(body);
        messageView.appendChild(row);
      });

      messageView.scrollTop = messageView.scrollHeight;
    };

    messageList.appendChild(thread);
    thread.click();

    const count = document.getElementById("topMessagesTab");
    if (count) count.textContent = "Messages (" + messages.length + ")";
  }

  // Replace the generic MDT message handler with one that feeds the
  // single shared Control conversation.
  window.addEventListener("message", function (e) {
    const d = e.data || {};
    if (d.type !== "message" || !d.item) return;

    const item = d.item;
    const key = [
      safeText(item.sender),
      safeText(item.time),
      safeText(item.text)
    ].join("|");

    // Avoid duplicate network/local copies.
    const duplicate = messages.some(function (m) {
      return [
        safeText(m.sender),
        safeText(m.time),
        safeText(m.text)
      ].join("|") === key;
    });

    if (!duplicate) {
      messages.push({
        sender: safeText(item.sender || "CONTROL"),
        text: safeText(item.text),
        time: safeText(item.time || ""),
        direction: item.direction || "",
        conversation: "CONTROL"
      });
    }

    renderControlConversation();

    if (safeText(item.sender).toUpperCase() === "CONTROL") {
      const p = document.getElementById("ping");
      if (p) {
        p.currentTime = 0;
        const promise = p.play();
        if (promise && promise.catch) promise.catch(function () {});
      }
    }
  });

  // Wire the existing Send Message controls directly to NUI.
  function sendControlReply() {
    if (!msgBox) return;
    const text = msgBox.value.trim();
    if (!text) return;

    nui("sendMessage", { message: text });
    msgBox.value = "";
    msgBox.focus();
  }

  const send = document.getElementById("sendMsg");
  if (send) {
    send.onclick = sendControlReply;
  }

  if (msgBox) {
    msgBox.onkeydown = function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendControlReply();
      }
    };
  }

  // Start with the existing conversation renderer.
  renderControlConversation();
})();

(function(){
  const btn=document.getElementById('updateHistoryBtn');
  const list=document.getElementById('updateHistoryList');
  const back=document.getElementById('updateHistoryBack');
  const fallbackHistory = [
    {date:'15/08/2026',time:'13:54',type:'Added',text:'Update History — Added a full in-game Update History tab opened from SatNav Admin Menu, matching the history stored in the resource files.'},
    {date:'15/08/2026',time:'13:48',type:'Added',text:'Update History — Added a persistent MDT update history showing date, time and work completed.'},
    {date:'15/08/2026',time:'13:48',type:'Added',text:'Keyboard shortcuts — F4 opens the MDT and F6 opens Control. Existing /getec and /control commands remain available.'},
    {date:'15/08/2026',time:'13:20',type:'Fixed',text:'Messaging — Control and MDT messages now use one shared conversation.'},
    {date:'15/08/2026',time:'13:10',type:'Fixed',text:'Pager — Pager popup and Enter-to-close behaviour fixed.'},
    {date:'15/08/2026',time:'12:55',type:'Updated',text:'Incident alerts — Incidents continue to arrive on the MDT when the alert sound is disabled.'},
    {date:'15/08/2026',time:'12:40',type:'Fixed',text:'Control appliance list — Callsigns now synchronise correctly with Control.'},
    {date:'15/08/2026',time:'12:20',type:'Added',text:'Admin Menu — Battery Status, Screen Settings and About panels restored.'}
  ];

  function renderHistory(data){
    if(!list) return;
    list.innerHTML='';
    (data||[]).forEach(function(item){
      const entry=document.createElement('article');
      entry.className='updateHistoryEntry';
      const meta=document.createElement('div');
      meta.className='updateHistoryMeta';
      const type=document.createElement('span');
      type.className='updateHistoryType';
      type.textContent=item.type||'Updated';
      const when=document.createElement('span');
      when.textContent=(item.date||'')+' '+(item.time||'');
      meta.append(type,when);
      const text=document.createElement('div');
      text.className='updateHistoryText';
      text.textContent=item.text||'';
      entry.append(meta,text);
      list.appendChild(entry);
    });
  }

  async function loadHistory(){
    try{
      const r=await fetch('update_history.json?'+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('history file unavailable');
      const data=await r.json();
      renderHistory(data);
    }catch(e){
      renderHistory(fallbackHistory);
    }
  }

  function openHistory(){
    switchTab('update-history');
    loadHistory();
  }

  function closeHistory(){
    switchTab('map');
    showSatnavAdminMenu();
  }

  if(btn) btn.onclick=openHistory;
  if(back) back.onclick=closeHistory;
  loadHistory();
})();

/* ================= SATNAV 2.1 — INCIDENT / POSTAL NAVIGATION ================= */
(function(){
  const vp=document.getElementById('mapViewport'), img=document.getElementById('dispatchMap');
  if(!vp||!img) return;

  let styleIndex=0, follow=false;
  let gps={x:0,y:0,z:0,heading:0,speed:0,ready:false};
  let activeIncident=null;

  const styles=['assets/gta_map.jpg'];
  const styleBtn=document.getElementById('mapStyle'), locate=document.getElementById('mapLocate');
  const searchToggle=document.getElementById('mapSearchToggle'), searchPanel=document.getElementById('mapSearchPanel');
  const searchBtn=document.getElementById('mapSearchBtn'), searchInput=document.getElementById('mapSearchInput');
  const gpsMarker=document.getElementById('gpsMarker'), searchMarker=document.getElementById('mapSearchMarker');
  const grid=document.getElementById('mapGrid');
  const ref=document.getElementById('mapRefReadout'), status=document.getElementById('mapStatusReadout');
  const navPanel=document.getElementById('incidentNavPanel'), navPostal=document.getElementById('incidentNavPostal');
  const navDistance=document.getElementById('incidentNavDistance'), navDirection=document.getElementById('incidentNavDirection');
  const navGo=document.getElementById('incidentNavGo');

  // The supplied GTA map is a 2:3 portrait map. These bounds match the
  // standard GTA world coordinate area represented by the artwork.
  const WORLD={minX:-4000,maxX:4000,minY:-4000,maxY:8000};

  const MAP_W=2048, MAP_H=3072;
  function worldToMap(x,y){
    return {
      x: ((Number(x)-WORLD.minX)/(WORLD.maxX-WORLD.minX))*MAP_W,
      y: ((WORLD.maxY-Number(y))/(WORLD.maxY-WORLD.minY))*MAP_H
    };
  }
  function mapToScreen(p){
    return {x: mapX + p.x*mapScale, y: mapY + p.y*mapScale};
  }
  function keepMapOnGps(){
    if(!follow || !gps.ready) return;
    const p=worldToMap(gps.x,gps.y);
    mapX=viewport.clientWidth/2-p.x*mapScale;
    mapY=viewport.clientHeight/2-p.y*mapScale;
    applyMap();
  }

  function distanceMeters(a,b){
    return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
  }

  function bearing(a,b){
    // GTA heading: 0=north, clockwise. Convert world XY to compass bearing.
    const dx=b.x-a.x, dy=b.y-a.y;
    return (Math.atan2(dx,dy)*180/Math.PI+360)%360;
  }

  function compass(deg){
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg/45)%8];
  }

  function setStyle(){
    img.src=styles[styleIndex];
    if(styleBtn) styleBtn.classList.toggle('mapOptionActive',styleIndex!==0);
  }

  function updateIncidentNav(){
    if(!activeIncident || activeIncident.x==null || activeIncident.y==null || !gps.ready){
      if(navPanel) navPanel.hidden=true;
      return;
    }

    const target={x:Number(activeIncident.x),y:Number(activeIncident.y)};
    const dist=distanceMeters(gps,target);
    const absBearing=bearing(gps,target);
    const relative=(absBearing-gps.heading+540)%360-180;

    navPanel.hidden=false;
    navPostal.textContent='Postal '+(activeIncident.postal||'—');
    navDistance.textContent=dist<1000 ? `Distance ${Math.round(dist)} m` : `Distance ${(dist/1000).toFixed(2)} km`;
    navDirection.textContent=`Direction ${compass(absBearing)} • ${Math.round(relative)}° from heading`;

    const p=mapToScreen(worldToMap(target.x,target.y));
    const marker=document.getElementById('incidentMarker');
    marker.style.left=p.x+'px';
    marker.style.top=p.y+'px';
    marker.hidden=false;

    // Draw a live bearing line from the unit to the incident.
    let line=document.getElementById('liveIncidentRoute');
    if(!line){
      line=document.createElementNS('http://www.w3.org/2000/svg','svg');
      line.id='liveIncidentRoute';
      line.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8';
      vp.appendChild(line);
    }
    while(line.firstChild) line.removeChild(line.firstChild);

    const a=mapToScreen(worldToMap(gps.x,gps.y));
    const b=mapToScreen(worldToMap(target.x,target.y));
    const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
    ln.setAttribute('x1',a.x); ln.setAttribute('y1',a.y);
    ln.setAttribute('x2',b.x); ln.setAttribute('y2',b.y);
    ln.setAttribute('stroke','#ffcf00'); ln.setAttribute('stroke-width','4');
    ln.setAttribute('stroke-dasharray','10 6');
    ln.setAttribute('stroke-linecap','round');
    line.appendChild(ln);
  }

  if(styleBtn) styleBtn.onclick=()=>{styleIndex=(styleIndex+1)%styles.length;setStyle()};
  if(locate) locate.onclick=()=>{
    follow=!follow;
    locate.classList.toggle('mapOptionActive',follow);
    gpsMarker.classList.toggle('following',follow);
    if(follow) keepMapOnGps();
    updateIncidentNav();
  };
  if(navGo) navGo.onclick=()=>{
    if(activeIncident && activeIncident.x!=null && activeIncident.y!=null)
      nui('setIncidentWaypoint',{x:activeIncident.x,y:activeIncident.y});
  };
  if(searchToggle) searchToggle.onclick=()=>{
    searchPanel.hidden=!searchPanel.hidden;
    if(!searchPanel.hidden) searchInput.focus();
  };

  // Incident event: cache it locally and make it the active SatNav target.
  window.addEventListener('message',e=>{
    const d=e.data||{};
    if(d.type==='incident'){
      activeIncident=d.item||null;
      updateIncidentNav();
    }
    if(d.type==='loadIncidents' && Array.isArray(d.incidents) && d.incidents.length){
      activeIncident=d.incidents[d.incidents.length-1];
      updateIncidentNav();
    }
    if(d.type==='gpsPosition'){
      gps={
        x:Number(d.x)||0,y:Number(d.y)||0,z:Number(d.z)||0,
        heading:Number(d.heading)||0,speed:Number(d.speed)||0,ready:true
      };
      status.textContent=`GPS • ${d.satellites||8} SAT • ${Math.round(gps.heading)}°`;
      if(ref) ref.textContent=`E (${Math.round(d.easting||0)}), N (${Math.round(d.northing||0)})`;

      keepMapOnGps();
      const p=follow
        ? {x:viewport.clientWidth/2,y:viewport.clientHeight/2}
        : mapToScreen(worldToMap(gps.x,gps.y));
      gpsMarker.style.left=p.x+'px';
      gpsMarker.style.top=p.y+'px';
      gpsMarker.style.transform=`translate(-50%,-50%) rotate(${gps.heading}deg)`;
      updateIncidentNav();
    }
  });

  // Postal search uses the exact dataset supplied by the user.
  async function doSearch(){
    const q=(searchInput.value||'').trim().toLowerCase();
    const out=document.getElementById('mapSearchResults');
    if(!q)return;
    out.innerHTML='<div class="mapSearchResult">Searching…</div>';
    try{
      const data=await fetch('assets/postals.json?'+Date.now()).then(r=>r.json());
      const entries=Array.isArray(data)?data:Object.values(data);
      const hits=entries.filter(v=>String(v.code||v.postal||'').toLowerCase()===q ||
        String(v.code||v.postal||'').toLowerCase().includes(q)).slice(0,8);
      out.innerHTML='';
      if(!hits.length){out.innerHTML='<div class="mapSearchResult">Postal not found.</div>';return}
      hits.forEach(v=>{
        const b=document.createElement('button');
        b.type='button'; b.className='mapSearchResult';
        b.textContent='Postal '+(v.code||v.postal);
        b.onclick=()=>{
          const p=mapToScreen(worldToMap(v.x,v.y));
          searchMarker.hidden=false;
          searchMarker.style.left=p.x+'px';
          searchMarker.style.top=p.y+'px';
          out.innerHTML='<div class="mapSearchResult">Selected: '+(v.code||v.postal)+'</div>';
        };
        out.appendChild(b);
      });
    }catch(e){out.innerHTML='<div class="mapSearchResult">Postal data unavailable.</div>'}
  }
  if(searchBtn) searchBtn.onclick=doSearch;
  if(searchInput) searchInput.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});

  const oldReset=document.getElementById('mapReset');
  if(oldReset) oldReset.addEventListener('click',()=>{
    follow=false;
    if(locate) locate.classList.remove('mapOptionActive');
    gpsMarker.classList.remove('following');
    updateIncidentNav();
  });

  window.addEventListener('mousemove',()=>{if(activeIncident) updateIncidentNav();});
  if(zoomIn) zoomIn.addEventListener('click',updateIncidentNav);
  if(zoomOut) zoomOut.addEventListener('click',updateIncidentNav);
  if(mapReset) mapReset.addEventListener('click',()=>{keepMapOnGps();updateIncidentNav();});

  const gridBtn=document.getElementById('gisLayers');
  if(gridBtn) gridBtn.addEventListener('click',()=>{
    grid.classList.toggle('active');
    gridBtn.classList.toggle('mapOptionActive',grid.classList.contains('active'));
  });

  setStyle();
})();

