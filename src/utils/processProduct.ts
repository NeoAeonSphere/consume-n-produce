import { Product } from "../types/types";

export const processProduct = (product: any): Product => {
  const variants = product.variants || [];
  const images = product.images || [];

  // Calculate price range
  const prices = variants.map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p));
  const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

  // Calculate compare at price range
  const comparePrices = variants
    .map((v: any) => v.compare_at_price ? parseFloat(v.compare_at_price) : undefined)
    .filter((p: number | undefined) => p !== undefined && !isNaN(p)) as number[];

  const minComparePrice = comparePrices.length > 0 ? Math.min(...comparePrices) : undefined;

  return {
    ...product,
    tags: Array.isArray(product.tags) ? product.tags : product.tags?.split(', ') || [],
    price: minPrice,
    compare_at_price: minComparePrice,
    featured_image_url: images[0]?.src,
    images_count: images.length,
    variants_count: variants.length,
    status: product.status || 'active',
    barcode: variants[0]?.barcode,
    brand: product.vendor,
    category: product.product_type,
    availability: variants.some((v: any) => v.available) ? 'in stock' : 'out of stock',
    condition: 'new',
    weight: variants[0]?.weight,
    dimensions: variants[0] ? {
      length: variants[0].length,
      width: variants[0].width,
      height: variants[0].height,
    } : undefined,
  };
};
