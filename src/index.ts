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

import { logger } from "./logger.js";

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception encountered", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled rejection encountered", reason);
  process.exit(1);
});
