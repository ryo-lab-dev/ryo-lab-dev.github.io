// scorevault.js — ScoreVault 固有スクリプト

// FAQ アコーディオン
function toggleFaq(id) {
  var item = document.getElementById(id);
  var isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function (el) { el.classList.remove('open'); });
  if (!isOpen) item.classList.add('open');
}
