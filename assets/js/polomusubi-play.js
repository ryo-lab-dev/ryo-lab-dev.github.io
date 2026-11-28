// ポロとむすびの迷宮 紹介ページの「遊び」。
//  A ひょっこり魔獣: 画面の下端から顔を出したり、セクションの区切り線の上を歩いたりする。タップで仲間にできる。
//  B なかまずかん: 仲間にした魔獣を、右下のボタンから開く図鑑に記録する（この端末のブラウザにだけ保存）。
//  F 今日の魔獣: 日本時間の日付で決まる 1 体。ホームの上のカードで会える（ボタンで仲間にできる）。
// 出す魔獣は、アプリの序盤（ランク E・D）の 24 種だけ。ランクの高い魔獣・ぬしは出さない（アプリで見つける楽しみを残す）。
// prefers-reduced-motion のときは動かさず、区切り線の上に座らせる（タップだけで遊べる）。右下の「とめる」で、あそびを止められる。
// 画面外・非表示のタブでは止まる。魔獣は装飾（aria-hidden）で、同じことが、今日の魔獣のボタンとずかんから、キーボードでもできる。
(function () {
  'use strict';
  var base = '../assets/polomusubi/mon/';
  var en = document.documentElement.getAttribute('data-lang') === 'en';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function t(ja, e) { return en ? e : ja; }

  // [id, 名前, 図鑑番号, 属性, すがた]（アプリの monsters.json より。英語の名前はアプリにないので、番号で出す）
  var ROSTER = [
    ['ke_1', 'モフタ', 1, 'fire', '丸い子犬'],
    ['ke_2', 'ニャルコ', 3, 'wind', '長い尾の猫'],
    ['ke_3', 'ポンチョ', 5, 'rock', '縞しっぽのたぬき'],
    ['ke_4', 'ヒノコ', 8, 'fire', '尾に炎のきつね'],
    ['ku_1', 'マメタ', 76, 'grass', '豆'],
    ['ku_2', 'カサモリ', 78, 'grass', '茶色キノコ'],
    ['ku_3', 'ハナビー', 80, 'grass', '花'],
    ['ku_4', 'スズナ', 82, 'grass', '草の鈴'],
    ['mi_1', 'ウオタ', 59, 'water', '小魚'],
    ['mi_2', 'カニパン', 62, 'water', 'カニ'],
    ['mi_3', 'クラゲル', 64, 'water', 'くらげ'],
    ['mi_4', 'カメゾウ', 66, 'water', '亀'],
    ['mu_1', 'イモタン', 40, 'grass', '幼虫'],
    ['mu_2', 'マルダン', 42, 'rock', '丸まる虫'],
    ['mu_3', 'チョウコ', 44, 'wind', '蝶'],
    ['mu_4', 'ホタルン', 46, 'fire', '蛍'],
    ['is_1', 'ココロン', 94, 'rock', '小石'],
    ['is_2', 'ガレキン', 96, 'rock', 'がれきの子'],
    ['is_3', 'コガネ', 98, 'rock', '金の鉱石'],
    ['is_4', 'ラピス', 100, 'water', '青い石'],
    ['to_1', 'ピヨリン', 22, 'wind', '丸いひよこ'],
    ['to_2', 'チュンタ', 24, 'grass', '木の実の小鳥'],
    ['to_3', 'ハトミ', 26, 'wind', '水かきのハト'],
    ['to_4', 'ホーロン', 28, 'rock', 'ずんぐり梟']
  ];
  var ELEM = { fire: ['ほのお', 'Fire'], water: ['みず', 'Water'], wind: ['かぜ', 'Wind'], grass: ['くさ', 'Grass'], rock: ['いわ', 'Rock'] };
  var N = ROSTER.length;
  function label(m) { return en ? 'No.' + m[2] : m[1]; }
  function src(m) { return base + m[0] + '.png'; }

  // ---- 保存（この端末のブラウザだけ。使えないときは、開いている間だけ覚える）----
  var KEY = 'polomusubi-site.v1';
  var state = { c: [], off: 0, done: 0 };
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && Array.isArray(o.c)) state = { c: o.c.filter(function (x) { return typeof x === 'string'; }), off: o.off ? 1 : 0, done: o.done ? 1 : 0 };
    }
  } catch (e) {}
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function has(id) { return state.c.indexOf(id) >= 0; }
  function count() { return ROSTER.filter(function (m) { return has(m[0]); }).length; }

  // ---- DOM ----
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var layer = el('div', 'pm-layer'); layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  var live = el('div', 'pm-sr'); live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);

  // 右下のボタン（なかま n / 24 ・ とめる）
  var dock = el('div', 'pm-dock');
  var dexBtn = el('button', 'pm-dex'); dexBtn.type = 'button';
  var dexIcon = el('img', 'pm-dex-icon'); dexIcon.alt = ''; dexIcon.width = 32; dexIcon.height = 32; dexIcon.src = base + 'is_1.png';
  var dexText = el('span', 'pm-dex-text');
  dexBtn.appendChild(dexIcon); dexBtn.appendChild(dexText);
  var playBtn = el('button', 'pm-play'); playBtn.type = 'button';
  dock.appendChild(dexBtn); dock.appendChild(playBtn);
  document.body.appendChild(dock);
  function refreshDock() {
    var n = count();
    dexText.textContent = t('なかま ', 'Allies ') + n + ' / ' + N;
    dexBtn.setAttribute('aria-label', t('なかまずかんを開く（' + n + ' / ' + N + '）', 'Open the ally collection (' + n + ' of ' + N + ')'));
    playBtn.textContent = state.off ? t('あそぶ', 'Play') : t('とめる', 'Pause');
    playBtn.setAttribute('aria-pressed', String(!!state.off));
    playBtn.setAttribute('aria-label', state.off ? t('魔獣のあそびを再開する', 'Resume the monster play') : t('魔獣のあそびを止める', 'Pause the monster play'));
    dock.classList.toggle('pm-complete', n === N);
  }

  // ---- 仲間にする ----
  function bubble(host, text, cls) {
    var b = el('span', 'pm-bubble' + (cls ? ' ' + cls : ''), text);
    host.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1800);
  }
  function hearts(host) {
    if (reduce) return;
    for (var i = 0; i < 3; i++) {
      var h = el('span', 'pm-heart', '♥');
      h.style.left = (18 + i * 22) + '%'; h.style.animationDelay = (i * 90) + 'ms';
      host.appendChild(h);
      (function (x) { setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 1300); })(h);
    }
  }
  var onChange = [];
  function befriend(m, host) {
    var isNew = !has(m[0]);
    if (isNew) { state.c.push(m[0]); save(); }
    refreshDock();
    if (host) {
      hearts(host);
      bubble(host, isNew ? t('なかまになった！', 'Joined you!') : t('もう なかま！', 'Already yours!'), isNew ? 'pm-new' : '');
    }
    live.textContent = isNew
      ? t(label(m) + 'が仲間になりました。' + count() + ' / ' + N, 'An ally joined: ' + label(m) + '. ' + count() + ' of ' + N)
      : t(label(m) + 'は、もう仲間です。', label(m) + ' is already your ally.');
    onChange.forEach(function (f) { f(m, isNew); });
    if (isNew && count() === N && !state.done) { state.done = 1; save(); setTimeout(function () { openSheet(); }, 900); }
    return isNew;
  }

  // ---- ずかん（シート）----
  var back, sheetOpen = false, lastFocus = null, grid, status, polo, resetBtn, resetAsk = false;
  function buildSheet() {
    back = el('div', 'pm-back'); back.hidden = true;
    var sheet = el('div', 'pm-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'pmSheetTitle');
    var head = el('div', 'pm-sheet-head');
    var h = el('h3', null, t('なかまずかん', 'Ally collection')); h.id = 'pmSheetTitle';
    var x = el('button', 'pm-x', '×'); x.type = 'button'; x.setAttribute('aria-label', t('閉じる', 'Close'));
    head.appendChild(h); head.appendChild(x);
    status = el('p', 'pm-status');
    polo = el('div', 'pm-polo'); polo.hidden = true;
    var pimg = el('img'); pimg.src = base + 'polo-joy.png'; pimg.alt = ''; pimg.width = 64; pimg.height = 48;
    polo.appendChild(pimg); polo.appendChild(el('span', null, t('ぜんぶ なかまにした！ ポロが よろこんでいる。', 'You befriended them all! Polo is overjoyed.')));
    grid = el('div', 'pm-grid');
    var hint = el('p', 'pm-hint', t('画面の端に魔獣が現れたら、タップして仲間にしよう。ホームの上の「今日の魔獣」でも会えます。記録は、この端末のブラウザの中だけに保存されます。', 'When a monster shows up at the edge of the screen, tap it to make it an ally. You can also meet one in "Today\'s monster" at the top of the home page. Your progress is saved only in this browser.'));
    var foot = el('div', 'pm-sheet-foot');
    resetBtn = el('button', 'pm-reset'); resetBtn.type = 'button';
    foot.appendChild(resetBtn);
    sheet.appendChild(head); sheet.appendChild(status); sheet.appendChild(polo); sheet.appendChild(grid); sheet.appendChild(hint); sheet.appendChild(foot);
    back.appendChild(sheet); document.body.appendChild(back);
    x.addEventListener('click', closeSheet);
    back.addEventListener('click', function (e) { if (e.target === back) closeSheet(); });
    resetBtn.addEventListener('click', function () {
      if (!resetAsk) { resetAsk = true; renderSheet(); return; }
      state.c = []; state.done = 0; save(); resetAsk = false; refreshDock(); renderSheet();
      onChange.forEach(function (f) { f(); });
    });
  }
  function renderSheet() {
    var n = count();
    status.textContent = t('なかま ' + n + ' / ' + N, 'Allies ' + n + ' / ' + N);
    polo.hidden = n !== N;
    grid.textContent = '';
    ROSTER.forEach(function (m) {
      var got = has(m[0]);
      var cell = el('div', 'pm-cell' + (got ? ' got' : ''));
      var im = el('img'); im.src = src(m); im.alt = got ? label(m) : ''; im.width = 64; im.height = 64; im.loading = 'lazy';
      var nm = el('span', 'pm-cell-name', got ? label(m) : '？？？');
      cell.appendChild(im); cell.appendChild(nm);
      if (got) cell.title = label(m) + ' / ' + ELEM[m[3]][en ? 1 : 0];
      grid.appendChild(cell);
    });
    resetBtn.textContent = resetAsk ? t('ほんとうに さいしょから？（もう一度押す）', 'Really start over? (press again)') : t('さいしょから', 'Start over');
    resetBtn.classList.toggle('pm-warn', resetAsk);
    resetBtn.hidden = n === 0;
  }
  function openSheet() {
    if (!back) buildSheet();
    resetAsk = false; renderSheet();
    if (!sheetOpen) lastFocus = document.activeElement;
    back.hidden = false; sheetOpen = true; document.documentElement.classList.add('pm-lock');
    clearActors();
    var x = back.querySelector('.pm-x'); if (x) x.focus();
  }
  function closeSheet() {
    if (!back) return;
    back.hidden = true; sheetOpen = false; document.documentElement.classList.remove('pm-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    applyMode();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'Tab' && sheetOpen) { // フォーカスをシートの中に留める
      var f = back.querySelectorAll('button:not([hidden])'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  dexBtn.addEventListener('click', function () { openSheet(); });

  // ---- 魔獣を 1 体出す（歩く・顔を出す・座る、で共通）----
  var actors = [];   // 出ている魔獣（歩く・顔を出す・座る）
  var timers = [];
  var lanes = [];
  var peeker = null;
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function playing() { return !state.off && !sheetOpen && !document.hidden && !reduce; }
  function onScreenIds() {
    var ids = [];
    actors.forEach(function (a) { ids.push(a.getAttribute('data-id')); });
    return ids;
  }
  function pickMonster(avoid) {
    // 仲間にしていない子を、少し出やすくする
    var pool = [];
    ROSTER.forEach(function (m) { if (avoid.indexOf(m[0]) < 0) { pool.push(m); if (!has(m[0])) pool.push(m); } });
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function makeMon(m, cls) {
    var b = el('button', 'pm-mon ' + cls); b.type = 'button'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); b.setAttribute('data-id', m[0]);
    var im = el('img'); im.src = src(m); im.alt = ''; im.width = 64; im.height = 64; im.draggable = false;
    b.appendChild(im);
    b.addEventListener('click', function (e) { e.preventDefault(); befriend(m, b); });
    return b;
  }
  function removeActor(b) {
    if (b.parentNode) b.parentNode.removeChild(b);
    var k = actors.indexOf(b); if (k >= 0) actors.splice(k, 1);
    if (peeker === b) peeker = null;
  }
  function clearActors() {
    timers.forEach(clearTimeout); timers = [];
    actors.slice().forEach(removeActor);
    peeker = null;
    lanes.forEach(function (l) { l.busy = false; });
  }

  // 区切り線の上を歩く。線の「上」に置くレーン（高さ 0）を、区切り線の前に入れる。
  function setupLanes() {
    var lines = document.querySelectorAll('.glow-line');
    lines.forEach(function (line, i) {
      var lane = el('div', 'pm-lane'); lane.setAttribute('aria-hidden', 'true');
      line.parentNode.insertBefore(lane, line);
      lanes.push({ node: lane, line: line, visible: false, busy: false, i: i });
    });
    if ('IntersectionObserver' in window) {
      // 高さ 0 のレーンは交差を取れないので、区切り線そのものを観察する
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          lanes.forEach(function (l) {
            if (l.line !== e.target) return;
            l.visible = e.isIntersecting;
            if (reduce) return; // 動きを減らす設定では、座っている魔獣を、そのままにしておく
            if (!e.isIntersecting) { var m = l.node.querySelector('.pm-mon'); if (m) removeActor(m); l.busy = false; }
            else if (playing() && !l.busy) later(function () { spawnWalker(l); }, 600 + Math.random() * 2200);
          });
        });
      }, { threshold: 0 });
      lanes.forEach(function (l) { io.observe(l.line); });
    } else { lanes.forEach(function (l) { l.visible = true; }); }
  }
  function spawnWalker(l) {
    if (l.busy || !l.visible || !playing()) return;
    l.busy = true;
    var m = pickMonster(onScreenIds());
    var b = makeMon(m, 'pm-walk');
    var w = l.node.clientWidth || 600, size = 64;
    var fromLeft = Math.random() < 0.5;
    var from = fromLeft ? -size : w, to = fromLeft ? w : -size;
    b.style.left = from + 'px';
    if (!fromLeft) b.classList.add('pm-flip');
    l.node.appendChild(b); actors.push(b);
    var dur = Math.round(Math.abs(to - from) / 36 * 1000); // 1 秒に 36px
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      b.style.transition = 'left ' + dur + 'ms linear'; b.style.left = to + 'px';
    }); });
    var finished = false;
    function done() {
      if (finished) return; finished = true;
      removeActor(b);
      l.busy = false;
      if (playing() && l.visible) later(function () { spawnWalker(l); }, 5000 + Math.random() * 9000);
    }
    b.addEventListener('transitionend', function (e) { if (e.propertyName === 'left') done(); });
    b.addEventListener('click', function () { // タップしたら、その場で止まって、少ししたら去る
      var left = b.getBoundingClientRect().left - l.node.getBoundingClientRect().left;
      b.style.transition = 'none'; b.style.left = left + 'px'; b.classList.add('pm-stay');
      later(function () { b.classList.add('pm-leave'); later(done, 500); }, 1500);
    });
  }

  // 画面の下から顔を出す
  function peek() {
    if (!playing() || peeker) return;
    var m = pickMonster(onScreenIds());
    var b = makeMon(m, 'pm-peek');
    var vw = window.innerWidth, big = vw >= 900, size = big ? 128 : 64;
    var min = 8, max = Math.max(min, vw - size - (big ? 250 : 215)); // 右下のボタンを避ける
    b.style.left = Math.round(min + Math.random() * (max - min)) + 'px';
    if (big) b.classList.add('pm-big');
    layer.appendChild(b); actors.push(b); peeker = b;
    requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.add('pm-up'); }); });
    function out() {
      b.classList.remove('pm-up');
      later(function () { removeActor(b); if (playing()) later(peek, 9000 + Math.random() * 9000); }, 600);
    }
    b.addEventListener('click', function () { later(out, 1300); });
    later(out, 4800);
  }

  // 動きを減らす設定: 区切り線の上に、1 体ずつ座らせる（動かさない）
  function sitters() {
    lanes.forEach(function (l) {
      var m = ROSTER[(l.i * 7 + 3) % N];
      var b = makeMon(m, 'pm-sit');
      b.style.left = (12 + ((l.i * 37) % 70)) + '%';
      l.node.appendChild(b); actors.push(b);
    });
  }
  function applyMode() {
    clearActors();
    if (state.off || sheetOpen) return;
    if (reduce) { sitters(); return; }
    if (document.hidden) return;
    lanes.forEach(function (l) { if (l.visible) later(function () { spawnWalker(l); }, 800 + Math.random() * 2500); });
    later(peek, 5000 + Math.random() * 5000);
  }
  playBtn.addEventListener('click', function () { state.off = state.off ? 0 : 1; save(); refreshDock(); applyMode(); });
  document.addEventListener('visibilitychange', applyMode);

  // ---- F 今日の魔獣 ----
  function jstDate() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function todayIndex() {
    var s = jstDate(), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h % N;
  }
  function setupToday() {
    var box = document.getElementById('pmToday'); if (!box) return;
    var m = ROSTER[todayIndex()];
    box.textContent = '';
    var wrap = el('div', 'pm-today-body');
    var pic = el('div', 'pm-today-pic');
    var im = el('img'); im.src = src(m); im.alt = ''; im.width = 64; im.height = 64;
    pic.appendChild(im);
    var info = el('div', 'pm-today-info');
    info.appendChild(el('span', 'pm-today-label', t('今日の魔獣', 'Today\'s monster')));
    info.appendChild(el('strong', 'pm-today-name', label(m)));
    info.appendChild(el('span', 'pm-today-meta', (en ? 'Element: ' : 'ぞくせい: ') + ELEM[m[3]][en ? 1 : 0] + (en ? '' : ' ／ ' + m[4])));
    var btn = el('button', 'pm-today-btn'); btn.type = 'button';
    function refresh() { btn.textContent = has(m[0]) ? t('なかま ✓', 'Ally ✓') : t('なかまにする', 'Befriend'); btn.classList.toggle('pm-done', has(m[0])); }
    refresh();
    btn.addEventListener('click', function () { befriend(m, pic); });
    onChange.push(refresh);
    wrap.appendChild(pic); wrap.appendChild(info); wrap.appendChild(btn);
    box.appendChild(wrap); box.hidden = false;
  }

  refreshDock();
  setupToday();
  setupLanes();
  applyMode();
})();
