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

  // 公式バッジ（Apple の黒・Google Play の日本語。改変しない）。このスクリプトの位置を基準に解決する
  var base = document.currentScript ? new URL('../badges/web/', document.currentScript.src).href : '/assets/badges/web/';

  function buttons() {
    var h = '';
    if (play) h += '<a class="store-cta__badge store-cta__badge--play" href="' + play + '" target="_blank" rel="noopener">' +
      '<img src="' + base + 'google-play-ja.svg" alt="' + (en ? 'Get it on Google Play' : 'Google Play で手に入れよう') + '" width="180" height="53"></a>';
    if (apple) h += '<a class="store-cta__badge store-cta__badge--apple" href="' + apple + '" target="_blank" rel="noopener">' +
      '<img src="' + base + 'app-store-ja.svg" alt="' + (en ? 'Download on the App Store' : 'App Store からダウンロード') + '" width="109" height="40"></a>';
    return h;
  }

  var name = appName();
  var label = en ? 'Free to download' : '無料でダウンロード';

  function make(cls) {
    var d = document.createElement('div');
    d.className = 'store-cta ' + cls;
    d.innerHTML = '<div class="store-cta__text"><strong>' + (name || '') + '</strong><span>' + label + '</span></div>' +
      '<div class="store-cta__btns">' + buttons() + '</div>';
    return d;
  }

  // 冒頭のカード（見出しの直後）
  var header = document.querySelector('.doc-header');
  var top = make('store-cta--top');
  if (header && header.parentNode) header.parentNode.insertBefore(top, header.nextSibling);
  else return;

  // 追従バー（スマホのみ CSS で表示）。冒頭のカードも記事末尾も見えていないときだけ出す
  var bar = make('store-cta--bar');
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
