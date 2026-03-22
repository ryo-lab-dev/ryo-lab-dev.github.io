// Theme switcher
function switchTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nd-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-theme-target') === theme);
  });
}

// Initialize from localStorage (default: katsujii)
(function() {
  var saved = localStorage.getItem('nd-theme') || 'katsujii';
  switchTheme(saved);
})();

// Scroll reveal
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(function(el) { observer.observe(el); });

// Hamburger
(function() {
  var btn = document.getElementById('navToggle');
  var navEl = btn && btn.closest('nav');
  if (btn && navEl) {
    btn.addEventListener('click', function() {
      navEl.classList.toggle('open');
      btn.setAttribute('aria-label', navEl.classList.contains('open') ? 'メニューを閉じる' : 'メニューを開く');
    });
    document.addEventListener('click', function(e) {
      if (!navEl.contains(e.target)) navEl.classList.remove('open');
    });
  }
})();

// Theme Swipe Gauge
(function() {
  var TH = ['hakushi','koushi','sumi','katsujii','stellar','oldfilm','mist','dreamy','blueprint','terminal'];
  var TN = {katsujii:'活字', sumi:'墨', koushi:'格子', terminal:'Terminal', hakushi:'白紙',
            stellar:'星霜', oldfilm:'銀幕', mist:'薄霧', dreamy:'夢想', blueprint:'青写真'};
  var DC = {katsujii:'#C4B8AE', sumi:'#555', koushi:'#C8C8C8', terminal:'#39D353', hakushi:'#D5D5D5',
            stellar:'#FFFFFF', oldfilm:'#D9D4CC', mist:'#0EA5E9', dreamy:'#FF99AA', blueprint:'#38BDF8'};

  // CSS変数補間用カラーデータ [bg, surface, border, border-mid, text1, text2, text3, accent, nav-bg-rgb, nav-bg-alpha, surface-bar]
  var TC = {
    katsujii: {bg:[248,246,241], sf:[253,252,249], bd:[224,221,218], bm:[191,188,184], t1:[10,10,10],   t2:[85,85,85],   t3:[153,153,153], ac:[10,10,10],  nb:[248,246,241], na:.92, sb:[242,240,235]},
    sumi:     {bg:[12,12,12],   sf:[20,20,20],   bd:[30,30,30],   bm:[46,46,46],   t1:[224,224,224], t2:[136,136,136], t3:[68,68,68],   ac:[255,255,255], nb:[12,12,12],   na:.92, sb:[16,16,16]},
    koushi:   {bg:[255,255,255], sf:[250,250,250], bd:[220,220,220], bm:[204,204,204], t1:[26,26,26],  t2:[85,85,85],   t3:[170,170,170], ac:[26,26,26],  nb:[255,255,255], na:.92, sb:[245,245,245]},
    terminal: {bg:[13,13,13],   sf:[17,17,17],   bd:[30,30,30],   bm:[46,74,46],   t1:[200,200,200], t2:[102,102,102], t3:[51,51,51],   ac:[57,211,83], nb:[13,13,13],   na:.94, sb:[10,10,10]},
    hakushi:  {bg:[255,255,255], sf:[255,255,255], bd:[238,238,238], bm:[204,204,204], t1:[17,17,17],  t2:[102,102,102], t3:[187,187,187], ac:[17,17,17],  nb:[255,255,255], na:.96, sb:[249,249,249]},
    stellar:   {bg:[0,0,0],       sf:[10,10,10],    bd:[34,34,34],    bm:[51,51,51],    t1:[255,255,255], t2:[136,136,136], t3:[68,68,68],    ac:[255,255,255], nb:[0,0,0],        na:.94, sb:[5,5,5]},
    oldfilm:   {bg:[26,25,24],    sf:[34,33,32],    bd:[58,56,53],    bm:[74,72,69],    t1:[240,240,232], t2:[181,176,168], t3:[122,117,112], ac:[217,212,204], nb:[26,25,24],     na:.94, sb:[23,22,21]},
    mist:      {bg:[240,249,255], sf:[255,255,255], bd:[224,242,254], bm:[186,230,253], t1:[51,65,85],    t2:[100,116,139], t3:[147,197,253], ac:[14,165,233],  nb:[240,249,255],  na:.92, sb:[224,242,254]},
    dreamy:    {bg:[255,245,247], sf:[255,255,255], bd:[255,209,220], bm:[255,183,197], t1:[93,64,55],    t2:[141,110,99],  t3:[212,160,168], ac:[255,153,170], nb:[255,245,247],  na:.92, sb:[255,228,236]},
    blueprint: {bg:[15,23,42],    sf:[30,41,59],    bd:[56,68,89],    bm:[71,85,105],   t1:[248,250,252], t2:[148,163,184], t3:[100,116,139], ac:[56,189,248],  nb:[15,23,42],     na:.94, sb:[10,22,40]}
  };

  // ── ゲージDOM構築 ──
  var bar  = document.getElementById('tsg-bar');
  var fill = document.getElementById('tsg-fill');
  var hint = document.getElementById('tsg-hint');

  var tsgItems = [], tsgConns = [];
  TH.forEach(function(t, i) {
    if (i > 0) {
      var c = document.createElement('div'); c.className = 'tsg-conn';
      tsgConns.push(c); bar.appendChild(c);
    }
    var item = document.createElement('div'); item.className = 'tsg-item'; item.dataset.i = i;
    var dot  = document.createElement('div'); dot.className = 'tsg-dot'; dot.style.setProperty('--tsg-dc', DC[t]);
    var lbl  = document.createElement('div'); lbl.className = 'tsg-lbl'; lbl.textContent = TN[t];
    item.appendChild(dot); item.appendChild(lbl); tsgItems.push(item); bar.appendChild(item);
  });

  var ci = Math.max(0, TH.indexOf(document.documentElement.getAttribute('data-theme') || 'katsujii'));

  function setFar(idx) {
    tsgItems.forEach(function(el, i) {
      el.classList.toggle('tsg-far', Math.abs(i - idx) > 1);
    });
    tsgConns.forEach(function(c, j) {
      c.classList.toggle('tsg-conn-far', Math.abs(j - idx) > 1 && Math.abs(j + 1 - idx) > 1);
    });
  }

  function setOn(idx) {
    tsgItems.forEach(function(el, i) {
      el.querySelector('.tsg-dot').classList.toggle('on', i === idx);
      el.querySelector('.tsg-lbl').classList.toggle('on', i === idx);
    });
    setFar(idx);
  }
  setOn(ci);

  // ── 色補間ヘルパー ──
  function L(a, b, t) { return a + (b - a) * t; }
  function LC(a, b, t) { return [Math.round(L(a[0],b[0],t)), Math.round(L(a[1],b[1],t)), Math.round(L(a[2],b[2],t))]; }
  function rgb(c)      { return 'rgb('  + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function rgba(c, a)  { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function morph(fi, ti, t) {
    var f = TC[TH[fi]], g = TC[TH[ti]], r = document.documentElement;
    var ac = LC(f.ac, g.ac, t);
    r.style.setProperty('--bg',          rgb(LC(f.bg, g.bg, t)));
    r.style.setProperty('--surface',     rgb(LC(f.sf, g.sf, t)));
    r.style.setProperty('--border',      rgb(LC(f.bd, g.bd, t)));
    r.style.setProperty('--border-mid',  rgb(LC(f.bm, g.bm, t)));
    r.style.setProperty('--text-1',      rgb(LC(f.t1, g.t1, t)));
    r.style.setProperty('--text-2',      rgb(LC(f.t2, g.t2, t)));
    r.style.setProperty('--text-3',      rgb(LC(f.t3, g.t3, t)));
    r.style.setProperty('--accent',      rgb(ac));
    r.style.setProperty('--accent-r',    ac[0]);
    r.style.setProperty('--accent-g',    ac[1]);
    r.style.setProperty('--accent-b',    ac[2]);
    r.style.setProperty('--nav-bg',      rgba(LC(f.nb, g.nb, t), L(f.na, g.na, t)));
    r.style.setProperty('--surface-bar', rgb(LC(f.sb, g.sb, t)));
  }

  function clearMorph() {
    ['--bg','--surface','--border','--border-mid','--text-1','--text-2','--text-3',
     '--accent','--accent-r','--accent-g','--accent-b','--nav-bg','--surface-bar'
    ].forEach(function(p) { document.documentElement.style.removeProperty(p); });
  }

  // ── ドラッグ処理 ──
  var drag = false, sx = 0, p = 0, dir = 0, raf = null;

  function cx(e) { return e.touches ? e.touches[0].clientX : e.clientX; }

  function onDown(e) {
    drag = true; sx = cx(e); p = 0; dir = 0;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    var dx = cx(e) - sx;
    dir = dx >= 0 ? 1 : -1;
    p = Math.min(1, Math.abs(dx) / 100);
    if (p < 0.01) return;
    var ti = (ci + dir + TH.length) % TH.length;
    morph(ci, ti, p);
    fill.style.transformOrigin = dir > 0 ? 'left' : 'right';
    fill.style.transform = 'scaleX(' + p + ')';
    hint.textContent = (dir < 0 ? '← ' : '') + TN[TH[ti]] + (dir > 0 ? ' →' : '');
    // 50%でドット先行ハイライト
    var center = p >= .5 ? ti : ci;
    tsgItems.forEach(function(el, i) {
      var on = (i === ci) || (i === ti && p >= .5);
      el.querySelector('.tsg-dot').classList.toggle('on', on);
      el.querySelector('.tsg-lbl').classList.toggle('on', on);
    });
    setFar(center);
  }

  function onUp() {
    if (!drag) return;
    drag = false;
    var fi = ci, ti = (ci + dir + TH.length) % TH.length;
    if (p > .45 && dir !== 0) {
      // スナップ完了 → テーマ確定
      snap(fi, ti, p, 1, function() {
        window._tsgSw = true;
        switchTheme(TH[ti]);
        window._tsgSw = false;
        clearMorph(); ci = ti; setOn(ci);
        fill.style.transform = 'scaleX(0)';
        hint.textContent = '← DRAG → THEME';
      });
    } else {
      // 戻す
      snap(fi, (p > 0 && dir !== 0) ? ti : fi, p, 0, function() {
        clearMorph(); setOn(ci);
        fill.style.transform = 'scaleX(0)';
        hint.textContent = '← DRAG → THEME';
      });
    }
  }

  function snap(fi, ti, from, to, cb) {
    var s = null, dur = 260;
    function step(ts) {
      if (!s) s = ts;
      var e = 1 - Math.pow(1 - Math.min(1, (ts - s) / dur), 3); // ease-out cubic
      var v = from + (to - from) * e;
      morph(fi, ti, v);
      fill.style.transform = 'scaleX(' + Math.abs(v) + ')';
      if ((ts - s) < dur) { raf = requestAnimationFrame(step); } else { cb(); }
    }
    raf = requestAnimationFrame(step);
  }

  bar.addEventListener('mousedown',  onDown);
  bar.addEventListener('touchstart', onDown, {passive: false});
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, {passive: false});
  window.addEventListener('mouseup',  onUp);
  window.addEventListener('touchend', onUp);

  // ── 外部からのswitchTheme（テーマバー・ひびわれギミック）と同期 ──
  var _sw = window.switchTheme;
  window.switchTheme = function(t) {
    _sw(t);
    if (!window._tsgSw) { var i = TH.indexOf(t); if (i >= 0) { ci = i; setOn(ci); } }
  };
})();
