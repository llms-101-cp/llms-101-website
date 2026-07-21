/* render-nav.js — shared navigation for llms101.com
 * Fetches /content/settings/nav.json and renders:
 *   - desktop top bar with hover-dropdown groups (≥641px)
 *   - hamburger + slide-out drawer (≤640px)
 *   - footer link row
 * Defines window.openNav / window.closeNav globally.
 */
(async function () {

  /* ── CSS injection ──────────────────────────────────────────────── */
  if (!document.getElementById('snav-styles')) {
    const s = document.createElement('style');
    s.id = 'snav-styles';
    s.textContent = [
      ':root{',
      '--snav-brown:#3d2a18;--snav-gold:#B8860B;--snav-muted:#9a7a5e;',
      '--snav-cream:#FAF8F4;--snav-light:#F5EDD8;--snav-border:rgba(184,134,11,.18);',
      '--snav-brown-lt:#8a5c3a',
      '}',

      /* hamburger button */
      '.hamburger{background:none;border:none;cursor:pointer;display:none;flex-direction:column;',
      'gap:5px;padding:6px;margin-right:.5rem;flex-shrink:0}',
      '.hamburger span{display:block;width:22px;height:2px;background:var(--snav-brown);',
      'border-radius:1px;transition:transform .25s,opacity .25s}',
      '.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
      '.hamburger.open span:nth-child(2){opacity:0}',
      '.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',

      /* overlay */
      '#nav-overlay{display:none;position:fixed;inset:0;background:rgba(61,42,24,.28);z-index:399}',
      '#nav-overlay.show{display:block}',

      /* drawer */
      '#nav-drawer{position:fixed;top:0;left:-280px;width:260px;height:100vh;',
      'background:var(--snav-cream);border-right:1px solid var(--snav-border);',
      'z-index:400;transition:left .32s cubic-bezier(.4,0,.2,1);',
      'display:flex;flex-direction:column;padding-top:64px;overflow-y:auto}',
      '#nav-drawer.open{left:0}',
      '.snav-drawer-logo{padding:.75rem 1.5rem 1rem;border-bottom:1px solid var(--snav-border);',
      'font-family:"Cormorant Garamond",serif;font-size:1.15rem;color:var(--snav-brown)}',
      '#nav-drawer nav{flex:1}',
      '#nav-drawer nav ul{list-style:none;padding:.25rem 0 .5rem}',
      '#nav-drawer nav ul li a,#nav-drawer .snav-direct-link{',
      'display:block;padding:.8rem 1.5rem;font-size:.88rem;color:var(--snav-brown-lt);',
      'text-decoration:none;letter-spacing:.04em;transition:background .15s,color .15s;',
      'border-left:3px solid transparent}',
      '#nav-drawer nav ul li a:hover,#nav-drawer nav ul li a.active,',
      '#nav-drawer .snav-direct-link:hover,#nav-drawer .snav-direct-link.active{',
      'background:var(--snav-light);color:var(--snav-brown);border-left-color:var(--snav-gold)}',
      '.snav-section-label{font-family:"Jost",sans-serif;font-size:.68rem;font-weight:500;',
      'letter-spacing:.1em;text-transform:uppercase;color:var(--snav-gold);opacity:.8;',
      'padding:.9rem 1.5rem .3rem}',

      /* desktop nav bar */
      '#site-nav-bar{display:flex;align-items:center;gap:.2rem;margin-left:auto}',
      '#site-nav-bar .snav-link{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;',
      'color:var(--snav-muted);text-decoration:none;padding:.3rem .7rem;border-radius:20px;',
      'transition:color .2s,background .2s}',
      '#site-nav-bar .snav-link:hover,#site-nav-bar .snav-link.active{',
      'color:var(--snav-brown);background:var(--snav-light)}',
      '#site-nav-bar .snav-group{position:relative}',
      '#site-nav-bar .snav-group-btn{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;',
      'color:var(--snav-muted);background:none;border:none;cursor:pointer;',
      'padding:.3rem .7rem;border-radius:20px;transition:color .2s,background .2s;',
      'font-family:"Jost",sans-serif;font-weight:300;line-height:1}',
      '#site-nav-bar .snav-group:hover .snav-group-btn,',
      '#site-nav-bar .snav-group:focus-within .snav-group-btn,',
      '#site-nav-bar .snav-group.snav-group-active .snav-group-btn{',
      'color:var(--snav-brown);background:var(--snav-light)}',
      '#site-nav-bar .snav-dropdown{display:none;position:absolute;top:calc(100% + 6px);',
      'left:50%;transform:translateX(-50%);background:var(--snav-cream);',
      'border:1px solid var(--snav-border);border-radius:6px;min-width:190px;',
      'padding:.4rem 0;z-index:500;box-shadow:0 4px 16px rgba(61,42,24,.1)}',
      '#site-nav-bar .snav-group:hover .snav-dropdown,',
      '#site-nav-bar .snav-group:focus-within .snav-dropdown{display:block}',
      '#site-nav-bar .snav-dropdown a{display:block;padding:.55rem 1.1rem;font-size:.8rem;',
      'color:var(--snav-muted);text-decoration:none;letter-spacing:.04em;',
      'white-space:nowrap;transition:color .15s,background .15s}',
      '#site-nav-bar .snav-dropdown a:hover,#site-nav-bar .snav-dropdown a.active{',
      'color:var(--snav-brown);background:var(--snav-light)}',

      /* footer link row */
      'footer a{color:var(--snav-gold);text-decoration:none}',

      /* responsive breakpoint */
      '@media(max-width:640px){',
      '#site-nav-bar{display:none}',
      '.hamburger{display:flex}',
      '}',
      '@media(min-width:641px){',
      '#nav-drawer,#nav-overlay{display:none!important}',
      '.hamburger{display:none!important}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Fetch nav data ─────────────────────────────────────────────── */
  let nav;
  try {
    const res = await fetch('/content/settings/nav.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    nav = await res.json();
  } catch (e) {
    console.warn('[render-nav] nav.json load failed:', e);
    return;
  }

  /* ── Active-path helper ─────────────────────────────────────────── */
  const curPath = (window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/$/, ''));

  function isActive(href) {
    const h = href === '/' ? '/' : href.replace(/\/$/, '');
    return curPath === h;
  }
  function ac(href) { return isActive(href) ? ' active' : ''; }
  function groupActive(children) { return children.some(c => isActive(c.href)); }

  /* ── Desktop nav bar ────────────────────────────────────────────── */
  const bar = document.getElementById('site-nav-bar');
  if (bar) {
    bar.innerHTML = nav.items.map(item => {
      if (!item.group) {
        return `<a href="${item.href}" class="snav-link${ac(item.href)}">${item.label}</a>`;
      }
      const ga = groupActive(item.children) ? ' snav-group-active' : '';
      const children = item.children.map(c =>
        `<a href="${c.href}"${c.page ? ` data-page="${c.page}"` : ''} class="${ac(c.href).trim()}">${c.label}</a>`
      ).join('');
      return `<div class="snav-group${ga}"><button class="snav-group-btn" aria-haspopup="true">${item.group}</button><div class="snav-dropdown">${children}</div></div>`;
    }).join('');
  }

  /* ── Mobile drawer ──────────────────────────────────────────────── */
  const drawer = document.getElementById('nav-drawer');
  if (drawer) {
    let html = '<div class="snav-drawer-logo">Navigation</div><nav>';
    nav.items.forEach(item => {
      if (!item.group) {
        html += `<a href="${item.href}" class="snav-direct-link${ac(item.href)}">${item.label}</a>`;
      } else {
        html += `<div class="snav-section-label">${item.group}</div><ul>`;
        item.children.forEach(c => {
          html += `<li><a href="${c.href}"${c.page ? ` data-page="${c.page}"` : ''} class="${ac(c.href).trim()}">${c.label}</a></li>`;
        });
        html += '</ul>';
      }
    });
    html += '</nav>';
    drawer.innerHTML = html;
  }

  /* ── Footer ─────────────────────────────────────────────────────── */
  if (nav.footer) {
    const footer = document.querySelector('footer');
    if (footer) {
      let p = footer.querySelector('p');
      if (!p) { p = document.createElement('p'); footer.appendChild(p); }
      p.innerHTML = nav.footer.map(f => `<a href="${f.href}">${f.label}</a>`).join(' · ');
    }
  }

  /* ── Open / close ───────────────────────────────────────────────── */
  window.openNav = function () {
    document.getElementById('nav-drawer')?.classList.add('open');
    document.getElementById('hamburger')?.classList.add('open');
    document.getElementById('nav-overlay')?.classList.add('show');
  };
  window.closeNav = function () {
    document.getElementById('nav-drawer')?.classList.remove('open');
    document.getElementById('hamburger')?.classList.remove('open');
    document.getElementById('nav-overlay')?.classList.remove('show');
  };

  /* ── Hamburger wiring (sentinel prevents double-bind) ───────────── */
  const ham = document.getElementById('hamburger');
  if (ham && !ham.dataset.snavWired) {
    ham.dataset.snavWired = '1';
    ham.addEventListener('click', () => {
      document.getElementById('nav-drawer')?.classList.contains('open') ? window.closeNav() : window.openNav();
    });
  }

  const overlay = document.getElementById('nav-overlay');
  if (overlay && !overlay.dataset.snavWired) {
    overlay.dataset.snavWired = '1';
    overlay.addEventListener('click', window.closeNav);
  }

  /* ── Escape key (once per document) ────────────────────────────── */
  if (!document.documentElement.dataset.snavKeyWired) {
    document.documentElement.dataset.snavKeyWired = '1';
    document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeNav?.(); });
  }

  /* ── showPage intercept — index.html only ───────────────────────── */
  /* Clicks on data-page links call showPage() instead of navigating. */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-page]');
    if (!link) return;
    if (typeof window.showPage !== 'function') return;
    e.preventDefault();
    window.showPage(link.dataset.page, link);
    window.closeNav();
  });

})();
