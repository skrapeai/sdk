import { Skrape, SkrapeError } from "./index";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.SKRAPE_API_KEY;
if (!apiKey) {
  throw new Error("SKRAPE_API_KEY is required");
}

const skrape = new Skrape({
  apiKey,
  baseUrl: "http://localhost:3000/api",
});

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

async function test() {
  try {
    // Extract data
    console.log("\n🔍 Extracting data from HN...");
    const result = await skrape.extract(
      "https://news.ycombinator.com",
      newsSchema,
      { renderJs: true }
    );
    console.log(JSON.stringify(result, null, 2));

    // Convert to markdown
    console.log("\n📝 Converting page to markdown...");
    const markdown = await skrape.markdown("https://news.ycombinator.com", {
      renderJs: true,
    });

    console.log("Markdown response:", markdown); // Debug log

    if (markdown) {
      console.log("\nPreview (first 500 chars):");
      console.log("---");
      console.log(markdown.slice(0, 500));
      console.log("---");
    } else {
      console.log("❌ No markdown content received");
    }
  } catch (error) {
    if (error instanceof SkrapeError) {
      console.error("\n❌ SkrapeError:", error.message);
      console.error("Status:", error.status);
      if (error.retryAfter) {
        console.error("Retry after:", error.retryAfter, "seconds");
      }
    } else {
      console.error("\n❌ Error:", error);
    }
  }
}

test();
