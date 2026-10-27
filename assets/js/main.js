// --- タイプライター ---
const typewriterEl = document.getElementById('typewriter');
const text = 'プロダクト運営チームとして、アイデアを継続的に形にしています。実用性と美しさを両立したアプリを、FlutterとPythonを軸に磨き続けています。';
let i = 0;

function typeNext() {
  if (i <= text.length) {
    typewriterEl.textContent = text.slice(0, i);
    i++;
    setTimeout(typeNext, i < text.length ? 55 : 800);
  }
}

// Heroフェードイン後にタイプライター開始
setTimeout(typeNext, 1000);

// --- スタックグリッド挿入 ---
const stacks = [
  'Flutter / Dart',
  'Firebase',
  'Python',
  'Isar',
  'Riverpod',
  'Gemini AI',
  'Notion API',
  'Chrome Extension',
  'Clean Architecture',
];

const grid = document.getElementById('stackGrid');
stacks.forEach(s => {
  const el = document.createElement('div');
  el.className = 'stack-item';
  el.innerHTML = `<span class="item-prefix">&gt;</span>${s}`;
  grid.appendChild(el);
});

document.querySelectorAll('.products-grid > .fade-in').forEach((item, index) => {
  item.style.transitionDelay = `${index * 0.08}s`;
});

// --- スクロール フェードイン ---
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

 // GA4 共通計測を読み込む
(function () {
  var currentScript = document.currentScript;
  if (!currentScript || window.__ryoLabAnalyticsLoaderAdded) return;
  window.__ryoLabAnalyticsLoaderAdded = true;
  var analyticsScript = document.createElement('script');
  analyticsScript.src = new URL('analytics.js', currentScript.src).href;
  analyticsScript.async = true;
  document.head.appendChild(analyticsScript);
})();
