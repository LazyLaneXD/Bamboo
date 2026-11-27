# Bamboo

Bamboo is a simple web and image search experience for curious minds. Web results
and related searches are supplied by Bing's public RSS and suggestion endpoints.
Images are sourced from Wikimedia Commons, with links to the original file pages.
No search API key or paid subscription is required. Open linked sources to check
facts, context, and image licensing.

## Deploy on Vercel

1. Import this repository into Vercel.
2. Deploy. No environment variables are needed.

The static site is served from the repository root and `/api/search` is a Vercel
serverless function. Provider requests are made from the function, so provider
endpoints are not exposed to the browser.

For local development, use the [Vercel CLI](https://vercel.com/docs/cli) with
`vercel dev`. Run the dependency-free API checks with `npm test` on Node.js 20 or
later.
