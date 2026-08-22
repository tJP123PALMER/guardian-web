let guardian999Calls=[];
let guardian999SelectedId=null;
let statusLog = [];
let acks = [];
let msgs = [];
let selectedMDT = [];
let commandState={units:{},callsigns:[],stations:{},skills:{},resources:{},resourceTypes:['Pump','Rescue','Aerial','Water Carrier','Wildfire','Command Unit','Specialist','Other'],incidents:[],activity:[]};

function sw(tab){

    document.querySelectorAll('.tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab));

    document.querySelectorAll('.pane').forEach(p =>
        p.classList.toggle('active', p.id === `tab-${tab}`));

    const board = document.querySelector(".applianceColumn");

    if(board){
        board.style.display = (tab === "incident" || tab === "dashboard") ? "block" : "none";
    }

}
document.querySelectorAll(".tab").forEach(btn=>{
    btn.onclick=()=>{
        const tab=btn.dataset.tab;
        sw(tab);
        if(['dashboard','appliance','stations','handover'].includes(tab)){
            if(typeof window.guardianRenderCommand==='function') window.guardianRenderCommand();
            if(tab==='appliance' && typeof renderAppliancePane==='function') renderAppliancePane();
        }
    };
});

window.addEventListener("message",function(e){

    const d=e.data||{};

    switch(d.type){

        case "open":
            document.body.style.display="block";
            fetch(`https://${GetParentResourceName()}/requestUnitBoard`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
            fetch(`https://${GetParentResourceName()}/requestOngoingIncidents`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
            setTimeout(()=>{if(typeof renderCommandViews==='function')renderCommandViews();},50);
            break;

        case "close":
            document.body.style.display="none";
            break;

    }

});

const sendBtn = document.getElementById("sendMessageBtn");

if(sendBtn){

    sendBtn.onclick = function(){

        const message = document.getElementById("messageBox").value;
        const target = document.getElementById("messageTarget").value;

        if(message.trim() === "") return;

        fetch(`https://${GetParentResourceName()}/sendMessage`,{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                target:target,
                message:message

            })

        });

        document.getElementById("messageBox").value="";

    };

}

const closeBtn=document.getElementById("close");

if(closeBtn){

    closeBtn.onclick=function(){

        fetch(`https://${GetParentResourceName()}/close`,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:"{}"
        });

        document.body.style.display="none";

    };

}

function renderAppliancePane(){
  const box=document.getElementById('statuses');
  if(!box)return;
  const rows=Object.entries(commandState.units||{});
  box.innerHTML=rows.length?rows.map(([cs,u])=>{
    const meta=commandState.resources[String(cs).toUpperCase()]||commandState.resources[String(cs).toLowerCase()]||{};
    return `<div class="statusRow">
      <strong>${escCmd(cs)}</strong>
      <span>${escCmd(stationForCmd(cs))}</span>
      <span>${escCmd(meta.type||'Other')}</span>
      <span>${escCmd(u?.status||'OFF RUN')}</span>
    </div>`;
  }).join(''):'<div class="noIncidents">No signed-on appliances are currently visible to Control.</div>';
}
window.addEventListener("message", function(e){
    const d = e.data || {};
    if(d.type !== "unitBoard") return;

    commandState.units = d.units || {};
    commandState.callsigns = d.callsigns || [];
    commandState.stations = d.callSignStations || {};
    commandState.skills = d.applianceSkills || {};
    commandState.resources = d.applianceResources || {};
    commandState.resourceTypes = (d.resourceTypes && d.resourceTypes.length)
        ? d.resourceTypes
        : commandState.resourceTypes;

    if(typeof window.guardianRenderCommand === 'function'){
        window.guardianRenderCommand();
    }
});

document.addEventListener("click", function(e){

    const btn = e.target.closest(".dispatchSelect");
    if(!btn) return;

    const cs = btn.dataset.callsign;

    if(selectedMDT.includes(cs)){

        selectedMDT = selectedMDT.filter(x => x !== cs);

        btn.classList.remove("selected");
        btn.innerText = "SELECT";

    }else{

        selectedMDT.push(cs);

        btn.classList.add("selected");
        btn.innerText = "SELECTED";

    }

});
window.addEventListener("message", function(e){

    const d = e.data || {};

    if(d.type !== "status") return;

    statusLog.unshift(d.item);

    if(statusLog.length > 100){
        statusLog.pop();
    }

    const box = document.getElementById("statuses");
    if(!box) return;

box.innerHTML = statusLog.map(s => `
<div class="statusRow">
    <span>${s.time}</span>
    <strong>${s.unit}</strong>
    <span>${s.status}</span>
</div>
`).join("");

});
window.addEventListener("message", function(e){

    const d = e.data || {};

    if(d.type !== "ack") return;

    acks.unshift(d.item);

    if(acks.length > 100){
        acks.pop();
    }

    const box = document.getElementById("acks");
    if(!box) return;

    box.innerHTML = acks.map(a => `
<div class="statusRow">
    <span>${a.time}</span>
    <strong>${a.unit}</strong>
    <span>ACKNOWLEDGED</span>
</div>
`).join("");

});

let controlMessageThread=[];
let selectedControlMessage=-1;

