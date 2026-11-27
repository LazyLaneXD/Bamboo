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

test('validates requests', async () => {
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
});

test('returns web results and search suggestions without an API key', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(options.headers['User-Agent'], /^Bamboo/);
    if (url.hostname === 'www.bing.com') {
      assert.equal(url.searchParams.get('q'), 'pandas');
      return { ok: true, text: async () => `<rss><channel><item>
        <title>Pandas &amp; bamboo</title><link>https://example.com/pandas</link>
        <description>A <b>source</b>.</description>
      </item><item><title>Unsafe</title><link>javascript:alert(1)</link><description>Bad</description></item></channel></rss>` };
    }
    return { ok: true, json: async () => ['pandas', ['giant pandas', '', 'a'.repeat(201)]] };
  };
  try {
    const res = response();
    await search({ method: 'GET', query: { q: ' pandas ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.results, [{ title: 'Pandas & bamboo', url: 'https://example.com/pandas', description: 'A source.' }]);
    assert.deepEqual(res.body.related, ['giant pandas']);
  } finally {
    global.fetch = previousFetch;
  }
});

test('returns image links and handles search failures', async () => {
  const previousFetch = global.fetch;
  try {
    global.fetch = async url => {
      assert.equal(url.hostname, 'commons.wikimedia.org');
      return { ok: true, json: async () => ({ query: { pages: {
        one: { title: 'File:Giant_panda.jpg', imageinfo: [{ descriptionurl: 'https://example.com/page', thumburl: 'https://example.com/image.jpg' }] },
        two: { title: 'File:Unsafe.jpg', imageinfo: [{ descriptionurl: 'https://example.com', thumburl: 'javascript:alert(1)' }] }
      } } }) };
    };
    let res = response();
    await search({ method: 'GET', query: { q: 'pandas', type: 'images' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.results, [{ title: 'Giant panda', url: 'https://example.com/page', thumbnail: 'https://example.com/image.jpg' }]);
    global.fetch = async () => ({ ok: false });
    res = response();
    await search({ method: 'GET', query: { q: 'pandas' } }, res);
    assert.equal(res.statusCode, 502);
  } finally {
    global.fetch = previousFetch;
  }
});

test('keeps web results when related suggestions are unavailable', async () => {
  const previousFetch = global.fetch;
  global.fetch = async url => {
    if (url.hostname === 'www.bing.com') {
      return { ok: true, text: async () => '<rss><item><title>Pandas</title><link>https://example.com/pandas</link><description>A source.</description></item></rss>' };
    }
    throw new Error('Suggestions unavailable');
  };
  try {
    const res = response();
    await search({ method: 'GET', query: { q: 'pandas' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.results.length, 1);
    assert.deepEqual(res.body.related, []);
  } finally {
    global.fetch = previousFetch;
  }
});
