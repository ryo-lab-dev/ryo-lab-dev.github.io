// ツルハシとツルギ紹介ページの「2人のミニ鍛冶屋」。
// アプリの流れを小さくなぞる: 採掘キャラの鉱石 → ツルギ、探索キャラの魔物素材 → ツルハシ。
// 各段階の最後には「門」（ボスと岩盤）があり、その段階のツルギとツルハシがそろっていないと挑めない。
// 岩や敵はタップで追加の一撃。prefers-reduced-motion のときは自動で動かさず、タップだけで遊べる。
// 画面外・非表示のタブでは止まり、「とめる」ボタンで手動停止できる。
(function () {
  var root = document.getElementById('pbGame');
  if (!root) return;
  var base = '../assets/pickandblade/sprites/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 段階ごとの景色・敵。名前はアプリの SPEC に合わせた（ダンジョン / 炭鉱）。
  var STAGES = [
    { dungeon: '木漏れ日の森', mine: '浅い坑道', enemy: 'enemy-slime' },
    { dungeon: '夕焼けの遺跡', mine: '遺跡の坑口', enemy: 'enemy-boar' },
    { dungeon: '青晶の坑道', mine: '青晶の坑道', enemy: 'enemy-bat' },
    { dungeon: '氷晶の洞窟', mine: '氷晶の坑道', enemy: 'enemy-crystal' },
    { dungeon: '溶岩の深淵', mine: '溶岩の坑道', enemy: 'enemy-magma' }
  ];
  var TICK = 700;       // 自動の 1 回の攻撃・採掘の間隔（ミリ秒）
  var HP = 3;           // ふつうの敵・岩の体力
  var GATE_HP = 6;      // 門（ボス・岩盤）の体力

  var el = {
    stage: document.getElementById('pbStage'),
    mineCard: document.getElementById('pbMine'),
    dunCard: document.getElementById('pbDungeon'),
    mineLabel: document.getElementById('pbMineLabel'),
    dunLabel: document.getElementById('pbDunLabel'),
    miner: document.getElementById('pbMiner'),
    explorer: document.getElementById('pbExplorer'),
    pickTool: document.getElementById('pbPickTool'),
    swordTool: document.getElementById('pbSwordTool'),
    rock: document.getElementById('pbRock'),
    foe: document.getElementById('pbFoe'),
    rockHp: document.getElementById('pbRockHp'),
    foeHp: document.getElementById('pbFoeHp'),
    ore: document.getElementById('pbOre'),
    part: document.getElementById('pbPart'),
    oreIcon: document.getElementById('pbOreIcon'),
    partIcon: document.getElementById('pbPartIcon'),
    craftSword: document.getElementById('pbCraftSword'),
    craftPick: document.getElementById('pbCraftPick'),
    msg: document.getElementById('pbMsg'),
    toggle: document.getElementById('pbToggle'),
    reset: document.getElementById('pbReset')
  };
  function src(n) { return base + n + '.png'; }

  var s, timers = [], running = false, userPaused = false, visible = false;
  var rock, foe; // { hp, max, gate, gone }

  function fresh() {
    s = { stage: 1, sword: 0, pick: 0, ore: 0, part: 0, gateDone: { mine: false, dungeon: false }, finished: false };
  }
  function costOf(stage) { return { main: 3 + stage, sub: 1 + (stage > 2 ? 1 : 0) }; }
  function hasBoth() { return s.sword >= s.stage && s.pick >= s.stage; }
  function dmg(tool) { return tool >= s.stage ? 2 : 1; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearAll() { timers.forEach(clearTimeout); timers = []; }
  function say(t) { el.msg.textContent = t; }

  function spawn(who) {
    var gate = hasBoth() && !s.gateDone[who];
    if (who === 'mine') {
      rock = { hp: gate ? GATE_HP : HP, max: gate ? GATE_HP : HP, gate: gate, gone: false };
      el.rock.querySelector('img').src = src(gate ? 'rock-0-1' : 'rock-' + s.stage + '-1');
      el.rock.classList.toggle('gate', gate);
      el.rock.classList.remove('gone');
      el.rock.setAttribute('aria-label', gate ? '岩盤をたたく' : '岩をたたく');
    } else {
      foe = { hp: gate ? GATE_HP : HP, max: gate ? GATE_HP : HP, gate: gate, gone: false };
      el.foe.querySelector('img').src = src(gate ? 'boss-' + s.stage : STAGES[s.stage - 1].enemy);
      el.foe.classList.toggle('gate', gate);
      el.foe.classList.remove('gone');
      el.foe.setAttribute('aria-label', gate ? 'ボスをたたく' : '敵をたたく');
    }
    bar(who);
  }
  function bar(who) {
    var t = who === 'mine' ? rock : foe;
    (who === 'mine' ? el.rockHp : el.foeHp).firstElementChild.style.width = (100 * Math.max(0, t.hp) / t.max) + '%';
  }
  function popup(card, html, cls, left, bottom) {
    var f = document.createElement('span');
    f.className = 'pb-float' + (cls ? ' ' + cls : '');
    f.innerHTML = html; f.style.left = left; f.style.bottom = bottom;
    card.appendChild(f);
    setTimeout(function () { f.remove(); }, 950);
  }
  function fx(card, name, left, bottom) {
    var i = document.createElement('img');
    i.className = 'pb-fx'; i.src = src(name); i.alt = ''; i.style.left = left; i.style.bottom = bottom;
    card.appendChild(i);
    setTimeout(function () { i.remove(); }, 400);
  }
  function flash(node) { node.classList.remove('hit'); void node.offsetWidth; node.classList.add('hit'); }

  // 1 回の攻撃・採掘。自動（ticks）とタップの両方から呼ぶ。
  function strike(who) {
    if (s.finished) return;
    var isMine = who === 'mine';
    var t = isMine ? rock : foe;
    if (!t || t.gone) return;
    var card = isMine ? el.mineCard : el.dunCard;
    var node = isMine ? el.rock : el.foe;
    var hero = isMine ? el.miner : el.explorer;
    var d = dmg(isMine ? s.pick : s.sword);
    t.hp -= d;
    bar(who); flash(node);
    hero.classList.add('act');
    hero.querySelector('img').src = src(isMine ? 'miner-swing' : 'explorer-attack');
    setTimeout(function () { hero.classList.remove('act'); hero.querySelector('img').src = src(isMine ? 'miner-idle' : 'explorer-idle'); }, 220);
    fx(card, isMine ? 'fx-rubble' : 'fx-slash', '56%', '34%');
    if (isMine && t.hp / t.max <= 0.5 && !t.gate) el.rock.querySelector('img').src = src('rock-' + s.stage + '-2');
    if (isMine && t.hp / t.max <= 0.5 && t.gate) el.rock.querySelector('img').src = src('rock-0-2');
    if (t.hp <= 0) defeated(who);
  }

  function defeated(who) {
    var isMine = who === 'mine';
    var t = isMine ? rock : foe;
    var node = isMine ? el.rock : el.foe;
    var card = isMine ? el.mineCard : el.dunCard;
    t.gone = true;
    if (isMine) el.rock.querySelector('img').src = src(t.gate ? 'rock-0-3' : 'rock-' + s.stage + '-3');
    node.classList.add('gone');
    if (t.gate) {
      s.gateDone[who] = true;
      popup(card, '門を突破！', 'gold', '46%', '56%');
      fx(card, 'fx-levelup', '58%', '40%');
      if (s.gateDone.mine && s.gateDone.dungeon) later(nextStage, 700);
      else say(isMine ? '岩盤をくだいた！ 相方の門を待っています。' : 'ボスを倒した！ 相方の門を待っています。');
      return;
    }
    if (isMine) {
      s.ore += 1;
      popup(card, '<img src="' + src('ore-' + s.stage) + '" alt="">+1', '', '60%', '48%');
    } else {
      s.part += 1;
      popup(card, '<img src="' + src('part-' + s.stage) + '" alt="">+1', '', '60%', '48%');
    }
    render();
    later(function () { if (!s.finished) spawn(who); }, 450);
  }

  function nextStage() {
    if (s.stage >= STAGES.length) { finish(); return; }
    s.stage += 1;
    s.gateDone = { mine: false, dungeon: false };
    setScene();
    say('門をぬけた！ 次は「' + STAGES[s.stage - 1].dungeon + '」。素材も、道具も、ひとつ上へ。');
    spawn('mine'); spawn('dungeon');
    render();
  }
  function finish() {
    s.finished = true;
    el.rock.classList.add('gone'); el.foe.classList.add('gone');
    say('最後の門をぬけた！ ここから先は、アプリで。');
    fx(el.mineCard, 'fx-sparkle', '50%', '40%'); fx(el.dunCard, 'fx-sparkle', '50%', '40%');
    el.reset.hidden = false;
    stop();
  }

  function setScene() {
    var st = STAGES[s.stage - 1];
    el.dunCard.style.backgroundImage = 'url(' + src('bg-' + s.stage) + ')';
    el.mineCard.style.backgroundImage = 'url(' + src('bg-' + s.stage) + ')';
    el.dunLabel.textContent = 'ダンジョン ' + st.dungeon;
    el.mineLabel.textContent = '炭鉱 ' + st.mine;
    el.oreIcon.src = src('ore-' + s.stage); el.partIcon.src = src('part-' + s.stage);
  }

  function craftLabel(btn, name, owned, cost, mainName, subName) {
    var done = owned >= s.stage;
    var next = Math.min(s.stage, owned + 1);
    btn.querySelector('img').src = src((name === 'sword' ? 'weapon-' : 'pickaxe-') + (done ? s.stage : next));
    btn.querySelector('.t').textContent = name === 'sword' ? 'ツルギ' + (done ? '（そろった）' : 'を鍛える') : 'ツルハシ' + (done ? '（そろった）' : 'を鍛える');
    btn.querySelector('.c').textContent = done ? (hasBoth() ? 'あとは門をたたくだけ' : '相方の道具を待っています') : mainName + ' ' + cost.main + '・' + subName + ' ' + cost.sub;
    btn.classList.toggle('done', done);
  }
  function render() {
    var c = costOf(s.stage);
    el.stage.textContent = s.stage + ' / ' + STAGES.length;
    el.ore.textContent = s.ore; el.part.textContent = s.part;
    craftLabel(el.craftSword, 'sword', s.sword, c, '鉱石', '魔物素材');
    craftLabel(el.craftPick, 'pick', s.pick, c, '魔物素材', '鉱石');
    el.craftSword.disabled = s.finished || s.sword >= s.stage || s.ore < c.main || s.part < c.sub;
    el.craftPick.disabled = s.finished || s.pick >= s.stage || s.part < c.main || s.ore < c.sub;
    el.swordTool.src = src('weapon-' + Math.max(1, s.sword)); el.swordTool.style.opacity = s.sword ? 1 : .3;
    el.pickTool.src = src('pickaxe-' + Math.max(1, s.pick)); el.pickTool.style.opacity = s.pick ? 1 : .3;
  }

  function craft(kind) {
    var c = costOf(s.stage);
    if (kind === 'sword') {
      if (s.sword >= s.stage || s.ore < c.main || s.part < c.sub) return;
      s.ore -= c.main; s.part -= c.sub; s.sword = s.stage;
      say('ツルギができた！ 鉱石が、探索キャラを強くした。');
      fx(el.dunCard, 'fx-levelup', '10%', '30%');
    } else {
      if (s.pick >= s.stage || s.part < c.main || s.ore < c.sub) return;
      s.part -= c.main; s.ore -= c.sub; s.pick = s.stage;
      say('ツルハシができた！ 魔物素材が、採掘キャラを強くした。');
      fx(el.mineCard, 'fx-levelup', '10%', '30%');
    }
    if (hasBoth()) say('ふたりの道具がそろった！ 門（ボスと岩盤）が現れた。');
    render();
    // 門がまだ出ていなければ、いまの標的を門に替える
    if (hasBoth()) { if (!rock.gate && !s.gateDone.mine) spawn('mine'); if (!foe.gate && !s.gateDone.dungeon) spawn('dungeon'); }
  }

  function loop() {
    strike('mine'); strike('dungeon');
    later(loop, TICK);
  }
  function start() { if (running || reduce || userPaused || !visible || document.hidden || s.finished) return; running = true; el.miner.classList.add('bob'); el.explorer.classList.add('bob'); later(loop, 300); }
  function stop() { running = false; clearAll(); el.miner.classList.remove('bob'); el.explorer.classList.remove('bob'); }
  function sync() { (visible && !userPaused && !document.hidden && !reduce && !s.finished) ? start() : stop(); }

  function restart() {
    stop(); fresh(); setScene(); spawn('mine'); spawn('dungeon'); render(); el.reset.hidden = true;
    say('もう一度、はじめから。');
    sync();
  }

  fresh(); setScene(); spawn('mine'); spawn('dungeon'); render();
  say(reduce ? '岩や敵をタップして、素材を集めよう。' : '岩や敵をタップすると、追加でたたけます。素材がたまったら「鍛える」を押してください。');

  el.rock.addEventListener('click', function () { strike('mine'); });
  el.foe.addEventListener('click', function () { strike('dungeon'); });
  el.craftSword.addEventListener('click', function () { craft('sword'); });
  el.craftPick.addEventListener('click', function () { craft('pick'); });
  el.reset.addEventListener('click', restart);

  if (reduce) { el.toggle.hidden = true; }
  else {
    el.toggle.addEventListener('click', function () {
      userPaused = !userPaused;
      el.toggle.textContent = userPaused ? 'うごかす' : 'とめる';
      el.toggle.setAttribute('aria-pressed', String(userPaused));
      sync();
    });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(root);
    document.addEventListener('visibilitychange', sync);
  }
})();
