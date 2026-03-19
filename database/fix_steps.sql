DROP TABLE IF EXISTS steps;

CREATE TABLE steps (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(100),
  next_step_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
