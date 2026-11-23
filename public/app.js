(function () {
  'use strict';

  var PRICE = 100; // one system = shampoo + treatment
  var SUB_PRICE = 85; // per month, 15% off
  var MAX = 12; // a year's supply, per order
  var state = { qty: 1, sys: 0, variant: 's', sub: false, bagOpen: false, menuOpen: false, ready: false,
    langOpen: false, legalOpen: false, cookieOpen: false };
  var I18N = window.KLARA_I18N;

  // Saved choices live in this browser only (language, cookie decision).
  function load(k) { try { return window.localStorage.getItem('klara-' + k); } catch (e) { return null; } }
  function save(k, v) { try { window.localStorage.setItem('klara-' + k, v); } catch (e) {} }

  var codes = I18N.langs.map(function (l) { return l.code; });
  // Each language has its own address: / for English, /de/, /fr/ and so on.
  function pathLang() {
    var m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
    return m && codes.indexOf(m[1]) >= 0 ? m[1] : null;
  }
  function pickLang() {
    var forced = pathLang() || (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
    if (forced && codes.indexOf(forced) >= 0) { return forced; }
    var saved = load('lang');
    if (saved && codes.indexOf(saved) >= 0) { return saved; }
    var prefs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < prefs.length; i++) {
      var c = String(prefs[i]).slice(0, 2).toLowerCase();
      if (codes.indexOf(c) >= 0) { return c; }
    }
    return 'en';
  }
  var lang = pickLang();
  function info() { return I18N.langs.filter(function (l) { return l.code === lang; })[0]; }
  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key] != null) ? I18N[lang][key] : I18N.en[key];
    if (typeof s === 'string' && vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return s;
  }
  var spin = { N: 192, a: 0, v: 0, drawn: -1, dirty: false, drag: null, running: false };

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function eur(n) {
    try {
      return new Intl.NumberFormat(info().locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    } catch (e) { return '€' + n; }
  }
  // One-time tiers: 6 packages (half a year) save 10%, 12 (a year) save 15%.
  function unit(n) { return n >= 12 ? 85 : n >= 6 ? 90 : PRICE; }
  function saving(n) { return n >= 12 ? 15 : n >= 6 ? 10 : 0; }

  function vals() {
    var bag = state.sys;
    return {
      bag: bag,
      qty: state.qty,
      sys: bag,
      total: eur(unit(state.qty)) + (state.qty > 1 ? ' \u00D7 ' + state.qty : ''),
      totalWas: saving(state.qty) ? eur(PRICE) : '',
      hasSaving: !!saving(state.qty),
      bagSaving: !state.sub && saving(bag) ? ' \u00B7 ' + t('saveN', { n: saving(bag) }) : '',
      bagTotal: eur((state.sub ? SUB_PRICE : unit(bag)) * bag) + (state.sub && bag > 0 ? t('perMonthShort') : ''),
      loading: !state.ready,
      bagOpen: state.bagOpen,
      menuOpen: state.menuOpen,
      langOpen: state.langOpen,
      legalOpen: state.legalOpen,
      cookieOpen: state.cookieOpen,
      bagEmpty: bag === 0,
      bagFilled: bag > 0,
      subOn: state.sub && bag > 0
    };
  }

  function render() {
    var v = vals();
    $all('[data-t]').forEach(function (el) { el.textContent = v[el.getAttribute('data-t')]; });
    $all('[data-show]').forEach(function (el) { el.hidden = !v[el.getAttribute('data-show')]; });
    $all('[data-open]').forEach(function (el) {
      var open = !!v[el.getAttribute('data-open')];
      el.classList.toggle('is-open', open);
      el.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    $all('.k-thumb').forEach(function (el) {
      var on = el.getAttribute('data-variant') === state.variant;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.body.style.overflow = (state.bagOpen || state.menuOpen || state.legalOpen) ? 'hidden' : '';
    var lb = document.querySelector('.k-lang-btn');
    if (lb) { lb.setAttribute('aria-expanded', state.langOpen ? 'true' : 'false'); }
  }

  function langPath(code) { return code === 'en' ? '/' : '/' + code + '/'; }
  function syncUrl() {
    if (!window.history || !history.replaceState || location.protocol === 'file:') { return; }
    var want = langPath(lang);
    if (location.pathname !== want) { history.replaceState(null, '', want + location.hash); }
  }

  // Product and FAQ data for search engines, in the current language.
  function structuredData() {
    var el = document.getElementById('k-ld');
    if (!el) { return; }
    var url = location.origin + langPath(lang);
    var data = [{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Klara Hair Loss Prevention System',
      description: t('metaDesc'),
      image: [location.origin + '/assets/shampoo.webp', location.origin + '/assets/treatment.webp'],
      brand: { '@type': 'Brand', name: 'Klara' },
      manufacturer: { '@type': 'Organization', name: 'NIBEC Co., Ltd.', url: 'https://www.nibec.co.kr' },
      countryOfOrigin: 'KR',
      url: url,
      offers: {
        '@type': 'Offer',
        price: PRICE,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/PreOrder',
        url: url
      }
    }, {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: t('faq').map(function (qa) {
        return { '@type': 'Question', name: qa[0], acceptedAnswer: { '@type': 'Answer', text: qa[1] } };
      })
    }];
    el.textContent = JSON.stringify(data);
  }

  function buildFaq() {
    $all('[data-faq]').forEach(function (box) {
      box.textContent = '';
      t('faq').forEach(function (qa) {
        var d = document.createElement('details');
        var s = document.createElement('summary');
        var h = document.createElement('h3'); h.textContent = qa[0];
        s.appendChild(h);
        s.insertAdjacentHTML('beforeend', '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 7h10"></path><path class="plus-v" d="M7 2v10"></path></svg>');
        var a = document.createElement('p'); a.textContent = qa[1];
        d.appendChild(s); d.appendChild(a);
        box.appendChild(d);
      });
    });
  }

  // Fill every translatable spot on the page for the current language.
  function translate() {
    document.documentElement.lang = lang;
    $all('[data-i18n-content]').forEach(function (el) { el.setAttribute('content', t(el.getAttribute('data-i18n-content'))); });
    buildFaq();
    structuredData();
    $all('[data-i18n]').forEach(function (el) {
      var n = el.getAttribute('data-n'), p = el.getAttribute('data-price');
      el.textContent = t(el.getAttribute('data-i18n'), { n: n, price: p && eur(+p), sub: eur(SUB_PRICE) });
    });
    $all('[data-price]:not([data-i18n])').forEach(function (el) { el.textContent = eur(+el.getAttribute('data-price')); });
    $all('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $all('[data-lang-code]').forEach(function (el) { el.textContent = lang.toUpperCase(); });
    $all('[data-legal]').forEach(function (dl) {
      dl.textContent = '';
      t(dl.getAttribute('data-legal')).forEach(function (item) {
        var parts = item.split('|');
        var dt = document.createElement('dt'); dt.textContent = parts[0];
        var dd = document.createElement('dd'); dd.textContent = parts[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
    });
    $all('[data-langlist]').forEach(function (box) {
      box.textContent = '';
      I18N.langs.forEach(function (l) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'k-langopt';
        b.setAttribute('role', box.getAttribute('data-langlist') === 'pop' ? 'menuitemradio' : 'radio');
        b.setAttribute('aria-checked', l.code === lang ? 'true' : 'false');
        b.setAttribute('data-act', 'setLang');
        b.setAttribute('data-lang', l.code);
        b.setAttribute('lang', l.code);
        var code = document.createElement('b'); code.textContent = l.code.toUpperCase();
        b.appendChild(code);
        b.appendChild(document.createTextNode(l.name));
        box.appendChild(b);
      });
    });
    $all('[data-langselect]').forEach(function (sel) {
      sel.textContent = '';
      I18N.langs.forEach(function (l) {
        var o = document.createElement('option');
        o.value = l.code;
        o.textContent = l.code.toUpperCase() + '  ' + l.name;
        o.selected = l.code === lang;
        sel.appendChild(o);
      });
    });
    restartTicker();
    sizeBand();
  }

  // Keep the page and cookie banner clear of the bottom disclaimer band, whatever its height.
  function sizeBand() {
    var band = document.querySelector('.k-concept');
    if (band) { document.documentElement.style.setProperty('--k-band', band.offsetHeight + 'px'); }
  }
  window.addEventListener('resize', sizeBand);

  function set(patch) {
    var wasBag = state.bagOpen, wasMenu = state.menuOpen, wasLegal = state.legalOpen;
    for (var k in patch) { state[k] = patch[k]; }
    render();
    if (state.bagOpen && !wasBag) { focusIn('#bag [data-act="closeBag"]:not([style*="inset: 0"])'); }
    if (state.menuOpen && !wasMenu) { focusIn('#menu .k-menu-close'); }
    if (state.legalOpen && !wasLegal) { focusIn('#legal .k-legal-close'); }
  }

  function focusIn(sel) { var el = document.querySelector(sel); if (el) { el.focus(); } }

  function pick(variant) {
    spin.dirty = true;
    spin.a = Math.round(spin.a / spin.N) * spin.N - 5;
    set({ variant: variant });
  }

  var actions = {
    openBag: function () { set({ bagOpen: true, menuOpen: false }); },
    openMenu: function () { set({ menuOpen: true }); },
    closeMenu: function () { set({ menuOpen: false }); },
    closeBag: function () { set({ bagOpen: false }); },
    inc: function () { set({ qty: Math.min(MAX, state.qty + 1) }); },
    dec: function () { set({ qty: Math.max(1, state.qty - 1) }); },
    add: function () { set({ sys: Math.min(MAX, state.sys + state.qty), sub: false, bagOpen: true }); },
    addBoth: function () { set({ sys: Math.min(MAX, state.sys + 1), sub: false, bagOpen: true }); },
    subBoth: function () { set({ sys: Math.max(1, state.sys), sub: true, bagOpen: true }); },
    rm: function () { set({ sys: 0, sub: false }); },
    pickS: function () { pick('s'); },
    pickT: function () { pick('t'); },
    toggleLang: function () { set({ langOpen: !state.langOpen }); },
    setLang: function (el) {
      lang = el.getAttribute('data-lang');
      save('lang', lang);
      translate();
      syncUrl();
      set({ langOpen: false, menuOpen: false });
    },
    openTerms: function () { openLegal('legal-terms'); },
    openPrivacy: function () { openLegal('legal-privacy'); },
    closeLegal: function () { set({ legalOpen: false }); },
    consentYes: function () { save('consent', 'accepted'); set({ cookieOpen: false }); },
    consentNo: function () { save('consent', 'declined'); set({ cookieOpen: false }); },
    cookieSettings: function () { set({ cookieOpen: true }); }
  };

  function openLegal(id) {
    set({ legalOpen: true, menuOpen: false, langOpen: false });
    var panel = document.querySelector('#legal .k-panel'), target = document.getElementById(id);
    if (panel && target) { panel.scrollTop = id === 'legal-terms' ? 0 : target.offsetTop - 16; }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) { return; }
    var fn = actions[el.getAttribute('data-act')];
    if (fn) { if (!el.hasAttribute('data-nav')) { e.preventDefault(); } fn(el); }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-langselect]')) { return; }
    lang = e.target.value;
    save('lang', lang);
    translate();
    syncUrl();
    render();
  });
  // Close the language list when tapping anywhere else.
  document.addEventListener('click', function (e) {
    if (state.langOpen && !e.target.closest('.k-langpop, .k-lang-btn')) { set({ langOpen: false }); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (state.bagOpen || state.menuOpen || state.langOpen || state.legalOpen)) {
      set({ bagOpen: false, menuOpen: false, langOpen: false, legalOpen: false });
    }
  });

  // 360° bottle spin, drawn from four 8×6 sprite sheets of 248×648 frames.
  function boot() {
    var cv = document.querySelector('canvas.klara-cv');
    var sheets = $all('img.klara-sheet');
    var strip = document.querySelector('img.klara-strip');
    var tries = 0;

    function ready() {
      return cv && cv.getContext && sheets.length === 4 && sheets.every(function (s) { return s.complete && s.naturalWidth > 0; });
    }
    (function wait() {
      if (!ready()) { if (tries++ < 900) { setTimeout(wait, 100); } return; }
      start();
    })();

    function start() {
      spin.running = true;
      var ctx = cv.getContext('2d');
      var N = spin.N, FW = 248, FH = 648, COLS = 8, PER = 48;
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var AUTO = still ? 0 : N / 12000;
      spin.v = AUTO;
      var last = performance.now();

      function draw() {
        var k = ((Math.round(spin.a) % N) + N) % N;
        if (k === spin.drawn && !spin.dirty) { return; }
        spin.dirty = false;
        var s = sheets[Math.floor(k / PER)], i = k % PER;
        ctx.clearRect(0, 0, FW, FH);
        ctx.drawImage(s, (i % COLS) * FW, Math.floor(i / COLS) * FH, FW, FH, 0, 0, FW, FH);
        if (state.variant === 't' && strip && strip.complete && strip.naturalWidth > 0) {
          ctx.clearRect(0, 524, FW, 96);
          ctx.drawImage(strip, (k % 4) * FW, Math.floor(k / 4) * 96, FW, 96, 0, 524, FW, 96);
        }
        if (spin.drawn < 0) { set({ ready: true }); }
        spin.drawn = k;
      }
      function tick(now) {
        var dt = Math.min(64, now - last); last = now;
        if (!spin.drag) {
          spin.v += (AUTO - spin.v) * Math.min(1, dt / 700);
          spin.a += spin.v * dt;
        }
        draw();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      cv.addEventListener('pointerdown', function (e) {
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        var r = Math.max(40, cv.clientWidth * 0.47);
        spin.drag = { x: e.clientX, a: spin.a, k: N / (2 * Math.PI * r), lx: e.clientX, lt: performance.now() };
        spin.v = 0;
      });
      cv.addEventListener('pointermove', function (e) {
        var d = spin.drag;
        if (!d) { return; }
        var now = performance.now();
        spin.a = d.a + (e.clientX - d.x) * d.k;
        var dt = now - d.lt;
        if (dt > 4) {
          var inst = (e.clientX - d.lx) * d.k / dt;
          spin.v = spin.v * 0.6 + inst * 0.4;
          d.lx = e.clientX; d.lt = now;
        }
      });
      function up() {
        var d = spin.drag;
        if (!d) { return; }
        if (performance.now() - d.lt > 120) { spin.v = 0; }
        var cap = N / 1200;
        spin.v = Math.max(-cap, Math.min(cap, spin.v));
        spin.drag = null;
      }
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
    }
  }

  // Ticker: one message crosses the screen at a time, then the next one starts.
  var tick = { el: document.querySelector('.k-ticker-msg'), i: 0, anim: null };
  function runTicker() {
    var el = tick.el;
    if (!el || !el.animate) { return; }
    el.textContent = t(tick.i === 0 ? 'ticker1' : 'ticker2');
    var w = window.innerWidth, tw = el.offsetWidth, SPEED = 90; // px per second
    tick.anim = el.animate(
      [{ transform: 'translateX(' + w + 'px)' }, { transform: 'translateX(' + (-tw) + 'px)' }],
      { duration: (w + tw) / SPEED * 1000, easing: 'linear' }
    );
    tick.anim.onfinish = function () { tick.i = 1 - tick.i; runTicker(); };
  }
  function restartTicker() {
    if (tick.anim) { tick.anim.onfinish = null; tick.anim.cancel(); }
    tick.i = 0;
    runTicker();
  }

  // GDPR: ask once; nothing optional is loaded unless the visitor accepts.
  state.cookieOpen = !load('consent');

  translate();
  syncUrl();
  render();
  boot();
})();
