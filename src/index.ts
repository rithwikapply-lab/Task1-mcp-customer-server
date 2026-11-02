import util from "node:util";

console.log = (...args: unknown[]) => {
  process.stderr.write(util.format(...args) + "\n");
};
console.info = (...args: unknown[]) => {
  process.stderr.write(util.format(...args) + "\n");
};
console.debug = (...args: unknown[]) => {
  process.stderr.write(util.format(...args) + "\n");
};
console.warn = (...args: unknown[]) => {
  process.stderr.write(util.format(...args) + "\n");
};

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception encountered", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled rejection encountered", reason);
  process.exit(1);
});

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Customer MCP server running on stdio transport");
}

main().catch((error) => {
  logger.error("Fatal startup error", error);
  process.exit(1);
});
