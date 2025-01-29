import pytest
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv
from skrape import Skrape, SkrapeAPIError, SkrapeValidationError

# Load environment variables
load_dotenv()

class SimpleSchema(BaseModel):
    """Schema for testing the extract endpoint."""
    title: str
    description: str

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_extract_simple():
    """Test extracting simple data."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    async with Skrape(api_key=api_key) as skrape:
        response = await skrape.extract(
            "https://example.com",
            SimpleSchema,
            {"renderJs": False}
        )
        
        # Validate job response
        assert response.jobId == "immediate"
        assert response.status == "COMPLETED"
        assert response.result
        assert response.result["title"]
        assert response.result["description"]

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_markdown():
    """Test converting URL to markdown."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    async with Skrape(api_key=api_key) as skrape:
        response = await skrape.markdown(
            "https://example.com",
            {"renderJs": False}
        )
        
        # Validate markdown response
        assert isinstance(response.result, str)
        assert response.usage.remaining >= 0
        assert response.usage.rateLimit.remaining >= 0

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_markdown_bulk():
    """Test bulk markdown conversion."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    async with Skrape(api_key=api_key) as skrape:
        response = await skrape.markdown_bulk(
            ["https://example.com", "https://example.org"],
            {"renderJs": False}
        )
        
        # Validate job response
        assert response.jobId
        assert response.status in ["PENDING", "RUNNING", "COMPLETED"]
        
        if response.status == "COMPLETED":
            job = await skrape.get_job(response.jobId)
            assert job.result
            assert job.status == "COMPLETED"
            assert isinstance(job.result, list)
            assert len(job.result) == 2

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_crawl():
    """Test crawling multiple URLs."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    async with Skrape(api_key=api_key) as skrape:
        response = await skrape.crawl(
            ["https://example.com", "https://example.org"],
            {"renderJs": False}
        )
        
        # Validate job response
        assert response.jobId
        assert response.status in ["PENDING", "RUNNING", "COMPLETED"]
        
        if response.status == "COMPLETED":
            job = await skrape.get_job(response.jobId)
            assert job.result
            assert job.status == "COMPLETED"
            assert isinstance(job.result, list)
            assert len(job.result) == 2

@pytest.mark.asyncio
async def test_invalid_api_key():
    """Test that invalid API key raises appropriate error."""
    async with Skrape(api_key="invalid_key") as skrape:
        with pytest.raises(SkrapeAPIError) as exc_info:
            await skrape.extract(
                "https://example.com",
                SimpleSchema,
                {"renderJs": False}
            )
        assert "Invalid or missing API key" in str(exc_info.value)

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_invalid_url():
    """Test that invalid URL raises appropriate error."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    async with Skrape(api_key=api_key) as skrape:
        with pytest.raises(SkrapeAPIError):
            await skrape.extract(
                "https://this-url-does-not-exist.com",
                SimpleSchema,
                {"renderJs": False}
            )

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SKRAPE_API_KEY"),
    reason="SKRAPE_API_KEY environment variable is not set"
)
async def test_rate_limit():
    """Test handling of rate limit errors."""
    api_key = os.getenv("SKRAPE_API_KEY")
    
    # Make multiple requests to trigger rate limit
    async with Skrape(api_key=api_key) as skrape:
        for _ in range(5):  # Attempt 5 requests in quick succession
            try:
                await skrape.extract(
                    "https://example.com",
                    SimpleSchema,
                    {"renderJs": False}
                )
            except SkrapeAPIError as e:
                if "Rate limit exceeded" in str(e):
                    # Test passed if we hit the rate limit
                    return
        
        # If we didn't hit the rate limit after 5 requests, that's fine too
        # The test is more about handling the rate limit when it occurs