function renderControlMessages(){
  const box=document.getElementById('msgs');
  if(!box) return;
  box.innerHTML='';
  const thread=document.createElement('div');
  thread.id='guardianControlConversation';
  thread.className='messageConversation';

  if(!controlMessageThread.length){
    const empty=document.createElement('div');
    empty.className='messageCard';
    empty.textContent='No messages';
    thread.appendChild(empty);
  } else {
    controlMessageThread.forEach((m,i)=>{
      const row=document.createElement('div');
      row.className='messageCard'+(i===selectedControlMessage?' selectedControlMessage':'');
      row.onclick=()=>{selectedControlMessage=i;renderControlMessages();};

      const head=document.createElement('div');
      head.className='messageHeader';

      const sender=document.createElement('strong');
      sender.textContent=m.sender||'UNIT';

      if(m.rank){
        const rank=document.createElement('small');
        rank.textContent=' · '+m.rank;
        rank.style.cssText='color:#7f91a6;font-weight:500;margin-left:4px';
        sender.appendChild(rank);
      }

      const time=document.createElement('span');
      time.textContent=m.time||'';

      head.appendChild(sender);
      head.appendChild(time);

      const body=document.createElement('div');
      body.className='messageBody';
      body.textContent=m.text||'';

      row.appendChild(head);
      row.appendChild(body);
      thread.appendChild(row);
    });
  }

  box.appendChild(thread);
}

window.addEventListener('message',function(e){
  const d=e.data||{};
  if(d.type!=='message' || !d.item) return;

  const item=d.item;
  const key=[item.sender||'',item.time||'',item.text||''].join('|');

  if(!controlMessageThread.some(m=>[m.sender||'',m.time||'',m.text||''].join('|')===key)){
    controlMessageThread.push({
      sender:item.sender||'CONTROL',
      rank:item.rank||'',
      name:item.name||'',
      role:item.role||'',
      callsign:item.callsign||'',
      text:item.text||'',
      time:item.time||'',
      direction:item.direction||'',
      conversation:'CONTROL'
    });
    selectedControlMessage=controlMessageThread.length-1;
    renderControlMessages();
  }
});

renderControlMessages();

