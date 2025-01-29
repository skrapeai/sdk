# skrape-js

A TypeScript library for easily interacting with Skrape.ai API. Define your scraping schema using Zod and get type-safe results.

## Features

- 🛡️ **Type-safe**: Define your schemas using Zod and get fully typed results
- 🚀 **Simple API**: Just define a schema and get your data
- 🧩 **Minimal Dependencies**
- 📝 **Markdown Conversion**: Convert web pages to markdown
- 🕷️ **Web Crawling**: Crawl websites with configurable depth and limits

## Installation

```bash
# Using npm
npm install skrape-js zod

# Using yarn, pnpm, etc.
yarn/pnpm/bun add skrape-js zod
```

Note: `zod` is a peer dependency and must be installed alongside `skrape-js`.

## Environment Setup

Setup your API key in `.env`:

```env
SKRAPE_API_KEY="your_api_key_here"
```

<small>Get your API key on [Skrape.ai](https://skrape.ai)</small>

## Quick Start

```typescript
import { Skrape } from "skrape-js";
import { z } from "zod";

// Initialize the client
const skrape = new Skrape({
  apiKey: process.env.SKRAPE_API_KEY,
});

// Define your schema using Zod
const newsSchema = z.object({
  topStories: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        score: z.number(),
        author: z.string(),
        commentCount: z.number(),
      })
    )
    .max(3),
});

// Extract data
const result = await skrape.extract(
  "https://news.ycombinator.com",
  newsSchema,
  { renderJs: false }
);

console.log(result.topStories);
// [
//   {
//     title: "Example HN Post",
//     url: "https://example.com",
//     score: 100,
//     author: "user123",
//     commentCount: 25
//   },
//   ...
// ]
```

## Features

### Data Extraction

Extract structured data from any webpage using Zod schemas:

```typescript
const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string(),
});

const product = await skrape.extract("https://shop.com/product", productSchema);
```

### Markdown Conversion

Convert a single web page to markdown:

```typescript
const markdown = await skrape.markdown(
  "https://example.com",
  { renderJs: true }
);

console.log(markdown);
// # Example Page
// 
// This is the content...
```

Convert multiple web pages to markdown in bulk:

```typescript
const { jobId } = await skrape.markdown.bulk(
  ["https://example.com", "https://example.org"],
  { renderJs: true, callbackUrl: "https://webhook.site/callback" }
);

// Check job status
const status = await skrape.getJobStatus(jobId);
if (status.isCompleted) {
  console.log(status.output);
}
```

### Web Crawling

Crawl websites with configurable options:

```typescript
const { jobId } = await skrape.crawl(
  ["https://example.com"],
  {
    renderJs: true,
    maxDepth: 3,
    maxPages: 100,
    maxLinks: 100,
    linksOnly: false
  }
);

// Check crawl results
const status = await skrape.getJobStatus(jobId);
if (status.isCompleted) {
  console.log(status.output);
}
```

### Health Check

Check API health status:

```typescript
const health = await skrape.checkHealth();
console.log(health.status); // 'healthy' | 'unhealthy'
```

## Error Handling

The library throws typed errors that you can catch and handle:

```typescript
try {
  const result = await skrape.extract(url, schema);
} catch (error) {
  if (error instanceof SkrapeError) {
    console.error("Error:", error.message);
    console.error("Status:", error.status);
    if (error.retryAfter) {
      console.error("Retry after:", error.retryAfter, "seconds");
    }
  }
}
