import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import {
  TOOLS,
  handleGetCustomerRecord,
  handleTriggerRefund,
} from "./tools.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "mcp-customer-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Received tools/list request");
    return {
      tools: TOOLS,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Received tools/call request for tool: ${name}`);

    switch (name) {
      case "get_customer_record":
        return handleGetCustomerRecord(args as any);
      case "trigger_refund":
        return handleTriggerRefund(args as any);
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    }
  });

  return server;
}
