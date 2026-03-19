const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const Workflow = require("../models/Workflow");
const workflowService = require("../services/workflowService");

const { NotFoundError } = require("../utils/errors");

// POST /workflows - Create a new workflow
router.post("/workflows", async (req, res, next) => {
  try {
    const workflow = await Workflow.create(req.body);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

// GET /workflows - List latest versions
router.get("/workflows", async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const results = await Workflow.getAllLatest({ 
      search, 
      limit: parseInt(limit), 
      offset: (parseInt(page) - 1) * parseInt(limit) 
    });
    res.json({ ...results, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:id - Get specific version details
router.get("/workflows/:id", async (req, res, next) => {
  try {
    const workflow = await Workflow.getById(req.params.id);
    if (!workflow) throw new NotFoundError("Workflow not found");
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// PUT /workflows/:id - Create new version (cloning)
router.put("/workflows/:id", async (req, res, next) => {
  try {
    const existing = await Workflow.getById(req.params.id);
    if (!existing) throw new NotFoundError("Parent workflow not found");

    const workflow = await Workflow.createVersion(existing.workflow_id, req.body);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

// PATCH /workflows/:id - Update an existing version in-place
router.patch("/workflows/:id", async (req, res, next) => {
  try {
    const existing = await Workflow.getById(req.params.id);
    if (!existing) throw new NotFoundError("Workflow not found");
    const updated = await Workflow.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /workflows/versions/:id/activate - Activate a version
router.patch("/workflows/versions/:id/activate", async (req, res, next) => {
  try {
    const workflow = await Workflow.activate(req.params.id);
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// DELETE /workflows/:id - Delete a specific version
router.delete("/workflows/:id", async (req, res, next) => {
  try {
    const result = await Workflow.delete(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /workflows/logical/:workflow_id - Delete all versions of a workflow
router.delete("/workflows/logical/:workflow_id", async (req, res, next) => {
  try {
    const result = await Workflow.deleteAllVersions(req.params.workflow_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /workflows/:workflow_id/execute - Trigger execution
router.post("/workflows/:workflow_id/execute", async (req, res, next) => {
  try {
    const { triggered_by, ...input_data } = req.body;
    const executionId = await workflowService.execute(req.params.workflow_id, input_data, triggered_by);
    res.status(202).json({ 
      status: "accepted",
      execution_id: executionId 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



