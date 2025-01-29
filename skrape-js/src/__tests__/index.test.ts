import { Skrape, SkrapeError, JobStatus } from "../index";
import { z } from "zod";
import { describe, expect, test, beforeAll } from "bun:test";

let skrape: Skrape;
const createMockResponse = (data: any) => new Response(JSON.stringify(data));

beforeAll(() => {
  global.fetch = (async () => createMockResponse({ result: {} })) as typeof fetch;
  skrape = new Skrape({ apiKey: "test-key" });
});

describe("Skrape", () => {
  test("should create a Skrape instance", () => {
    expect(skrape).toBeInstanceOf(Skrape);
  });

  test("should throw error if apiKey is missing", () => {
    expect(() => new Skrape({} as any)).toThrow();
  });

  test("should have correct default baseUrl", () => {
    expect(skrape["baseUrl"]).toBe("https://skrape.ai/api");
  });

  test("should store API key and strip quotes", () => {
    const skrapeWithQuotes = new Skrape({ apiKey: '"test-key"' });
    expect(skrapeWithQuotes["apiKey"]).toBe("test-key");
  });

  test("should allow custom baseUrl", () => {
    const customSkrape = new Skrape({
      apiKey: "test-key",
      baseUrl: "https://custom.api",
    });
    expect(customSkrape["baseUrl"]).toBe("https://custom.api");
  });

  describe("extract", () => {
    const testSchema = z.object({
      title: z.string(),
      price: z.number(),
    });

    const mockSuccessResponse = {
      result: {
        title: "Test Product",
        price: 99.99,
      },
    };

    test("should make correct API request", async () => {
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        expect(input).toBe("https://skrape.ai/api/extract");
        expect(init?.method).toBe("POST");
        return createMockResponse(mockSuccessResponse);
      }) as typeof fetch;

      await skrape.extract("https://example.com", testSchema);
    });

    test("should handle renderJs option", async () => {
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        expect(body.options.renderJs).toBe(true);
        return createMockResponse(mockSuccessResponse);
      }) as typeof fetch;

      await skrape.extract("https://example.com", testSchema, { renderJs: true });
    });

    test("should parse successful response", async () => {
      global.fetch = (async () => createMockResponse(mockSuccessResponse)) as typeof fetch;
      const result = await skrape.extract("https://example.com", testSchema);
      expect(result).toEqual(mockSuccessResponse.result);
    });

    test("should handle API errors with retry-after", async () => {
      global.fetch = (async () => new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "retry-after": "60" }
      })) as typeof fetch;

      try {
        await skrape.extract("https://example.com", testSchema);
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(SkrapeError);
        if (error instanceof SkrapeError) {
          expect(error.status).toBe(429);
          expect(error.retryAfter).toBe(60);
        }
      }
    });

    test("should handle network errors", async () => {
      global.fetch = (async () => { throw new Error("Network error"); }) as typeof fetch;

      try {
        await skrape.extract("https://example.com", testSchema);
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Network error");
      }
    });
  });

  describe("Schema Validation", () => {
    test("should validate schema conversion", async () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number().min(0),
          email: z.string().email(),
        }),
        orders: z.array(
          z.object({
            id: z.string(),
            total: z.number(),
          })
        ),
      });

      global.fetch = (async () =>
        createMockResponse({
          result: {
            user: {
              name: "John",
              age: 30,
              email: "john@example.com",
            },
            orders: [
              { id: "1", total: 99.99 },
              { id: "2", total: 149.99 },
            ],
          },
        })) as typeof fetch;

      const result = await skrape.extract("https://example.com", complexSchema);
      expect(result.user.name).toBe("John");
      expect(result.orders).toHaveLength(2);
    });
  });

  describe("SkrapeError", () => {
    test("should create SkrapeError with status and retry-after", () => {
      const error = new SkrapeError("Rate limit exceeded", 429, 60);
      expect(error).toBeInstanceOf(SkrapeError);
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.name).toBe("SkrapeError");
    });
  });

  describe("markdown", () => {
    const mockUrl = "https://example.com";
    const mockOptions = { renderJs: true };
    const mockApiResponse = {
      result: "# Example Page\n\nThis is a test page",
    };

    test("should make correct API request", async () => {
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        expect(input).toBe("https://skrape.ai/api/markdown");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(init?.body as string)).toEqual({
          url: mockUrl,
          options: mockOptions,
        });
        return createMockResponse(mockApiResponse);
      }) as typeof fetch;

      await skrape.markdown(mockUrl, mockOptions);
    });

    test("should return markdown content", async () => {
      global.fetch = (async () => createMockResponse(mockApiResponse)) as typeof fetch;
      const result = await skrape.markdown(mockUrl, mockOptions);
      expect(result).toBe(mockApiResponse.result);
    });

    test("should handle API errors", async () => {
      global.fetch = (async () =>
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "retry-after": "60" },
        })) as typeof fetch;

      await expect(skrape.markdown(mockUrl, mockOptions)).rejects.toThrow(
        SkrapeError
      );
    });

    describe("bulk", () => {
      const mockUrls = ["https://example.com", "https://example.org"];
      const mockBulkResponse = {
        jobId: "123",
        message: "Bulk conversion started",
      };

      test("should make correct API request", async () => {
        global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
          expect(input).toBe("https://skrape.ai/api/markdown/bulk");
          expect(init?.method).toBe("POST");
          expect(JSON.parse(init?.body as string)).toEqual({
            urls: mockUrls,
            options: mockOptions,
          });
          return createMockResponse(mockBulkResponse);
        }) as typeof fetch;

        await skrape.markdown.bulk(mockUrls, mockOptions);
      });

      test("should handle API errors", async () => {
        global.fetch = (async () =>
          new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { "retry-after": "60" },
          })) as typeof fetch;

        await expect(
          skrape.markdown.bulk(mockUrls, mockOptions)
        ).rejects.toThrow(SkrapeError);
      });
    });
  });

  describe("crawl", () => {
    const mockUrls = ["https://example.com"];
    const mockOptions = { maxDepth: 2, renderJs: false };
    const mockCrawlResponse = {
      jobId: "123",
      message: "Crawl started",
    };

    test("should make correct API request", async () => {
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        expect(input).toBe("https://skrape.ai/api/crawl");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(init?.body as string)).toEqual({
          urls: mockUrls,
          options: mockOptions,
        });
        return createMockResponse(mockCrawlResponse);
      }) as typeof fetch;

      await skrape.crawl(mockUrls, mockOptions);
    });

    test("should handle API errors", async () => {
      global.fetch = (async () =>
        new Response(JSON.stringify({ error: "Usage limit exceeded" }), {
          status: 402,
        })) as typeof fetch;

      await expect(skrape.crawl(mockUrls, mockOptions)).rejects.toThrow(
        SkrapeError
      );
    });
  });

  describe("getJobStatus", () => {
    const mockJobId = "123";
    const mockJobResponse: JobStatus = {
      status: "COMPLETED" as const,
      output: { data: "test" },
      createdAt: "2023-01-01",
      isCompleted: true,
    };

    test("should make correct API request", async () => {
      global.fetch = (async (input: string | URL | Request) => {
        expect(input).toBe(`https://skrape.ai/api/get-job?jobId=${mockJobId}`);
        return createMockResponse(mockJobResponse);
      }) as typeof fetch;

      await skrape.getJobStatus(mockJobId);
    });

    test("should return job status", async () => {
      global.fetch = (async () => createMockResponse(mockJobResponse)) as typeof fetch;
      const result = await skrape.getJobStatus(mockJobId);
      expect(result).toEqual(mockJobResponse);
    });

    test("should handle API errors", async () => {
      global.fetch = (async () =>
        new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
        })) as typeof fetch;

      await expect(skrape.getJobStatus(mockJobId)).rejects.toThrow(SkrapeError);
    });
  });

  describe("checkHealth", () => {
    const mockHealthResponse = {
      status: "healthy" as const,
      timestamp: "2023-01-01",
      environment: "production" as const,
    };

    test("should make correct API request", async () => {
      global.fetch = (async (input: string | URL | Request) => {
        expect(input).toBe("https://skrape.ai/api/health");
        return createMockResponse(mockHealthResponse);
      }) as typeof fetch;

      await skrape.checkHealth();
    });

    test("should return health status", async () => {
      global.fetch = (async () => createMockResponse(mockHealthResponse)) as typeof fetch;
      const result = await skrape.checkHealth();
      expect(result).toEqual(mockHealthResponse);
    });

    test("should handle API errors", async () => {
      global.fetch = (async () =>
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
        })) as typeof fetch;

      await expect(skrape.checkHealth()).rejects.toThrow(SkrapeError);
    });
  });
});
