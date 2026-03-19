const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

class Workflow {
  /**
   * Create a brand new workflow (Version 1)
   */
  static async create(data) {
    const id = uuidv4();
    const workflow_id = uuidv4(); // Generate a new logical ID
    const { name, input_schema, start_step_id } = data;

    const result = await pool.query(
      `INSERT INTO workflows (id, workflow_id, name, version, is_active, input_schema, start_step_id)
       VALUES ($1, $2, $3, 1, TRUE, $4, $5)
       RETURNING *`,
      [id, workflow_id, name, JSON.stringify(input_schema), start_step_id || null]
    );

    return result.rows[0];
  }

  /**
   * Create a new version of an existing workflow
   */
  static async createVersion(workflowId, updates) {
    // 1. Get the current latest version to clone from
    const latest = await this.getLatest(workflowId);
    if (!latest) throw new Error("Workflow not found");

    const id = uuidv4();
    const newVersion = latest.version + 1;
    
    // Merge updates with latest version data
    const name = updates.name || latest.name;
    const input_schema = updates.input_schema || latest.input_schema;
    const start_step_id = updates.start_step_id || latest.start_step_id;

    // Deactivate previous versions if this is meant to be active (default true)
    if (updates.is_active !== false) {
      await this.deactivateAll(workflowId);
    }

    const result = await pool.query(
      `INSERT INTO workflows (id, workflow_id, name, version, is_active, input_schema, start_step_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, workflowId, name, newVersion, updates.is_active !== false, JSON.stringify(input_schema), start_step_id]
    );

    return result.rows[0];
  }

  static async getLatest(workflowId) {
    const result = await pool.query(
      `SELECT * FROM workflows WHERE workflow_id = $1 ORDER BY version DESC LIMIT 1`,
      [workflowId]
    );
    return result.rows[0];
  }

  static async deactivateAll(workflowId) {
    await pool.query(
      `UPDATE workflows SET is_active = FALSE WHERE workflow_id = $1`,
      [workflowId]
    );
  }

  static async activate(id) {
    // 1. Get workflow_id for this version
    const version = await pool.query("SELECT workflow_id FROM workflows WHERE id = $1", [id]);
    if (version.rows.length === 0) throw new Error("Version not found");
    const { workflow_id } = version.rows[0];

    // 2. Deactivate others
    await this.deactivateAll(workflow_id);

    // 3. Activate this one
    const result = await pool.query(
      `UPDATE workflows SET is_active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async getAllLatest(options = {}) {
    const { search, limit = 10, offset = 0 } = options;
    let query = `
      SELECT DISTINCT ON (workflow_id) *, 
        (SELECT COUNT(*)::int FROM steps WHERE workflow_id = workflows.id) as step_count
      FROM workflows 
    `;
    let params = [];

    if (search) {
      query += ` WHERE name ILIKE $1 `;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY workflow_id, version DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Also get total count for pagination
    let countQuery = `SELECT COUNT(DISTINCT workflow_id) FROM workflows`;
    let countParams = [];
    if (search) {
      countQuery += ` WHERE name ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    const countResult = await pool.query(countQuery, countParams);

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  static async getById(id) {
    const result = await pool.query("SELECT * FROM workflows WHERE id = $1", [id]);
    return result.rows[0];
  }

  /**
   * Update an existing workflow version in-place (no new version).
   * This is used by the UI "Persist Manifest" to avoid orphaning steps/rules.
   */
  static async update(id, updates) {
    const { name, input_schema, start_step_id, max_iterations, is_active } = updates || {};
    const result = await pool.query(
      `UPDATE workflows
       SET name = COALESCE($1, name),
           input_schema = COALESCE($2, input_schema),
           start_step_id = COALESCE($3, start_step_id),
           max_iterations = COALESCE($4, max_iterations),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name ?? null,
        input_schema !== undefined ? JSON.stringify(input_schema) : null,
        start_step_id ?? null,
        max_iterations ?? null,
        is_active ?? null,
        id
      ]
    );
    return result.rows[0];
  }

  static async delete(id) {
    // Delete executions first (FK has no ON DELETE CASCADE)
    await pool.query("DELETE FROM executions WHERE workflow_id = $1", [id]);
    await pool.query("DELETE FROM workflows WHERE id = $1", [id]);
    return { message: "Workflow version deleted" };
  }

  static async deleteAllVersions(workflowLogicalId) {
    // Delete executions for ALL versions first
    await pool.query(
      `DELETE FROM executions e
       USING workflows w
       WHERE e.workflow_id = w.id
         AND w.workflow_id = $1`,
      [workflowLogicalId]
    );
    // Then delete all workflow versions
    await pool.query("DELETE FROM workflows WHERE workflow_id = $1", [workflowLogicalId]);
    return { message: "Workflow (all versions) deleted" };
  }

  static async getActiveVersion(workflowId) {
    let result = await pool.query(
      "SELECT * FROM workflows WHERE workflow_id = $1 AND is_active = TRUE ORDER BY version DESC LIMIT 1",
      [workflowId]
    );
    if (result.rows.length === 0) {
      // Fallback: If no version is explicitly marked active, return the most recent one.
      result = await pool.query(
        "SELECT * FROM workflows WHERE workflow_id = $1 ORDER BY version DESC LIMIT 1",
        [workflowId]
      );
    }
    return result.rows[0];
  }
}

module.exports = Workflow;
