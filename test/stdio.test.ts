import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number | string;
  result?: {
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
    tools?: Array<{ name: string }>;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

describe("STDIO JSON-RPC Integration", () => {
  it("processes lifecycle, tool listing, valid/invalid calls, and enforces pure JSON-RPC on stdout", async () => {
    const entryPath = path.resolve(__dirname, "../dist/index.js");
    const child = spawn("node", [entryPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutLines: string[] = [];
    const stderrChunks: string[] = [];
    const pendingResponses = new Map<number | string, (res: JsonRpcResponse) => void>();

    const rl = readline.createInterface({
      input: child.stdout,
      terminal: false,
    });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      stdoutLines.push(trimmed);

      // Verify every stdout line is valid JSON-RPC
      const parsed = JSON.parse(trimmed) as JsonRpcResponse;
      expect(parsed.jsonrpc).toBe("2.0");

      if (parsed.id !== undefined && pendingResponses.has(parsed.id)) {
        const resolve = pendingResponses.get(parsed.id)!;
        pendingResponses.delete(parsed.id);
        resolve(parsed);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString("utf-8"));
    });

    function sendRequest(request: Record<string, unknown>): Promise<JsonRpcResponse> {
      return new Promise((resolve, reject) => {
        const id = request.id as number | string;
        pendingResponses.set(id, resolve);
        child.stdin.write(JSON.stringify(request) + "\n", (err) => {
          if (err) reject(err);
        });
      });
    }

    function sendNotification(notification: Record<string, unknown>): Promise<void> {
      return new Promise((resolve, reject) => {
        child.stdin.write(JSON.stringify(notification) + "\n", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 1. Initialize
    const initRes = await sendRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "integration-tester",
          version: "1.0.0",
        },
      },
    });
    expect(initRes.error).toBeUndefined();
    expect(initRes.result).toBeDefined();

    // 2. Initialized notification
    await sendNotification({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // 3. tools/list
    const listRes = await sendRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(listRes.result?.tools).toBeDefined();
    const toolNames = listRes.result?.tools?.map((t) => t.name);
    expect(toolNames).toContain("get_customer_record");
    expect(toolNames).toContain("trigger_refund");

    // 4. Valid call: get_customer_record
    const getValidRes = await sendRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_customer_record",
        arguments: {
          customer_id: "CUST-10001",
        },
      },
    });
    expect(getValidRes.error).toBeUndefined();
    expect(getValidRes.result?.content).toBeDefined();
    expect(getValidRes.result?.isError).toBeFalsy();
    const customer = JSON.parse(getValidRes.result!.content![0].text);
    expect(customer.customer_id).toBe("CUST-10001");
    expect(customer.name).toBe("Alice Smith");

    // 5. Valid call: trigger_refund
    const refundValidRes = await sendRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "trigger_refund",
        arguments: {
          customer_id: "CUST-10001",
          amount: 50.0,
          reason: "Item arrived damaged during transit",
        },
      },
    });
    expect(refundValidRes.error).toBeUndefined();
    expect(refundValidRes.result?.content).toBeDefined();
    expect(refundValidRes.result?.isError).toBeFalsy();
    const refund = JSON.parse(refundValidRes.result!.content![0].text);
    expect(refund.customer_id).toBe("CUST-10001");
    expect(refund.amount).toBe(50.0);
    expect(refund.status).toBe("processed");
    expect(refund.refund_id).toBeDefined();

    // 6. Business failure: customer not found (isError: true result)
    const notFoundRes = await sendRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_customer_record",
        arguments: {
          customer_id: "CUST-99999",
        },
      },
    });
    expect(notFoundRes.error).toBeUndefined();
    expect(notFoundRes.result?.isError).toBe(true);
    expect(notFoundRes.result?.content?.[0]?.text).toContain("Customer not found");

    // 7. Invalid call: bad customer_id
    const badIdRes = await sendRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "get_customer_record",
        arguments: {
          customer_id: "invalid-id",
        },
      },
    });
    expect(badIdRes.error).toBeDefined();
    expect(badIdRes.error?.code).toBe(-32602);

    // 8. Invalid call: negative amount
    const negAmountRes = await sendRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "trigger_refund",
        arguments: {
          customer_id: "CUST-10001",
          amount: -25,
          reason: "Damaged item replacement",
        },
      },
    });
    expect(negAmountRes.error).toBeDefined();
    expect(negAmountRes.error?.code).toBe(-32602);

    // 9. Invalid call: short reason
    const shortReasonRes = await sendRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "trigger_refund",
        arguments: {
          customer_id: "CUST-10001",
          amount: 25,
          reason: "short",
        },
      },
    });
    expect(shortReasonRes.error).toBeDefined();
    expect(shortReasonRes.error?.code).toBe(-32602);

    // 10. Invalid call: unknown tool
    const unknownToolRes = await sendRequest({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "unknown_custom_tool",
        arguments: {},
      },
    });
    expect(unknownToolRes.error).toBeDefined();
    expect(unknownToolRes.error?.code).toBe(-32602);

    // 11. Invalid call: extra property on strict schema
    const extraPropRes = await sendRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "get_customer_record",
        arguments: {
          customer_id: "CUST-10001",
          unexpected_extra_property: 123,
        },
      },
    });
    expect(extraPropRes.error).toBeDefined();
    expect(extraPropRes.error?.code).toBe(-32602);

    // Terminate server process cleanly
    child.kill("SIGTERM");

    // Assert stdout contained only valid JSON-RPC lines
    expect(stdoutLines.length).toBeGreaterThan(0);
    for (const line of stdoutLines) {
      expect(() => JSON.parse(line)).not.toThrow();
      const obj = JSON.parse(line);
      expect(obj.jsonrpc).toBe("2.0");
    }

    // Assert stderr contains log records
    const fullStderr = stderrChunks.join("");
    expect(fullStderr).toMatch(/\[(INFO|DEBUG|WARN|ERROR)\]/);
  });
});
