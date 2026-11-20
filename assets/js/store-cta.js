// 記事ページのストア導線。記事末尾のストアリンクを元に、冒頭のカードと
// スマホ用の追従バーを作る（リンクはページ内の既存のものを再利用する）。
(function () {
  var SEL = 'a[href^="https://play.google.com/store/apps/details"], a[href*="apps.apple.com/"]';
  var en = document.documentElement.getAttribute('data-lang') === 'en';

  var links = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (a) {
    return !a.closest('nav, footer, .store-cta');
  });
  if (!links.length) return;
  var endBlock = links[0].closest('.doc-section') || links[0].parentNode;

  var play = null, apple = null;
  links.forEach(function (a) {
    if (!play && a.href.indexOf('play.google.com') !== -1) play = a.href;
    if (!apple && a.href.indexOf('apps.apple.com') !== -1) apple = a.href;
  });

  function appName() {
    try {
      var ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      if (ld.about && ld.about.name) return ld.about.name;
    } catch (e) {}
    var t = document.querySelector('.nav-logo-text');
    return t ? t.textContent.trim() : '';
  }

  var ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 3v12m0 0l-5-5m5 5l5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buttons(long) {
    var h = '';
    if (play) h += '<a class="store-cta__btn" href="' + play + '" target="_blank" rel="noopener">' + ICON + '<span>' +
      (en ? 'Google Play' : (long ? 'Google Play でダウンロード' : 'Google Play')) + '</span></a>';
    if (apple) h += '<a class="store-cta__btn" href="' + apple + '" target="_blank" rel="noopener">' + ICON + '<span>' +
      (en ? 'App Store' : (long ? 'App Store でダウンロード' : 'App Store')) + '</span></a>';
    return h;
  }

  var name = appName();
  var label = en ? 'Free to download' : '無料でダウンロード';

  function make(cls, long) {
    var d = document.createElement('div');
    d.className = 'store-cta ' + cls;
    d.innerHTML = '<div class="store-cta__text"><strong>' + (name || '') + '</strong><span>' + label + '</span></div>' +
      '<div class="store-cta__btns">' + buttons(long) + '</div>';
    return d;
  }

  // 冒頭のカード（見出しの直後）
  var header = document.querySelector('.doc-header');
  var top = make('store-cta--top', true);
  if (header && header.parentNode) header.parentNode.insertBefore(top, header.nextSibling);
  else return;

  // 追従バー（スマホのみ CSS で表示）。冒頭のカードも記事末尾も見えていないときだけ出す
  var bar = make('store-cta--bar', false);
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var topSeen = true, endSeen = false;
  function update() {
    var show = !topSeen && !endSeen;
    bar.classList.toggle('is-shown', show);
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    document.body.classList.toggle('has-store-bar', show);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { topSeen = e[0].isIntersecting; update(); }).observe(top);
    new IntersectionObserver(function (e) { endSeen = e[0].isIntersecting; update(); }).observe(endBlock);
  }
})();
