/* Presentation only. Existing routes, permission checks and data renderers remain authoritative. */
(() => {
  'use strict';
  const nav = document.getElementById('mainNavigation');
  const scroller = nav?.querySelector('.industrial-sidebar-scroll');
  if (!scroller) return;

  const search = document.createElement('label');
  search.className = 'premium-nav-search';
  search.innerHTML = '<span>Encontrar módulo</span><input type="search" aria-label="Encontrar módulo no menu" placeholder="Encontrar módulo…" autocomplete="off">';
  scroller.before(search);
  const input = search.querySelector('input');
  const empty = document.createElement('p');
  empty.className = 'premium-nav-empty';
  empty.textContent = 'Nenhum módulo encontrado.';
  empty.hidden = true;
  empty.setAttribute('role', 'status');
  scroller.append(empty);
  let originalGroups;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filter = () => {
    const query = normalize(input.value.trim());
    if (query && !originalGroups) originalGroups = new Map([...scroller.querySelectorAll('details')].map(node => [node, node.open]));
    let matches = 0;
    scroller.querySelectorAll('.tab').forEach(button => {
      const match = !query || normalize(button.textContent).includes(query);
      button.classList.toggle('premium-filter-hidden', !match);
      if (match && !button.classList.contains('is-permission-hidden') && getComputedStyle(button).display !== 'none') matches++;
    });
    scroller.querySelectorAll('details').forEach(group => {
      const match = [...group.querySelectorAll('.tab')].some(button => !button.classList.contains('premium-filter-hidden') && !button.classList.contains('is-permission-hidden'));
      group.classList.toggle('premium-filter-hidden', !match);
      // Keep native accordion behavior; a matching group is labeled, not forcibly opened.
      if (!query && originalGroups?.has(group)) group.open = originalGroups.get(group);
    });
    if (!query) originalGroups = undefined;
    empty.hidden = !query || matches > 0;
  };
  input.addEventListener('input', filter);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; filter(); input.blur(); }
  });
  const footer = document.createElement('div');
  footer.className = 'premium-sidebar-footer';
  footer.innerHTML = '<span class="premium-product-mark" aria-hidden="true">G</span><div><strong>GestMan365</strong><span>Gestão da manutenção</span></div>';
  nav.append(footer);

  const backdrop = document.createElement('button');
  backdrop.className = 'nav-drawer-backdrop';
  backdrop.type = 'button';
  backdrop.dataset.gmSkipIcon = '';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', 'Fechar menu de navegação');
  backdrop.addEventListener('click', () => window.closeMobileNavigation());
  nav.before(backdrop);
  let drawerWasOpen = false;
  const syncDrawer = () => {
    const open = document.body.classList.contains('mobile-nav-open');
    const toggle = document.getElementById('topbarMenuBtn');
    if (innerWidth <= 900 && toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
    }
    if (open === drawerWasOpen) return;
    drawerWasOpen = open;
    if (!open && nav.contains(document.activeElement)) document.getElementById('topbarMenuBtn')?.focus();
  };
  new MutationObserver(syncDrawer).observe(document.body, { attributes:true, attributeFilter:['class'] });
  syncDrawer();
  nav.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !drawerWasOpen) return;
    const items = [...nav.querySelectorAll('button,input,summary,a[href]')].filter(item => !item.disabled && item.tabIndex >= 0 && item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  });
  window.addEventListener('resize', () => {
    if (innerWidth > 900 && drawerWasOpen) window.closeMobileNavigation();
    syncDrawer();
  }, { passive:true });

  // A real skip link and focus destination, including for keyboard-only field users.
  const workspace = document.querySelector('main.workspace');
  if (workspace) {
    workspace.id = 'premiumWorkspace';
    workspace.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'premium-skip';
    skip.href = '#premiumWorkspace';
    skip.textContent = 'Ir para o conteúdo';
    skip.addEventListener('click', event => { event.preventDefault(); workspace.focus(); });
    document.body.prepend(skip);
  }
  // Names remain available to assistive technology in the compact rail.
  nav.querySelectorAll('.tab, summary').forEach(item => {
    if (!item.title) item.title = item.textContent.trim();
  });
})();
