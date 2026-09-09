/* Guardian v65 — appearance helpers only */
(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function sectionFromHash(){
    const raw=(location.hash||'#overview').replace(/^#/, '').split(/[/?]/)[0]||'overview';
    document.body.dataset.guardianSection=raw;
  }
  sectionFromHash();
  addEventListener('hashchange',sectionFromHash);

  // Ctrl/Cmd+K focuses Guardian search.
  addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      const input=$('#globalSearch'); if(input){e.preventDefault();input.focus();input.select();}
    }
  });

  // Transform basic no-data messages into useful visual empty states without changing content.
  function polishEmptyStates(root=document){
    const candidates=$$('p,td,.empty,.notice',root);
    candidates.forEach(el=>{
      if(el.closest('.g65-empty')) return;
      const t=(el.textContent||'').trim();
      if(!t || t.length>120) return;
      if(/^(no |nothing |there are no |no .* yet|no .* found|no .* created|no bookings yet|no training events found)/i.test(t)){
        if(el.tagName==='TD' && el.parentElement?.children.length===1){el.classList.add('g65-empty');}
        else if(el.tagName==='P' || el.classList.contains('empty')) el.classList.add('g65-empty');
      }
    });
  }

  // A small toast API for newer UI pieces.
  window.guardianToast=(message,{title='Guardian',type='info',timeout=4200}={})=>{
    let stack=$('.g65-toast-stack');
    if(!stack){stack=document.createElement('div');stack.className='g65-toast-stack';document.body.appendChild(stack)}
    const toast=document.createElement('div');toast.className='g65-toast '+(type==='success'?'ok':type==='error'?'err':'');
    toast.innerHTML=`<i>${type==='success'?'✓':type==='error'?'!':'i'}</i><div><b></b><small></small></div><button aria-label="Dismiss">×</button>`;
    toast.querySelector('b').textContent=title;toast.querySelector('small').textContent=String(message||'');
    const remove=()=>{toast.remove();if(!stack.children.length)stack.remove()};
    toast.querySelector('button').onclick=remove;stack.appendChild(toast);setTimeout(remove,timeout);
    return toast;
  };

  // Generic async modal helper for future screens and v65 enhancements.
  window.guardianModal=({title='Guardian',description='',fields=[],confirmText='Save',danger=false}={})=>new Promise(resolve=>{
    const wrap=document.createElement('div');wrap.className='g65-modal-backdrop';
    const formFields=fields.map((f,i)=>{
      const id='g65f'+i; const label=`<span>${String(f.label||'Field')}</span>`;
      if(f.type==='textarea')return `<label>${label}<textarea id="${id}" rows="${f.rows||4}" placeholder="${String(f.placeholder||'').replaceAll('"','&quot;')}">${String(f.value??'')}</textarea></label>`;
      if(f.type==='select')return `<label>${label}<select id="${id}">${(f.options||[]).map(o=>{const v=typeof o==='string'?o:o.value,tx=typeof o==='string'?o:o.label;return `<option value="${String(v).replaceAll('"','&quot;')}" ${String(v)===String(f.value)?'selected':''}>${String(tx)}</option>`}).join('')}</select></label>`;
      return `<label>${label}<input id="${id}" type="${f.type||'text'}" value="${String(f.value??'').replaceAll('"','&quot;')}" placeholder="${String(f.placeholder||'').replaceAll('"','&quot;')}"></label>`;
    }).join('');
    wrap.innerHTML=`<div class="g65-modal" role="dialog" aria-modal="true"><div class="g65-modal-head"><h3></h3>${description?'<p></p>':''}</div><div class="g65-modal-body">${formFields}</div><div class="g65-modal-actions"><button class="secondary" data-cancel>Cancel</button><button class="${danger?'danger':''}" data-ok>${confirmText}</button></div></div>`;
    wrap.querySelector('h3').textContent=title;if(description)wrap.querySelector('.g65-modal-head p').textContent=description;
    const close=v=>{wrap.remove();resolve(v)};
    wrap.querySelector('[data-cancel]').onclick=()=>close(null);
    wrap.querySelector('[data-ok]').onclick=()=>close(fields.map((f,i)=>{const el=wrap.querySelector('#g65f'+i);return f.type==='number'?Number(el.value):el.value}));
    wrap.addEventListener('click',e=>{if(e.target===wrap)close(null)});
    document.body.appendChild(wrap);setTimeout(()=>wrap.querySelector('input,select,textarea')?.focus(),0);
  });

  const obs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)polishEmptyStates(n)})));
  obs.observe(document.body,{childList:true,subtree:true});
  polishEmptyStates();
})();
