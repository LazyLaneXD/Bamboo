const MAX_QUERY_LENGTH = 200;

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
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
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return res.status(503).json({ error: 'Search is not configured yet. Add BRAVE_SEARCH_API_KEY in Vercel.' });
  }

  const url = new URL(`https://api.search.brave.com/res/v1/${type === 'images' ? 'images' : 'web'}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('count', '20');
  url.searchParams.set('safesearch', type === 'images' ? 'strict' : 'moderate');

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Search provider error');
    const data = await response.json();

    if (type === 'images') {
      const results = (data.results || []).map(item => ({
        title: item.title || 'Image result',
        url: safeUrl(item.url),
        thumbnail: safeUrl(item.thumbnail?.src)
      })).filter(item => item.url && item.thumbnail);
      return res.status(200).json({ results });
    }

    const results = (data.web?.results || []).map(item => ({
      title: item.title || item.url,
      url: safeUrl(item.url),
      description: item.description || ''
    })).filter(item => item.url);
    const related = (data.related_queries?.results || [])
      .map(item => item.query)
      .filter(item => typeof item === 'string' && item.trim() && item.length <= MAX_QUERY_LENGTH)
      .slice(0, 8);
    return res.status(200).json({ results, related });
  } catch {
    return res.status(502).json({ error: 'Search is temporarily unavailable. Please try again.' });
  }
};
