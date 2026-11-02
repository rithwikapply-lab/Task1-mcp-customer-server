import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import {
  GetCustomerRecordInputSchema,
  TriggerRefundInputSchema,
} from "./schemas.js";
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
    const { name, arguments: rawArgs } = request.params;
    logger.debug(`Received tools/call request for tool: ${name}`);

    try {
      switch (name) {
        case "get_customer_record": {
          const parsed = GetCustomerRecordInputSchema.safeParse(rawArgs);
          if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            }));
            const summary = issues
              .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
              .join("; ");
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid params: ${summary}`,
              { issues }
            );
          }
          return handleGetCustomerRecord(parsed.data);
        }

        case "trigger_refund": {
          const parsed = TriggerRefundInputSchema.safeParse(rawArgs);
          if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            }));
            const summary = issues
              .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
              .join("; ");
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid params: ${summary}`,
              { issues }
            );
          }
          return handleTriggerRefund(parsed.data);
        }

        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      logger.error(`Internal error executing tool ${name}`, error);
      throw new McpError(ErrorCode.InternalError, "Internal error");
    }
  });

  return server;
}
