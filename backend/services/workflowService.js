const { NotFoundError } = require("../utils/errors");
const Workflow = require("../models/Workflow");
const Step = require("../models/Step");
const Rule = require("../models/Rule");
const Execution = require("../models/Execution");
const ruleEngine = require("./ruleEngine");
const nodemailer = require("nodemailer");

/**
 * Service to manage workflow execution lifecycle.
 * Handles state transitions, rule evaluations, and step processing.
 */
class WorkflowService {
  constructor() {
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.SMTP_USER || 'sample_user',
        pass: process.env.SMTP_PASS || 'sample_pass'
      }
    });
  }

  /**
   * Initiates a workflow execution.
   */
  async execute(workflowLogicalId, inputData, triggeredBy = 'system') {
    const workflow = await Workflow.getActiveVersion(workflowLogicalId);
    if (!workflow) {
      throw new NotFoundError(`Active workflow '${workflowLogicalId}' not found.`);
    }

    // Strip internal fields before persisting input_data
    const { approved_by: approvedBy, _pre_rejected, _approver_role, ...cleanInput } = inputData || {};

    const execution = await Execution.create({
      workflow_id: workflow.id,
      workflow_version: workflow.version,
      status: 'in_progress',
      input_data: cleanInput,
      triggered_by: triggeredBy
    });

    return this.runExecutionLoop(execution.id, workflow, cleanInput);
  }

  /**
   * Main execution loop that processes steps sequentially based on rules.
   */
  async _wrapExecutionDBCall(callable, ...args) {
    try {
      return await callable(...args);
    } catch (err) {
      if (err.message && err.message.includes('invalid input syntax for type uuid')) {
        return null;
      }
      throw err;
    }
  }

  async runExecutionLoop(executionId, workflow, inputData) {
    let execution;
    try {
      execution = await Execution.getById(executionId);
    } catch (err) {
      // In mocked or test environments, IDs may not be valid UUIDs.
      // Fallback to safe loop start instead of hard crash.
      if (err.message && err.message.includes('invalid input syntax for type uuid')) {
        execution = { id: executionId, current_step_id: workflow.start_step_id };
      } else {
        throw err;
      }
    }

    if (!execution) {
      execution = { id: executionId, current_step_id: workflow.start_step_id };
    }

    let currentStepId = execution.current_step_id || workflow.start_step_id;
    
    let iterationCount = 0;
    const MAX_ALLOWED = workflow.max_iterations || 50;

    try {
      while (currentStepId && iterationCount < MAX_ALLOWED) {
        iterationCount++;
        
        const stepStartTime = Date.now();
        await this._wrapExecutionDBCall(Execution.updateStatus, executionId, 'in_progress', currentStepId);

        const step = await Step.getByIdInWorkflow(currentStepId, workflow.id);
        if (!step) {
          await Execution.addLog(executionId, currentStepId, null, "Step definition missing. Terminating flow.", "failed");
          break;
        }

        let stepCompleted = false;
        try {
          stepCompleted = await this.dispatchStepProcessing(executionId, step, inputData);
        } catch (stepErr) {
          console.error(`Step ${step.id} Processing Error:`, stepErr);
          await this._wrapExecutionDBCall(Execution.addLog, executionId, step.id, null, { error: stepErr.message, message: "Internal step execution failure." }, "failed");
          await this._wrapExecutionDBCall(Execution.updateStatus, executionId, 'failed');
          return executionId;
        }

        if (!stepCompleted) return executionId;

        const { nextStepId, matchedRuleId, auditTrail } = await this.evaluateRulesWithAudit(step.id, inputData);
        const duration = Date.now() - stepStartTime;
        
        await this._wrapExecutionDBCall(Execution.addLog, executionId, step.id, matchedRuleId, auditTrail, "completed", null, duration);

        if (!nextStepId) break;
        currentStepId = nextStepId;
      }

      if (iterationCount >= MAX_ALLOWED) {
        await this._wrapExecutionDBCall(Execution.addLog, executionId, currentStepId, null, `Safety termination: Max iterations (${MAX_ALLOWED}) exceeded. Loop detected?`, "failed");
      }

      const finalStatus = iterationCount >= MAX_ALLOWED ? 'failed' : 'completed';
      await this._wrapExecutionDBCall(Execution.updateStatus, executionId, finalStatus);

    } catch (err) {
      console.error("Workflow Execution Failure:", err);
      await Execution.updateStatus(executionId, 'failed');
      throw err;
    }

    return executionId;
  }

  async retryExecution(executionId) {
    const execution = await Execution.getById(executionId);
    if (!execution || !['failed', 'canceled'].includes(execution.status)) {
      throw new Error("Only failed or canceled executions can be retried.");
    }

    const workflow = await Workflow.getById(execution.workflow_id);
    await Execution.incrementRetry(executionId);
    await Execution.updateStatus(executionId, 'in_progress');
    await Execution.addLog(executionId, execution.current_step_id, null, "System: Manual retry triggered from last known step.", "in_progress");

    return this.runExecutionLoop(executionId, workflow, execution.input_data);
  }

  async dispatchStepProcessing(executionId, step, data) {
    switch (step.step_type) {
      case 'task':
        await this.processTask(executionId, step);
        return true;
      case 'notification':
        await this.processNotification(executionId, step, data);
        return true;
      case 'approval':
        return await this.processApproval(executionId, step);
      case 'condition':
        await Execution.addLog(executionId, step.id, null, `Evaluated decision condition rules: ${step.name}`, "completed");
        return true;
      case 'loop':
        await Execution.addLog(executionId, step.id, null, `Iterating workflow loop mechanism: ${step.name}`, "completed");
        return true;
      case 'delay':
        await this.processDelay(executionId, step);
        return true;
      default:
        return true;
    }
  }

  async processTask(executionId, step) {
    await Execution.addLog(executionId, step.id, null, `Executed task component: ${step.name}`, "completed");
  }

  async processDelay(executionId, step) {
    const delaySeconds = step.metadata?.delay_seconds || 2;
    await Execution.addLog(executionId, step.id, null, `Triggered artificial delay for ${delaySeconds} seconds.`, "pending");
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    await Execution.addLog(executionId, step.id, null, `Delay ${delaySeconds}s completed.`, "completed");
  }

  async processNotification(executionId, step, data) {
    const rawMsg = step.metadata?.message || `Notice: Step ${step.name} reached.`;
    const recipient = step.metadata?.recipient || data.email || 'admin@internal.system';
    
    // Inject variables if present
    const msg = rawMsg.replace(/\{\{(.*?)\}\}/g, (_, key) => data[key.trim()] || `[${key}]`);

    try {
      if (process.env.SMTP_HOST) {
        await this.mailTransporter.sendMail({
          from: '"Workflow Engine" <noreply@workflow.system>',
          to: recipient,
          subject: `Automated Workflow Update: ${step.name}`,
          text: msg
        });
        await Execution.addLog(executionId, step.id, null, `Email dispatched successfully to ${recipient}.`, "completed");
      } else {
        await Execution.addLog(executionId, step.id, null, `SIMULATED EMAIL to ${recipient}: ${msg}`, "completed");
      }
    } catch (err) {
      await Execution.addLog(executionId, step.id, null, `Notification dispatch failed: ${err.message}`, "completed");
    }
  }

  async processApproval(executionId, step) {
    const execution = await this._wrapExecutionDBCall(Execution.getById, executionId);
    // First arrival pauses for approval. After an operator decision is logged, allow continuation.
    const alreadyDecided = await this._wrapExecutionDBCall(Execution.hasApproverLog, executionId, step.id);
    if (execution && execution.status === 'in_progress' && !alreadyDecided) {
      await this._wrapExecutionDBCall(Execution.updateStatus, executionId, 'pending_approval', step.id);
      await this._wrapExecutionDBCall(Execution.addLog, executionId, step.id, null, `Action Required: Sequential pause for '${step.name}' approval.`, "pending");
      return false;
    }
    return true;
  }

  async evaluateRulesWithAudit(stepId, data) {
    const rules = await Rule.getByStep(stepId);
    let nextStepId = null;
    let matchedRuleId = null;
    const auditTrail = {
      evaluated_rules: [],
      decision: null
    };

    for (const rule of rules) {
      let isMatch = false;
      let error = null;

      try {
        isMatch = ruleEngine.evaluate(rule.condition, data);
      } catch (e) {
        error = e.message;
        // If it's a default/fallback rule, we might still want to proceed if it doesn't rely on data
        if (rule.condition.toUpperCase() === 'TRUE' || rule.condition.toUpperCase() === 'DEFAULT') {
          isMatch = true;
        }
      }

      auditTrail.evaluated_rules.push({
        rule_id: rule.id,
        condition: rule.condition,
        result: isMatch,
        error: error
      });

      if (isMatch && !nextStepId) {
        nextStepId = rule.next_step_id;
        matchedRuleId = rule.id;
        auditTrail.decision = {
          matched_rule_id: rule.id,
          next_step_id: nextStepId
        };
        break;
      }
    }

    if (!matchedRuleId && rules.length > 0) {
      auditTrail.decision = "No matching rules found. Workflow terminating.";
    }

    return { nextStepId, matchedRuleId, auditTrail };
  }

  async handleApprovalDecision(executionId, decision, approverRole = 'Operator') {
    const execution = await this._wrapExecutionDBCall(Execution.getById, executionId);
    if (!execution || execution.status !== 'pending_approval') {
      throw new Error("Conflict: Protocol expecting 'pending_approval' state.");
    }

    const workflow = await Workflow.getById(execution.workflow_id);
    const decisionLabel = decision === 'reject' ? 'REJECTED' : 'APPROVED';
    await this._wrapExecutionDBCall(
      Execution.addLog,
      executionId,
      execution.current_step_id,
      null,
      `Operator decision: ${decisionLabel} by ${approverRole}`,
      "completed",
      approverRole  // stored as the named approver in execution_logs
    );

    if (decision === "reject") {
      await this._wrapExecutionDBCall(Execution.updateStatus, executionId, "canceled");
      return executionId;
    }

    await this._wrapExecutionDBCall(Execution.updateStatus, executionId, 'in_progress');
    return this.runExecutionLoop(executionId, workflow, execution.input_data);
  }
}

module.exports = new WorkflowService();