function escCmd(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function stationForCmd(cs){
  const key=String(cs||'').trim().toUpperCase();
  const map=commandState.stations||{};
  if(map[key]) return map[key];
  const found=Object.keys(map).find(k=>String(k).trim().toUpperCase()===key);
  return found?map[found]:'Unallocated';
}
function activeIncidentsCmd(){
  return Array.isArray(commandState.incidents)?commandState.incidents.filter(i=>String(i.status||'').toUpperCase()!=='CLOSED'):[];
}
/* ==========================
   ONGOING FIRE INCIDENTS
========================== */
(function(){
  const state={incidents:[],selected:null,units:{},callsigns:[]};

  function nui(name,data){
    fetch(`https://${GetParentResourceName()}/${name}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data||{})
    }).catch(()=>{});
  }

  function escapeHtml(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function priorityClass(p){
    const x=String(p||'').replace(/\s+/g,'');
    if(x==='Immediate')return 'priorityImmediate';
    if(x==='Prompt')return 'priorityPrompt';
    return 'priorityNonEmergency';
  }

  function renderList(){
    const list=document.getElementById('ongoingIncidentList');
    const details=document.getElementById('ongoingIncidentDetails');
    if(!list)return;
    details.hidden=true; list.style.display='flex';

    if(!state.incidents.length){
      list.innerHTML='<div class="noIncidents">No ongoing incidents.</div>';
      return;
    }

    list.innerHTML=state.incidents.map((inc,i)=>{
      const units=Array.isArray(inc.assignedUnits)?inc.assignedUnits:[];
      return `<div class="ongoingIncidentCard" data-incident-index="${i}">
        <div class="ongoingIncidentTop">
          <div>
            <div class="ongoingIncidentId">#${escapeHtml(inc.id)} · ${escapeHtml(inc.type||'INCIDENT')}</div>
            <div class="ongoingIncidentType">${escapeHtml(inc.address||'Location not provided')}</div>
          </div>
          <div class="incidentPriority ${priorityClass(inc.priority)}">${escapeHtml(inc.priority||'')}</div>
        </div>
        <div class="ongoingIncidentMeta">
          <span>📍 ${escapeHtml(inc.postal||'No postal')}</span>
          <span>🚒 ${units.length} appliance${units.length===1?'':'s'}</span>
          <span>⏱ ${escapeHtml(inc.time||'')}</span>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.ongoingIncidentCard').forEach(card=>{
      card.onclick=()=>showDetails(Number(card.dataset.incidentIndex));
    });
  }

  function showDetails(index){
    const inc=state.incidents[index];
    if(!inc)return;
    state.selected=inc;

    const list=document.getElementById('ongoingIncidentList');
    const details=document.getElementById('ongoingIncidentDetails');
    list.style.display='none'; details.hidden=false;

    document.getElementById('ongoingIncidentHeader').innerHTML=
      `<div class="sectionTitle">🔥 Incident #${escapeHtml(inc.id)} — ${escapeHtml(inc.type||'Incident')}</div>`;

    document.getElementById('ongoingIncidentInfo').innerHTML=`
      <div class="detailLine"><span>Location</span><strong>${escapeHtml(inc.address||'—')}</strong></div>
      <div class="detailLine"><span>Postal</span><strong>${escapeHtml(inc.postal||'—')}</strong></div>
      <div class="detailLine"><span>Priority</span><strong class="${priorityClass(inc.priority)}">${escapeHtml(inc.priority||'—')}</strong></div>
      <div class="detailLine"><span>Caller</span><strong>${escapeHtml(inc.caller||'—')}</strong></div>
      <div class="detailLine"><span>Dispatched</span><strong>${escapeHtml(inc.time||'—')}</strong></div>
      <div style="margin-top:12px;color:#b9c4d2;line-height:1.5">${escapeHtml(inc.notes||'No notes.')}</div>`;

    const roles=inc.assignedRoles||{};
    const crews=inc.applianceCrew||{};
    const members=inc.crewMembers||{};
    const units=Array.isArray(inc.assignedUnits)?inc.assignedUnits:[];
    const roleOptions=[
      'Crew','Crew Commander','Watch Commander','Incident Commander',
      'Safety Officer','Pump Commander','Sector Commander','Other'
    ];

    // Populate editable incident details.
    const incidentTypeEdit=document.getElementById('incidentTypeEdit');
    const incidentPriorityEdit=document.getElementById('incidentPriorityEdit');
    const incidentAddressEdit=document.getElementById('incidentAddressEdit');
    const incidentPostalEdit=document.getElementById('incidentPostalEdit');
    const incidentCallerEdit=document.getElementById('incidentCallerEdit');
    const scene=document.getElementById('incidentSceneStatus');
    const casualties=document.getElementById('incidentCasualties');
    const detailsEdit=document.getElementById('incidentDetailsEdit');
    const hazardsEdit=document.getElementById('incidentHazardsEdit');
    const resourcesEdit=document.getElementById('incidentResourcesEdit');
    if(incidentTypeEdit)incidentTypeEdit.value=inc.type||'999 EMERGENCY';
    if(incidentPriorityEdit)incidentPriorityEdit.value=inc.priority||'Immediate';
    if(incidentAddressEdit)incidentAddressEdit.value=inc.address||'';
    if(incidentPostalEdit)incidentPostalEdit.value=inc.postal||'';
    if(incidentCallerEdit)incidentCallerEdit.value=inc.caller||'';
    if(scene)scene.value=inc.sceneStatus||'';
    if(casualties)casualties.value=Number(inc.casualties||0);
    if(detailsEdit)detailsEdit.value=inc.details||'';
    if(hazardsEdit)hazardsEdit.value=inc.hazards||'';
    if(resourcesEdit)resourcesEdit.value=inc.resources||'';

    document.getElementById('saveIncidentDetails').onclick=()=>{
      nui('updateIncidentDetails',{
        incidentId:inc.id,
        type:incidentTypeEdit?.value||inc.type||'999 EMERGENCY',
        priority:incidentPriorityEdit?.value||inc.priority||'Immediate',
        address:incidentAddressEdit?.value||'',
        postal:incidentPostalEdit?.value||'',
        caller:incidentCallerEdit?.value||'',
        sceneStatus:scene?.value||'',
        casualties:Number(casualties?.value||0),
        details:detailsEdit?.value||'',
        hazards:hazardsEdit?.value||'',
        resources:resourcesEdit?.value||''
      });
    };

    const timelineBox=document.getElementById('incidentTimeline');
    if(timelineBox){
      const items=Array.isArray(inc.timeline)?inc.timeline:[];
      timelineBox.innerHTML=items.slice().reverse().map(ev=>`
        <div class="timelineItem">
          <div><b>${escapeHtml(ev.time||'')}</b>
          <strong>${escapeHtml(ev.text||'')}</strong>
          ${ev.callsign?`<small>🚒 ${escapeHtml(ev.callsign)}</small>`:''}</div>
        </div>`).join('') || '<div class="noIncidents">No activity recorded yet.</div>';
    }

    // Dispatch/mobilise appliances here, after the incident exists.
    const assignedSet={};
    units.forEach(cs=>assignedSet[String(cs).toUpperCase()]=true);
    // Only show genuinely available pumps, plus pumps already assigned to
    // this incident so they can be unassigned. Pumps committed to another
    // open incident are deliberately hidden from this dispatch list.
    const busyElsewhere=new Set();
    (state.incidents||[]).forEach(other=>{
      if(!other || String(other.id)===String(inc.id) || other.status==='CLOSED') return;
      (other.assignedUnits||[]).forEach(cs=>busyElsewhere.add(String(cs).toUpperCase()));
    });

    const applianceStatuses=inc.applianceStatuses||{};
    const dispatchOptions=Object.keys(state.units||{}).sort().map(cs=>{
      const u=state.units[cs]||{};
      const key=String(cs).toUpperCase();
      const isAssigned=!!assignedSet[key];
      // A signed-on callsign is dispatchable unless it is actually committed
      // to another open incident.  Do NOT use the MDT's radio status here: a
      // pump can be Home Station / Available Pager / Mobile And Available etc.
      // and must still be selectable.  OFF RUN removes the callsign from the
      // server's active unit board entirely.
      if(!isAssigned && busyElsewhere.has(key)) return '';
      const liveStatus=isAssigned
        ? String(applianceStatuses[key] || 'MOBILISED TO THIS INCIDENT')
        : 'AVAILABLE';
      return `<div class="assignPumpRow">
        <div><strong>🚒 ${escapeHtml(cs)}</strong><span>${escapeHtml(liveStatus)}</span></div>
        <button class="${isAssigned?'unassignPumpBtn':'assignPumpBtn'}" data-callsign="${escapeHtml(cs)}" data-assign="${isAssigned?'false':'true'}">
          ${isAssigned?'UNASSIGN / RELEASE':'MOBILISE'}
        </button>
      </div>`;
    }).filter(Boolean).join('');

    let assignmentBox=document.getElementById('incidentPumpAssignment');
    if(!assignmentBox){
      assignmentBox=document.createElement('div');
      assignmentBox.id='incidentPumpAssignment';
      assignmentBox.className='ongoingDetailCard pumpAssignmentCard';
      const parent=document.getElementById('ongoingIncidentDetails');
      parent.insertBefore(assignmentBox,parent.querySelector('.ongoingDetailGrid'));
    }
    assignmentBox.innerHTML=`<h3>🚒 Assign / Mobilise Appliances</h3>
      <div class="assignPumpHelp">Only AVAILABLE pumps are shown. A pump already committed to another ongoing incident will stay hidden until it is released or that incident is closed.</div>
      <div class="mobilisationOptions">
        <div class="mobilisationOptionsTitle">📡 Mobilisation Options</div>
        <label class="dispatchToggle"><input type="checkbox" id="mobiliseMDT" ${inc.sendMDT !== false ? 'checked' : ''}><span>Send to MDT</span></label>
        <label class="dispatchToggle"><input type="checkbox" id="mobiliseTurnout" ${inc.sendTurnout === true ? 'checked' : ''}><span>Send to Turnout</span></label>
        <label class="dispatchToggle"><input type="checkbox" id="mobilisePager" ${inc.sendPager === true ? 'checked' : ''}><span>Send to Pager</span></label>
      </div>
      <div class="assignPumpList">${dispatchOptions || '<div class="noIncidents">No active appliances available.</div>'}</div>`;

    assignmentBox.querySelectorAll('.assignPumpBtn,.unassignPumpBtn').forEach(btn=>{
      btn.onclick=()=>{
        const assigning=btn.dataset.assign==='true';
        nui('assignAppliance',{
          incidentId:inc.id,
          callsign:btn.dataset.callsign,
          assign:assigning,
          enableMDT:document.getElementById('mobiliseMDT')?.checked === true,
          enableTurnout:document.getElementById('mobiliseTurnout')?.checked === true,
          enablePager:document.getElementById('mobilisePager')?.checked === true
        });
      };
    });

    const container=document.getElementById('incidentApplianceList');
    if(!units.length){
      container.innerHTML='<div class="noIncidents">No appliances assigned.</div>';
    }else{
      container.innerHTML=units.map(cs=>{
        const crew=crews[cs]||{};
        const count=Math.max(0,Number(crew.count||0));
        const roster=members[cs]||{};
        const rosterRows=Array.from({length:count},(_,n)=>{
          const slot=n+1, person=roster[slot]||{};
          return `<div class="crewMemberRow">
            <span class="crewMemberSlot">${slot}</span>
            <div class="crewField"><label>Name</label><input class="crewNameInput" data-callsign="${escapeHtml(cs)}" data-slot="${slot}" placeholder="e.g. Palmer" value="${escapeHtml(person.name||'')}"></div>
            <div class="crewField"><label>Rank</label><input class="crewRankInput" data-callsign="${escapeHtml(cs)}" data-slot="${slot}" placeholder="e.g. Firefighter" value="${escapeHtml(person.rank||'')}"></div>
            <div class="crewField crewRoleField"><label>Radio role <span>(what Control hears)</span></label><select class="crewRoleInput" data-callsign="${escapeHtml(cs)}" data-slot="${slot}">
              ${roleOptions.map(r=>`<option ${r===(person.role||'Crew')?'selected':''}>${escapeHtml(r)}</option>`).join('')}
            </select></div>
            <button class="saveCrewMemberBtn" data-callsign="${escapeHtml(cs)}" data-slot="${slot}">Save</button>
          </div>`;
        }).join('');

        const lead=Object.values(roster).find(x=>x && x.name && x.role && x.role!=='Crew');
        const identity=lead
          ? `${lead.role}${lead.rank?' '+lead.rank:''} ${lead.name}`.replace(/\s+/g,' ').trim()
          : 'No special radio role assigned';

        return `<div class="incidentAppliance">
          <div class="incidentApplianceTop">
            <div><span class="incidentCallsign">🚒 ${escapeHtml(cs)}</span><div class="crewSubheading">Crew members assigned to this pump</div></div>
            <span class="crewCount">${count} crew</span>
          </div>
          <div class="applianceCrewRow">
            <div><strong>How many crew?</strong><div class="crewRoleHint">Set the number first, then fill in each person below.</div></div>
            <input class="applianceCrewCount" type="number" min="0" value="${count}" data-callsign="${escapeHtml(cs)}">
            <button class="saveCrewBtn" data-callsign="${escapeHtml(cs)}">Save crew count</button>
          </div>
          <div class="radioIdentityBadge">📻 <strong>Current radio identity:</strong> ${escapeHtml(identity)}<div class="crewRoleHint">Only named command/radio roles are shown to Control. Ordinary firefighter roles do not need to be assigned here.</div></div>
          <div class="crewRoster">
            <div class="crewRosterTitle">👨‍🚒 Who is on ${escapeHtml(cs)}?</div>
            <div class="crewRosterHelp">For each crew member, enter their name and rank. Use <strong>Radio role</strong> only if you want that person identified by a command/special role when they radio Control.</div>
            ${rosterRows || '<div class="crewRoleHint">Set the crew count above to add crew members.</div>'}
          </div>
        </div>`;
      }).join('');

      container.querySelectorAll('.saveCrewBtn').forEach(btn=>{
        btn.onclick=()=>{
          const input=container.querySelector(`.applianceCrewCount[data-callsign="${CSS.escape(btn.dataset.callsign)}"]`);
          nui('setApplianceCrew',{
            incidentId:inc.id,callsign:btn.dataset.callsign,count:Number(input?.value||0)
          });
        };
      });
      container.querySelectorAll('.saveCrewMemberBtn').forEach(btn=>{
        btn.onclick=()=>{
          const cs=btn.dataset.callsign, slot=Number(btn.dataset.slot);
          const name=container.querySelector(`.crewNameInput[data-callsign="${CSS.escape(cs)}"][data-slot="${slot}"]`)?.value||'';
          const rank=container.querySelector(`.crewRankInput[data-callsign="${CSS.escape(cs)}"][data-slot="${slot}"]`)?.value||'';
          const role=container.querySelector(`.crewRoleInput[data-callsign="${CSS.escape(cs)}"][data-slot="${slot}"]`)?.value||'Crew';
          nui('setCrewMember',{incidentId:inc.id,callsign:cs,slot,name,rank,role});
        };
      });
    }

    const closeBtn=document.getElementById('closeOngoingIncident');
    if(closeBtn){
      closeBtn.onclick=(ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        nui('closeIncident',{incidentId:inc.id});
        closeBtn.disabled=true;
        closeBtn.textContent='Closing...';
        setTimeout(()=>{
          if(closeBtn){
            closeBtn.disabled=false;
            closeBtn.textContent='Close Incident';
          }
        },1500);
      };
    }
  }

  document.getElementById('backToOngoing')?.addEventListener('click',renderList);

  window.addEventListener('message',e=>{
    const d=e.data||{};
    if(d.type==='unitBoard'){
      state.units=d.units||{};
      state.callsigns=Array.isArray(d.callsigns)?d.callsigns:[];
      if(state.selected){
        const idx=state.incidents.findIndex(x=>String(x.id)===String(state.selected.id));
        if(idx>=0) showDetails(idx);
      }
    }
    if(d.type==='ongoingIncidents'){
      state.incidents=Array.isArray(d.incidents)?d.incidents:[];
      if(state.selected){
        const idx=state.incidents.findIndex(x=>String(x.id)===String(state.selected.id));
        if(idx>=0) showDetails(idx);
        else { state.selected=null; renderList(); }
      }else renderList();
    }
    if(d.type==='open'){
      nui('requestOngoingIncidents');
    }
  });

  // Ensure the tab works with the existing generic .tab handler.
  document.querySelector('[data-tab="ongoing"]')?.addEventListener('click',()=>{
    nui('requestOngoingIncidents');
    fetch(`https://${GetParentResourceName()}/requestUnitBoard`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
    renderList();
  });
})();

window.addEventListener('message',function(e){
  const d=e.data||{};
});

/* =========================================================
   Stable Guardian Control command views
========================================================= */
(function(){
  const st=commandState;

  const esc=function(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
    });
  };

  function getStation(cs){
    const key=String(cs||'').trim().toUpperCase();
    const map=st.stations||{};
    if(map[key]) return String(map[key]);
    const found=Object.keys(map).find(k=>String(k).trim().toUpperCase()===key);
    return found?String(map[found]):'Unallocated';
  }

  function getSkill(cs){
    const key=String(cs||'').trim().toUpperCase();
    const map=st.skills||{};
    if(map[key]) return String(map[key]);
    const found=Object.keys(map).find(k=>String(k).trim().toUpperCase()===key);
    return found ? String(map[found]) : 'Not configured';
  }

  function getResource(cs){
    const key=String(cs||'').trim().toUpperCase();
    const map=st.resources||{};
    if(map[key]) return map[key];
    const found=Object.keys(map).find(k=>String(k).trim().toUpperCase()===key);
    return found?map[found]:{type:'Other',role:'Resource'};
  }

  function allCallsigns(){
    const arr=Array.isArray(st.callsigns)?st.callsigns.slice():[];
    Object.keys(st.units||{}).forEach(k=>arr.push(k));
    Object.keys(st.stations||{}).forEach(k=>arr.push(k));
    Object.keys(st.resources||{}).forEach(k=>arr.push(k));
    const seen=new Set(), out=[];
    arr.forEach(x=>{
      const clean=String(x||'').trim();
      const key=clean.toUpperCase();
      if(clean && !seen.has(key)){seen.add(key);out.push(clean);}
    });
    return out.sort((a,b)=>a.toUpperCase().localeCompare(b.toUpperCase()));
  }

  function openIncidents(){
    return Array.isArray(st.incidents)?st.incidents.filter(i=>String(i.status||'').toUpperCase()!=='CLOSED'):[];
  }

  function mode(status){
    const s=String(status||'OFF RUN').toLowerCase();
    if(/mobile to incident|in attendance at incident|at incident|on scene/.test(s)) return 'red';
    if(/available|home station|mobile and available|available at incident|available standby station/.test(s)) return 'green';
    return 'grey';
  }

  function rows(){
    return allCallsigns().map(cs=>{
      const u=(st.units||{})[cs] || (st.units||{})[cs.toUpperCase()] || (st.units||{})[cs.toLowerCase()] || null;
      const status=u&&u.status ? String(u.status) : 'OFF RUN';
      return {cs:cs,unit:u,status:status,mode:mode(status),station:getStation(cs),resource:getResource(cs)};
    });
  }

  function renderDashboard(){
    const rs=rows(), inc=openIncidents();
    const available=rs.filter(r=>r.mode==='green').length;
    const mobile=rs.filter(r=>/mobile/i.test(r.status)).length;
    const scene=rs.filter(r=>/attendance|at incident|on scene/i.test(r.status)).length;

    const stats=document.getElementById('dashboardStats');
    if(stats) stats.innerHTML=[
      ['🔥',inc.length,'Active Incidents','Open operational incidents'],
      ['🚒',available,'Available Appliances','Ready for mobilisation'],
      ['➡️',mobile,'Mobile','Currently travelling'],
      ['📍',scene,'On Scene','Current attendance']
    ].map(x=>`<div class="statCard"><div class="statIcon">${x[0]}</div><div><strong>${x[1]}</strong><span>${x[2]}</span><small>${x[3]}</small></div></div>`).join('');

    const di=document.getElementById('dashboardIncidents');
    if(di) di.innerHTML=inc.length ? inc.slice(0,8).map(i=>`
      <div class="dashboardIncident">
        <div class="dashboardIncidentTop"><b>#${esc(i.id)} · ${esc(i.type||'INCIDENT')}</b><span>${esc(i.priority||'')}</span></div>
        <small>📍 ${esc(i.address||'Location not provided')}${i.postal?' · '+esc(i.postal):''}</small>
        <div class="dashboardIncidentMeta"><span>🚒 ${(i.assignedUnits||[]).length} appliance(s)</span><span>⏱ ${esc(i.time||'')}</span></div>
      </div>`).join('') : '<div class="noIncidents">No active incidents.</div>';

    const da=document.getElementById('dashboardAppliances');
    if(da) da.innerHTML=rs.slice(0,10).map(r=>`
      <div class="snapshotRow">
        <div><b>${esc(r.cs)}</b><small>${esc(r.station)} · ${esc(getSkill(r.cs))}</small></div>
        <span class="statusPill">${esc(r.status)}</span>
      </div>`).join('') || '<div class="noIncidents">No configured appliances.</div>';

    const act=document.getElementById('dashboardActivity');
    if(act) act.innerHTML=(st.activity||[]).slice(0,8).map(a=>`<div class="timelineItem"><div><b>${esc(a.time)}</b><strong>${esc(a.text)}</strong></div></div>`).join('') || '<div class="noIncidents">No recent activity.</div>';
  }

  function renderStations(){
    const el=document.getElementById('stationGrid');
    if(!el) return;
    const groups={};
    rows().forEach(r=>(groups[r.station] ||= []).push(r));

    el.innerHTML=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([station,list])=>{
      const green=list.some(r=>r.mode==='green');
      const red=list.some(r=>r.mode==='red');
      const cls=red?'stationRed':green?'stationGreen':'stationGrey';
      const state=red?'MOBILE / AT INCIDENT':green?'AVAILABLE':'OFF RUN';

      return `<div class="stationCard ${cls}">
        <div class="stationHeader">
          <div><div class="eyebrow">FIRE STATION</div><h3>🏠 ${esc(station)}</h3></div>
          <span class="stationState ${cls}">${state}</span>
        </div>
        ${list.map(r=>{
          const dot=r.mode==='green'?'#00d84a':r.mode==='red'?'#e0002a':'#68717c';
          return `<div class="stationApplianceRow">
            <div class="stationCall">
              <span class="statusDot" style="background:${dot}"></span>
              <b>${esc(r.cs)}</b>
              <small>${esc(getSkill(r.cs))}</small>
            </div>
            <div class="stationStatus">${esc(r.status)}</div>
          </div>`;
        }).join('')}
        <div class="stationFooter">${list.length} configured appliance${list.length===1?'':'s'}</div>
      </div>`;
    }).join('') || '<div class="noIncidents">No configured stations.</div>';
  }

  function renderApplianceBoard(){
    const box=document.getElementById('statuses');
    if(!box) return;
    box.innerHTML=rows().map(r=>`
      <div class="statusRow">
        <strong>${esc(r.cs)}</strong>
        <span>${esc(r.station)}</span>
        <span>${esc(getSkill(r.cs))}</span>
        <span>${esc(r.status)}</span>
      </div>`).join('') || '<div class="noIncidents">No configured appliances.</div>';
  }

  function renderRequests(){
    const el=document.getElementById('resourceRequestList');
    if(!el) return;
    const inc=openIncidents();
    const types=(st.resourceTypes&&st.resourceTypes.length)?st.resourceTypes:['Pump','Rescue','Aerial','Water Carrier','Wildfire','Command Unit','Specialist','Other'];

    el.innerHTML=`<div class="featureCard">
      <div class="featureTitle">🧰 Raise Resource Request</div>
      <div class="resourceFormGrid">
        <label>Incident<select id="resourceIncidentSelect">${inc.map(i=>`<option value="${esc(i.id)}">#${esc(i.id)} · ${esc(i.type||'Incident')}</option>`).join('')||'<option>No active incidents</option>'}</select></label>
        <label>Resource Type<select id="resourceTypeSelect">${types.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label>
        <label>Priority<select id="resourcePrioritySelect"><option>Normal</option><option>Urgent</option></select></label>
        <label class="wide">Reason / Details<textarea id="resourceRequestText" rows="3" placeholder="Reason / details"></textarea></label>
      </div>
      <button id="createResourceRequestBtn" class="saveDetailsBtn" ${inc.length?'':'disabled'}>CREATE REQUEST</button>
    </div>
    <div class="featureCard"><div class="featureTitle">🚒 Matching Resources</div><div id="matchingResources"></div></div>
    <div class="featureCard"><div class="featureTitle">📋 Open Requests</div><div id="openResourceRequests"></div></div>`;

    const typeSel=document.getElementById('resourceTypeSelect');
    const matchBox=document.getElementById('matchingResources');

    function renderMatches(type){
      const busy={};
      inc.forEach(i=>(i.assignedUnits||[]).forEach(cs=>busy[String(cs).toUpperCase()]=true));
      const m=rows().filter(r=>r.resource.type===type && !busy[String(r.cs).toUpperCase()] && r.mode!=='grey');
      matchBox.innerHTML=m.map(r=>`<div class="resourceAvailableRow"><div><b>${esc(r.cs)}</b><small>${esc(r.station)} · ${esc(r.resource.role||r.resource.type)}</small></div><span class="statusPill">${esc(r.status)}</span></div>`).join('') || '<div class="noIncidents">No suitable available resources.</div>';
    }

    if(typeSel){typeSel.onchange=()=>renderMatches(typeSel.value);renderMatches(typeSel.value);}
    const create=document.getElementById('createResourceRequestBtn');
    if(create) create.onclick=()=>{
      const id=document.getElementById('resourceIncidentSelect')?.value;
      if(!id) return;
      fetch(`https://${GetParentResourceName()}/createResourceRequest`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          incidentId:Number(id),
          resourceType:typeSel?.value||'Other',
          type:typeSel?.value||'Other',
          priority:document.getElementById('resourcePrioritySelect')?.value||'Normal',
          notes:document.getElementById('resourceRequestText')?.value||''
        })
      }).catch(()=>{});
    };

    const open=[];
    inc.forEach(i=>(i.resourceRequests||[]).forEach(r=>{if(String(r.status||'OPEN')==='OPEN')open.push({incident:i,request:r});}));
    const openBox=document.getElementById('openResourceRequests');
    if(openBox) openBox.innerHTML=open.length?open.slice().reverse().map(x=>`<div class="resourceCard"><div class="resourceCardTop"><b>🧰 ${esc(x.request.resourceType||x.request.type||'Other')}</b><span>${esc(x.request.priority||'Normal')}</span></div><p>Incident #${esc(x.incident.id)} · ${esc(x.incident.type||'')}</p><p>${esc(x.request.notes||'No details')}</p></div>`).join(''):'<div class="noIncidents">No outstanding resource requests.</div>';
  }

  function renderAll(){
    renderDashboard();
    renderStations();
    renderApplianceBoard();
  }

  window.guardianRenderCommand=renderAll;

  window.addEventListener('message',function(e){
    const d=e.data||{};
    if(d.type==='ongoingIncidents'){
      st.incidents=d.incidents||[];
      st.activity.unshift({time:new Date().toLocaleTimeString(),text:'Live incident data received'});
      st.activity=st.activity.slice(0,30);
      renderAll();
    }
    if(d.type==='status' || d.type==='ack' || d.type==='message'){
      st.activity.unshift({time:new Date().toLocaleTimeString(),text:d.type==='status' ? 'Appliance status updated' : d.type==='ack' ? 'Dispatch ACK received' : 'Message received'});
      st.activity=st.activity.slice(0,30);
      renderDashboard();
    }
  });

  setTimeout(renderAll,100);
})();

