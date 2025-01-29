from typing import TypeVar, Generic, Any, Dict, Optional, Union, List
import json
import httpx
from pydantic import BaseModel
from .errors import SkrapeAPIError, SkrapeValidationError

T = TypeVar("T", bound=BaseModel)

class RateLimit(BaseModel):
    """Rate limit information."""
    remaining: int
    baseLimit: int
    burstLimit: int
    reset: int

class UsageInfo(BaseModel):
    """Information about API usage and rate limits."""
    remaining: int
    rateLimit: RateLimit

class ExtractResponse(Generic[T]):
    """Response from the extract endpoint."""
    def __init__(self, result: T, usage: UsageInfo):
        self.result = result
        self.usage = usage

class MarkdownResponse(BaseModel):
    """Response from the markdown endpoint."""
    result: str
    usage: UsageInfo

class JobResponse(BaseModel):
    """Response from async job endpoints."""
    jobId: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None

class Skrape(Generic[T]):
    """Client for interacting with the Skrape.ai API."""
    
    def __init__(self, api_key: str, base_url: str = "https://skrape.ai/api"):
        """Initialize the Skrape client.
        
        Args:
            api_key: Your Skrape.ai API key
            base_url: Base URL for the Skrape.ai API (default: https://skrape.ai/api)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")  # Remove trailing slash if present
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        self.client = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create an HTTP client."""
        if self.client is None:
            self.client = httpx.AsyncClient(
                headers=self.headers,
                verify=True,  # Verify SSL certificates
                timeout=30.0,  # 30 seconds timeout
                follow_redirects=True
            )
        return self.client

    async def _handle_response(self, response: httpx.Response) -> Dict:
        """Handle API response and common error cases."""
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "10"))
            raise SkrapeAPIError(f"Rate limit exceeded. Try again in {retry_after} seconds")
        
        response.raise_for_status()
        data = response.json()
        
        # For async endpoints, job info is in result
        if "result" in data and isinstance(data["result"], dict):
            if "jobId" in data["result"]:
                return {
                    "jobId": data["result"]["jobId"],
                    "status": data["result"].get("status", "PENDING"),
                    "result": data["result"].get("result"),
                    "error": data["result"].get("error")
                }
            # For extract endpoint, wrap response in job format
            return {
                "jobId": "immediate",
                "status": "COMPLETED",
                "result": data["result"],
                "error": None
            }
        
        # For sync endpoints, return as is
        return data

    async def extract(
        self, 
        url: str, 
        schema: type[T], 
        options: Optional[Dict[str, Any]] = None
    ) -> JobResponse:
        """
        Extract data from a URL using the provided Pydantic schema.
        
        Args:
            url: The URL to scrape
            schema: A Pydantic model class defining the expected data structure
            options: Optional dictionary of scraping options (e.g., renderJs, actions)
            
        Returns:
            JobResponse containing the job ID and status
            
        Raises:
            SkrapeAPIError: If the API request fails
            SkrapeValidationError: If the response doesn't match the schema
        """
        try:
            json_schema = schema.model_json_schema()
            payload = {
                "url": url,
                "schema": json_schema,
                "options": options or {}
            }
            
            client = await self._get_client()
            response = await client.post(f"{self.base_url}/extract", json=payload)
            data = await self._handle_response(response)
            
            return JobResponse.model_validate(data)
                
        except httpx.HTTPError as e:
            if isinstance(e, httpx.HTTPStatusError):
                if e.response.status_code == 401:
                    raise SkrapeAPIError("Invalid or missing API key")
                elif e.response.status_code == 503:
                    raise SkrapeAPIError("Server too busy, please retry")
            raise SkrapeAPIError(f"API request failed: {str(e)}")

    async def markdown(
        self,
        url: str,
        options: Optional[Dict[str, Any]] = None
    ) -> MarkdownResponse:
        """
        Convert a URL to markdown.

        Args:
            url: The URL to convert
            options: Optional dictionary of scraping options (e.g., renderJs, actions)

        Returns:
            MarkdownResponse containing the markdown text and usage info

        Raises:
            SkrapeAPIError: If the API request fails
        """
        try:
            payload = {
                "url": url,
                "options": options or {}
            }

            client = await self._get_client()
            response = await client.post(f"{self.base_url}/markdown", json=payload)
            data = await self._handle_response(response)

            return MarkdownResponse.model_validate(data)

        except httpx.HTTPError as e:
            raise SkrapeAPIError(f"API request failed: {str(e)}")

    async def markdown_bulk(
        self,
        urls: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> JobResponse:
        """
        Convert multiple URLs to markdown.

        Args:
            urls: List of URLs to convert
            options: Optional dictionary of scraping options (e.g., renderJs, actions)

        Returns:
            JobResponse containing the job ID and status

        Raises:
            SkrapeAPIError: If the API request fails
        """
        try:
            payload = {
                "urls": urls,
                "options": options or {}
            }

            client = await self._get_client()
            response = await client.post(f"{self.base_url}/markdown/bulk", json=payload)
            data = await self._handle_response(response)

            return JobResponse.model_validate(data)

        except httpx.HTTPError as e:
            raise SkrapeAPIError(f"API request failed: {str(e)}")

    async def crawl(
        self,
        urls: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> JobResponse:
        """
        Crawl multiple URLs with custom browser automation.
        
        Args:
            urls: List of URLs to crawl
            options: Optional dictionary of crawling options (e.g., renderJs, actions, callbackUrl)
            
        Returns:
            JobResponse containing the job ID and status
            
        Raises:
            SkrapeAPIError: If the API request fails
        """
        try:
            payload = {
                "urls": urls,
                "options": options or {}
            }
            
            client = await self._get_client()
            response = await client.post(f"{self.base_url}/crawl", json=payload)
            data = await self._handle_response(response)
            
            return JobResponse.model_validate(data)
                
        except httpx.HTTPError as e:
            raise SkrapeAPIError(f"API request failed: {str(e)}")

    async def get_job(self, job_id: str) -> JobResponse:
        """
        Get the status and results of a background job.
        
        Args:
            job_id: ID of the job to check
            
        Returns:
            JobResponse containing the job status and results if complete
            
        Raises:
            SkrapeAPIError: If the API request fails
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/get-job?jobId={job_id}")
            data = await self._handle_response(response)
            
            return JobResponse.model_validate(data)
                
        except httpx.HTTPError as e:
            raise SkrapeAPIError(f"API request failed: {str(e)}")
            
    async def __aenter__(self):
        await self._get_client()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
            self.client = None
