import puppeteer from "puppeteer-extra";
import { Page, HTTPRequest } from "puppeteer";
import { generateRandomUserAgent } from "./generateRandomUserAgent";
import { cache } from "./cache";
import { Product } from "../types/types";
import { TIMEOUT } from "../types/constants";

export const fetchWithPuppeteer = async (url: string): Promise<Product[]> => {
  const browser = await puppeteer.launch({
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
  });

  try {
    const page: Page = await browser.newPage();

    // Set random user agent
    await page.setUserAgent(generateRandomUserAgent());

    // Set extra headers to mimic browser behavior
    await page.setExtraHTTPHeaders({
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
    });

    // Enable request interception for caching
    await page.setRequestInterception(true);

    page.on("request", (request: HTTPRequest) => {
      const requestUrl = request.url();

      // Check cache first
      if (requestUrl === url && cache.has(requestUrl)) {
        const cachedData = cache.get(requestUrl);
        request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(cachedData),
        });
      } else {
        request.continue();
      }
    });

    console.log(`Fetching ${url} with Puppeteer...`);

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: TIMEOUT,
    });

    // Get the page content
    const content = await page.content();

    // Try to find JSON data in the page
    const jsonMatch =
      content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/) ||
      content.match(
        /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/
      );

    let products: Product[] = [];

    if (jsonMatch && jsonMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        products = jsonData.products || [];
      } catch (error: any) {
        console.warn("Failed to parse JSON from page:", error.message);
      }
    }

    // If no products found, try to evaluate JavaScript in the context
    if (products.length === 0) {
      try {
        products = await page.evaluate(() => {
          // @ts-ignore
          if (window.products || window.productData) {
            // @ts-ignore
            return window.products || window.productData.products || [];
          }
          return [];
        });
      } catch (error: any) {
        console.warn(
          "Failed to extract products from page context:",
          error.message
        );
      }
    }

    // Cache the response
    if (products.length > 0) {
      cache.set(url, { products }, 3600000); // Cache for 1 hour
    }

    return products;
  } catch (error: any) {
    console.error(`Puppeteer error for ${url}:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
};
