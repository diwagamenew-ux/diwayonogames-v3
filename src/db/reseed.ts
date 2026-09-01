/* Standalone runner: wipes all tables and re-seeds demo content.
   Run with: node --experimental-strip-types src/db/reseed.ts */
import "dotenv/config";
import { reseedDatabase } from "./seed";
import { pool } from "./index";

reseedDatabase()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
