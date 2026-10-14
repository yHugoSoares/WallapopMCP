const API_BASE = "https://api.wallapop.com/api/v3";
const HEADERS = {
  "X-DeviceOS": "0",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
};

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

async function get(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wallapop API ${res.status} on ${path}`);
  return res.json();
}

function normalizeItem(it: any): ListingSummary {
  const price = it?.price?.amount ?? it?.price?.cash?.amount ?? null;
  const loc = it?.location;
  const city = loc?.city ?? "";
  const country = loc?.country_code ? ` (${loc.country_code})` : "";
  return {
    id: it.id,
    title: it.title ?? it.title?.original ?? "",
    price,
    currency: it?.price?.currency ?? "EUR",
    location: `${city}${country}`,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
    image: it?.images?.[0]?.urls?.medium ?? it?.images?.[0]?.urls?.small,
    url: it?.share_url ?? `https://wallapop.com/item/${it.slug ?? it.id}`,
    shipping_available: Boolean(it?.supports_shipping ?? it?.shipping?.allowed),
    reserved: Boolean(it?.reserved?.flag),
  };
}

export async function searchListings(p: SearchParams): Promise<{ items: ListingSummary[]; total: number }> {
  const orderMap: Record<string, string> = {
    newest: "newest",
    closest: "closest",
    most_relevance: "most_relevance",
    price_low_to_high: "price_low_to_high",
    price_high_to_low: "price_high_to_low",
  };
  const data = await get("/search", {
    source: "search_box",
    keywords: p.query ?? "",
    latitude: p.latitude ?? 40.4168,
    longitude: p.longitude ?? -3.7038,
    distance_in_km: p.radius_km,
    min_sale_price: p.min_price,
    max_sale_price: p.max_price,
    category_id: p.category_id,
    order_by: p.order_by ? orderMap[p.order_by] : "most_relevance",
  });
  let items: any[] =
    data?.data?.section?.payload?.items ??
    data?.section?.payload?.items ??
    [];
  // fallback: older shape { search_objects: [...] }
  if (!items.length && Array.isArray(data?.search_objects)) items = data.search_objects;
  if (!items.length && Array.isArray(data?.data)) items = data.data;
  const out = items
    .filter((it) => !it?.reserved?.flag)
    .map(normalizeItem)
    .slice(0, p.limit ?? 20);
  return { items: out, total: out.length };
}

export function parseListingId(input: string): string {
  // accept raw id, slug, or full URL
  const m = input.match(/([a-z0-9]{12,13})(?:[/?#]|$)/i);
  if (m) return m[1];
  return input.trim();
}

export async function getListing(idOrUrl: string): Promise<any> {
  const id = parseListingId(idOrUrl);
  const d = await get(`/items/${id}`, {});
  return {
    id: d.id,
    title: d.title?.original ?? d.title,
    description: d.description?.original ?? d.description ?? "",
    price: d.price?.amount ?? d.price?.cash?.amount ?? null,
    currency: d.price?.currency ?? "EUR",
    category: (d.taxonomy ?? []).map((t: any) => ({ id: t.id, name: t.name })),
    location: d.location,
    images: (d.images ?? []).map((i: any) => i.urls?.big ?? i.urls?.medium),
    shipping: d.shipping,
    supports_shipping: d.supports_shipping,
    counters: d.counters,
    characteristics: d.characteristics_details ?? d.characteristics,
    seller_id: d.user?.id,
    url: d.share_url ?? `https://wallapop.com/item/${d.slug}`,
    slug: d.slug,
  };
}

export async function getSeller(userId: string): Promise<any> {
  const id = parseListingId(userId);
  return get(`/users/${id}`, {});
}

export async function listCategories(): Promise<any[]> {
  const d = await get("/categories", {});
  return d.categories ?? d;
}

export async function searchLocation(query: string, limit = 5): Promise<any[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "es,it,pt");
  const res = await fetch(url, { headers: { "User-Agent": "wallapop-mcp/0.1" } });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const arr = (await res.json()) as any[];
  return arr.map((r) => ({
    name: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
  }));
}
