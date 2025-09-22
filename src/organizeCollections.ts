import * as fs from "node:fs";
import * as path from "node:path";
import { Product } from "./main";

const INPUT_DIR = "./products";
const OUTPUT_DIR = "./collections";

// Define your collection mappings here
const COLLECTIONS: Record<string, string[]> = {
  digital: ["gift card", "subscription", "license", "software", "e-book"],
  apparel: [
    "t-shirt",
    "hoodie",
    "sweatshirt",
    "jogger",
    "leggings",
    "shorts",
    "tank",
    "bra",
    "jacket",
    "hat",
    "socks",
    "underwear",
    "swimwear",
    "dress",
    "skirt",
    "pants",
  ],
  electronics: [
    "phone",
    "tablet",
    "laptop",
    "notebook",
    "computer",
    "camera",
    "headphone",
    "speaker",
    "cable",
    "charger",
    "adapter",
    "dyson",
  ],
  books: ["book", "e-book", "audiobook"],
  home: [
    "decor",
    "furniture",
    "kitchen",
    "bedding",
    "bath",
    "lighting",
    "garden",
    "pura",
  ],
  fitness: ["fitness", "gym", "workout", "yoga", "protein", "supplement"],
  accessories: [
    "bag",
    "backpack",
    "wallet",
    "case",
    "pela",
    "watch",
    "jewelry",
    "sunglasses",
  ],
  toys: ["toy", "game", "puzzle", "netflix"],
  tools: ["tool", "benchmark", "lift", "apluslift"],
  auto: ["car", "vehicle", "automotive"],
  health: ["health", "wellness", "care", "beactivewear"],
  uncategorized: [],
};

const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
};

const classifyProduct = (product: Product): string => {
  const productText = `${product.product_type.toLowerCase()} ${product.title.toLowerCase()} ${product.tags.join(
    " "
  )}`;

  for (const collection in COLLECTIONS) {
    for (const keyword of COLLECTIONS[collection]) {
      if (productText.includes(keyword)) {
        return collection;
      }
    }
  }

  return "uncategorized";
};

const organizeCollections = async () => {
  console.log("Starting to organize products into collections...");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const productFiles = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.startsWith("products_") && file.endsWith(".json"));

  let allProducts: Product[] = [];
  for (const file of productFiles) {
    const filePath = path.join(INPUT_DIR, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    try {
      const products = JSON.parse(fileContent);
      if (Array.isArray(products)) {
        allProducts.push(...products);
      } else {
        console.warn(`Skipping non-array JSON file: ${file}`);
      }
    } catch (error) {
      console.error(`Error parsing JSON from ${file}:`, error);
    }
  }

  console.log(
    `Loaded ${allProducts.length} products from ${productFiles.length} files.`
  );

  const classifiedProducts: Record<string, Product[]> = {};
  const unclassifiedProducts: Product[] = [];

  for (const product of allProducts) {
    const collection = classifyProduct(product);
    if (collection === "uncategorized") {
      unclassifiedProducts.push(product);
    }
    if (!classifiedProducts[collection]) {
      classifiedProducts[collection] = [];
    }
    classifiedProducts[collection].push(product);
  }

  for (const collection in classifiedProducts) {
    const collectionDir = path.join(OUTPUT_DIR, collection);
    if (!fs.existsSync(collectionDir)) {
      fs.mkdirSync(collectionDir, { recursive: true });
    }

    for (const product of classifiedProducts[collection]) {
      const productFileName = `${sanitizeFilename(product.handle)}.json`;
      const productFilePath = path.join(collectionDir, productFileName);
      fs.writeFileSync(
        productFilePath,
        JSON.stringify(product, null, 2),
        "utf-8"
      );
    }
  }

  console.log(
    `Organized products into ${
      Object.keys(classifiedProducts).length
    } collections.`
  );

  if (unclassifiedProducts.length > 0) {
    console.log(
      `${unclassifiedProducts.length} products could not be classified.`
    );
    const unclassifiedDir = path.join(OUTPUT_DIR, "uncategorized");
    if (!fs.existsSync(unclassifiedDir)) {
      fs.mkdirSync(unclassifiedDir, { recursive: true });
    }
    for (const product of unclassifiedProducts) {
      const productFileName = `${sanitizeFilename(product.handle)}.json`;
      const productFilePath = path.join(unclassifiedDir, productFileName);
      fs.writeFileSync(
        productFilePath,
        JSON.stringify(product, null, 2),
        "utf-8"
      );
    }
  }
};

organizeCollections().catch(console.error);
