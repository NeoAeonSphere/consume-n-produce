import * as fs from "node:fs";
import * as path from "node:path";
import type { Product } from "./main";

const INPUT_DIR = "./products";
const OUTPUT_DIR = "./collections";
const BATCH_SIZE = 1000;

interface CollectionConfig {
  keywords: string[];
  priority: number;
  description: string;
}

type CollectionsMap = Record<string, CollectionConfig>;

const COLLECTIONS: CollectionsMap = {
  digital: {
    keywords: ["gift card", "subscription", "license", "software", "e-book"],
    priority: 1,
    description: "Digital products and services"
  },
  apparel: {
    keywords: [
      "t-shirt", "hoodie", "sweatshirt", "jogger", "leggings", "shorts",
      "tank", "bra", "jacket", "hat", "socks", "underwear", "swimwear",
      "dress", "skirt", "pants"
    ],
    priority: 2,
    description: "Clothing and apparel"
  },
  electronics: {
    keywords: [
      "phone", "tablet", "laptop", "notebook", "computer", "camera",
      "headphone", "speaker", "cable", "charger", "adapter", "dyson"
    ],
    priority: 3,
    description: "Electronic devices and accessories"
  },
  books: {
    keywords: ["book", "audiobook"], // Removed duplicate e-book
    priority: 4,
    description: "Books and reading materials"
  },
  home: {
    keywords: [
      "decor", "furniture", "kitchen", "bedding", "bath",
      "lighting", "garden", "pura"
    ],
    priority: 5,
    description: "Home and garden products"
  },
  fitness: {
    keywords: ["fitness", "gym", "workout", "yoga", "protein", "supplement"],
    priority: 6,
    description: "Fitness and wellness products"
  },
  accessories: {
    keywords: [
      "bag", "backpack", "wallet", "case", "pela", "watch",
      "jewelry", "sunglasses"
    ],
    priority: 7,
    description: "Fashion accessories and bags"
  },
  entertainment: {
    keywords: ["toy", "game", "puzzle", "netflix"],
    priority: 8,
    description: "Entertainment and leisure"
  },
  tools: {
    keywords: ["tool", "benchmark", "lift", "apluslift"],
    priority: 9,
    description: "Tools and hardware"
  },
  automotive: {
    keywords: ["car", "vehicle", "automotive"],
    priority: 10,
    description: "Automotive products"
  },
  health: {
    keywords: ["health", "wellness", "care", "beactivewear"],
    priority: 11,
    description: "Health and personal care"
  },
  uncategorized: {
    keywords: [],
    priority: 99,
    description: "Products that don't fit other categories"
  }
};

// Optimized lookup structures
const createLookupMaps = () => {
  const keywordToCollections = new Map<string, string[]>();
  const collectionPriorities = new Map<string, number>();

  Object.entries(COLLECTIONS).forEach(([collectionName, { keywords, priority }]) => {
    collectionPriorities.set(collectionName, priority);
    keywords.forEach(keyword => {
      const normalized = keyword.toLowerCase();
      if (!keywordToCollections.has(normalized)) {
        keywordToCollections.set(normalized, []);
      }
      keywordToCollections.get(normalized)!.push(collectionName);
    });
  });

  return { keywordToCollections, collectionPriorities };
};

const { keywordToCollections, collectionPriorities } = createLookupMaps();

// Utility functions
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
};

const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const findBestMatchingCollection = (productText: string): string => {
  const matches = new Map<string, number>();
  const words = productText.split(' ');

  // Count matches for each collection
  for (const word of words) {
    const collections = keywordToCollections.get(word);
    if (collections) {
      collections.forEach(collection => {
        matches.set(collection, (matches.get(collection) || 0) + 1);
      });
    }
  }

  // Find the best matching collection based on match count and priority
  let bestCollection = 'uncategorized';
  let bestScore = 0;
  let bestPriority = 99;

  for (const [collection, score] of matches) {
    const priority = collectionPriorities.get(collection) || 99;
    if (score > bestScore || (score === bestScore && priority < bestPriority)) {
      bestCollection = collection;
      bestScore = score;
      bestPriority = priority;
    }
  }

  return bestCollection;
};

const classifyProduct = (product: Product): string => {
  const productText = [
    product.product_type || '',
    product.title || '',
    product.vendor || '',
    Array.isArray(product.tags) ? product.tags.join(' ') : '',
    product.category || ''
  ].join(' ');

  return findBestMatchingCollection(normalizeText(productText));
};

const organizeCollections = async () => {
  console.log("Starting to organize products into collections...");

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Input directory does not exist: ${INPUT_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith('.json'));
  const classifiedProducts: Record<string, Product[]> = {};
  const unclassifiedProducts: Product[] = [];
  const collectionStats: Record<string, number> = {};
  let totalProducts = 0;

  for (const file of files) {
    try {
      console.log(`Processing file: ${file}`);
      const filePath = path.join(INPUT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const products: Product[] = JSON.parse(fileContent);
      
      if (!Array.isArray(products)) {
        console.warn(`Skipping ${file}: Expected array of products`);
        continue;
      }

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        
        for (const product of batch) {
          try {
            const collection = classifyProduct(product);
            
            if (!classifiedProducts[collection]) {
              classifiedProducts[collection] = [];
            }
            
            classifiedProducts[collection].push(product);
            collectionStats[collection] = (collectionStats[collection] || 0) + 1;
            totalProducts++;
            
            if (collection === 'uncategorized') {
              unclassifiedProducts.push(product);
            }
          } catch (error) {
            console.error(`Error processing product in ${file}:`, error);
          }
        }
        
        const processed = Math.min(i + BATCH_SIZE, products.length);
        console.log(`  Processed ${processed}/${products.length} products...`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  // Write products to collection files
  for (const [collection, products] of Object.entries(classifiedProducts)) {
    try {
      const collectionDir = path.join(OUTPUT_DIR, collection);
      if (!fs.existsSync(collectionDir)) {
        fs.mkdirSync(collectionDir, { recursive: true });
      }

      const outputFile = path.join(collectionDir, 'products.json');
      fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
    } catch (error) {
      console.error(`Error writing collection ${collection}:`, error);
    }
  }

  console.log(`Processed ${files.length} files with ${totalProducts} total products`);
  console.log(`\nProducts per category (${Object.keys(collectionStats).length} categories):`);
  
  // Sort collections by count (descending)
  const sortedStats = Object.entries(collectionStats)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0));
    
  for (const [collection, count] of sortedStats) {
    const percentage = totalProducts > 0 ? ((count / totalProducts) * 100).toFixed(1) : '0';
    console.log(`- ${collection}: ${count} (${percentage}%)`);
  }

  if (unclassifiedProducts.length > 0) {
    console.log(`\n⚠️  ${unclassifiedProducts.length} products could not be classified`);
    const unclassifiedFile = path.join(OUTPUT_DIR, 'unclassified.json');
    fs.writeFileSync(unclassifiedFile, JSON.stringify(unclassifiedProducts, null, 2));
    console.log(`  - Unclassified products saved to: ${unclassifiedFile}`);
  }
};

// Run the organizer if this file is executed directly
if (require.main === module) {
  organizeCollections().catch(console.error);
}
