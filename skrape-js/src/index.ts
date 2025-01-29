import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface SkrapeOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
}

export interface ExtractOptions {
  renderJs?: boolean;
}

export interface JobResponse {
  jobId: string;
  message: string;
}

export interface JobStatus {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  output?: any;
  error?: any;
  createdAt: string;
  isCompleted: boolean;
}

export interface CrawlOptions {
  renderJs: boolean;
  callbackUrl?: string;
  maxDepth?: number;
  maxPages?: number;
  maxLinks?: number;
  linksOnly?: boolean;
}

export interface MarkdownOptions {
  renderJs: boolean;
  callbackUrl?: string;
}

export class SkrapeError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "SkrapeError";
  }
}

export class Skrape {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  public readonly markdown: {
    (url: string, options: MarkdownOptions): Promise<string>;
    bulk: (urls: string[], options: MarkdownOptions) => Promise<JobResponse>;
  };

  constructor(options: SkrapeOptions) {
    this.baseUrl = options.baseUrl || "https://skrape.ai/api";
    this.apiKey = options.apiKey.replace(/["']/g, "");

    // Initialize markdown method and its bulk property
    this.markdown = Object.assign(
      async (url: string, options: MarkdownOptions): Promise<string> => {
        try {
          const response = await fetch(`${this.baseUrl}/markdown`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, options }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new SkrapeError(
              data.error || "Request failed",
              response.status,
              response.headers.get("Retry-After")
                ? parseInt(response.headers.get("Retry-After")!, 10)
                : undefined
            );
          }

          return data.result;
        } catch (error) {
          if (error instanceof SkrapeError) throw error;
          throw new SkrapeError(
            error instanceof Error ? error.message : "Unknown error occurred",
            500
          );
        }
      },
      {
        bulk: async (
          urls: string[],
          options: MarkdownOptions
        ): Promise<JobResponse> => {
          try {
            const response = await fetch(`${this.baseUrl}/markdown/bulk`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ urls, options }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new SkrapeError(
                data.error || "Request failed",
                response.status,
                response.headers.get("Retry-After")
                  ? parseInt(response.headers.get("Retry-After")!, 10)
                  : undefined
              );
            }

            return data;
          } catch (error) {
            if (error instanceof SkrapeError) throw error;
            throw new SkrapeError(
              error instanceof Error ? error.message : "Unknown error occurred",
              500
            );
          }
        },
      }
    );
  }

  private convertToJsonSchema(schema: z.ZodType) {
    const fullSchema = zodToJsonSchema(schema);
    if (
      typeof fullSchema === "object" &&
      fullSchema.definitions &&
      "Schema" in fullSchema.definitions
    ) {
      return fullSchema.definitions.Schema;
    }
    return fullSchema;
  }

  async extract<T extends z.ZodType>(
    url: string,
    schema: T,
    options?: ExtractOptions
  ): Promise<z.infer<T>> {
    const jsonSchema = this.convertToJsonSchema(schema);

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url,
          schema: jsonSchema,
          options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new SkrapeError(
          data.error || "Request failed",
          response.status,
          response.headers.get("Retry-After")
            ? parseInt(response.headers.get("Retry-After")!, 10)
            : undefined
        );
      }

      return data.result as z.infer<T>;
    } catch (error) {
      if (error instanceof SkrapeError) {
        throw error;
      }
      throw new SkrapeError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500
      );
    }
  }

  async crawl(urls: string[], options: CrawlOptions): Promise<JobResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls, options }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new SkrapeError(
          data.error || "Request failed",
          response.status,
          response.headers.get("Retry-After")
            ? parseInt(response.headers.get("Retry-After")!, 10)
            : undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof SkrapeError) throw error;
      throw new SkrapeError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500
      );
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/get-job?jobId=${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new SkrapeError(
          data.error || "Request failed",
          response.status,
          response.headers.get("Retry-After")
            ? parseInt(response.headers.get("Retry-After")!, 10)
            : undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof SkrapeError) throw error;
      throw new SkrapeError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500
      );
    }
  }

  async checkHealth(): Promise<{
    status: "healthy" | "unhealthy";
    timestamp: string;
    environment: "development" | "production";
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new SkrapeError(data.error || "Request failed", response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof SkrapeError) throw error;
      throw new SkrapeError(
        error instanceof Error ? error.message : "Unknown error occurred",
        500
      );
    }
  }
}

export type InferSkrapeSchema<T extends z.ZodType> = z.infer<T>;
