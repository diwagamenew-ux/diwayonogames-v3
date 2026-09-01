/**
 * Passenger / DreamHost entry point for this Next.js app.
 *
 * Copy this file to your Node.js app's document root on the server
 * (the directory you set as "App Directory" in the DreamHost panel),
 * together with the whole project. Passenger automatically injects PORT.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;
const dir = path.resolve(__dirname);

const next = require(path.join(dir, "node_modules", "next"));
const app = next({ dev: false, dir });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(PORT, () => {
        console.log(`APKVault running on port ${PORT}`);
      });
  })
  .catch((err) => {
    console.error("Failed to start Next.js:", err);
    process.exit(1);
  });
