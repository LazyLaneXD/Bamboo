const MAX_QUERY_LENGTH = 200;
const RESULT_COUNT = 20;

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function decodeHtml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g), match => {
    const item = match[1];
    const value = tag => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '';
    return {
      title: decodeHtml(value('title')),
      url: safeUrl(decodeHtml(value('link'))),
      description: decodeHtml(value('description'))
    };
  }).filter(item => item.url);
}

async function searchWeb(query) {
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('count', RESULT_COUNT);

  const [searchResult, suggestionsResult] = await Promise.allSettled([
    fetch(url, {
      headers: { 'User-Agent': 'Bamboo/1.0 (web search)', Accept: 'application/rss+xml' },
      signal: AbortSignal.timeout(10000)
    }),
    fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Bamboo/1.0 (search suggestions)' },
      signal: AbortSignal.timeout(10000)
    })
  ]);
  if (searchResult.status === 'rejected' || !searchResult.value.ok) {
    throw new Error('Search service error');
  }
  const searchResponse = searchResult.value;
  const suggestionsResponse = suggestionsResult.status === 'fulfilled' ? suggestionsResult.value : null;

  const results = parseRss(await searchResponse.text()).slice(0, RESULT_COUNT);
  let related = [];
  if (suggestionsResponse?.ok) {
    const suggestions = await suggestionsResponse.json();
    related = (Array.isArray(suggestions?.[1]) ? suggestions[1] : [])
      .filter(item => typeof item === 'string' && item.trim() && item.length <= MAX_QUERY_LENGTH)
      .slice(0, 8);
  }
  return { results, related };
}

async function searchImages(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', RESULT_COUNT);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url');
  url.searchParams.set('iiurlwidth', '640');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Bamboo/1.0 (image search)' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Image service error');
  const data = await response.json();
  const results = Object.values(data.query?.pages || {}).map(item => {
    const image = item.imageinfo?.[0];
    return {
      title: (item.title || 'Image result').replace(/^File:/, '').replace(/\.[^.]+$/, '').replaceAll('_', ' '),
      url: safeUrl(image?.descriptionurl),
      thumbnail: safeUrl(image?.thumburl || image?.url)
    };
  }).filter(item => item.url && item.thumbnail);
  return { results };
}

module.exports = async function search(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const type = req.query.type || 'web';
  if (!query || query.length > MAX_QUERY_LENGTH || !['web', 'images'].includes(type)) {
    return res.status(400).json({ error: 'Enter a search of 1–200 characters.' });
  }
  try {
    return res.status(200).json(type === 'images' ? await searchImages(query) : await searchWeb(query));
  } catch {
    return res.status(502).json({ error: 'Search is temporarily unavailable. Please try again.' });
  }
};
