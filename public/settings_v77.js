/* Guardian v77 — Training Documents tab integration. Extends the existing v71
   Training workspace instead of replacing its event/qualification workflows. */
(()=>{
  const A=v=>Array.isArray(v)?v:[];
  const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const api=async(url,opt={})=>{const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d};
  const toast=(msg,bad=false)=>{let t=document.querySelector('.g59Toast');if(t)t.remove();t=document.createElement('div');t.className='g59Toast'+(bad?' bad':'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)};
  const original=window.renderTraining;
  if(typeof original!=='function')return;
  let showingDocs=false;
  async function drawDocuments(panel){
    panel.innerHTML='<div class="g77Loading">Loading training documents…</div>';
    try{
      const [dd,td,rd]=await Promise.all([api('/api/admin/training-documents'),api('/api/admin/training'),api('/api/admin/discord/roles').catch(()=>({roles:[]}))]);
      const docs=A(dd.documents), sessions=A(td.sessions), roles=A(rd.roles);
      const sessionOptions=(selected='')=>`<option value="">Not linked to a session</option>${sessions.map(t=>`<option value="${E(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${E(t.title||'Training session')}</option>`).join('')}`;
      const roleOptions=(selected='')=>`<option value="">No additional Discord role</option>${roles.map(r=>`<option value="${E(r.id)}" ${String(r.id)===String(selected)?'selected':''}>${E(r.name)}</option>`).join('')}`;
      const draw=()=>{
        panel.innerHTML=`<div class="g77DocsHead"><div><span class="g59Kicker">LEARNING RESOURCES</span><h2>Training Documents</h2><p>Upload course files or link Google Slides. Link documents to a session and optionally require a Discord role.</p></div><button id="g77AddDoc">+ ADD DOCUMENT</button></div>
          <div class="g77Stats"><div><b>${docs.length}</b><span>Total resources</span></div><div><b>${docs.filter(d=>d.published!==false).length}</b><span>Published</span></div><div><b>${docs.filter(d=>d.trainingId).length}</b><span>Linked to training</span></div></div>
          <div class="g77DocList">${docs.map(d=>`<article class="g77Doc"><div class="g77DocIcon">${E((d.type||'LINK').toUpperCase().slice(0,4))}</div><div class="g77DocInfo"><div class="g77DocTitle"><h3>${E(d.title||'Untitled resource')}</h3><span class="g59Status ${d.published===false?'closed':'open'}">${d.published===false?'DRAFT':'PUBLISHED'}</span></div><p>${E(d.description||'No description provided.')}</p><small>${E(d.fileName||d.url||'Stored resource')} · ${E((sessions.find(t=>String(t.id)===String(d.trainingId))||{}).title|| (d.trainingId?'Training session':'General resource'))}</small><small>Required Discord role: ${E(d.requiredDiscordRoleName||roles.find(r=>String(r.id)===String(d.requiredDiscordRoleId))?.name||'None')}</small></div><div class="g77DocActions"><a class="buttonLink" href="${E(d.downloadUrl||d.url||'#')}" ${d.downloadUrl?'download':''} target="_blank" rel="noopener">OPEN</a><button data-g77-edit="${E(d.id)}">EDIT</button><button class="danger" data-g77-delete="${E(d.id)}">DELETE</button></div></article>`).join('')||'<div class="g77Empty"><b>No training documents yet</b><span>Add a PDF, PowerPoint, Word file, Google Slides link or other HTTPS resource.</span></div>'}</div>`;
        panel.querySelector('#g77AddDoc').onclick=async()=>{
          try{
            const title=prompt('Document title');if(!title||!title.trim())return;
            const description=prompt('Description','Training material')||'';
            const category=prompt('Category / department','General')||'General';
            const kind=prompt('Type: upload, slides, or link','upload');if(!kind)return;
            const payload={title:title.trim(),description,category,published:true,access:'restricted',type:kind==='slides'?'Google Slides':kind==='upload'?'Upload':'External link'};
            if(kind.toLowerCase()==='upload'){
              const file=await new Promise(resolve=>{const i=document.createElement('input');i.type='file';i.accept='.pdf,.ppt,.pptx,.doc,.docx,.odp,.odt,.png,.jpg,.jpeg,.webp,.mp4';i.onchange=()=>resolve(i.files?.[0]||null);i.click()});
              if(!file)return;if(file.size>2*1024*1024){alert('Uploads are limited to 2 MB per file.');return}
              payload.fileName=file.name;payload.mimeType=file.type;payload.fileData=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});
            }else{
              payload.url=prompt(kind.toLowerCase()==='slides'?'Google Slides sharing URL (HTTPS)':'Resource URL (HTTPS)','https://');if(!payload.url)return;
            }
            payload.trainingId=prompt('Training session ID to link (leave blank for general resource)\nAvailable: '+sessions.map(t=>`${t.title} [${t.id}]`).join('; '),'')||'';
            const role=prompt('Required Discord role ID (leave blank for no extra role)\nAvailable: '+roles.map(r=>`${r.name} [${r.id}]`).join('; '),'')||'';payload.requiredDiscordRoleId=role;payload.requiredDiscordRoleName=roles.find(r=>String(r.id)===String(role))?.name||'';
            await api('/api/admin/training-documents',{method:'POST',body:JSON.stringify({document:payload})});toast('Training document added');const fresh=await api('/api/admin/training-documents');docs.splice(0,docs.length,...A(fresh.documents));draw();
          }catch(e){toast(e.message,true)}
        };
        panel.querySelectorAll('[data-g77-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this training document?'))return;try{await api('/api/admin/training-documents/'+encodeURIComponent(b.dataset.g77Delete),{method:'DELETE'});toast('Document deleted');const fresh=await api('/api/admin/training-documents');docs.splice(0,docs.length,...A(fresh.documents));draw()}catch(e){toast(e.message,true)}});
        panel.querySelectorAll('[data-g77-edit]').forEach(b=>b.onclick=async()=>{const d=docs.find(x=>String(x.id)===String(b.dataset.g77Edit));if(!d)return;const title=prompt('Document title',d.title||'');if(!title)return;const description=prompt('Description',d.description||'')??d.description;const published=confirm('Publish this document? Choose Cancel to save as a draft.');try{await api('/api/admin/training-documents/'+encodeURIComponent(d.id),{method:'PATCH',body:JSON.stringify({title,description,published})});toast('Document updated');const fresh=await api('/api/admin/training-documents');docs.splice(0,docs.length,...A(fresh.documents));draw()}catch(e){toast(e.message,true)}});
      };
      draw();
    }catch(e){panel.innerHTML=`<div class="g77Empty g77Error"><b>Training documents could not be loaded</b><span>${E(e.message)}</span><button id="g77Retry">RETRY</button></div>`;panel.querySelector('#g77Retry').onclick=()=>drawDocuments(panel)}
  }
  window.renderTraining=async function(){
    showingDocs=false;
    await original();
    const tabs=document.querySelector('.g59Tabs');
    const panel=document.querySelector('.g59Panel');
    if(!tabs||!panel)return;
    if(!tabs.querySelector('[data-tab77="documents"]')){
      const b=document.createElement('button');b.type='button';b.dataset.tab77='documents';b.textContent='Training Documents';
      b.onclick=()=>{showingDocs=true;tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');drawDocuments(panel)};
      tabs.appendChild(b);
    }
    if(showingDocs){const b=tabs.querySelector('[data-tab77="documents"]');b?.click()}
  };
})();
