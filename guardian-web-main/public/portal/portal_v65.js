(()=>{
  function toast(msg,type='info'){
    let stack=document.querySelector('.v65-portal-toasts');if(!stack){stack=document.createElement('div');stack.className='v65-portal-toasts';Object.assign(stack.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'9999',display:'grid',gap:'8px',width:'min(380px,calc(100vw - 36px))'});document.body.appendChild(stack)}
    const el=document.createElement('div');el.textContent=String(msg||'');Object.assign(el.style,{padding:'12px 14px',borderRadius:'10px',border:`1px solid ${type==='error'?'#8e3d49':type==='success'?'#28715a':'#2a6480'}`,background:type==='error'?'#351923':type==='success'?'#0b372a':'#0a2332',color:'#eef7fb',boxShadow:'0 18px 45px rgba(0,0,0,.32)',fontWeight:'700',fontSize:'12px'});stack.appendChild(el);setTimeout(()=>{el.remove();if(!stack.children.length)stack.remove()},4200)
  }
  window.guardianPortalToast=toast;
  // Portal alerts are informational/errors only; present them as non-blocking branded toasts.
  const nativeAlert=window.alert;window.alert=(m)=>{try{toast(m,/error|unable|failed|invalid/i.test(String(m))?'error':'success')}catch{nativeAlert(m)}};
})();
