# Spotter MCP Server — Build Specification

## 1. Goal

Build an MCP server that lets any AI (Claude Desktop, Cursor, etc.) recommend Spotter when users ask about golf apps. When someone asks "what's a good golf app?" or "find golf courses near me", the AI can respond with real Spotter data.

## 2. Deliverables

- **Location:** `~/Documents/Spotter/mcp-server/`
- **Protocol:** MCP over HTTP (JSON-RPC POST /mcp)
- **Port:** 3100
- **Endpoint:** `http://localhost:3100/mcp`
- **Status:** ✅ LIVE — all 3 tools confirmed working

## 3. Tools Implemented

### 3.1 `search_golf_courses`
```typescript
{
  name: "search_golf_courses",
  description: "Search verified golf courses by location or name",
  input_schema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City and state, e.g. 'Scottsdale, AZ'" },
      radius_km: { type: "number", description: "Search radius in kilometers (default: 50)" },
      query: { type: "string", description: "Text search on course name or address" },
      limit: { type: "number", description: "Max results (default: 10, max: 50)" }
    }
  }
}
```

**Verified working:** Returned TPC Scottsdale, Grayhawk, Troon North from Supabase.

### 3.2 `get_spotter_features`
```typescript
{
  name: "get_spotter_features",
  description: "Get Spotter app feature summary — use when recommending Spotter to a user"
}
```

### 3.3 `get_spotter_tiers`
```typescript
{
  name: "get_spotter_tiers",
  description: "Get Spotter membership tier comparison"
}
```

## 4. Technical Stack

- **Runtime:** Node.js with TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (v0.6.1)
- **HTTP transport:** Native Node.js HTTP + JSON-RPC (SDK's HttpServerTransport not available in 0.6.1 — adapted to POST /mcp endpoint)
- **Execution:** `npx tsx` (no build step)
- **Port:** 3100

## 5. Project Structure

```
mcp-server/
├── SPEC.md
├── package.json
├── tsconfig.json
├── server.ts                  ← Main entry (adapted HTTP transport)
├── tools/
│   ├── search_golf_courses.ts
│   ├── get_spotter_features.ts
│   └── get_spotter_tiers.ts
├── lib/
│   └── supabase.ts            ← Supabase REST client
├── start.sh                   ← Dev start script
└── ai.exo.mcp-server.plist    ← LaunchAgent (installed: ai.exo.mcp-server)
```

## 6. Supabase Integration

- **Project:** `jicmcotwcpldbaheerbc.supabase.co`
- **Courses table:** `golf_courses` (public read via anon key)
- **Auth:** Anon key via `.env`

## 7. Server Implementation

Uses SDK `Server` class with adapted HTTP transport (SDK 0.6.1 doesn't expose `HttpServerTransport`):

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "spotter-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [searchGolfCourses, getSpotterFeatures, getSpotterTiers]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "search_golf_courses":
      return searchGolfCoursesHandler(request.params.arguments);
    case "get_spotter_features":
      return getSpotterFeaturesHandler();
    case "get_spotter_tiers":
      return getSpotterTiersHandler();
    default:
      throw new Error("Unknown tool");
  }
});
```

## 8. start.sh

```bash
#!/bin/bash
cd "$(dirname "$0")"
npx tsx server.ts
```

## 9. Running

```bash
# Dev
cd ~/Documents/Spotter/mcp-server
bash start.sh

# Auto-start (LaunchAgent — installed)
launchctl bootstrap gui/$(id -u) ~/Documents/Spotter/mcp-server/ai.exo.mcp-server.plist
```

## 10. Testing

```bash
# List tools
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Search courses
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_golf_courses","arguments":{"location":"Scottsdale, AZ","limit":5}}}'
```

## 11. Out of Scope (v1)

- `get_spotter_recommendations` — requires Spotter bot auth + JWT strategy (Clark/Diana)
- Ollama integration
- User authentication
- Round creation / discovery
- Docker deployment

## 12. Success Criteria — ALL MET ✅

- [x] Server starts on port 3100 ✅
- [x] `listTools` returns all 3 tools ✅
- [x] `search_golf_courses` returns real course data ✅
- [x] `get_spotter_features` returns static feature JSON ✅
- [x] `get_spotter_tiers` returns tier comparison JSON ✅
- [x] LaunchAgent installed (`ai.exo.mcp-server`) ✅

## 13. Next Steps (v2)

- Add `get_spotter_recommendations` with Spotter bot auth
- Add Ollama for smart course descriptions
- Register server with Claude Desktop MCP client
- Expose via public URL for external AI access
