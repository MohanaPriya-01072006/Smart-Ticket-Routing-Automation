const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/**
 * POST /api/workflow/save
 * Saves a full workflow canvas (nodes + edges) to the database.
 * Body: { workflow_name, nodes, edges }
 */
router.post("/workflow/save", async (req, res) => {
  const client = await pool.connect();
  try {
    const { workflow_name, nodes, edges } = req.body;

    await client.query("BEGIN");

    // 1. Insert workflow
    const wfRes = await client.query(
      `INSERT INTO workflows (id, name, input_schema)
       VALUES (gen_random_uuid(), $1, $2)
       RETURNING *`,
      [workflow_name, JSON.stringify({ nodes, edges })]
    );
    const workflow = wfRes.rows[0];

    // 2. Insert steps for each node
    const stepIdMap = {}; // map canvas node id → db step UUID
    for (const node of nodes) {
      const stepRes = await client.query(
        `INSERT INTO steps (id, workflow_id, step_name, step_type)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        [workflow.id, node.label || node.type, node.type]
      );
      stepIdMap[node.id] = stepRes.rows[0].id;
    }

    // 3. Insert rules for condition nodes with edges
    for (const edge of edges) {
      const sourceStepId = stepIdMap[edge.from];
      const targetStepId = stepIdMap[edge.to];
      if (sourceStepId && targetStepId) {
        await client.query(
          `INSERT INTO rules (id, step_id, condition, next_step_id)
           VALUES (gen_random_uuid(), $1, $2, $3)`,
          [sourceStepId, "priority == 'high'", targetStepId]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      message: "Workflow saved successfully",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      steps_created: nodes.length,
      rules_created: edges.length
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/executions
 * Returns all execution records (for history page)
 */
router.get("/executions", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, w.name AS workflow_name,
              e.input_data,
              e.current_step_id AS start_step,
              e.status AS result,
              e.created_at AS executed_at
       FROM executions e
       LEFT JOIN workflows w ON e.workflow_id = w.id
       ORDER BY e.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
