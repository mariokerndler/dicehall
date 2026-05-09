const { existsSync } = require("node:fs");
const { join } = require("node:path");

process.env.NODE_ENV ||= "production";

const serverPath = join(__dirname, "dist", "server.js");

if (!existsSync(serverPath)) {
  console.error("Missing dist/server.js. Run `npm run build` before `npm run start`.");
  process.exit(1);
}

require(serverPath);
