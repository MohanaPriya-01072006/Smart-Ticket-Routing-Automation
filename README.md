# ⚡ Halleyx Workflow Automation System

A robust, full-stack workflow engine designed for Enterprise-grade process automation. This system allows you to define complex business logic, visually monitor executions in real-time, and manage manual approval gates with high transparency.

## 🚀 Core Features

- **Dynamic Rule Engine**: Evaluate business logic using logical (`&&`, `||`) and comparison (`>`, `==`) operators with a prioritized execution strategy.
- **Interactive Rule Editor**: Drag-and-drop rule reordering with real-time syntax validation and syntax highlighting.
- **Live Execution Dashboard**: Monitor workflow runs in real-time with vibrant status indicators and sequential transition logs.
- **Manual Approval Gates**: Built-in support for `approval` steps that pause execution until a user decision (Approve/Reject) is made.
- **Step-Level Recovery**: Retry failed or canceled executions from the exact point of interruption.
- **Deep Audit Logging**: Comprehensive history of all executions, including granular JSON rule evaluation trails and timing forensics.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Vanilla CSS with a **Premium Dark Theme** featuring Glassmorphism, linear gradients, and micro-animations.
- **Icons**: Lucide React / Emoji icons
- **State Management**: React Hooks (useState, useEffect)
- **API Client**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Logic Engine**: Custom Modular Service-based Evaluation

---

## 📦 Setup Instructions

### Prerequisites
- Node.js (v16+)
- PostgreSQL installed and running
- A database named `workflow_engine`

### 1. Database Configuration
Update your PostgreSQL credentials in `backend/config/db.js`.

### 2. Backend Initialization
```bash
cd backend
npm install

# Initialize schema
node apply_schema.js      # Creates core tables and audit structures

# Start the server
npm start                 # Server runs on http://localhost:5000
```

### 3. Frontend Initialization
```bash
cd workflow-ui
npm install

# Start Vite dev server
npm run dev               # App runs on http://localhost:5173
```

---

## 📡 API Documentation

### Workflows
- `GET  /api/workflows`: List latest versions of all workflows (supports `search`, `page`, `limit`).
- `POST /api/workflows`: Create a new workflow.
- `PUT  /api/workflows/:id`: Create a new version of an existing workflow.
- `DELETE /api/workflows/:id`: Delete a specific version.

### Execution Control
- `POST /api/workflows/:id/execute`: Start a new execution run.
- `GET  /api/executions/:id`: Fetch detailed status and transition logs for a run.
- `POST /api/executions/:id/cancel`: Stop an active execution.
- `POST /api/executions/:id/retry`: Restart a failed or stopped execution.
- `POST /api/executions/:id/approve`: Submit a decision for an approval step (`decision: 'approve' | 'reject'`).

### Step & Rule Management
- `GET  /api/workflows/:id/steps`: List all steps in a workflow.
- `POST /api/steps/:id/rules`: Add a condition-based transition rule to a step.
- `PUT  /api/rules/batch/priority`: Update rule execution order via batch priority sync.

---

## 🏮 Workflow Engine Logic

The Halleyx Engine follows a **"First-Match-Wins"** prioritized strategy:
1. **Evaluation**: When a step completes, the engine fetches all rules for that step, sorted by `priority`.
2. **Matching**: The system evaluates each rule's `condition` against the current execution context (Global input + past step results).
3. **Transition**: The first rule to evaluate to `TRUE` determines the `next_step_id`.
4. **Completion**: If no rules match or no `next_step_id` is defined, the workflow completes.

---

## 📋 Sample Workflows

The system includes pre-configured elite examples:

### 1. Smart Ticket Routing
- **Triage**: High priority tickets bypass general intake and instantly escalate to Level 3 support.
- **Technical Support**: Technical issues are routed to engineering queues vs general billing queues.
- **Rule Fallbacks**: Intelligent `true` conditions ensure no ticket is left unrouted.

---

## ⚖️ License
Distributed under the MIT License. Built for the Halleyx Full Stack Engineer Challenge.
