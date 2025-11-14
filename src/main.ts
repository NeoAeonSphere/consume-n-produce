import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserAgent from "user-agents";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Enable stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
export const ENDPOINTS = [
  //  "https://apluslift.com/products.json",
  // "https://beingshipped.com/products.json",
  //"https://benchmarktooling.com/products.json",
  //"https://gymshark.com/products.json",
  // "https://mobiledirectonline.co.uk/products.json",
  //"https://overstock.com/products.json",
  "https://pelacase.com/products.json",
  // "https://pura.com/products.json",
  //"https://tecisoft.com/products.json",
  //"https://warmlydecor.com/products.json",
  //"https://www.allbirds.com/products.json",
  //"https://www.beactivewear.com.au/products.json",
  //"https://www.netflix.shop/products.json",
];

export const BATCH_SIZE = 250;
export const DELAY_BETWEEN_REQUESTS = 2000;
export const MAX_RETRIES = 3;
export const MAX_WORKERS = Math.max(1, os.cpus().length / 2);
export const MINIMUM_PRICE = 25;
export const PRODUCTS_OUTPUT_DIR = "./products";
export const TIMEOUT = 30000;

// Create output directory if it doesn't exist
if (isMainThread && !fs.existsSync(PRODUCTS_OUTPUT_DIR)) {
  fs.mkdirSync(PRODUCTS_OUTPUT_DIR, { recursive: true });
}

// Interfaces
export interface ProductVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price?: string;
  sku?: string;
  inventory_quantity?: number;
  option1?: string;
  option2?: string;
  option3?: string;
  available?: boolean;
  weight?: number;
  grams?: number;
  barcode?: string;
  gtin?: string;
  mpn?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

export interface ProductImage {
  id: number;
  src: string;
  alt?: string;
  position: number;
  width?: number;
  height?: number;
}

export interface ProductOption {
  id: number;
  name: string;
  position: number;
  values: string[];
}

export interface Product {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ProductVariant[];
  images: ProductImage[];
  options: ProductOption[];
  featured_image_url?: string;
  images_count?: number;
  variants_count?: number;
  price?: number;
  compare_at_price?: number;
  status?: string;
  rating?: number;
  review_count?: number;
  barcode?: string;
  brand?: string;
  category?: string;
  availability?: string;
  condition?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

// API Response types
interface ApiResponse {
  products: Product[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface CacheEntry<T = unknown> {
  data: T;
  expiry: number;
}

interface WorkerMessage {
  type: "result" | "error";
  data?: Product[];
  error?: string;
}

interface WorkerData {
  endpoint: string;
}

// Cache implementation
class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheFile: string;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(cacheFile: string = "./cache.json") {
    this.cacheFile = cacheFile;
    this.loadCache();
  }

  set(key: string, data: unknown, ttl: number = 3600000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
    this.saveCache();
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      this.missCount++;
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.saveCache();
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      this.missCount++;
      return false;
    }

    const hasItem = Date.now() <= item.expiry;
    if (!hasItem) {
      this.missCount++;
    } else {
      this.hitCount++;
    }
    return hasItem;
  }

  get size(): number {
    return this.cache.size;
  }

  get hits(): number {
    return this.hitCount;
  }

  get misses(): number {
    return this.missCount;
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.saveCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, "utf8");
        const entries = JSON.parse(data) as [string, CacheEntry][];
        this.cache = new Map(entries);
      }
    } catch (error) {
      console.warn("Could not load cache:", (error as Error).message);
    }
  }

  private saveCache(): void {
    try {
      const data = JSON.stringify(Array.from(this.cache.entries()));
      fs.writeFileSync(this.cacheFile, data, "utf8");
    } catch (error) {
      console.warn("Could not save cache:", (error as Error).message);
    }
  }
}

// Sanitize filename utility
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
};

// Generate random user agent
const generateRandomUserAgent = () => {
  return new UserAgent({ deviceCategory: "desktop" }).toString();
};

