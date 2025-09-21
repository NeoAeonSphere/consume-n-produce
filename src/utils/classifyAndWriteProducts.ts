import * as fs from "node:fs";
import * as path from "path";
import { OUTPUT_DIR, BATCH_SIZE } from "../types/constants";
import { Product } from "../types/types";
import { sanitizeFileName } from "./sanitizeFileName";

// Classify and write products to files
export const classifyAndWriteProducts = (products: Product[]) => {
  const classified: Record<string, Record<string, Product[]>> = {};

  products.forEach(product => {
    const type = product.product_type || 'uncategorized';
    const vendor = product.vendor || 'unknown';

    if (!classified[type]) classified[type] = {};
    if (!classified[type][vendor]) classified[type][vendor] = [];

    classified[type][vendor].push(product);
  });

  // Write classified products to files
  Object.entries(classified).forEach(([type, vendors]) => {
    const sanitizedType = sanitizeFileName(type);
    const typeDir = path.join(OUTPUT_DIR, sanitizedType);

    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    Object.entries(vendors).forEach(([vendor, products]) => {
      const sanitizedVendor = sanitizeFileName(vendor);
      const baseFilename = path.join(typeDir, sanitizedVendor);

      // Split into batches if necessary
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const filename = `${baseFilename}${i > 0 ? `_${i/BATCH_SIZE + 1}` : ''}.json`;

        fs.writeFileSync(
          filename,
          JSON.stringify(batch, null, 2),
          'utf8'
        );
      }
    });
  });
};
