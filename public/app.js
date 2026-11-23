(function () {
  'use strict';

  var PRICE = 100; // one system = shampoo + treatment
  var SUB_PRICE = 85; // per month, 15% off
  var state = { qty: 1, sys: 0, variant: 's', sub: false, bagOpen: false, menuOpen: false, ready: false };
  var spin = { N: 192, a: 0, v: 0, drawn: -1, dirty: false, drag: null, running: false };

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function eur(n) { return '€' + n; }

  function vals() {
    var bag = state.sys;
    return {
      bag: bag,
      qty: state.qty,
      sys: bag,
      note: bag > 0 ? bag + (bag === 1 ? ' system' : ' systems') + ' (shampoo + treatment) in your bag' : '',
      bagTotal: eur((state.sub ? SUB_PRICE : PRICE) * bag) + (state.sub && bag > 0 ? ' / month' : ''),
      loading: !state.ready,
      bagOpen: state.bagOpen,
      menuOpen: state.menuOpen,
      bagEmpty: bag === 0,
      bagFilled: bag > 0,
      subOn: state.sub && bag > 0
    };
  }

  function render() {
    var v = vals();
    $all('[data-t]').forEach(function (el) { el.textContent = v[el.getAttribute('data-t')]; });
    $all('[data-show]').forEach(function (el) { el.hidden = !v[el.getAttribute('data-show')]; });
    $all('.k-thumb').forEach(function (el) {
      var on = el.getAttribute('data-variant') === state.variant;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.body.style.overflow = (state.bagOpen || state.menuOpen) ? 'hidden' : '';
  }

  function set(patch) {
    var wasBag = state.bagOpen, wasMenu = state.menuOpen;
    for (var k in patch) { state[k] = patch[k]; }
    render();
    if (state.bagOpen && !wasBag) { focusIn('#bag [data-act="closeBag"]:not([style*="inset: 0"])'); }
    if (state.menuOpen && !wasMenu) { focusIn('#menu .k-menu-close'); }
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
    inc: function () { set({ qty: Math.min(9, state.qty + 1) }); },
    dec: function () { set({ qty: Math.max(1, state.qty - 1) }); },
    add: function () { set({ sys: state.sys + state.qty, sub: false, bagOpen: true }); },
    addBoth: function () { set({ sys: state.sys + 1, sub: false, bagOpen: true }); },
    subBoth: function () { set({ sys: Math.max(1, state.sys), sub: true, bagOpen: true }); },
    rm: function () { set({ sys: 0, sub: false }); },
    pickS: function () { pick('s'); },
    pickT: function () { pick('t'); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) { return; }
    var fn = actions[el.getAttribute('data-act')];
    if (fn) { if (!el.hasAttribute('data-nav')) { e.preventDefault(); } fn(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (state.bagOpen || state.menuOpen)) { set({ bagOpen: false, menuOpen: false }); }
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
  (function ticker() {
    var el = document.querySelector('.k-ticker-msg');
    if (!el || !el.animate) { return; }
    var msgs = ['Now in Europe for the first time', 'Free shipping'];
    var i = 0, SPEED = 90; // px per second
    function run() {
      el.textContent = msgs[i];
      var w = window.innerWidth, tw = el.offsetWidth;
      var anim = el.animate(
        [{ transform: 'translateX(' + w + 'px)' }, { transform: 'translateX(' + (-tw) + 'px)' }],
        { duration: (w + tw) / SPEED * 1000, easing: 'linear' }
      );
      anim.onfinish = function () { i = (i + 1) % msgs.length; run(); };
    }
    run();
  })();

  render();
  boot();
})();
