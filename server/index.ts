import { createServer } from "node:http";
import express from "express";
import next from "next";
import { attachRealtimeServer } from "./realtime";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const nextApp = next({ dev, hostname, port });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const app = express();
  const httpServer = createServer(app);

  attachRealtimeServer(httpServer);

  app.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Dicehall is ready at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
