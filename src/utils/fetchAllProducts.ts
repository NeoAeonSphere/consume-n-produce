import { fetchWithPuppeteer } from "./fetchWithPuppeteer";
import { generateRandomUserAgent } from "./generateRandomUserAgent";
import {
  DELAY_BETWEEN_REQUESTS,
  MAX_RETRIES,
  TIMEOUT,
} from "../types/constants";

import { Product } from "../types/types";
import { sanitizeFileName } from "./sanitizeFileName";
import { cache } from "./cache";

export const fetchAllProducts = async (baseUrl: string): Promise<Product[]> => {
  // Check cache first
  const cacheKey = `products_${sanitizeFileName(new URL(baseUrl).hostname)}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && cachedData.products) {
    console.log(`Using cached products for ${baseUrl}`);
    return cachedData.products;
  }

  console.log(`Fetching products from ${baseUrl}`);
  let allProducts: Product[] = [];
  let page = 1;
  let hasMorePages = true;
  let retries = 0;

  while (hasMorePages && retries < MAX_RETRIES) {
    try {
      const url = `${baseUrl}${
        baseUrl.includes("?") ? "&" : "?"
      }page=${page}&limit=250`;
      console.log(`Fetching page ${page} from ${baseUrl}`);

      let products: Product[] = [];

      // Try direct API request first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(url, {
          headers: {
            "User-Agent": generateRandomUserAgent(),
            Accept: "application/json, text/javascript, */*; q=0.01",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          products = data.products || [];
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error: any) {
        // If direct request fails, try Puppeteer
        console.log(`Direct request failed, trying Puppeteer for ${url}`);
        products = await fetchWithPuppeteer(url);
      }

      if (products.length === 0) {
        hasMorePages = false;
        break;
      }

      allProducts = [...allProducts, ...products];
      retries = 0; // Reset retries after successful request

      // Check if we've reached the last page
      if (products.length < 250) {
        hasMorePages = false;
      } else {
        page++;
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
        );
      }
    } catch (error: any) {
      console.error(
        `Error fetching page ${page} from ${baseUrl}:`,
        error.message
      );
      retries++;
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_REQUESTS * 2)
      );
    }
  }

  console.log(`Fetched ${allProducts.length} products from ${baseUrl}`);

  // Cache the results
  if (allProducts.length > 0) {
    cache.set(cacheKey, { products: allProducts }, 3600000); // Cache for 1 hour
  }

  return allProducts;
};
