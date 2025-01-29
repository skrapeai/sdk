import asyncio
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from skrape import Skrape

# Load API key from .env
load_dotenv()
api_key = os.getenv("SKRAPE_API_KEY")

if not api_key:
    print("Error: SKRAPE_API_KEY not found in .env file")
    exit(1)

# Define a schema for data extraction
class ArticleSchema(BaseModel):
    title: str
    description: str
    author: str | None = None
    date: str | None = None

async def main():
    async with Skrape(api_key=api_key) as skrape:
        print("\n1. Extract structured data from a single URL")
        print("-" * 50)
        response = await skrape.extract(
            "https://example.com",
            ArticleSchema,
            {"renderJs": False}
        )
        print(f"Status: {response.status}")
        print(f"Result: {response.result}\n")

        print("2. Convert URL to markdown")
        print("-" * 50)
        md_response = await skrape.markdown(
            "https://example.com",
            {"renderJs": False}
        )
        print(f"Markdown:\n{md_response.result}\n")
        print(f"API Usage: {md_response.usage.remaining} requests remaining\n")

        print("3. Bulk markdown conversion")
        print("-" * 50)
        urls = [
            "https://example.com",
            "https://example.org"
        ]
        bulk_response = await skrape.markdown_bulk(urls, {"renderJs": False})
        print(f"Job ID: {bulk_response.jobId}")
        print(f"Initial Status: {bulk_response.status}")
        
        if bulk_response.status != "COMPLETED":
            print("Waiting for job to complete...")
            job = await skrape.get_job(bulk_response.jobId)
            print(f"Final Status: {job.status}")
            if job.result:
                print("\nMarkdown results:")
                print(job.result)

        print("\n4. Crawl multiple URLs")
        print("-" * 50)
        crawl_response = await skrape.crawl(urls, {"renderJs": False})
        print(f"Job ID: {crawl_response.jobId}")
        print(f"Initial Status: {crawl_response.status}")
        
        if crawl_response.status != "COMPLETED":
            print("Waiting for job to complete...")
            job = await skrape.get_job(crawl_response.jobId)
            print(f"Final Status: {job.status}")
            if job.result:
                print("\nCrawl results:")
                print(job.result)

if __name__ == "__main__":
    asyncio.run(main())
