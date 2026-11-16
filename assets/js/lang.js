// 同じページの中で日本語と英語を切り替える（assets/css/lang.css と組で使う）。
// 使い方: <head> の中で、このスクリプトを同期で読み込む（表示のちらつきを防ぐため async にしない）。
//   - ?lang=en なら英語、それ以外は日本語。ブラウザの言語では自動で切り替えない
//     （検索エンジンのクローラーが英語の設定で読むと、日本語のページが英語として登録されるため）。
//   - 英語のときは <html lang="en">、タイトルは <html data-title-en="…">、説明は <meta name="description" data-en="…">。
//   - ページ内のリンク（./ で始まるもの）に、いまの lang を引き継ぐ。
//   - 言語の切替リンクは <a data-lang-switch="en"> / <a data-lang-switch="ja">。ほかのクエリ（os・version など）は残す。
(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') === 'en' ? 'en' : 'ja';
  var html = document.documentElement;
  html.setAttribute('data-lang', lang);
  html.setAttribute('lang', lang);
  if (lang === 'en' && html.getAttribute('data-title-en')) document.title = html.getAttribute('data-title-en');

  function withLang(href, value) {
    var url = new URL(href, window.location.href);
    if (value === 'ja') url.searchParams.delete('lang');
    else url.searchParams.set('lang', value);
    return url.pathname + url.search + url.hash;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var desc = document.querySelector('meta[name="description"][data-en]');
    if (lang === 'en' && desc) desc.setAttribute('content', desc.getAttribute('data-en'));

    document.querySelectorAll('a[data-lang-switch]').forEach(function (a) {
      a.setAttribute('href', withLang(window.location.href, a.getAttribute('data-lang-switch')));
    });
    if (lang !== 'en') return;
    document.querySelectorAll('a[href^="./"]:not([data-lang-switch])').forEach(function (a) {
      a.setAttribute('href', withLang(a.getAttribute('href'), 'en'));
    });
  });
})();
