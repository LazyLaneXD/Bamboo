const test = require('node:test');
const assert = require('node:assert/strict');
const search = require('../api/search');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('validates requests and missing configuration', async () => {
  const previous = process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.BRAVE_SEARCH_API_KEY;
  try {
    let res = response();
    await search({ method: 'POST', query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET');
    res = response();
    await search({ method: 'GET', query: { q: ' ' } }, res);
    assert.equal(res.statusCode, 400);
    res = response();
    await search({ method: 'GET', query: { q: 'a'.repeat(201) } }, res);
    assert.equal(res.statusCode, 400);
    res = response();
    await search({ method: 'GET', query: { q: 'pandas', type: 'other' } }, res);
    assert.equal(res.statusCode, 400);
    res = response();
    await search({ method: 'GET', query: { q: 'pandas' } }, res);
    assert.equal(res.statusCode, 503);
  } finally {
    if (previous === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = previous;
  }
});

test('returns attributed web results and provider recommendations', async () => {
  const previousKey = process.env.BRAVE_SEARCH_API_KEY;
  const previousFetch = global.fetch;
  process.env.BRAVE_SEARCH_API_KEY = 'test-key';
  global.fetch = async (url, options) => {
    assert.equal(url.pathname, '/res/v1/web/search');
    assert.equal(url.searchParams.get('q'), 'pandas');
    assert.equal(options.headers['X-Subscription-Token'], 'test-key');
    return { ok: true, json: async () => ({
      web: { results: [
        { title: 'Pandas', url: 'https://example.com/pandas', description: 'A source.' },
        { title: 'Unsafe', url: 'javascript:alert(1)' }
      ] },
      related_queries: { results: [{ query: 'giant pandas' }] }
    }) };
  };
  try {
    const res = response();
    await search({ method: 'GET', query: { q: ' pandas ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.results, [{ title: 'Pandas', url: 'https://example.com/pandas', description: 'A source.' }]);
    assert.deepEqual(res.body.related, ['giant pandas']);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = previousKey;
  }
});

test('returns image links and handles provider failures', async () => {
  const previousKey = process.env.BRAVE_SEARCH_API_KEY;
  const previousFetch = global.fetch;
  process.env.BRAVE_SEARCH_API_KEY = 'test-key';
  try {
    global.fetch = async url => {
      assert.equal(url.pathname, '/res/v1/images/search');
      return { ok: true, json: async () => ({ results: [
        { title: 'Panda', url: 'https://example.com/page', thumbnail: { src: 'https://example.com/image.jpg' } },
        { title: 'Unsafe', url: 'https://example.com', thumbnail: { src: 'javascript:alert(1)' } }
      ] }) };
    };
    let res = response();
    await search({ method: 'GET', query: { q: 'pandas', type: 'images' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.results, [{ title: 'Panda', url: 'https://example.com/page', thumbnail: 'https://example.com/image.jpg' }]);
    global.fetch = async () => ({ ok: false });
    res = response();
    await search({ method: 'GET', query: { q: 'pandas' } }, res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /test-key/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = previousKey;
  }
});
