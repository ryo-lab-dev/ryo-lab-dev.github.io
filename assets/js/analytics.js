// Ryo-Lab portfolio analytics (Google Analytics 4)
(function () {
  if (window.__ryoLabAnalyticsInitialized) return;
  window.__ryoLabAnalyticsInitialized = true;

  var measurementId = 'G-P4D3NZSVMC';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  var gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(gtagScript);

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (_) {
      return;
    }

    var store = null;
    if (url.hostname === 'play.google.com' && url.pathname.indexOf('/store/apps/details') === 0) {
      store = 'google_play';
    } else if (url.hostname === 'apps.apple.com') {
      store = 'app_store';
    }
    if (!store) return;

    var pathParts = window.location.pathname.split('/').filter(Boolean);
    var appName = pathParts.length ? pathParts[0] : 'portfolio';
    window.gtag('event', 'store_click', {
      store: store,
      app_name: appName,
      link_url: url.href,
      page_path: window.location.pathname
    });
  });
})();
