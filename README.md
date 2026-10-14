# Wallapop MCP

MCP server (scraper) for Wallapop marketplace. No API key needed — uses the public `api.wallapop.com` endpoints.

## Tools

| Tool | Description |
|---|---|
| `wallapop_search_listings` | Search by query, lat/lon, radius, price, category, sort |
| `wallapop_get_listing` | Full details by id, slug or URL |
| `wallapop_get_seller` | Seller profile by user id |
| `wallapop_list_categories` | Category tree with ids |
| `wallapop_search_location` | Geocode city → lat/lon (via Nominatim) |
| `wallapop_compare_prices` | Median/min/max per city |
| `wallapop_monitor_search` / `wallapop_list_monitors` / `wallapop_check_monitors` / `wallapop_delete_monitor` | Track new listings (stored in `.monitors.json`) |

## Run

```bash
npm install && npm run build
node dist/index.js
```

## Add to Claude Code / opencode

```json
{
  "mcpServers": {
    "wallapop": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/WallapopMCP/dist/index.js"]
    }
  }
}
```

## Examples

Search near Valencia:
```
wallapop_search_location(query="Valencia")  → lat/lon
wallapop_search_listings(query="bici montaña", latitude=39.4699, longitude=-0.3763, max_price=200, order_by="closest")
wallapop_get_listing(listing_id="w67vww5r5w6x")
```
