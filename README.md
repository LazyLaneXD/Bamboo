# Bamboo

Bamboo is a simple web and image search experience for curious minds. Results and
related search recommendations are supplied by the [Brave Search API](https://brave.com/search/api/).
Result snippets come from their linked sources; open those sources to check facts
and context.

## Deploy on Vercel

1. Import this repository into Vercel.
2. Obtain a Brave Search API subscription and API key. The subscription must
   include the web and image search endpoints to use both tabs.
3. Add `BRAVE_SEARCH_API_KEY` as a server-side environment variable in the
   Vercel project settings, then deploy (or redeploy).

The static site is served from the repository root and `/api/search` is a Vercel
serverless function. The API key is used only by the function, never sent to the
browser. Without a key, the interface displays a configuration message.

For local development, use the [Vercel CLI](https://vercel.com/docs/cli) with
`vercel dev` and set `BRAVE_SEARCH_API_KEY` in your local environment. Run the
dependency-free API checks with `npm test` on Node.js 20 or later.
