/* eslint-disable no-console */
const pool = require("../config/db");

async function main() {
  const workflowVersionId = process.argv[2];
  if (!workflowVersionId) {
    console.error("Usage: node scripts/debug_delete.js <workflow_version_id>");
    process.exit(1);
  }

  const before = await pool.query(
    "select count(*)::int as c from executions where workflow_id = $1",
    [workflowVersionId]
  );
  console.log("executions_before:", before.rows[0].c);

  const del = await pool.query("delete from executions where workflow_id = $1", [
    workflowVersionId
  ]);
  console.log("executions_deleted_rowCount:", del.rowCount);

  const after = await pool.query(
    "select count(*)::int as c from executions where workflow_id = $1",
    [workflowVersionId]
  );
  console.log("executions_after:", after.rows[0].c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

