// StarPuzzle 紹介ページの「1問あそぶ」。アプリと同じルール（各行・各列・各領域に★1つ、斜めを含めて隣り合わない）の 5×5 ミニ盤面。
// 問題は答えが 1 通りになることを確認した 7 問で、日本時間の日付で「今日の1問」が変わる。
(function () {
  var root = document.getElementById('spTry');
  if (!root) return;
  var N = 5;
  var COLORS = ['#ff9aa8', '#ffd08a', '#a8e6a1', '#9ad0ff', '#c9a8ff']; // アプリの領域色の先頭 5 色
  var NAMES = ['ピンク', 'オレンジ', 'みどり', 'あお', 'むらさき'];
  var PUZZLES = [{"r": ["00111", "33112", "33442", "33444", "33444"], "s": [0, 2, 4, 1, 3]}, {"r": ["00002", "01022", "31322", "33332", "33444"], "s": [3, 1, 4, 0, 2]}, {"r": ["11000", "11022", "10024", "13344", "11444"], "s": [2, 0, 3, 1, 4]}, {"r": ["00011", "00111", "22111", "23344", "22444"], "s": [1, 3, 0, 2, 4]}, {"r": ["11100", "11122", "14222", "14223", "44443"], "s": [3, 0, 2, 4, 1]}, {"r": ["10000", "12222", "22233", "24433", "44433"], "s": [3, 0, 2, 4, 1]}, {"r": ["10000", "11000", "13324", "13224", "13344"], "s": [2, 0, 3, 1, 4]}];

  var boardEl = root.querySelector('.sp-board');
  var statusEl = root.querySelector('.sp-status');
  var titleEl = root.querySelector('.sp-puzzle-no');
  var idx = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000) % PUZZLES.length;
  var puzzle, cells, solved, focusAt = 0, btns = [];

  function region(i) { return +puzzle.r[Math.floor(i / N)][i % N]; }
  function say(t) { statusEl.textContent = t; }

  function conflicts() {
    var stars = [], bad = {};
    cells.forEach(function (c, i) { if (c === 2) stars.push(i); });
    for (var a = 0; a < stars.length; a++) for (var b = a + 1; b < stars.length; b++) {
      var p = stars[a], q = stars[b];
      var pr = Math.floor(p / N), pc = p % N, qr = Math.floor(q / N), qc = q % N;
      if (pr === qr || pc === qc || region(p) === region(q) || (Math.abs(pr - qr) <= 1 && Math.abs(pc - qc) <= 1)) { bad[p] = bad[q] = true; }
    }
    return { stars: stars.length, bad: bad };
  }

  function label(i, bad) {
    var st = ['空', '×', '★'][cells[i]];
    return (Math.floor(i / N) + 1) + '行' + (i % N + 1) + '列、' + NAMES[region(i)] + '、' + st + (bad ? '（ルール違反）' : '');
  }

  function paint() {
    var res = conflicts();
    btns.forEach(function (b, i) {
      var r = region(i), row = Math.floor(i / N), col = i % N;
      var thick = '3px solid #0f1530', thin = '1px solid rgba(15,21,48,.35)';
      b.style.background = COLORS[r];
      b.style.borderTop = row > 0 && region(i - N) === r ? thin : thick;
      b.style.borderBottom = row < N - 1 && region(i + N) === r ? thin : thick;
      b.style.borderLeft = col > 0 && region(i - 1) === r ? thin : thick;
      b.style.borderRight = col < N - 1 && region(i + 1) === r ? thin : thick;
      var bad = !!res.bad[i];
      b.textContent = ['', '×', '★'][cells[i]];
      b.className = 'sp-cell' + (cells[i] === 2 ? ' star' : '') + (cells[i] === 1 ? ' cross' : '') + (bad ? ' bad' : '');
      b.setAttribute('aria-label', label(i, bad));
      b.tabIndex = i === focusAt ? 0 : -1;
    });
    var ok = res.stars === N && Object.keys(res.bad).length === 0;
    if (ok && !solved) { solved = true; boardEl.classList.add('solved'); say('クリア！ 全部のルールを満たしました。アプリには、6×6・8×8・10×10 の 300 問が入っています。'); }
    else if (!ok) { solved = false; boardEl.classList.remove('solved'); }
  }

  function load() {
    puzzle = PUZZLES[idx]; cells = new Array(N * N).fill(0); solved = false; focusAt = 0;
    titleEl.textContent = '問題 ' + (idx + 1) + ' / ' + PUZZLES.length;
    boardEl.classList.remove('solved');
    paint();
    say('マスをタップすると「空 → × → ★ → 空」と切り替わります。');
  }

  function build() {
    for (var i = 0; i < N * N; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      boardEl.appendChild(b); btns.push(b);
    }
    boardEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var i = +b.dataset.i; focusAt = i;
      cells[i] = (cells[i] + 1) % 3;
      paint();
      var res = conflicts();
      if (!solved) say(res.bad[i] ? 'そのマスはルール違反です（行・列・色の領域・隣り合う★のどれか）。' : '');
    });
    boardEl.addEventListener('keydown', function (e) {
      var d = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d === undefined) return;
      var i = +document.activeElement.dataset.i, n = i + d;
      if ((e.key === 'ArrowLeft' && i % N === 0) || (e.key === 'ArrowRight' && i % N === N - 1) || n < 0 || n >= N * N) return;
      e.preventDefault(); focusAt = n; paint(); btns[n].focus();
    });
    root.querySelector('[data-act="reset"]').addEventListener('click', load);
    root.querySelector('[data-act="next"]').addEventListener('click', function () { idx = (idx + 1) % PUZZLES.length; load(); });
    root.querySelector('[data-act="hint"]').addEventListener('click', function () {
      for (var r = 0; r < N; r++) {
        var c = puzzle.s[r], i = r * N + c;
        if (cells[i] !== 2) {
          // 間違った★が同じ行にあれば消してから置く
          for (var k = 0; k < N; k++) if (cells[r * N + k] === 2) cells[r * N + k] = 0;
          cells[i] = 2; focusAt = i; paint();
          if (!solved) say('ヒント：' + (r + 1) + '行目の ' + (c + 1) + ' 列に★を置きました。');
          return;
        }
      }
      say('正解の★はもうそろっています。');
    });
  }
  build(); load();
})();
