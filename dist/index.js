#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { searchListings, getListing, getSeller, listCategories, searchLocation, } from "./wallapop.js";
const server = new McpServer({ name: "wallapop", version: "0.1.0" });
// ---------- search ----------
server.tool("wallapop_search_listings", "Search Wallapop listings by query, location, and filters", {
    query: z.string().describe("Search keywords, e.g. 'iphone 14', 'bici montaña'"),
    latitude: z.number().optional().describe("Search center latitude (default Madrid 40.4168)"),
    longitude: z.number().optional().describe("Search center longitude (default -3.7038)"),
    radius_km: z.number().optional().describe("Radius in km"),
    min_price: z.number().optional(),
    max_price: z.number().optional(),
    category_id: z.string().optional().describe("Wallapop category id, e.g. 24200"),
    order_by: z.enum(["newest", "closest", "most_relevance", "price_low_to_high", "price_high_to_low"]).optional(),
    limit: z.number().min(1).max(40).default(20),
}, async (p) => ({ content: [{ type: "text", text: JSON.stringify(await searchListings(p), null, 2) }] }));
server.tool("wallapop_get_listing", "Get full details for a Wallapop listing by id, slug or URL", { listing_id: z.string().describe("Listing id, slug, or full wallapop.com/item/... URL") }, async ({ listing_id }) => ({
    content: [{ type: "text", text: JSON.stringify(await getListing(listing_id), null, 2) }],
}));
server.tool("wallapop_get_seller", "Get seller profile by user id", { seller_id: z.string() }, async ({ seller_id }) => ({
    content: [{ type: "text", text: JSON.stringify(await getSeller(seller_id), null, 2) }],
}));
server.tool("wallapop_list_categories", "List Wallapop category tree (ids + names)", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify(await listCategories(), null, 2).slice(0, 20000) }],
}));
server.tool("wallapop_search_location", "Geocode a city/town name to coordinates for search_listings", { query: z.string().describe("e.g. 'Dedham MA', 'Valencia', 'Barcelona'") }, async ({ query }) => ({
    content: [{ type: "text", text: JSON.stringify(await searchLocation(query), null, 2) }],
}));
server.tool("wallapop_compare_prices", "Compare median prices for a query across multiple cities", {
    query: z.string(),
    cities: z.array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number() })).describe("Cities to compare"),
    limit: z.number().min(1).max(40).default(20),
}, async ({ query, cities, limit }) => {
    const out = [];
    for (const c of cities) {
        const r = await searchListings({ query, latitude: c.latitude, longitude: c.longitude, limit });
        const prices = r.items.map((i) => i.price).filter((x) => typeof x === "number");
        prices.sort((a, b) => a - b);
        const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
        out.push({ city: c.name, count: r.items.length, median_price: median, min: prices[0] ?? null, max: prices[prices.length - 1] ?? null });
    }
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});
// ---------- monitors (file-based) ----------
const MON_FILE = path.join(process.cwd(), ".monitors.json");
function loadMonitors() {
    try {
        return JSON.parse(fs.readFileSync(MON_FILE, "utf8"));
    }
    catch {
        return [];
    }
}
function saveMonitors(m) {
    fs.writeFileSync(MON_FILE, JSON.stringify(m, null, 2));
}
server.tool("wallapop_monitor_search", "Save a search as a monitor to track new listings over time", {
    name: z.string(),
    query: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radius_km: z.number().optional(),
    min_price: z.number().optional(),
    max_price: z.number().optional(),
    category_id: z.string().optional(),
}, async (p) => {
    const monitors = loadMonitors();
    const r = await searchListings({ ...p, limit: 20 });
    const existing = monitors.findIndex((m) => m.name === p.name);
    const mon = { ...p, seen_ids: r.items.map((i) => i.id) };
    if (existing >= 0)
        monitors[existing] = mon;
    else
        monitors.push(mon);
    saveMonitors(monitors);
    return { content: [{ type: "text", text: `Monitor '${p.name}' saved. ${r.items.length} baseline listings tracked.` }] };
});
server.tool("wallapop_list_monitors", "List all saved search monitors", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify(loadMonitors(), null, 2) }],
}));
server.tool("wallapop_check_monitors", "Check saved monitors for new listings since last check", { monitor_name: z.string().optional() }, async ({ monitor_name }) => {
    const monitors = loadMonitors().filter((m) => !monitor_name || m.name === monitor_name);
    const fresh = [];
    for (const m of monitors) {
        const r = await searchListings({ ...m, limit: 20 });
        const seen = new Set(m.seen_ids);
        const isNew = r.items.filter((i) => !seen.has(i.id));
        if (isNew.length)
            fresh.push({ monitor: m.name, new_count: isNew.length, items: isNew });
        m.seen_ids = r.items.map((i) => i.id);
    }
    const all = loadMonitors();
    for (const m of monitors) {
        const i = all.findIndex((x) => x.name === m.name);
        if (i >= 0)
            all[i] = m;
    }
    saveMonitors(all);
    return { content: [{ type: "text", text: JSON.stringify(fresh, null, 2) }] };
});
server.tool("wallapop_delete_monitor", "Delete a saved search monitor", { name: z.string() }, async ({ name }) => {
    saveMonitors(loadMonitors().filter((m) => m.name !== name));
    return { content: [{ type: "text", text: `Monitor '${name}' deleted.` }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
