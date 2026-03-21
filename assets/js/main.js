// --- タイプライター ---
const typewriterEl = document.getElementById('typewriter');
const text = '個人開発者として、アイデアをプロダクトに変え続けています。実用性と美しさを両立させたアプリを、FlutterとPythonで作り続けています。';
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
