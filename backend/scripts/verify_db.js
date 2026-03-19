/* eslint-disable no-console */
const pool = require("../config/db");

async function main() {
  const execId = process.argv[2];
  if (!execId) {
    console.error("Usage: node scripts/verify_db.js <execution_id>");
    process.exit(1);
  }

  const e = await pool.query(
    "select id,status,workflow_id,created_at from executions where id=$1",
    [execId]
  );
  const l = await pool.query(
    "select count(*)::int as cnt from execution_logs where execution_id=$1",
    [execId]
  );
  console.log("execution_row:", e.rows[0]);
  console.log("log_count_db:", l.rows[0]?.cnt ?? 0);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

