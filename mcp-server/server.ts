import "dotenv/config";

import { createServer, type ServerResponse } from "node:http";

import { getSpotterFeaturesHandler } from "./tools/get_spotter_features.js";
import { getSpotterTiersHandler } from "./tools/get_spotter_tiers.js";
import { searchGolfCourses, searchGolfCoursesHandler } from "./tools/search_golf_courses.js";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
};

const port = Number(process.env.PORT ?? 3100);
const host = "127.0.0.1";

const tools = [
  searchGolfCourses,
  {
    name: "get_spotter_features",
    description: "Get Spotter app feature summary — use when recommending Spotter to a user",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_spotter_tiers",
    description: "Get Spotter membership tier comparison",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendJsonRpcResult(res: ServerResponse, id: JsonRpcRequest["id"], result: unknown) {
  sendJson(res, 200, { jsonrpc: "2.0", id: id ?? null, result });
}

function sendJsonRpcError(
  res: ServerResponse,
  id: JsonRpcRequest["id"],
  code: number,
  message: string
) {
  sendJson(res, 400, { jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<JsonRpcRequest> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRpcRequest;
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Missing request URL" });
    return;
  }

  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname !== "/mcp") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      name: "spotter-mcp-server",
      version: "1.0.0",
      endpoint: `http://${host}:${port}/mcp`,
      transport: "http-jsonrpc"
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let payload: JsonRpcRequest;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJsonRpcError(res, null, -32700, `Invalid JSON: ${String(error)}`);
    return;
  }

  if (payload.jsonrpc !== "2.0" || !payload.method) {
    sendJsonRpcError(res, payload.id ?? null, -32600, "Invalid JSON-RPC request");
    return;
  }

  try {
    switch (payload.method) {
      case "tools/list":
        sendJsonRpcResult(res, payload.id, { tools });
        return;
      case "tools/call": {
        const toolName = payload.params?.name;
        if (!toolName) {
          sendJsonRpcError(res, payload.id, -32602, "Missing params.name for tools/call");
          return;
        }

        let result;
        switch (toolName) {
          case "search_golf_courses":
            result = await searchGolfCoursesHandler(payload.params?.arguments ?? {});
            break;
          case "get_spotter_features":
            result = await getSpotterFeaturesHandler();
            break;
          case "get_spotter_tiers":
            result = await getSpotterTiersHandler();
            break;
          default:
            sendJsonRpcError(res, payload.id, -32601, `Unknown tool: ${toolName}`);
            return;
        }

        sendJsonRpcResult(res, payload.id, result);
        return;
      }
      default:
        sendJsonRpcError(res, payload.id, -32601, `Unsupported method: ${payload.method}`);
    }
  } catch (error) {
    sendJsonRpcError(res, payload.id ?? null, -32000, error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Spotter MCP Server running on http://${host}:${port}/mcp`);
});
