(() => {
  const q = new URLSearchParams(location.search);
  const standalone = q.get('standaloneRadio') === '1';
  const hideTab = q.get('hideRadioTab') === '1';

  if (hideTab) document.body.classList.add('guardianHideRadioTab');
  if (!standalone) return;

  document.body.classList.add('guardianStandaloneRadio');
  document.title = 'Guardian Radio';

  const forceRadioPane = () => {
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    const radio = document.getElementById('tab-radio');
    if (radio) radio.classList.add('active');
  };

  forceRadioPane();
  setTimeout(forceRadioPane, 50);
  setTimeout(forceRadioPane, 300);
  setTimeout(forceRadioPane, 1000);
})();
