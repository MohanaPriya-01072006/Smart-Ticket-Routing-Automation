const express = require("express");
const router = express.Router();
const Rule = require("../models/Rule");

const { BadRequestError, NotFoundError } = require("../utils/errors");

// POST /steps/:step_id/rules
router.post("/steps/:step_id/rules", async (req, res, next) => {
  try {
    if (!req.body.condition) throw new BadRequestError("Rule condition is missing");

    const rule = await Rule.create(req.params.step_id, req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

// GET /steps/:step_id/rules
router.get("/steps/:step_id/rules", async (req, res, next) => {
  try {
    const rules = await Rule.getByStep(req.params.step_id);
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// PUT /rules/:id
router.put("/rules/:id", async (req, res, next) => {
  try {
    const rule = await Rule.update(req.params.id, req.body);
    if (!rule) throw new NotFoundError("Rule not found");
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /rules/:id
router.delete("/rules/:id", async (req, res, next) => {
  try {
    await Rule.delete(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
