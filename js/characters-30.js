(function () {
  'use strict';
  // The static HTML remains an ordinary set of readable details when JavaScript is unavailable.
  for (const workspace of document.querySelectorAll('[data-character-skills]')) {
    const list = workspace.querySelector('.ts3-skill-selector');
    const buttons = [...list.querySelectorAll('[data-skill-target]')];
    const panels = buttons.map(button => document.getElementById(button.dataset.skillTarget));
    if (panels.some(panel => !panel)) continue;
    const select = (index, focus, animate = true) => {
      buttons.forEach((button, i) => {
        const active = i === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        panels[i].open = active;
        panels[i].classList.toggle('ts3-skill-panel-enter', active && animate);
      });
      if (focus) buttons[index].focus();
    };
    list.setAttribute('role', 'tablist');
    buttons.forEach((button, i) => {
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', button.id);
      panels[i].querySelector('summary').tabIndex = -1;
      panels[i].querySelector('summary').addEventListener('click', e => e.preventDefault());
      button.addEventListener('click', () => select(i, false));
      button.addEventListener('keydown', e => {
        let next;
        if (e.key === 'ArrowRight') next = (i + 1) % buttons.length;
        if (e.key === 'ArrowLeft') next = (i + buttons.length - 1) % buttons.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { e.preventDefault(); select(next, true); }
      });
    });
    const initial = panels.findIndex(panel => panel.open);
    select(initial < 0 ? 0 : initial, false, false);
    workspace.classList.add('ts3-skills-ready');
    list.hidden = false;
  }
  // Search/filter logic remains owned by platform.js; observe its visible result state.
  const empty = document.querySelector('[data-character-empty]');
  if (empty) {
    const cards = [...document.querySelectorAll('.ts3-roster-card')];
    const update = () => { empty.hidden = cards.some(card => !card.hidden); };
    const observer = new MutationObserver(update);
    cards.forEach(card => observer.observe(card, { attributes: true, attributeFilter: ['hidden'] }));
    update();
  }
  const links = [...document.querySelectorAll('.ts3-character-sections a')];
  const updateCurrent = () => links.forEach(link => {
    if (location.hash && new URL(link.href).hash === location.hash) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  window.addEventListener('hashchange', updateCurrent);updateCurrent();
})();
