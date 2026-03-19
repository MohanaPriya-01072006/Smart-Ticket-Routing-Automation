const pool = require('./config/db');
async function check() {
  try {
    const wfRes = await pool.query("SELECT id, name, version, is_active FROM workflows WHERE name = 'Smart Ticket Routing System' ORDER BY created_at DESC LIMIT 1");
    if (wfRes.rows.length === 0) {
      console.log('Workflow not found');
      process.exit(0);
    }
    const wf = wfRes.rows[0];
    console.log('\n--- WORKFLOW RECORD ---');
    console.table([wf]);

    const stepRes = await pool.query("SELECT id, name, step_type, step_order FROM steps WHERE workflow_id = $1 ORDER BY step_order", [wf.id]);
    console.log('\n--- STEPS IN WORKFLOW ---');
    console.table(stepRes.rows);

    const ruleRes = await pool.query(`
      SELECT 
        s.name as "From Step", 
        r.condition as "Condition", 
        r.priority as "Priority", 
        ns.name as "To Step"
      FROM rules r 
      JOIN steps s ON r.step_id = s.id 
      LEFT JOIN steps ns ON r.next_step_id = ns.id 
      WHERE s.workflow_id = $1 
      ORDER BY s.step_order, r.priority
    `, [wf.id]);
    console.log('\n--- TRANSITION RULES ---');
    console.table(ruleRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();
