const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const Execution = require("../models/Execution");
const workflowService = require("../services/workflowService");

const { NotFoundError, BadRequestError } = require("../utils/errors");

// GET /executions/:id - Get detailed history
router.get("/executions/:id", async (req, res, next) => {
  try {
    const execution = await Execution.getById(req.params.id);
    if (!execution) throw new NotFoundError("Execution not found");

    const logs = await Execution.getLogs(req.params.id);
    res.json({ ...execution, logs });
  } catch (err) {
    next(err);
  }
});

// GET /executions - Audit log overview
router.get("/executions", async (req, res, next) => {
  try {
    // Audit data is better fetched via a model method
    const results = await Execution.getAllDetailed(); 
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// DELETE /executions/:id - Delete an execution (and its logs)
router.delete("/executions/:id", async (req, res, next) => {
  try {
    const execution = await Execution.getById(req.params.id);
    if (!execution) throw new NotFoundError("Execution not found");
    const result = await Execution.deleteById(req.params.id);
    res.json({ status: "success", ...result });
  } catch (err) {
    next(err);
  }
});

// DELETE /workflows/:workflow_id/executions - Delete all executions/logs for a workflow logical ID
router.delete("/workflows/:workflow_id/executions", async (req, res, next) => {
  try {
    const result = await Execution.deleteByWorkflowLogicalId(req.params.workflow_id);
    res.json({ status: "success", ...result });
  } catch (err) {
    next(err);
  }
});

// POST /executions/:id/cancel
router.post("/executions/:id/cancel", async (req, res, next) => {
  try {
    const execution = await Execution.getById(req.params.id);
    if (!execution) throw new NotFoundError("Execution not found");

    const result = await Execution.updateStatus(req.params.id, 'canceled');
    res.json({ status: "success", message: "Execution stopped", data: result });
  } catch (err) {
    next(err);
  }
});

// POST /executions/:id/retry
router.post("/executions/:id/retry", async (req, res, next) => {
  try {
    await workflowService.retryExecution(req.params.id);
    res.json({ status: "success", message: "Step-level retry initiated" });
  } catch (err) {
    next(err);
  }
});

// POST /executions/:id/approve
router.post("/executions/:id/approve", async (req, res, next) => {
  try {
    const { decision, approver_role } = req.body;
    if (!decision) throw new BadRequestError("Decision (approve/reject) is required");

    const role = approver_role || 'Operator';
    await workflowService.handleApprovalDecision(req.params.id, decision, role);
    res.json({ status: "success", message: `Decision '${decision}' recorded by ${role}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
