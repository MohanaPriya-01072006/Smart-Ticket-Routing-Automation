const pool = require("./config/db");
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../database/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

async function applySchema() {
  try {
    console.log("Applying schema from:", schemaPath);
    await pool.query(schema);
    console.log("Database schema synchronized successfully.");
    process.exit(0);
  } catch (err) {
    console.error("CRITICAL: Error applying schema synchronization:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
    });
    process.exit(1);
  }
}

applySchema();
