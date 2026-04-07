// Shared scripts for product subpages.

// Scroll reveal
(function () {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
})();

// Hamburger menu
(function () {
  var btn = document.getElementById('navToggle');
  var navEl = btn && btn.closest('nav');
  if (!btn || !navEl) return;

  btn.addEventListener('click', function () {
    navEl.classList.toggle('open');
    btn.setAttribute('aria-label', navEl.classList.contains('open') ? 'メニューを閉じる' : 'メニューを開く');
  });

  document.addEventListener('click', function (e) {
    if (!navEl.contains(e.target)) navEl.classList.remove('open');
  });
})();
