const categoryFilters = document.querySelectorAll('[data-category-filter]');
const platformFilters = document.querySelectorAll('[data-platform-filter]');
const cards = document.querySelectorAll('.app-card');
const noResults = document.querySelector('.no-results');
let selectedCategory = 'all';
let selectedPlatform = 'all';

function updateCards() {
  let visible = 0;
  cards.forEach((card) => {
    const matchesCategory = selectedCategory === 'all' || card.dataset.category === selectedCategory;
    const matchesPlatform = selectedPlatform === 'all' || card.querySelector(`[href*="${selectedPlatform === 'android' ? 'play.google.com' : selectedPlatform === 'ios' ? 'apps.apple.com' : 'chromewebstore.google.com'}"]`);
    const matches = matchesCategory && matchesPlatform;
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  noResults.hidden = visible !== 0;
}

function selectFilter(filters, selectedFilter) {
  filters.forEach((item) => {
    const isSelected = item === selectedFilter;
    item.classList.toggle('is-active', isSelected);
    item.setAttribute('aria-pressed', String(isSelected));
  });
}

categoryFilters.forEach((filter) => {
  filter.addEventListener('click', () => {
    selectedCategory = filter.dataset.categoryFilter;
    selectFilter(categoryFilters, filter);
    updateCards();
  });
});

platformFilters.forEach((filter) => {
  filter.addEventListener('click', () => {
    selectedPlatform = filter.dataset.platformFilter;
    selectFilter(platformFilters, filter);
    updateCards();
  });
});

// GA4 共通スクリプトを遅延読み込みする。
(() => {
  const analyticsScript = document.createElement('script');
  analyticsScript.src = './assets/js/analytics.js';
  analyticsScript.async = true;
  document.head.appendChild(analyticsScript);
})();
