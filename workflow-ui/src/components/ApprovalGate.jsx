import React, { useState } from 'react';

const APPROVER_ROLES = [
  { value: 'Manager',    icon: '👔', color: '#6366f1' },
  { value: 'CEO',        icon: '🏢', color: '#8b5cf6' },
  { value: 'Team Lead',  icon: '👥', color: '#0ea5e9' },
  { value: 'Supervisor', icon: '🛡️', color: '#10b981' },
  { value: 'Director',   icon: '📋', color: '#f59e0b' },
];

/**
 * ApprovalGate — Pre-execution approval modal.
 * Shown before any workflow execution begins.
 *
 * @param {Object}   props.workflow   - Workflow object being approved.
 * @param {Function} props.onApprove  - Called with (role) when approved.
 * @param {Function} props.onReject   - Called with (role) when rejected.
 * @param {Function} props.onClose    - Called when modal is dismissed.
 */
const ApprovalGate = ({ workflow, onApprove, onReject, onClose }) => {
  const [selectedRole, setSelectedRole] = useState('Manager');
  const [loading, setLoading] = useState(null); // 'approve' | 'reject'

  const handleDecision = async (decision) => {
    setLoading(decision);
    await new Promise(r => setTimeout(r, 300)); // brief visual feedback
    if (decision === 'approve') {
      onApprove(selectedRole);
    } else {
      onReject(selectedRole);
    }
    setLoading(null);
  };

  const selected = APPROVER_ROLES.find(r => r.value === selectedRole);

  return (
    <div className="ag-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal animate-fade-in">

        {/* Glow effect */}
        <div className="ag-glow" style={{ background: selected?.color }} />

        {/* Header */}
        <div className="ag-header">
          <div className="ag-icon">⚡</div>
          <div>
            <h2 className="ag-title">Approval Required</h2>
            <p className="ag-sub">Review and authorize this workflow execution</p>
          </div>
        </div>

        {/* Workflow Info */}
        <div className="ag-wf-card">
          <div className="ag-wf-label">WORKFLOW</div>
          <div className="ag-wf-name">{workflow?.name || 'Unknown Workflow'}</div>
          <div className="ag-wf-id">ID: {workflow?.workflow_id?.slice(0, 12)}...</div>
        </div>

        {/* Role Selector */}
        <div className="ag-section">
          <label className="ag-label">Approver Role</label>
          <div className="ag-role-grid">
            {APPROVER_ROLES.map(role => (
              <button
                key={role.value}
                className={`ag-role-btn ${selectedRole === role.value ? 'active' : ''}`}
                style={selectedRole === role.value ? { borderColor: role.color, background: `${role.color}18` } : {}}
                onClick={() => setSelectedRole(role.value)}
              >
                <span className="ag-role-icon">{role.icon}</span>
                <span className="ag-role-name">{role.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected role preview */}
        <div className="ag-preview" style={{ borderColor: `${selected?.color}55`, background: `${selected?.color}0d` }}>
          <span style={{ fontSize: 18 }}>{selected?.icon}</span>
          <span style={{ color: selected?.color, fontWeight: 700 }}>
            {selectedRole} is about to {' '}
            <span style={{ color: 'white' }}>approve or reject</span>
            {' '} this execution
          </span>
        </div>

        {/* Action Buttons */}
        <div className="ag-actions">
          <button
            className="ag-btn ag-btn-reject"
            disabled={!!loading}
            onClick={() => handleDecision('reject')}
          >
            {loading === 'reject' ? (
              <span className="ag-spinner" />
            ) : '✕'}
            <span>{loading === 'reject' ? 'Rejecting...' : 'Reject'}</span>
          </button>
          <button
            className="ag-btn ag-btn-approve"
            disabled={!!loading}
            onClick={() => handleDecision('approve')}
          >
            {loading === 'approve' ? (
              <span className="ag-spinner" />
            ) : '✓'}
            <span>{loading === 'approve' ? 'Approving...' : 'Approve'}</span>
          </button>
        </div>

        <div className="ag-footer">
          This decision will be recorded in the audit log
        </div>

      </div>

      <style>{`
        .ag-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 24px;
        }

        .ag-modal {
          position: relative;
          background: linear-gradient(160deg, rgba(17, 24, 39, 0.98), rgba(30, 41, 59, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          padding: 40px;
          width: 100%;
          max-width: 520px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
        }

        .ag-glow {
          position: absolute;
          top: -80px;
          right: -80px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.2;
          pointer-events: none;
          transition: background 0.4s ease;
        }

        .ag-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }

        .ag-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        }

        .ag-title {
          font-size: 22px;
          font-weight: 800;
          color: white;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }

        .ag-sub {
          font-size: 13px;
          color: rgba(148, 163, 184, 0.9);
        }

        .ag-wf-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 24px;
        }

        .ag-wf-label {
          font-size: 10px;
          font-weight: 700;
          color: rgba(148, 163, 184, 0.7);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .ag-wf-name {
          font-size: 18px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }

        .ag-wf-id {
          font-size: 11px;
          color: rgba(148, 163, 184, 0.6);
          font-family: monospace;
        }

        .ag-section {
          margin-bottom: 20px;
        }

        .ag-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: rgba(148, 163, 184, 0.8);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .ag-role-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .ag-role-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: white;
        }

        .ag-role-btn:hover {
          background: rgba(255, 255, 255, 0.07);
          transform: translateY(-2px);
        }

        .ag-role-btn.active {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }

        .ag-role-icon {
          font-size: 20px;
        }

        .ag-role-name {
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          color: rgba(255,255,255,0.8);
        }

        .ag-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid;
          margin-bottom: 28px;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .ag-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 20px;
        }

        .ag-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .ag-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ag-btn-approve {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        }

        .ag-btn-approve:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(16, 185, 129, 0.45);
        }

        .ag-btn-reject {
          background: linear-gradient(135deg, #b91c1c, #ef4444);
          color: white;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
        }

        .ag-btn-reject:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(239, 68, 68, 0.45);
        }

        .ag-footer {
          text-align: center;
          font-size: 11px;
          color: rgba(148, 163, 184, 0.5);
        }

        .ag-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: ag-spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes ag-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ApprovalGate;
