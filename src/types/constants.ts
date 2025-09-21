import * as os from "node:os";

export const ENDPOINTS = [
  "https://pura.com/products.json",
  "https://apluslift.com/products.json",
  "https://pelacase.com/products.json",
  "https://mobiledirectonline.co.uk/products.json",
  "https://benchmarktooling.com/products.json",
  "https://gymshark.com/products.json",
  "https://www.allbirds.com/products.json",
  "https://www.netflix.shop/products.json",
  "https://www.beactivewear.com.au/products.json",
  "https://overstock.com/products.json",
  "https://beingshipped.com/products.json",
  "https://tecisoft.com/products.json"
];

export const OUTPUT_DIR = "./products";
export const BATCH_SIZE = 250;
export const DELAY_BETWEEN_REQUESTS = 100;
export const MAX_RETRIES = 3;
export const TIMEOUT = 3000;
export const MAX_CONCURRENT_PAGES = 8;
export const MAX_WORKERS = Math.max(1, os.cpus().length - 1);
