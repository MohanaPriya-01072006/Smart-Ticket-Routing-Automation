const pool = require('./config/db');
const { v4: uuidv4 } = require('uuid');

const workflowData = {
  "id": "wf_001",
  "name": "Smart Ticket Routing System",
  "version": 1,
  "is_active": true,
  "input_schema": {
    "fields": [
      {
        "name": "user_name",
        "type": "text",
        "label": "User Name"
      },
      {
        "name": "issue_type",
        "type": "select",
        "label": "Issue Type",
        "options": ["technical", "billing", "general"]
      },
      {
        "name": "priority",
        "type": "select",
        "label": "Priority",
        "options": ["low", "medium", "high"]
      },
      {
        "name": "description",
        "type": "text",
        "label": "Description"
      }
    ]
  },
  "start_step_id": "step_1",
  "steps": [
    {
      "id": "step_1",
      "name": "Submit Ticket",
      "step_type": "task",
      "order": 1,
      "metadata": {}
    },
    {
      "id": "step_2",
      "name": "Assign to Team",
      "step_type": "approval",
      "order": 2,
      "metadata": {
        "assignee": "system"
      }
    },
    {
      "id": "step_3",
      "name": "Send Response",
      "step_type": "notification",
      "order": 3,
      "metadata": {
        "channel": "email"
      }
    }
  ],
  "rules": [
    {
      "id": "rule_1",
      "step_id": "step_1",
      "condition": "true",
      "next_step_id": "step_2",
      "priority": 1
    },
    {
      "id": "rule_2",
      "step_id": "step_2",
      "condition": "priority == 'high'",
      "next_step_id": "step_3",
      "priority": 1
    },
    {
      "id": "rule_3",
      "step_id": "step_2",
      "condition": "issue_type == 'technical'",
      "next_step_id": "step_3",
      "priority": 2
    },
    {
      "id": "rule_4",
      "step_id": "step_2",
      "condition": "true",
      "next_step_id": "step_3",
      "priority": 3
    },
    {
      "id": "rule_5",
      "step_id": "step_3",
      "condition": "true",
      "next_step_id": null,
      "priority": 1
    }
  ]
};

async function applyWorkflow() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create Workflow
    const workflowId = uuidv4();
    const wfRes = await client.query(
      `INSERT INTO workflows (id, workflow_id, name, version, is_active, input_schema) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [workflowId, uuidv4(), workflowData.name, workflowData.version, workflowData.is_active, JSON.stringify(workflowData.input_schema)]
    );
    const dbWorkflowId = wfRes.rows[0].id;

    // 2. Map JSON IDs to DB UUIDs
    const stepMap = {};
    for (const step of workflowData.steps) {
      const stepUuid = uuidv4();
      stepMap[step.id] = stepUuid;
      await client.query(
        `INSERT INTO steps (id, workflow_id, name, step_type, step_order, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
        [stepUuid, dbWorkflowId, step.name, step.step_type, step.order, JSON.stringify(step.metadata)]
      );
    }

    // Update start step
    await client.query('UPDATE workflows SET start_step_id = $1 WHERE id = $2', [stepMap[workflowData.start_step_id], dbWorkflowId]);

    // 3. Insert rules with mapped step IDs
    for (const rule of workflowData.rules) {
      await client.query(
        `INSERT INTO rules (id, step_id, condition, next_step_id, priority) VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), stepMap[rule.step_id], rule.condition, stepMap[rule.next_step_id] || null, rule.priority]
      );
    }

    await client.query('COMMIT');
    console.log('Successfully applied sample workflow:', workflowData.name);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying workflow:', err);
  } finally {
    client.release();
    process.exit();
  }
}

// Exports for reference or execution
module.exports = workflowData;

// If run directly, apply to database
if (require.main === module) {
  applyWorkflow();
}
