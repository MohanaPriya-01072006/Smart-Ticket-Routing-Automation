const express = require("express");
const router = express.Router();
const Step = require("../models/Step");
const pool = require("../config/db");

const { BadRequestError, NotFoundError } = require("../utils/errors");

// POST /workflows/:workflow_id/steps
router.post("/workflows/:workflow_id/steps", async (req, res, next) => {
  try {
    const { name, step_type } = req.body;
    if (!name || !step_type) throw new BadRequestError("Name and step_type are required");

    const step = await Step.create(req.params.workflow_id, req.body);
    
    // Auto-set start_step_id if workflow currently has none
    const workflow = await pool.query("SELECT id, start_step_id FROM workflows WHERE id = $1", [req.params.workflow_id]);
    if (workflow.rows.length > 0 && !workflow.rows[0].start_step_id) {
      await pool.query("UPDATE workflows SET start_step_id = $1 WHERE id = $2", [step.id, req.params.workflow_id]);
    }

    res.status(201).json(step);
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:workflow_id/steps
router.get("/workflows/:workflow_id/steps", async (req, res, next) => {
  try {
    const steps = await Step.getByWorkflow(req.params.workflow_id);
    res.json(steps);
  } catch (err) {
    next(err);
  }
});

// PUT /steps/:id
router.put("/steps/:id", async (req, res, next) => {
  try {
    const step = await Step.update(req.params.id, req.body);
    if (!step) throw new NotFoundError("Step not found");
    res.json(step);
  } catch (err) {
    next(err);
  }
});

// PATCH /steps/:id (partial update)
router.patch("/steps/:id", async (req, res, next) => {
  try {
    const step = await Step.update(req.params.id, req.body);
    if (!step) throw new NotFoundError("Step not found");
    res.json(step);
  } catch (err) {
    next(err);
  }
});

// DELETE /steps/:id
router.delete("/steps/:id", async (req, res, next) => {
  try {
    await Step.delete(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