// Worker thread function to process a single endpoint
const processEndpoint = async (
  endpoint: string
): Promise<Record<string, unknown>[]> => {
  const cache = new ResponseCache();
  const hostname = new URL(endpoint).hostname;
  const cacheKey = `products_${sanitizeFilename(hostname)}`;

  // Check cache first
  const cachedData = cache.get<{ products: Record<string, unknown>[] }>(
    cacheKey
  );
  if (cachedData?.products) {
    console.log(`Using cached products for ${endpoint}`);
    return cachedData.products;
  }

  console.log(`Fetching products from ${endpoint}`);
  let allProducts: Record<string, unknown>[] = [];
  let page = 1;
  let hasMorePages = true;
  let retries = 0;

  while (hasMorePages && retries < MAX_RETRIES) {
    try {
      const url = `${endpoint}${
        endpoint.includes("?") ? "&" : "?"
      }page=${page}&limit=${BATCH_SIZE}`;
      console.log(`Fetching page ${page} from ${endpoint}`);

      let products: Record<string, unknown>[] = [];

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
          const data = (await response.json()) as ApiResponse;
          products = (data.products || []) as unknown as Record<
            string,
            unknown
          >[];
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        // If direct request fails, try Puppeteer
        console.log(`Direct request failed, trying Puppeteer for ${url}`);
        products = await fetchWithPuppeteer(url);
      }

      if (products.length === 0) {
        hasMorePages = false;
        break;
      }

      allProducts = [...allProducts, ...products];
      retries = 0;

      // Check if we've reached the last page
      if (products.length < 250) {
        hasMorePages = false;
      } else {
        page++;
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
        );
      }
    } catch (error) {
      console.error(
        `Error fetching page ${page} from ${endpoint}:`,
        (error as Error).message
      );
      retries++;
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_REQUESTS * 2)
      );
    }
  }

  console.log(`Fetched ${allProducts.length} products from ${endpoint}`);

  // Cache the results
  if (allProducts.length > 0) {
    cache.set(cacheKey, { products: allProducts }, 3600000);
  }

  return allProducts;
};

// Fetch with Puppeteer
const fetchWithPuppeteer = async (
  url: string
): Promise<Record<string, unknown>[]> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set random user agent
    await page.setUserAgent(generateRandomUserAgent());

    // Set extra headers to mimic browser behavior
    await page.setExtraHTTPHeaders({
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
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

    let products: Record<string, unknown>[] = [];

    if (jsonMatch?.[1]) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]) as ApiResponse;
        products = (jsonData.products || []) as unknown as Record<
          string,
          unknown
        >[];
      } catch (error) {
        console.warn(
          "Failed to parse JSON from page:",
          (error as Error).message
        );
      }
    }

    // If no products found, try to evaluate JavaScript in the context
    if (products.length === 0) {
      try {
        products = await page.evaluate((): Record<string, unknown>[] => {
          // Type assertion for window properties that may not be defined
          const windowWithProducts = window as unknown as {
            products?: Record<string, unknown>[];
            productData?: { products: Record<string, unknown>[] };
          };

          if (windowWithProducts.products) {
            return windowWithProducts.products;
          }

          if (windowWithProducts.productData?.products) {
            return windowWithProducts.productData.products;
          }

          return [];
        });
      } catch (error) {
        console.warn(
          "Failed to extract products from page context:",
          (error as Error).message
        );
      }
    }

    return products;
  } catch (error) {
    console.error(`Puppeteer error for ${url}:`, (error as Error).message);
    return [];
  } finally {
    await browser.close();
  }
};

// Process and enhance product data
const processProduct = (product: Record<string, unknown>): Product => {
  const variants = (product.variants as ProductVariant[]) || [];
  const images = (product.images as ProductImage[]) || [];

  // Calculate price range
  const prices = variants
    .map((v) => parseFloat(String(v.price)))
    .filter((p) => !Number.isNaN(p));
  const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

  // Calculate compare at price range
  const comparePrices = variants
    .map((v) =>
      v.compare_at_price ? parseFloat(String(v.compare_at_price)) : undefined
    )
    .filter((p): p is number => p !== undefined && !Number.isNaN(p));

  const minComparePrice =
    comparePrices.length > 0 ? Math.min(...comparePrices) : undefined;

  return {
    ...product,
    tags: Array.isArray(product.tags)
      ? (product.tags as string[])
      : String(product.tags || "").split(", ") || [],
    price: minPrice,
    compare_at_price: minComparePrice,
    featured_image_url: images[0]?.src,
    images_count: images.length,
    variants_count: variants.length,
    status: String(product.status || "active"),
    barcode: variants[0]?.barcode,
    brand: String(product.vendor || ""),
    category: String(product.product_type || ""),
    availability: variants.some((v) => v.available)
      ? "in stock"
      : "out of stock",
    condition: "new",
    weight: variants[0]?.weight,
    dimensions: variants[0]?.dimensions,
  } as Product;
};

