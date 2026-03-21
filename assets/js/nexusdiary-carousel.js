// NexusDiary Live Preview Carousel
(function () {
  var THEMES = [
    '白紙 Hakushi', '格子 Koushi', '墨 Sumi', '活字 Katsujii', '星霜 Stellar',
    '銀幕 Old Film', '薄霧 Mist', '夢想 Dreamy', '青写真 Blueprint', 'Terminal'
  ];

  var carousel = document.getElementById('ndCarousel');
  var label    = document.getElementById('ndLabel');
  var prevBtn  = document.getElementById('ndPrev');
  var nextBtn  = document.getElementById('ndNext');
  var dotsEl   = document.getElementById('ndDots');

  if (!carousel) return;

  var stage  = carousel.querySelector('.nd-stage');
  var slides = carousel.querySelectorAll('.nd-slide');
  var total  = slides.length;

  // ── ドット生成 ──
  THEMES.forEach(function (name, i) {
    var btn = document.createElement('button');
    btn.className = 'nd-dot' + (i === 0 ? ' nd-dot-active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', name);
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.dataset.i = i;
    dotsEl.appendChild(btn);
  });

  var dots    = dotsEl.querySelectorAll('.nd-dot');
  var current = 0;

  function goTo(n) {
    var from = current;
    current = (n + total) % total;
    if (from === current) return;

    slides[from].classList.remove('nd-active');
    slides[from].classList.add('nd-exit');
    setTimeout(function () { slides[from].classList.remove('nd-exit'); }, 220);

    slides[current].classList.add('nd-active');

    dots[from].classList.remove('nd-dot-active');
    dots[from].setAttribute('aria-selected', 'false');
    dots[current].classList.add('nd-dot-active');
    dots[current].setAttribute('aria-selected', 'true');

    if (label) label.textContent = THEMES[current];
  }

  // ── ボタン ──
  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });

  // ── ドットクリック ──
  dotsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.nd-dot');
    if (btn) goTo(parseInt(btn.dataset.i, 10));
  });

  // ── スワイプ（TSG との競合回避: stopPropagation） ──
  var swipeStartX = 0;
  var swipeDeltaX = 0;
  var swiping = false;

  stage.addEventListener('touchstart', function (e) {
    swipeStartX = e.touches[0].clientX;
    swipeDeltaX = 0;
    swiping = true;
  }, { passive: true });

  stage.addEventListener('touchmove', function (e) {
    if (!swiping) return;
    swipeDeltaX = e.touches[0].clientX - swipeStartX;
    // TSG の window.touchmove リスナーへのバブル伝播を阻止
    e.stopPropagation();
  }, { passive: false });

  stage.addEventListener('touchend', function (e) {
    if (!swiping) return;
    swiping = false;
    e.stopPropagation();
    if (Math.abs(swipeDeltaX) > 40) {
      goTo(swipeDeltaX < 0 ? current + 1 : current - 1);
    }
  });

  // ── マウスドラッグ ──
  var mouseStartX = 0;
  var mouseDragging = false;

  stage.addEventListener('mousedown', function (e) {
    mouseStartX = e.clientX;
    mouseDragging = true;
  });

  window.addEventListener('mousemove', function () {
    // 移動中フラグを維持するだけ
  });

  window.addEventListener('mouseup', function (e) {
    if (!mouseDragging) return;
    mouseDragging = false;
    var dx = e.clientX - mouseStartX;
    if (Math.abs(dx) > 40) {
      goTo(dx < 0 ? current + 1 : current - 1);
    }
  });
})();