(function(){
    function e(v){
        return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
        });
    }

    function getBadge(){
        return document.getElementById('guardian999Badge');
    }

    function getToast(){
        return document.getElementById('guardian999Toast');
    }

    function renderBadge(){
        const badge=getBadge();
        if(!badge) return;
        const count=guardian999Calls.length;
        badge.textContent=String(count);
        badge.hidden=count===0;
    }

    function renderInbox(){
        const box=document.getElementById('guardian999Inbox');
        if(!box) return;

        if(!guardian999Calls.length){
            box.innerHTML='<div class="noIncidents">No 999 calls waiting for Control.</div>';
            return;
        }

        box.innerHTML=guardian999Calls.map(function(call){
            return `<div class="guardian999InboxCard">
                <div class="guardian999InboxTop">
                    <div>
                        <div class="guardian999CallLabel">📞 999 CALL</div>
                        <h3>${e(call.caller || 'Unknown Caller')}</h3>
                    </div>
                    <span class="guardian999Waiting">WAITING</span>
                </div>
                <div class="guardian999DetailsGrid">
                    <div><b>TIME</b><span>${e(call.time || '')}</span></div>
                    <div><b>POSTAL</b><span>${e(call.postal || 'Unknown')}</span></div>
                    <div class="wide"><b>LOCATION</b><span>${e(call.location || 'Location supplied by caller')}</span></div>
                    <div class="wide"><b>REPORT</b><span>${e(call.description || 'No details provided')}</span></div>
                </div>
                <div class="guardian999Actions">
                    <button class="guardian999OpenBtn" data-999-open="${e(call.id)}">SEND TO ONGOING</button>
                    <button class="guardian999DismissBtn" data-999-dismiss="${e(call.id)}">DISMISS</button>
                </div>
            </div>`;
        }).join('');
    }

    function showToast(call){
        const toast=getToast();
        if(!toast || !call) return;

        const text=document.getElementById('guardian999ToastText');
        if(text){
            text.textContent = `${call.caller || 'Unknown caller'} · Postal ${call.postal || 'Unknown'}`;
        }

        toast.hidden=false;
        clearTimeout(window.guardian999ToastTimer);
        window.guardian999ToastTimer=setTimeout(function(){
            toast.hidden=true;
        },12000);
    }

    function open999Tab(){
        const tab=document.querySelector('.tab[data-tab="999calls"]');
        if(tab) tab.click();
    }

    function dismiss999(id){
        fetch(`https://${GetParentResourceName()}/dismiss999Call`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({id:Number(id)})
        }).catch(()=>{});
    }

    function openIncidentFrom999(call){
        if(!call) return;

        fetch(`https://${GetParentResourceName()}/createIncidentFrom999`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({callId:Number(call.id)})
        }).catch(()=>{});

        const toast=getToast();
        if(toast) toast.hidden=true;
    }

    document.addEventListener('click',function(event){
        const openBtn=event.target.closest('[data-999-open]');
        const dismissBtn=event.target.closest('[data-999-dismiss]');
        const openToast=event.target.closest('#guardian999ToastOpen');
        const dismissToast=event.target.closest('#guardian999ToastDismiss');

        if(openToast){
            open999Tab();
            return;
        }

        if(dismissToast){
            const toast=getToast();
            if(toast) toast.hidden=true;
            return;
        }

        if(dismissBtn){
            dismiss999(dismissBtn.dataset['999Dismiss']);
            return;
        }

        if(openBtn){
            const id=String(openBtn.dataset['999Open'] || '');
            const call=guardian999Calls.find(function(item){
                return String(item.id)===id;
            });
            openIncidentFrom999(call);
        }
    });

    
    window.addEventListener('message',function(event){
        const d=event.data || {};
        if(d.type==='999IncidentCreated' && d.incident){
            const id=String(d.incident.id);
            guardian999Calls=guardian999Calls.filter(function(item){
                return String(item.id)!==String(d.incident.source999CallId || '');
            });
            renderBadge();
            renderInbox();

            const ongoingTab=document.querySelector('.tab[data-tab="ongoing"]');
            if(ongoingTab) ongoingTab.click();

            setTimeout(function(){
                const cards=document.querySelectorAll('.ongoingIncidentCard');
                const match=[...cards].find(function(card){
                    return card.textContent.includes('#'+id);
                });
                if(match) match.click();
            },150);
        }
    });

window.addEventListener('message',function(event){
        const d=event.data || {};

        if(d.type==='999Call'){
            const id=String(d.call && d.call.id || '');
            if(id && !guardian999Calls.some(function(item){
                return String(item.id)===id;
            })){
                guardian999Calls.unshift(d.call);
                showToast(d.call);
            }
            renderBadge();
            renderInbox();
        }

        if(d.type==='999Calls'){
            guardian999Calls=Array.isArray(d.calls) ? d.calls : [];
            renderBadge();
            renderInbox();
        }

        if(d.type==='999CallDismissed'){
            const id=String(d.id || '');
            guardian999Calls=guardian999Calls.filter(function(item){
                return String(item.id)!==id;
            });
            renderBadge();
            renderInbox();
        }
    });

    setTimeout(function(){
        fetch(`https://${GetParentResourceName()}/request999Calls`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:'{}'
        }).catch(()=>{});
    },250);

    renderBadge();
    renderInbox();
})();
;
