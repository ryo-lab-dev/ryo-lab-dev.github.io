(function () {
  'use strict';

  var measurementId = 'G-P4D3NZSVMC';
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link) return;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    var store;
    if (url.hostname === 'play.google.com') {
      store = 'google_play';
    } else if (url.hostname === 'apps.apple.com') {
      store = 'app_store';
    } else {
      return;
    }

    window.gtag('event', 'store_click', {
      store: store,
      link_url: url.href,
      page_path: window.location.pathname,
      transport_type: 'beacon'
    });
  });
})();
