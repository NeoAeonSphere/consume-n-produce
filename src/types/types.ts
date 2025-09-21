
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
	dimensions?: ProductDimensions;
}

export interface ProductDimensions {
	length?: number;
	width?: number;
	height?: number;
}
