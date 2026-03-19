/* eslint-disable no-console */
// End-to-end sanity: create workflow -> steps -> rules -> execute -> fetch logs

async function main() {
  const API = "http://localhost:5000/api";

  const wfRes = await fetch(`${API}/workflows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Demo Blocks Workflow",
      input_schema: {
        fields: [
          { name: "user_name", label: "User Name", type: "text" },
          {
            name: "issue_type",
            label: "Issue Type",
            type: "select",
            options: ["technical", "billing", "general"]
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            options: ["low", "medium", "high"]
          },
          { name: "description", label: "Description", type: "text" }
        ]
      }
    })
  });
  const wf = await wfRes.json();
  console.log("workflow_version_id:", wf.id);
  console.log("workflow_logical_id:", wf.workflow_id);

  async function addStep(name, step_type, order) {
    const res = await fetch(`${API}/workflows/${wf.id}/steps`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        step_type,
        step_order: order,
        metadata: {}
      })
    });
    const step = await res.json();
    console.log("step:", name, step.id);
    return step;
  }

  const s1 = await addStep("Submit Ticket", "task", 1);
  const s2 = await addStep("Manager Approval", "approval", 2);
  const s3 = await addStep("Send Response", "notification", 3);

  async function addRule(stepId, condition, next_step_id, priority = 0) {
    const res = await fetch(`${API}/steps/${stepId}/rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ condition, next_step_id, priority })
    });
    const rule = await res.json();
    console.log("rule:", stepId, condition, "->", next_step_id, rule.id);
    return rule;
  }

  await addRule(s1.id, "true", s2.id, 0);
  await addRule(s2.id, "priority == 'high'", s3.id, 0);
  await addRule(s2.id, "true", s3.id, 1);
  await addRule(s3.id, "true", null, 0);

  const execRes = await fetch(`${API}/workflows/${wf.workflow_id}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      triggered_by: "script",
      user_name: "Mohan",
      issue_type: "technical",
      priority: "high",
      description: "test"
    })
  });
  const exec = await execRes.json();
  console.log("execution_response:", exec);

  await new Promise((r) => setTimeout(r, 1200));
  const snapRes = await fetch(`${API}/executions/${exec.execution_id}`);
  const snap = await snapRes.json();
  console.log("snapshot_status:", snap.status);
  console.log("log_count:", snap.logs?.length ?? 0);
  console.log("logs_preview:", (snap.logs || []).slice(0, 3));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

