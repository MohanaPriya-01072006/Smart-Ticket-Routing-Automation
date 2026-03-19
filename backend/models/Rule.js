const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");
const ruleEngine = require("../services/ruleEngine");

class Rule {
  static async create(stepId, data) {
    const id = uuidv4();
    const { condition, next_step_id, priority } = data;

    // Validation
    const validation = ruleEngine.validate(condition);
    if (!validation.valid) {
      throw new Error(`Invalid condition syntax: ${validation.error}`);
    }

    const result = await pool.query(
      `INSERT INTO rules (id, step_id, condition, next_step_id, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, stepId, condition, next_step_id || null, priority || 0]
    );

    return result.rows[0];
  }

  static async update(id, data) {
    const { condition, next_step_id, priority } = data;

    if (condition) {
      const validation = ruleEngine.validate(condition);
      if (!validation.valid) {
        throw new Error(`Invalid condition syntax: ${validation.error}`);
      }
    }

    const result = await pool.query(
      `UPDATE rules 
       SET condition = COALESCE($1, condition),
           next_step_id = COALESCE($2, next_step_id),
           priority = COALESCE($3, priority),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [condition, next_step_id, priority, id]
    );

    return result.rows[0];
  }

  static async delete(id) {
    await pool.query("DELETE FROM rules WHERE id = $1", [id]);
    return { message: "Rule deleted" };
  }

  static async getByStep(stepId) {
    const result = await pool.query(
      "SELECT * FROM rules WHERE step_id = $1 ORDER BY priority ASC",
      [stepId]
    );
    return result.rows;
  }
}

module.exports = Rule;
