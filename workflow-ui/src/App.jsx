import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Components
import WorkflowList from './components/WorkflowList';
import WorkflowEditor from './components/WorkflowEditor';
import ExecutionPanel from './components/ExecutionPanel';
import HistoryView from './components/HistoryView';
import ApprovalGate from './components/ApprovalGate';

const API = 'http://localhost:5000/api';

export default function App() {
  const [currentView, setCurrentView] = useState('list'); // list, editor, history
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [executionState, setExecutionState] = useState({ activeId: null, statuses: {} });
  const [autoStartExecution, setAutoStartExecution] = useState(false);
  const [approvedBy, setApprovedBy] = useState(null); // role string e.g. "Manager"

  // Approval gate state
  const [gateWorkflow, setGateWorkflow] = useState(null); // workflow pending approval

  // Rejection notice state
  const [rejectionNotice, setRejectionNotice] = useState(null); // { role, workflowName }

  useEffect(() => {
    localStorage.setItem('app-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Auto-dismiss rejection notice after 4s
  useEffect(() => {
    if (!rejectionNotice) return;
    const t = setTimeout(() => setRejectionNotice(null), 4000);
    return () => clearTimeout(t);
  }, [rejectionNotice]);

  const handleNewWorkflow = async () => {
    const name = prompt('Enter workflow name:', 'New Workflow');
    if (!name) return;

    try {
      const res = await axios.post(`${API}/workflows`, { 
        name, 
        input_schema: { fields: [
          { name: 'user_name', label: 'User Name', type: 'text' },
          { name: 'issue_type', label: 'Issue Type', type: 'select', options: ['technical', 'billing', 'general'] },
          { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'] },
          { name: 'description', label: 'Description', type: 'text' }
        ]} 
      });
      setSelectedWorkflow(res.data);
      setCurrentView('editor');
    } catch (err) {
      console.error('Error creating workflow:', err?.message || err);
      alert('Error creating workflow');
    }
  };

  const handleSelectWorkflow = (wf, view = 'editor') => {
    setSelectedWorkflow(wf);
    setCurrentView(view);
  };

  /**
   * Called when user clicks Execute⚡ on a workflow card.
   * Opens the ApprovalGate instead of going straight to execution.
   */
  const handleExecuteRequest = (wf) => {
    setGateWorkflow(wf);
  };

  /**
   * Approval granted — record role, navigate to editor, auto-start.
   */
  const handleGateApprove = (role) => {
    setApprovedBy(role);
    setGateWorkflow(null);
    setAutoStartExecution(true);
    handleSelectWorkflow(gateWorkflow, 'editor');
  };

  /**
   * Approval rejected — log a rejected entry via API and show notice.
   */
  const handleGateReject = async (role) => {
    const wf = gateWorkflow;
    setGateWorkflow(null);
    setRejectionNotice({ role, workflowName: wf?.name });

    // Record a rejected execution in the audit log
    try {
      const response = await axios.post(`${API}/workflows/${wf.workflow_id}/execute`, {
        triggered_by: `${role} (Web Dashboard)`,
        _pre_rejected: true,
        _approver_role: role,
      });
      // Immediately reject it
      if (response.data?.execution_id) {
        await axios.post(`${API}/executions/${response.data.execution_id}/approve`, {
          decision: 'reject',
          approver_role: role,
        });
      }
    } catch (err) {
      console.warn('Could not persist rejection log:', err.message);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'editor':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', flex: 1, overflow: 'hidden' }}>
            <WorkflowEditor 
              workflow={selectedWorkflow} 
              onBack={() => setCurrentView('list')} 
              executionState={executionState}
              onWorkflowUpdate={(updatedFields) => {
                setSelectedWorkflow(prev => ({ ...prev, ...updatedFields }));
              }}
            />
            <div style={{ borderLeft: '1px solid var(--border)', padding: '16px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.4)' }}>
              <ExecutionPanel 
                workflow={selectedWorkflow} 
                onStatusUpdate={(activeId, statuses) => setExecutionState({ activeId, statuses })}
                autoStart={autoStartExecution}
                onAutoStartConsumed={() => setAutoStartExecution(false)}
                approvedBy={approvedBy}
                onApprovedByChange={setApprovedBy}
              />
            </div>
          </div>
        );
      case 'history':
        return <HistoryView />;
      case 'list':
      default:
        return (
          <WorkflowList 
            onSelect={(wf) => handleSelectWorkflow(wf, 'editor')} 
            onNew={handleNewWorkflow} 
            onExecute={handleExecuteRequest}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      <header className="header" style={{ backdropFilter: 'var(--glass)', background: 'rgba(30, 41, 59, 0.8)' }}>
        <div className="header-logo" onClick={() => setCurrentView('list')} style={{ cursor: 'pointer' }}>
          <span className="icon">⚡</span>Halleyx Workflow Engine
        </div>
        <div className="header-actions">
          <button className={`btn btn-sm ${currentView === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentView('list')}>📦 Workflows</button>
          <button className={`btn btn-sm ${currentView === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentView('history')}>📋 Audit History</button>
        </div>
      </header>

      <div className="workspace" style={{ padding: currentView === 'editor' ? 0 : '32px', overflowY: 'auto' }}>
        {renderContent()}
      </div>

      {/* Approval Gate Modal */}
      {gateWorkflow && (
        <ApprovalGate
          workflow={gateWorkflow}
          onApprove={handleGateApprove}
          onReject={handleGateReject}
          onClose={() => setGateWorkflow(null)}
        />
      )}

      {/* Rejection Toast Notice */}
      {rejectionNotice && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(185,28,28,0.95), rgba(239,68,68,0.95))',
          border: '1px solid rgba(239,68,68,0.5)',
          borderRadius: 16,
          padding: '18px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: 'white',
          fontWeight: 600,
          fontSize: 15,
          boxShadow: '0 16px 48px rgba(239,68,68,0.4)',
          zIndex: 10000,
          animation: 'fadeIn 0.3s ease',
          backdropFilter: 'blur(12px)',
          minWidth: 320,
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22 }}>❌</span>
          <div>
            <div>{rejectionNotice.role} Rejected</div>
            <div style={{ fontWeight: 400, fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              "{rejectionNotice.workflowName}" — Request Denied
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        
      `}</style>
    </div>
  );
}
