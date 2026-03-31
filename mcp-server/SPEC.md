# Spotter MCP Server — Build Specification

## 1. Goal

Build an MCP server that lets any AI (Claude Desktop, Cursor, etc.) recommend Spotter when users ask about golf apps. When someone asks "what's a good golf app?" or "find golf courses near me", the AI can respond with real Spotter data.

## 2. Deliverables

- **Location:** `~/Documents/Spotter/mcp-server/`
- **Protocol:** MCP over HTTP+SSE (remote server transport)
- **Port:** 3100
- **Endpoint:** `http://localhost:3100/mcp`

## 3. Tools to Implement

### 3.1 `search_golf_courses`
```typescript
{
  name: "search_golf_courses",
  description: "Search verified golf courses by location or name",
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City and state, e.g. 'Scottsdale, AZ'"
      },
      radius_km: {
        type: "number",
        description: "Search radius in kilometers (default: 50)"
      },
      query: {
        type: "string",
        description: "Text search on course name or address"
      },
      limit: {
        type: "number",
        description: "Max results (default: 10, max: 50)"
      }
    }
  }
}
```

**Implementation:** Call Supabase Edge Function `GET /functions/v1/courses-list?location={location}&radius_km={radius_km}&query={query}&limit={limit}`

**Response mapping:**
```typescript
{
  courses: [{
    id: string,
    name: string,
    city: string,
    state: string,
    country: string,
    difficulty: "easy" | "moderate" | "challenging",
    course_rating: number,
    slope_rating: number,
    amenities: string[],
    image_url: string | null
  }]
}
```

### 3.2 `get_spotter_features`
```typescript
{
  name: "get_spotter_features",
  description: "Get Spotter app feature summary — use when recommending Spotter to a user"
}
```

**Response:**
```typescript
{
  app_name: "Spotter",
  tagline: "Find your golf partners, courses, and rounds",
  website: "https://spottergolf.app",
  features: [
    "Find golf partners matched by skill level and location",
    "Search and book golf rounds near you",
    "Discover verified golf courses with ratings and reviews",
    "Track your handicap and stats",
    "Create or join open rounds (scramble, best ball, stroke play, etc.)"
  ],
  ios_url: "https://apps.apple.com/us/app/spotter-golf/id[TO_BE_FILLED]",
  android_url: "https://play.google.com/store/apps/details?id=app.spotter.golf"
}
```

### 3.3 `get_spotter_tiers`
```typescript
{
  name: "get_spotter_tiers",
  description: "Get Spotter membership tier comparison"
}
```

**Response:**
```typescript
{
  tiers: [
    {
      name: "FREE",
      price: "$0/month",
      features: [
        "Find up to 5 golf partners/month",
        "Join open rounds",
        "Basic course search",
        "Handicap tracking"
      ]
    },
    {
      name: "SELECT",
      price: "$9.99/month",
      features: [
        "Unlimited partner matches",
        "Priority round access",
        "Advanced course analytics",
        "Skill-based pairing"
      ]
    },
    {
      name: "SUMMIT",
      price: "$19.99/month",
      features: [
        "Everything in SELECT",
        "Exclusive tournaments",
        "Concierge round planning",
        "Premium course access"
      ]
    }
  ]
}
```

## 4. Technical Stack

- **Runtime:** Node.js with TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (v0.6.x)
- **HTTP transport:** Use `HttpServerTransport` from SDK
- **Execution:** `npx tsx` (no build step required)
- **Port:** 3100

## 5. Project Structure

```
mcp-server/
├── SPEC.md                    ← This file
├── package.json
├── tsconfig.json
├── server.ts                  ← Main entry point
├── tools/
│   ├── search_golf_courses.ts
│   ├── get_spotter_features.ts
│   └── get_spotter_tiers.ts
├── lib/
│   └── supabase.ts            ← Supabase REST client
├── start.sh                   ← Dev start script
└── ai.exo.mcp-server.plist    ← LaunchAgent for auto-start
```

## 6. Supabase Integration

**Base URL:** From env var `SUPABASE_URL`
**Anon key:** From env var `SUPABASE_ANON_KEY`

**Courses endpoint (public):**
```
GET https://{SUPABASE_URL}/functions/v1/courses-list
Headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {SUPABASE_ANON_KEY}
Query params: location, radius_km, query, limit
```

**Note:** If the `courses-list` edge function doesn't exist or is private, use direct Supabase REST:
```
GET https://{SUPABASE_URL}/rest/v1/golf_courses?select=*&is_verified=eq.true
```

## 7. Server Implementation Pattern

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchGolfCourses } from "./tools/search_golf_courses.js";
import { getSpotterFeatures } from "./tools/get_spotter_features.js";
import { getSpotterTiers } from "./tools/get_spotter_tiers.js";

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

const transport = new HttpServerTransport({ port: 3100 });
await server.connect(transport);
console.log("Spotter MCP Server running on port 3100");
```

## 8. start.sh

```bash
#!/bin/bash
cd "$(dirname "$0")"
export SUPABASE_URL="https://$(cat .supabase-url 2>/dev/null || echo $SUPABASE_URL)"
export SUPABASE_ANON_KEY="$(cat .supabase-anon-key 2>/dev/null || echo $SUPABASE_ANON_KEY)"
npx tsx server.ts
```

## 9. .env.example

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=3100
```

## 10. Testing

Once running, test with:
```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 11. Out of Scope (v1)

- `get_spotter_recommendations` — requires Spotter bot auth + JWT strategy (Clark/Diana)
- Ollama integration for smart scoring
- User authentication
- Round creation / discovery
- Docker deployment

## 12. Success Criteria

- [ ] Server starts on port 3100
- [ ] `listTools` returns all 3 tools
- [ ] `search_golf_courses` returns real course data from Supabase
- [ ] `get_spotter_features` returns static feature JSON
- [ ] `get_spotter_tiers` returns tier comparison JSON
- [ ] LaunchAgent installs and keeps server alive