// Filter products by minimum price
const filterProductsByPrice = (
  products: Product[],
  minPrice: number
): Product[] => {
  const filteredProducts = products.filter((product) => {
    // Handle cases where price might be undefined or null
    const productPrice = product.price || 0;
    return productPrice >= minPrice;
  });

  console.log(
    `Filtered out ${
      products.length - filteredProducts.length
    } products with price < $${minPrice}`
  );
  return filteredProducts;
};

// Classify and write products to files organized by product_type exclusively
const classifyAndWriteProducts = (products: Product[]) => {
  const classified: Record<string, Product[]> = {};

  // Group products by product_type
  products.forEach((product) => {
    const type = product.product_type || "uncategorized";

    if (!classified[type]) {
      classified[type] = [];
    }

    classified[type].push(product);
  });

  console.log(
    `Organizing products into ${Object.keys(classified).length} product types`
  );

  // Write classified products to files
  Object.entries(classified).forEach(([type, products]) => {
    const sanitizedType = sanitizeFilename(type);
    const typeDir = path.join(PRODUCTS_OUTPUT_DIR, sanitizedType);

    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    // Split into batches if necessary
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const filename = path.join(
        typeDir,
        `products${i > 0 ? `_${i / BATCH_SIZE + 1}` : ""}.json`
      );

      fs.writeFileSync(filename, JSON.stringify(batch, null, 2), "utf8");
    }
  });
};

// Main thread logic
const mainThread = async () => {
  console.log(`Starting product fetching with ${MAX_WORKERS} workers...`);
  console.log(`Will filter out products with price < $${MINIMUM_PRICE}`);

  const results: Record<string, unknown>[][] = [];
  const workers: Worker[] = [];

  // Create a worker for each endpoint
  for (const endpoint of ENDPOINTS) {
    const worker = new Worker(__filename, {
      workerData: { endpoint },
    });

    workers.push(worker);

    worker.on("message", (message) => {
      if (message.type === "result") {
        results.push(message.data);
      }
    });

    worker.on("error", (error) => {
      console.error(`Worker error for ${endpoint}:`, error);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Worker for ${endpoint} stopped with exit code ${code}`);
      }
    });
  }

  // Wait for all workers to complete
  await Promise.all(
    workers.map(
      (worker) => new Promise((resolve) => worker.on("exit", resolve))
    )
  );

  const allRawProducts = results.flat();

  console.log(`Total products fetched: ${allRawProducts.length}`);

  if (allRawProducts.length > 0) {
    // Process products
    const allProducts = allRawProducts.map(processProduct);

    // Filter products by minimum price
    const filteredProducts = filterProductsByPrice(allProducts, MINIMUM_PRICE);

    if (filteredProducts.length > 0) {
      classifyAndWriteProducts(filteredProducts);
      console.log(
        "Products classified and written to files organized by product_type"
      );

      // Generate a summary file
      const summary = {
        total_products_fetched: allProducts.length,
        total_products_after_filter: filteredProducts.length,
        products_filtered_out: allProducts.length - filteredProducts.length,
        minimum_price_threshold: MINIMUM_PRICE,
        product_types: Array.from(
          new Set(filteredProducts.map((p) => p.product_type))
        ).length,
        vendors: Array.from(new Set(filteredProducts.map((p) => p.vendor)))
          .length,
        fetched_at: new Date().toISOString(),
        endpoints: ENDPOINTS,
        workers_used: MAX_WORKERS,
        organization: "by_product_type_exclusively",
      };

      fs.writeFileSync(
        path.join(PRODUCTS_OUTPUT_DIR, "summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8"
      );
    } else {
      console.log("No products remained after price filtering");
    }
  } else {
    console.log("No products were fetched");
  }
};

// Worker thread logic
const workerThread = async () => {
  try {
    const { endpoint } = workerData as WorkerData;
    const products = await processEndpoint(endpoint);
    const processedProducts = products.map(processProduct);

    // Write intermediate results per endpoint
    const hostname = new URL(endpoint).hostname;
    fs.writeFileSync(
      path.join(
        PRODUCTS_OUTPUT_DIR,
        `products_${sanitizeFilename(hostname)}.json`
      ),
      JSON.stringify(processedProducts, null, 2),
      "utf8"
    );

    parentPort!.postMessage({
      type: "result",
      data: processedProducts,
    } as WorkerMessage);
  } catch (error) {
    console.error("Worker error:", error);
    parentPort!.postMessage({
      type: "error",
      error: (error as Error).message,
    } as WorkerMessage);
  }
};

// Entry point
if (isMainThread) {
  mainThread().catch(console.error);
} else {
  workerThread().catch(console.error);
}
