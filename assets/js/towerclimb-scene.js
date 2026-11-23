// タワクライム紹介ページの戦闘シーン（v2.0.0 のドット絵）。
// 論理サイズ 270×150 の <canvas> に描き、整数倍で拡大する（ぼかさない）。50 階ごとに区画（背景・敵）が変わる。
// 描き方は、アプリ本体（TowerClimb の lib/ui/battle_scene.dart）と同じ。足元の位置・希少度の色替えも合わせている。
// prefers-reduced-motion のときは静止、画面外・非表示のタブでは止まる。「とめる」ボタンで手動停止できる。
(function () {
  var canvas = document.getElementById('tcScene');
  if (!canvas || !canvas.getContext) return;
  var base = '../assets/towerclimb/sprites/';
  var W = 270, H = 150, FOOT_Y = 139, HERO_FOOT = 71, ENEMY_FOOT = 184;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var floorEl = document.getElementById('tcFloor');
  var goldEl = document.getElementById('tcGold');
  var btn = document.getElementById('tcToggle');

  // 希少度の色（コモン〜レジェンド。g=暗・G=中・j=明）
  var RAR = [
    ['#5c606a', '#8a8f99', '#b8bcc6'], ['#3a8a47', '#5cbf6a', '#9be8a5'], ['#2f5fb0', '#4f8fe8', '#9cc4ff'],
    ['#6f35ab', '#a35ee8', '#d3a6ff'], ['#b06a10', '#f0a030', '#ffd88a']
  ];
  function hex(s) { return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; }

  // ---- 素材の読み込み ----
  var names = [];
  for (var z = 1; z <= 5; z++) {
    names.push('bg/s' + z, 'boss/s' + z + '_idle', 'boss/s' + z + '_attack');
    for (var n = 1; n <= 3; n++) names.push('mob/s' + z + '_' + n + '_idle', 'mob/s' + z + '_' + n + '_attack');
  }
  for (var t = 1; t <= 3; t++) {
    ['idle', 'ready', 'swing', 'hurt'].forEach(function (p) { names.push('hero/t' + t + '_' + p); });
    ['idle_alt', 'ready', 'swing'].forEach(function (p) { names.push('weapon/t' + t + '_' + p); });
  }
  for (var s = 1; s <= 3; s++) names.push('fx/slash_' + s);
  var img = {};
  function load(cb) {
    var left = names.length;
    names.forEach(function (k) {
      var i = new Image();
      i.onload = i.onerror = function () { if (--left === 0) cb(); };
      i.src = base + k + '.png';
      img[k] = i;
    });
  }

  // 希少度の色を付けた武器の絵（宝石・ルーンの青い部分を 3 段の色に置き換え、エピック以上は外側に 1 ドットの光）
  var recolored = {};
  function recolor(key, rar) {
    var id = key + '#' + rar;
    if (recolored[id]) return recolored[id];
    var src = img[key], pad = rar >= 3 ? 1 : 0;
    var c = document.createElement('canvas'); c.width = src.width + pad * 2; c.height = src.height + pad * 2;
    var x = c.getContext('2d'); x.drawImage(src, pad, pad);
    var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    var ramp = RAR[rar].map(hex);
    for (var i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      var r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (b > r + 40 && b > 110 && mx - mn > 55) {
        var l = 0.3 * r + 0.59 * g + 0.11 * b, col = ramp[l < 120 ? 0 : l < 190 ? 1 : 2];
        p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2];
      }
    }
    if (pad) {
      var w = c.width, h = c.height, o = new Uint8ClampedArray(p), edge = ramp[2];
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var j = (yy * w + xx) * 4; if (o[j + 3]) continue;
        var near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (dd) {
          var nx = xx + dd[0], ny = yy + dd[1];
          return nx >= 0 && ny >= 0 && nx < w && ny < h && o[(ny * w + nx) * 4 + 3];
        });
        if (near) { p[j] = edge[0]; p[j + 1] = edge[1]; p[j + 2] = edge[2]; p[j + 3] = 255; }
      }
    }
    x.putImageData(d, 0, 0); recolored[id] = c; return c;
  }

  // ---- 画面（論理 270×150 を整数倍で拡大）----
  var lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  var lx = lc.getContext('2d'); lx.imageSmoothingEnabled = false;
  var prev = document.createElement('canvas'); prev.width = W; prev.height = H;
  var px = prev.getContext('2d');
  var mixc = document.createElement('canvas'); mixc.width = W; mixc.height = H;
  var mx2 = mixc.getContext('2d');
  var cx = canvas.getContext('2d');
  function fit() {
    var box = canvas.parentNode.clientWidth || W;
    var dpr = window.devicePixelRatio || 1;
    var k = Math.max(1, Math.floor(box * dpr / W)); // 物理ピクセルの整数倍
    canvas.width = W * k; canvas.height = H * k;
    canvas.style.width = (W * k / dpr) + 'px'; canvas.style.height = (H * k / dpr) + 'px';
    cx.imageSmoothingEnabled = false;
  }
  function present(src) { cx.imageSmoothingEnabled = false; cx.drawImage(src, 0, 0, canvas.width, canvas.height); }

  // ---- 場面の状態 ----
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var floor = 5, gold = 0, kills = 0;
  function secOf(f) { return Math.floor((f - 1) / 50) % 5 + 1; }
  function isBoss(f) { return f % 50 === 0; }
  function isMid(f) { return f % 10 === 0 && !isBoss(f); }
  var enemyIdx = 1;
  function pickEnemy() { enemyIdx = (kills * 7 + 2) % 3 + 1; }
  function gear(sec) { return { tier: sec <= 1 ? 1 : sec <= 3 ? 2 : 3, rar: sec - 1 }; }

  var WALK = 1300, HITS = 3, HIT_GAP = 520, FADE = 650;
  var CYCLE = WALK + HITS * HIT_GAP + FADE;

  function drawBg(sec) { lx.drawImage(img['bg/s' + sec], 0, 0); }
  function drawHero(g, pose, dy) {
    var x0 = HERO_FOOT - 38, y0 = FOOT_Y - 64 + dy;
    lx.drawImage(img['hero/t' + g.tier + '_' + pose], x0, y0);
    if (pose === 'idle' || pose === 'ready' || pose === 'swing') {
      var key = 'weapon/t' + g.tier + '_' + (pose === 'idle' ? 'idle_alt' : pose), pad = g.rar >= 3 ? 1 : 0;
      lx.drawImage(recolor(key, g.rar), x0 - pad, y0 - pad);
    }
  }
  function drawEnemy(sec, boss, mid, pose, offX, alpha, flash, sc) {
    var key = boss ? 'boss/s' + sec + '_' + pose : 'mob/s' + sec + '_' + enemyIdx + '_' + pose;
    var src = img[key]; sc = sc || 1;
    var w = src.width * sc, hh = src.height * sc;
    var footIn = boss ? 88 : 43, groundIn = boss ? 127 : 65;
    var left = ENEMY_FOOT + offX - (src.width - 1 - footIn) * sc, top = FOOT_Y + 1 - groundIn * sc;
    lx.save(); lx.globalAlpha = alpha;
    lx.translate(left + w, top); lx.scale(-sc, sc); lx.drawImage(src, 0, 0);
    if (flash) { lx.globalCompositeOperation = 'source-atop'; lx.globalAlpha = alpha * 0.75; lx.fillStyle = '#fff'; lx.fillRect(0, 0, src.width, src.height); }
    lx.restore();
    if (mid) crown(Math.round(left + w / 2), top + 6);
  }
  function crown(cxp, y) {
    var rows = ['..y...y...y..', '.yyy.yyy.yyy.', '.yyyyyyyyyyy.', '.yoyyyryyyoy.', '.yyyyyyyyyyy.'];
    var col = { y: '#ffd24a', o: '#c27a3e', r: '#e8505b' };
    rows.forEach(function (row, j) { row.split('').forEach(function (ch, i) { if (ch !== '.') { lx.fillStyle = col[ch]; lx.fillRect(cxp - 6 + i, y - 8 + j, 1, 1); } }); });
  }
  function slash(n, offX) { var s = img['fx/slash_' + n]; lx.drawImage(s, ENEMY_FOOT + offX - 70, FOOT_Y - 64); }

  var floats = [];
  function drawFloats(t) {
    lx.font = '10px "JetBrains Mono", monospace'; lx.textAlign = 'center';
    floats = floats.filter(function (f) { return t - f.t0 < 800; });
    floats.forEach(function (f) {
      var age = (t - f.t0) / 800; lx.globalAlpha = 1 - age;
      var y = Math.round(f.y - age * 22);
      lx.fillStyle = '#000'; lx.fillText(f.text, f.x, y + 1);
      lx.fillStyle = f.color; lx.fillText(f.text, f.x, y);
      lx.globalAlpha = 1;
    });
  }

  var cycleStart = 0, lastFrame = 0, transFrom = -1, transStart = 0, fired = {};
  var running = false, userPaused = false, visible = false, raf = 0;

  var lastNow = 0;
  function render(now) {
    lastNow = now;
    var t = now - cycleStart;
    var sec = secOf(floor), boss = isBoss(floor), mid = isMid(floor), g = gear(sec);
    lx.clearRect(0, 0, W, H);
    drawBg(sec);
    var heroPose = 'idle', dy = 0, offX = 0, alpha = 1, flash = false, ePose = 'idle', sc = 1;
    if (t < WALK) {
      var p = t / WALK; offX = Math.round((1 - p) * (boss ? 130 : 110));
      dy = Math.floor(t / 150) % 2 ? -1 : 0;
    } else if (t < WALK + HITS * HIT_GAP) {
      var u = t - WALK, n = Math.floor(u / HIT_GAP), ph = u % HIT_GAP;
      heroPose = ph < 160 ? 'ready' : ph < 360 ? 'swing' : 'idle';
      if (ph >= 160 && ph < 360) { flash = ph < 260; }
      if (ph >= 160 && !fired['h' + n]) {
        fired['h' + n] = 1;
        floats.push({ text: String(18 + floor * 3 + n * 7), x: ENEMY_FOOT - 18 + n * 10, y: 70, t0: now, color: '#ffffff' });
      }
      ePose = ph >= 360 && ph < 430 ? 'attack' : 'idle';
    } else {
      var f = (t - WALK - HITS * HIT_GAP) / FADE;
      alpha = Math.max(0, 1 - f); dy = 0; offX = Math.round(f * 12);
      heroPose = 'idle';
      if (!fired.gold) { fired.gold = 1; var gg = 10 + floor * 3; gold += gg; floats.push({ text: '+' + gg + 'G', x: ENEMY_FOOT - 10, y: 95, t0: now, color: '#e8b84a' }); }
    }
    drawHero(g, heroPose, dy);
    if (t < WALK + HITS * HIT_GAP + FADE) drawEnemy(sec, boss, mid, ePose, offX, alpha, flash, 1);
    if (t >= WALK && t < WALK + HITS * HIT_GAP) {
      var uu = t - WALK, ph2 = uu % HIT_GAP;
      if (ph2 >= 200 && ph2 < 340) slash(Math.min(3, Math.floor((ph2 - 200) / 47) + 1), 0);
    }
    drawFloats(now);
    floorEl.textContent = floor + 'F' + (boss ? ' BOSS' : mid ? ' MID' : '');
    goldEl.textContent = gold;
    // 区画が変わった直後は、固い 4×4 のディザで前の画面から切り替える（半透明を使わない）
    if (transFrom >= 0) {
      var q = (now - transStart) / 700;
      if (q >= 1) transFrom = -1;
      else {
        var da = px.getImageData(0, 0, W, H), db = lx.getImageData(0, 0, W, H), out = mx2.createImageData(W, H), th = q * 16;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var i = (y * W + x) * 4, src = BAYER[(y & 3) * 4 + (x & 3)] < th ? db : da;
          out.data[i] = src.data[i]; out.data[i + 1] = src.data[i + 1]; out.data[i + 2] = src.data[i + 2]; out.data[i + 3] = 255;
        }
        mx2.putImageData(out, 0, 0); present(mixc); return;
      }
    }
    present(lc);
    if (t >= CYCLE) nextEnemy(now);
  }
  function nextEnemy(now) {
    px.clearRect(0, 0, W, H); px.drawImage(lc, 0, 0);
    var oldSec = secOf(floor);
    kills++; floor += 5; fired = {};
    if (floor > 250) { floor = 5; gold = 0; }
    pickEnemy();
    cycleStart = now;
    if (secOf(floor) !== oldSec) { transFrom = oldSec; transStart = now; }
  }

  function loop(now) {
    raf = 0; if (!running) return;
    if (now - lastFrame >= 66) { lastFrame = now; render(now); } // 約 15 fps
    raf = requestAnimationFrame(loop);
  }
  var pauseAt = 0;
  function start() { if (running) return; running = true; if (pauseAt) cycleStart += performance.now() - pauseAt; pauseAt = 0; raf = requestAnimationFrame(loop); }
  function stop() { if (running) pauseAt = performance.now(); running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !userPaused && !document.hidden && !reduce) ? start() : stop(); }

  function still() { // 静止画（動きを減らす設定のとき）。ポロが敵と向き合う 1 枚
    floor = 15; kills = 3; pickEnemy();
    var sec = secOf(floor), g = gear(sec);
    lx.clearRect(0, 0, W, H); drawBg(sec); drawHero(g, 'idle', 0); drawEnemy(sec, false, false, 'idle', 0, 1, false, 1);
    floorEl.textContent = floor + 'F'; goldEl.textContent = 0; present(lc);
  }

  load(function () {
    fit(); pickEnemy();
    if (reduce) { btn.hidden = true; still(); return; }
    cycleStart = performance.now();
    render(cycleStart); // 最初の 1 枚
    window.addEventListener('resize', function () { fit(); render(lastNow); }); // 大きさを変えると canvas が消えるので、すぐ描き直す
    btn.addEventListener('click', function () {
      userPaused = !userPaused;
      btn.textContent = userPaused ? 'うごかす' : 'とめる';
      btn.setAttribute('aria-pressed', String(userPaused));
      sync();
    });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(canvas);
    document.addEventListener('visibilitychange', sync);
  });
})();
