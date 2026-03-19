const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

class Step {
  /**
   * Add a new step to a workflow
   */
  static async create(workflowId, data) {
    const id = uuidv4();
    const { name, step_type, step_order, metadata } = data;

    const result = await pool.query(
      `INSERT INTO steps (id, workflow_id, name, step_type, step_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, workflowId, name, step_type, step_order, JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  /**
   * Update an existing step
   */
  static async update(id, data) {
    const { name, step_type, step_order, metadata } = data;
    
    const result = await pool.query(
      `UPDATE steps 
       SET name = COALESCE($1, name),
           step_type = COALESCE($2, step_type),
           step_order = COALESCE($3, step_order),
           metadata = COALESCE($4, metadata),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, step_type, step_order, metadata ? JSON.stringify(metadata) : null, id]
    );

    return result.rows[0];
  }

  /**
   * Delete a step
   */
  static async delete(id) {
    await pool.query("DELETE FROM steps WHERE id = $1", [id]);
    return { message: "Step deleted" };
  }

  /**
   * Get all steps for a specific workflow version
   */
  static async getByWorkflow(workflowId) {
    const result = await pool.query(
      "SELECT * FROM steps WHERE workflow_id = $1 ORDER BY step_order ASC",
      [workflowId]
    );
    return result.rows;
  }

  /**
   * Get a single step by ID
   */
  static async getById(id) {
    try {
      const result = await pool.query("SELECT * FROM steps WHERE id = $1", [id]);
      return result.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('invalid input syntax for type uuid')) {
        return null;
      }
      throw err;
    }
  }

  static async getByIdInWorkflow(id, workflowId) {
    try {
      const result = await pool.query(
        "SELECT * FROM steps WHERE id = $1 AND workflow_id = $2",
        [id, workflowId]
      );
      return result.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('invalid input syntax for type uuid')) {
        return null;
      }
      throw err;
    }
  }
}

module.exports = Step;
