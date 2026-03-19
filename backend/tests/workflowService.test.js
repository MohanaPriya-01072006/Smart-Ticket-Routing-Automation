import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/Workflow');
vi.mock('../models/Step');
vi.mock('../models/Execution');
vi.mock('../models/Rule');
vi.mock('../services/ruleEngine', () => ({
  evaluate: vi.fn(() => true)
}));

import workflowService from '../services/workflowService';
import Workflow from '../models/Workflow';
import Step from '../models/Step';
import Execution from '../models/Execution';
import Rule from '../models/Rule';

describe('WorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Execution.getById = vi.fn();
    Execution.updateStatus = vi.fn();
    Execution.addLog = vi.fn();
    Step.getByIdInWorkflow = vi.fn();
    Rule.getByStep = vi.fn();
  });

  it('should execute a workflow and respect max iterations', async () => {
    const mockWorkflow = { id: 'wf1', workflow_id: 'logical-wf1', start_step_id: 'step1', max_iterations: 2 };
    const mockStep = { id: 'step-id-1', step_type: 'task', name: 'Test Step' };
    const mockExecution = { id: '11111111-1111-1111-1111-111111111111' };
    const mockRule = { id: 'rule1', next_step_id: 'step-id-1', condition: 'true' };

    Workflow.getActiveVersion.mockResolvedValue(mockWorkflow);
    Execution.create.mockResolvedValue(mockExecution);
    Execution.getById.mockResolvedValue({ id: 'ex1', current_step_id: 'step-id-1' });
    Step.getByIdInWorkflow.mockResolvedValue(mockStep);
    Rule.getByStep.mockResolvedValue([mockRule]);

    await workflowService.runExecutionLoop('ex1', mockWorkflow, {});

    // Should call getByIdInWorkflow multiple times until max_iterations
    expect(Step.getByIdInWorkflow).toHaveBeenCalled();
    expect(Execution.updateStatus).toHaveBeenCalledWith('ex1', 'failed');
  });
});
