const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { BadRequestError } = require("../utils/errors");

// POST /admin/purge
// DANGER: Deletes all workflow-related data (workflows, steps, rules, executions, logs).
// Requires explicit confirmation token in body.
router.post("/admin/purge", async (req, res, next) => {
  try {
    const { confirm } = req.body || {};
    if (confirm !== "DELETE_ALL") {
      throw new BadRequestError("Missing confirmation. Send { confirm: 'DELETE_ALL' }.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const countsBefore = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM workflows) AS workflows,
          (SELECT COUNT(*)::int FROM steps) AS steps,
          (SELECT COUNT(*)::int FROM rules) AS rules,
          (SELECT COUNT(*)::int FROM executions) AS executions,
          (SELECT COUNT(*)::int FROM execution_logs) AS execution_logs
      `);

      // Executions reference workflows without ON DELETE CASCADE, so wipe in safe order.
      await client.query("TRUNCATE TABLE execution_logs CASCADE");
      await client.query("TRUNCATE TABLE executions CASCADE");
      await client.query("TRUNCATE TABLE rules CASCADE");
      await client.query("TRUNCATE TABLE steps CASCADE");
      await client.query("TRUNCATE TABLE workflows CASCADE");

      await client.query("COMMIT");
      res.json({
        status: "success",
        message: "All workflow data deleted.",
        deleted_counts: countsBefore.rows[0]
      });
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;

