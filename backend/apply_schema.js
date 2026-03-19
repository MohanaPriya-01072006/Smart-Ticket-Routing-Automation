const pool = require("./config/db");
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../database/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

async function applySchema() {
  try {
    console.log("Applying schema...");
    await pool.query(schema);
    console.log("Schema applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error applying schema:", err);
    process.exit(1);
  }
}

applySchema();
