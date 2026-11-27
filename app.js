const form = document.querySelector('#search-form');
const input = document.querySelector('#query');
const resultsSection = document.querySelector('#results-section');
const welcome = document.querySelector('#welcome');
const results = document.querySelector('#results');
const message = document.querySelector('#message');
const related = document.querySelector('#related');
const relatedList = document.querySelector('#related-list');
const tabs = document.querySelectorAll('.tab');
let currentQuery = '';
let currentType = 'web';
let request;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function search(query, type = 'web', updateHistory = true) {
  query = query.trim();
  if (!query) return;
  currentQuery = query;
  currentType = type;
  input.value = query;
  document.title = `${query} — Bamboo`;
  resultsSection.hidden = false;
  welcome.hidden = true;
  document.body.classList.add('has-results');
  tabs.forEach(tab => {
    const active = tab.dataset.type === type;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  if (updateHistory) {
    const params = new URLSearchParams({ q: query });
    if (type !== 'web') params.set('type', type);
    history.pushState(null, '', `/?${params}`);
  }
  loadResults(query, type);
}

async function loadResults(query, type) {
  if (request) request.abort();
  request = new AbortController();
  const signal = request.signal;
  results.replaceChildren();
  related.hidden = true;
  message.textContent = 'Looking around the web…';
  results.classList.toggle('image-grid', type === 'images');

  try {
    const params = new URLSearchParams({ q: query, type });
    const response = await fetch(`/api/search?${params}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    if (signal.aborted) return;
    message.textContent = data.results.length ? '' : 'No results found. Try a different search.';
    data.results.forEach(item => {
      const link = element('a', type === 'images' ? 'image-card' : 'result-card');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (type === 'images') {
        const image = element('img');
        image.src = item.thumbnail;
        image.alt = item.title;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        link.append(image, element('span', 'image-title', item.title));
      } else {
        const host = new URL(item.url).hostname.replace(/^www\./, '');
        link.append(element('span', 'result-source', host), element('h3', '', item.title),
          element('p', '', item.description));
      }
      results.append(link);
    });
    if (type === 'web' && data.related?.length) {
      relatedList.replaceChildren();
      data.related.forEach(query => {
        const button = element('button', 'related-link', query);
        button.type = 'button';
        button.addEventListener('click', () => search(query));
        relatedList.append(button);
      });
      related.hidden = false;
    }
  } catch (error) {
    if (signal.aborted) return;
    message.textContent = error.message || 'Something went wrong. Please try again.';
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  search(input.value);
});
document.querySelectorAll('[data-query]').forEach(button => {
  button.addEventListener('click', () => search(button.dataset.query));
});
tabs.forEach(tab => tab.addEventListener('click', () => search(currentQuery, tab.dataset.type)));
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    search(params.get('q'), params.get('type') === 'images' ? 'images' : 'web', false);
  } else {
    if (request) request.abort();
    currentQuery = '';
    input.value = '';
    document.title = 'Bamboo — a little more wonder';
    resultsSection.hidden = true;
    welcome.hidden = false;
    document.body.classList.remove('has-results');
  }
});
const initialParams = new URLSearchParams(location.search);
if (initialParams.get('q')) {
  search(initialParams.get('q'), initialParams.get('type') === 'images' ? 'images' : 'web', false);
}
