# skrape-py

A Python library for easily interacting with Skrape.ai API. Define your scraping schema using Pydantic and get type-safe results.

## Features

- 🛡️ **Type-safe**: Define your schemas using Pydantic and get fully typed results
- 🚀 **Simple API**: Just define a schema and get your data
- 🔄 **Async Support**: Built with async/await for efficient scraping
- 🧩 **Minimal Dependencies**: Built on top of proven libraries like Pydantic and httpx
- 📝 **Markdown Conversion**: Convert any webpage to clean markdown
- 🕷️ **Web Crawling**: Crawl multiple pages with browser automation
- 🔄 **Background Jobs**: Handle long-running tasks asynchronously

## Installation

```bash
pip install skrape-py
```

Or with Poetry:

```bash
poetry add skrape-py
```

## Environment Setup

Setup your API key in `.env`:

```env
SKRAPE_API_KEY="your_api_key_here"
```

Get your API key on [Skrape.ai](https://skrape.ai)

## Quick Start

### Extract Structured Data

```python
from skrape import Skrape
from pydantic import BaseModel
from typing import List
import os
import asyncio

# Define your schema using Pydantic
class ProductSchema(BaseModel):
    title: str
    price: float
    description: str
    rating: float

async def main():
    async with Skrape(api_key=os.getenv("SKRAPE_API_KEY")) as skrape:
        # Start extraction job
        job = await skrape.extract(
            "https://example.com/product",
            ProductSchema,
            {"renderJs": True}  # Enable JavaScript rendering if needed
        )
        
        # Wait for job to complete and get results
        while job.status != "COMPLETED":
            job = await skrape.get_job(job.jobId)
            await asyncio.sleep(1)
        
        # Access the extracted data
        product = job.result
        print(f"Product: {product.title}")
        print(f"Price: ${product.price}")

asyncio.run(main())
```

### Convert to Markdown

```python
# Single URL
response = await skrape.to_markdown(
    "https://example.com/article",
    {"renderJs": True}
)
print(response.result)  # Clean markdown content

# Multiple URLs (async)
job = await skrape.to_markdown_bulk(
    ["https://example.com/1", "https://example.com/2"],
    {"renderJs": True}
)

# Get results when ready
while job.status != "COMPLETED":
    job = await skrape.get_job(job.jobId)
    await asyncio.sleep(1)

for markdown in job.result:
    print(markdown)
```

### Web Crawling

```python
# Start crawling job
job = await skrape.crawl(
    ["https://example.com", "https://example.com/page2"],
    {
        "renderJs": True,
        "actions": [
            {"scroll": {"distance": 500}},  # Scroll down 500px
            {"wait_for": ".content"}  # Wait for content to load
        ]
    }
)

# Get results when ready
while job.status != "COMPLETED":
    job = await skrape.get_job(job.jobId)
    await asyncio.sleep(1)

for page in job.result:
    print(page)
```

## API Options

Common options for all endpoints:

```python
options = {
    "renderJs": True,  # Enable JavaScript rendering
    "actions": [
        {"click": {"selector": ".button"}},  # Click element
        {"scroll": {"distance": 500}},       # Scroll page
        {"wait_for": ".content"},           # Wait for element
        {"type": {                          # Type into input
            "selector": "input",
            "text": "search term"
        }}
    ],
    "callbackUrl": "https://your-server.com/webhook"  # For async jobs
}
```

## Error Handling

The library provides typed exceptions for better error handling:

```python
from skrape import Skrape, SkrapeValidationError, SkrapeAPIError

async with Skrape(api_key=os.getenv("SKRAPE_API_KEY")) as skrape:
    try:
        response = await skrape.extract(url, schema)
    except SkrapeValidationError as e:
        print(f"Data doesn't match schema: {e}")
    except SkrapeAPIError as e:
        print(f"API error: {e}")
```

## Rate Limiting

The API response includes rate limit information that you can use to manage your requests:

```python
response = await skrape.to_markdown(url)
usage = response.usage

print(f"Remaining credits: {usage.remaining}")
print(f"Rate limit info:")
print(f"  - Remaining: {usage.rateLimit.remaining}")
print(f"  - Base limit: {usage.rateLimit.baseLimit}")
print(f"  - Burst limit: {usage.rateLimit.burstLimit}")
print(f"  - Reset at: {usage.rateLimit.reset}")
