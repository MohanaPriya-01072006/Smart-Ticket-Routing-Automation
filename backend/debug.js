const pool = require('./config/db');

async function debug() {
  const result = await pool.query("SELECT id, workflow_id, name, version, is_active FROM workflows WHERE workflow_id = 'c917ddc0-749f-41e1-b4f6-66ca5dd3f54a'");
  console.log("Workflows for this ID:", result.rows);
  const all = await pool.query("SELECT id, workflow_id, name, version, is_active FROM workflows");
  console.log("All workflows:", all.rows);
  process.exit();
}

debug();
