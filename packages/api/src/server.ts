import { createClient, disconnect } from "@durable/storage";
import { createApp } from "./app";
import { loadConfig } from "./config/env";

const config = loadConfig();
const client = createClient(config.DATABASE_URL);
const app = createApp({ client });

const server = Bun.serve({
  port: config.PORT,
  hostname: config.HOST,
  fetch: app.fetch,
});

console.log(
  `[Orbit Control Plane API] Running on http://${server.hostname}:${server.port} (env: ${config.NODE_ENV})`
);

async function shutdown() {
  console.log("\n[Orbit Control Plane API] Shutting down gracefully...");
  server.stop();
  await disconnect(client);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
