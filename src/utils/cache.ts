import * as fs from "node:fs";

export interface CacheItem {
  data: unknown;
  expiry: number;
}

export class ResponseCache {
  private cache: Map<string, CacheItem> = new Map();
  private cacheFile: string;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(cacheFile: string = "./cache.json") {
    this.cacheFile = cacheFile;
    this.loadCache();
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
  set(key: string, data: any, ttl: number = 3600000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
    this.saveCache();
  }

  get(key: string): any | null {
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
    return item.data;
  }
  has(key: string): boolean {
    const hasItem =
      this.cache.has(key) && Date.now() <= this.cache.get(key)!.expiry;
    if (!hasItem) {
      this.missCount++;
    } else {
      this.hitCount++;
    }
    return hasItem;
  }
  private loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, "utf8");
        this.cache = new Map(JSON.parse(data));
      }
    } catch (error: any) {
      console.warn("Could not load cache:", error.message);
    }
  }

  private saveCache() {
    try {
      const data = JSON.stringify(Array.from(this.cache.entries()));
      fs.writeFileSync(this.cacheFile, data, "utf8");
    } catch (error: any) {
      console.warn("Could not save cache:", error.message);
    }
  }
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.saveCache();
  }
}

export const cache = new ResponseCache();
