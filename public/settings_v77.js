/* Guardian v77 — Training Documents tab integration. Extends the existing v71
   Training workspace instead of replacing its event/qualification workflows. */
(()=>{
  const A=v=>Array.isArray(v)?v:[];
  const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const api=async(url,opt={})=>{const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d};
  const toast=(msg,bad=false)=>{let t=document.querySelector('.g59Toast');if(t)t.remove();t=document.createElement('div');t.className='g59Toast'+(bad?' bad':'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)};

  const original=window.renderTraining || globalThis.renderTraining;
  if(typeof original!=='function')return;
  let docsMode=false;
  let lastShell=null;
  async function attachDocumentsTab(){
    const shell=document.querySelector('.v49Shell');
    const tabs=shell?.querySelector('.settingsSubtabs');
    if(!shell||!tabs)return;
    if(lastShell!==shell){docsMode=false;lastShell=shell}
    let button=tabs.querySelector('[data-g77-documents-tab]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='settingsSubtab';
      button.dataset.g77DocumentsTab='1';
      button.textContent='Training Documents';
      tabs.appendChild(button);
      button.addEventListener('click',async()=>{
        docsMode=true;
        tabs.querySelectorAll('.settingsSubtab').forEach(x=>x.classList.toggle('active',x===button));
        let body=tabs.nextElementSibling;
        if(body)body.style.display='none';
        let panel=shell.querySelector('[data-g77-documents-panel]');
        if(!panel){panel=document.createElement('div');panel.dataset.g77DocumentsPanel='1';panel.className='g77DocumentsPanel';shell.appendChild(panel)}
        await drawDocuments(panel);
      });
    }
    tabs.querySelectorAll('.settingsSubtab:not([data-g77-documents-tab])').forEach(b=>{
      if(b.dataset.g77DocHooked)return;
      b.dataset.g77DocHooked='1';
      b.addEventListener('click',()=>{
        docsMode=false;
        const body=tabs.nextElementSibling;
        if(body)body.style.display='';
        const panel=shell.querySelector('[data-g77-documents-panel]');
        if(panel)panel.remove();
      });
    });
    if(docsMode)button.click();
  }
  window.renderTraining=async function(){
    docsMode=false;
    await original();
    await attachDocumentsTab();
  };
  // Some older Settings builds call the lexical global function directly.
  try{globalThis.renderTraining=window.renderTraining}catch{}
})();
