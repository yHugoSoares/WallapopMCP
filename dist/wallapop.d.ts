export interface SearchParams {
    query?: string;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    min_price?: number;
    max_price?: number;
    category_id?: string;
    order_by?: "newest" | "closest" | "most_relevance" | "price_low_to_high" | "price_high_to_low";
    limit?: number;
}
export interface ListingSummary {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    location: string;
    latitude?: number;
    longitude?: number;
    image?: string;
    url: string;
    shipping_available: boolean;
    reserved: boolean;
}
export declare function searchListings(p: SearchParams): Promise<{
    items: ListingSummary[];
    total: number;
}>;
export declare function parseListingId(input: string): string;
export declare function getListing(idOrUrl: string): Promise<any>;
export declare function getSeller(userId: string): Promise<any>;
export declare function listCategories(): Promise<any[]>;
export declare function searchLocation(query: string, limit?: number): Promise<any[]>;
