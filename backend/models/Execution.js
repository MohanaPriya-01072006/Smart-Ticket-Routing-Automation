const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

class Execution {
  static async create(data) {
    const id = uuidv4();
    const { workflow_id, workflow_version, status, input_data, triggered_by } = data;

    const result = await pool.query(
      `INSERT INTO executions (id, workflow_id, workflow_version, status, input_data, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, workflow_id, workflow_version, status || 'pending', JSON.stringify(input_data), triggered_by || 'system']
    );

    return result.rows[0];
  }

  static async updateStatus(id, status, currentStepId = null) {
    const result = await pool.query(
      `UPDATE executions 
       SET status = $1, 
           current_step_id = COALESCE($2, current_step_id),
           updated_at = NOW() 
       WHERE id = $3
       RETURNING *`,
      [status, currentStepId, id]
    );
    return result.rows[0];
  }

  static async addLog(executionId, stepId, ruleId, evaluation, status, approver = null, timeMs = 0) {
    const id = uuidv4();
    const evaluationJson = typeof evaluation === 'object' ? JSON.stringify(evaluation) : JSON.stringify({ message: evaluation });
    await pool.query(
      `INSERT INTO execution_logs (id, execution_id, step_id, rule_id, rule_evaluation, status, approver, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, executionId, stepId, ruleId, evaluationJson, status, approver, timeMs]
    );
  }

  static async incrementRetry(id) {
    await pool.query(
      "UPDATE executions SET retries = retries + 1, updated_at = NOW() WHERE id = $1",
      [id]
    );
  }

  static async getById(id) {
    try {
      const result = await pool.query("SELECT * FROM executions WHERE id = $1", [id]);
      return result.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('invalid input syntax for type uuid')) {
        return null;
      }
      throw err;
    }
  }

  static async getLogs(executionId) {
    const result = await pool.query(
      `SELECT
         l.*,
         s.name AS step_name,
         r.condition AS rule_condition
       FROM execution_logs l
       LEFT JOIN steps s ON s.id = l.step_id
       LEFT JOIN rules r ON r.id = l.rule_id
       WHERE l.execution_id = $1
       ORDER BY l.created_at ASC`,
      [executionId]
    );
    return result.rows;
  }

  static async hasApproverLog(executionId, stepId) {
    const result = await pool.query(
      `SELECT 1
       FROM execution_logs
       WHERE execution_id = $1 AND step_id = $2 AND approver IS NOT NULL
       LIMIT 1`,
      [executionId, stepId]
    );
    return result.rows.length > 0;
  }

  static async getAllDetailed() {
    const result = await pool.query(
      `SELECT e.*, w.name as workflow_name 
       FROM executions e 
       JOIN workflows w ON e.workflow_id = w.id 
       ORDER BY e.created_at DESC`
    );
    return result.rows;
  }

  static async deleteById(id) {
    // execution_logs has ON DELETE CASCADE, so deleting execution removes its logs.
    await pool.query("DELETE FROM executions WHERE id = $1", [id]);
    return { message: "Execution deleted" };
  }

  static async deleteByWorkflowLogicalId(workflowLogicalId) {
    // Deletes all executions (and logs) across all versions of a workflow logical ID.
    await pool.query(
      `DELETE FROM executions e
       USING workflows w
       WHERE e.workflow_id = w.id
         AND w.workflow_id = $1`,
      [workflowLogicalId]
    );
    return { message: "Workflow executions deleted" };
  }
}

module.exports = Execution;
