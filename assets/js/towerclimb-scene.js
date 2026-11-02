// タワクライム紹介ページの戦闘シーン。アプリのドット絵（32×32）を重ねて、塔を登る様子を見せる。
// prefers-reduced-motion のときは静止、画面外・非表示のタブでは止まる。「止める」ボタンで手動停止できる。
(function () {
  var scene = document.getElementById('tcScene');
  if (!scene) return;
  var base = '../assets/towerclimb/sprites/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 階が進むほど装備が育つ（段階・希少度）
  var gear = [
    { a: 'armor_0_common', c: 'charm_0_common', w: 'weapon_0_%_common' },
    { a: 'armor_0_uncommon', c: 'charm_0_uncommon', w: 'weapon_0_%_uncommon' },
    { a: 'armor_1_rare', c: 'charm_1_rare', w: 'weapon_1_%_rare' },
    { a: 'armor_2_epic', c: 'charm_2_epic', w: 'weapon_2_%_epic' },
    { a: 'armor_2_legend', c: 'charm_2_legend', w: 'weapon_2_%_legend' }
  ];
  var kinds = ['slime', 'bat', 'skull', 'mushroom'];

  var hero = scene.querySelector('.tc-hero');
  var enemy = scene.querySelector('.tc-enemy');
  var enemyImg = enemy.querySelector('img');
  var armor = hero.querySelector('.tc-armor');
  var charm = hero.querySelector('.tc-charm');
  var weapon = hero.querySelector('.tc-weapon');
  var floorEl = document.getElementById('tcFloor');
  var goldEl = document.getElementById('tcGold');
  var btn = document.getElementById('tcToggle');

  var floor = 1, gold = 0, tier = 0, timers = [], running = false, userPaused = false, visible = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearAll() { timers.forEach(clearTimeout); timers = []; }
  function isBoss() { return floor % 10 === 0; }
  function src(name) { return base + name + '.png'; }

  function dressUp() {
    var g = gear[tier];
    armor.src = src(g.a); charm.src = src(g.c);
    weapon.dataset.w = g.w;
    weapon.src = src(g.w.replace('%', 'idle'));
  }
  function setAttack(on) {
    hero.classList.toggle('atk', on);
    weapon.src = src(weapon.dataset.w.replace('%', on ? 'attack' : 'idle'));
  }
  function float(text, cls, left, bottom) {
    var f = document.createElement('span');
    f.className = 'tc-float' + (cls ? ' ' + cls : '');
    f.textContent = text;
    f.style.left = left; f.style.bottom = bottom;
    scene.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }
  function render() {
    floorEl.textContent = floor + 'F' + (isBoss() ? ' BOSS' : '');
    goldEl.textContent = gold;
  }

  function spawn() {
    var k = kinds[(floor - 1) % kinds.length];
    enemyImg.src = src((isBoss() ? 'boss_' + k + '_purple' : 'mob_' + k + '_green'));
    enemy.className = 'tc-enemy away' + (isBoss() ? ' boss' : '');
    render();
    scene.classList.add('walking'); hero.classList.add('bob');
    later(function () { enemy.classList.remove('away'); }, 50);
    later(fight, 1300);
  }
  function fight() {
    scene.classList.remove('walking'); hero.classList.remove('bob');
    var hits = isBoss() ? 4 : 2;
    for (var i = 0; i < hits; i++) {
      (function (n) {
        later(function () {
          setAttack(true);
          enemy.classList.remove('hit'); void enemy.offsetWidth; enemy.classList.add('hit');
          float(String(8 + Math.floor(Math.random() * 20) + floor), '', 'calc(62% + ' + (n * 8) + 'px)', '58%');
        }, 350 + n * 600);
        later(function () { setAttack(false); }, 350 + n * 600 + 220);
      })(i);
    }
    later(defeat, 350 + hits * 600);
  }
  function defeat() {
    enemy.classList.add('dead');
    var g = 10 + floor * 3;
    gold += g;
    float('+' + g + 'G', 'gold', '64%', '45%');
    if (isBoss() && tier < gear.length - 1) { tier++; dressUp(); float('装備が変わった！', 'gold', '8%', '78%'); }
    floor++;
    if (floor > 50) { floor = 1; gold = 0; tier = 0; dressUp(); }
    render();
    later(spawn, 900);
  }

  function start() { if (running || reduce || userPaused || !visible || document.hidden) return; running = true; spawn(); }
  function stop() {
    running = false; clearAll();
    scene.classList.remove('walking'); hero.classList.remove('bob'); setAttack(false);
    enemy.className = 'tc-enemy' + (isBoss() ? ' boss' : '');
  }
  function sync() { (visible && !userPaused && !document.hidden && !reduce) ? start() : stop(); }

  dressUp(); render();
  enemyImg.src = src('mob_slime_green');

  if (reduce) { btn.hidden = true; return; }
  btn.addEventListener('click', function () {
    userPaused = !userPaused;
    btn.textContent = userPaused ? 'うごかす' : 'とめる';
    btn.setAttribute('aria-pressed', String(userPaused));
    sync();
  });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(scene);
  document.addEventListener('visibilitychange', sync);
})();
