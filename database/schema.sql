-- Workflow Automation System Schema

-- Cleanup existing tables
DROP TABLE IF EXISTS execution_logs CASCADE;
DROP TABLE IF EXISTS executions CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS steps CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Specific version ID
    workflow_id UUID NOT NULL, -- Logical ID for the same workflow across versions
    name TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    input_schema JSONB DEFAULT '{"fields": []}',
    start_step_id UUID,
    max_iterations INTEGER DEFAULT 50, -- Safety limit for looping
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_workflow_id ON workflows(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows(is_active) WHERE is_active = TRUE;

-- Steps table
CREATE TABLE IF NOT EXISTS steps (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('task', 'approval', 'notification')),
    step_order INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rules table
CREATE TABLE IF NOT EXISTS rules (
    id UUID PRIMARY KEY,
    step_id UUID REFERENCES steps(id) ON DELETE CASCADE,
    condition TEXT NOT NULL,
    next_step_id UUID, -- Can be NULL for completion steps
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    workflow_version INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'canceled', 'pending_approval')),
    input_data JSONB,
    current_step_id UUID REFERENCES steps(id),
    retries INTEGER DEFAULT 0,
    triggered_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Execution Logs Table (for detailed step-by-step history)
CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID PRIMARY KEY,
    execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
    step_id UUID REFERENCES steps(id),
    rule_id UUID REFERENCES rules(id),
    rule_evaluation TEXT, -- JSON or string describing evaluations
    status TEXT,
    approver TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default Rules for steps if no condition matches
-- This can be handled in application logic or by a rule with high priority (large number) and condition 'TRUE'
