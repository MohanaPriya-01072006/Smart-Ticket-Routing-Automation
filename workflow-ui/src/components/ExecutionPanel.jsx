import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

import API_BASE_URL from '../api';

const API = API_BASE_URL;

/**
 * ExecutionPanel Component
 * Handles the configuration and monitoring of a workflow run.
 * 
 * @param {Object} props
 * @param {Object} props.workflow - The active workflow version to execute.
 * @param {Function} props.onBack - Callback to return to the workflow list.
 */
const ExecutionPanel = ({ workflow, onBack, onStatusUpdate, autoStart, onAutoStartConsumed, approvedBy, onApprovedByChange }) => {
  // Input State
  const [inputValues, setInputValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Execution Context State
  const [currentExecutionId, setCurrentExecutionId] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [userError, setUserError] = useState(null);
  
  // UI Controls
  const [expandedLogIds, setExpandedLogIds] = useState(() => new Set());
  const [pendingDecisionType, setPendingDecisionType] = useState(null);
  const poolingRef = useRef(null);

  // Derived Input Schema
  const inputSchema = workflow.input_schema || { fields: [] };
  
  // Normalize schema layout (handles both { fields: [...] } and dictionary { fieldName: { ... } } structures)
  const schemaFields = Array.isArray(inputSchema.fields) 
    ? inputSchema.fields 
    : Object.keys(inputSchema).map(key => ({
        name: key,
        ...inputSchema[key]
      }));

  useEffect(() => {
    return () => stopStatusPolling();
  }, []);

  useEffect(() => {
    // Clear stale errors when switching workflows
    setUserError(null);
  }, [workflow?.workflow_id]);

  useEffect(() => {
    if (!autoStart) return;
    // Consume immediately so it doesn't re-trigger on re-renders.
    if (typeof onAutoStartConsumed === 'function') onAutoStartConsumed();
    // Don't interrupt an active run.
    if (currentExecutionId || isSubmitting) return;
    // Kick off execution with whatever inputs are currently provided.
    startExecution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const stopStatusPolling = () => {
    if (poolingRef.current) {
      clearInterval(poolingRef.current);
      poolingRef.current = null;
    }
  };

  /**
   * Updates local input state for a specific field.
   */
  const handleFieldChange = (fieldName, rawValue, type) => {
    const processedValue = type === 'number' ? parseFloat(rawValue) : rawValue;
    setInputValues(prev => ({ ...prev, [fieldName]: processedValue }));
  };

  /**
   * Initiates a new workflow execution via the API.
   */
  const startExecution = async () => {
    setIsSubmitting(true);
    setCurrentExecutionId(null);
    setExecutionStatus('initializing');
    setExecutionLogs([]);
    setUserError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/workflows/${workflow.workflow_id}/execute`, {
        ...inputValues,
        triggered_by: `${approvedBy ? approvedBy + ' (Web Dashboard)' : 'Web Dashboard'}`,
        approved_by: approvedBy || null
      });
      
      const execId = response.data.execution_id;
      setCurrentExecutionId(execId);
      beginStatusPolling(execId);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('Failed to start execution:', errorMsg);
      setExecutionStatus('failed');
      setUserError(
        `Execution failed to start. ${errorMsg}${
          errorMsg?.includes('Network') || errorMsg?.includes('ECONN') || errorMsg?.includes('fetch')
            ? ` (Is the backend running at ${API_BASE_URL}?)`
            : ''
        }`
      );
      setIsSubmitting(false);
    }
  };

  const restartExecution = async () => {
    if (isSubmitting) return;
    setCurrentExecutionId(null);
    setExecutionStatus(null);
    setExecutionLogs([]);
    setExpandedLogIds(new Set());
    await startExecution();
  };

  /**
   * Establishes a periodic check for execution status updates.
   */
  const beginStatusPolling = (id) => {
    stopStatusPolling();
    poolingRef.current = setInterval(() => updateExecutionSnapshot(id), 1500);
  };

  /**
   * Synchronizes local execution state with the server.
   */
  const updateExecutionSnapshot = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/executions/${id}`);
      const { status, logs, current_step_id } = response.data;
      
      setExecutionStatus(status);
      const normalizedLogs = (logs || []).map((log) => {
        if (log && typeof log.rule_evaluation === 'string') {
          try {
            return { ...log, rule_evaluation: JSON.parse(log.rule_evaluation) };
          } catch {
            return log;
          }
        }
        return log;
      });
      setExecutionLogs(normalizedLogs);
      
      // Calculate step statuses from logs
      const stepStatuses = {};
      (normalizedLogs || []).forEach(log => {
        if (log.step_id) {
          stepStatuses[log.step_id] = log.status;
        }
      });
      if (current_step_id && status === 'in_progress') {
        stepStatuses[current_step_id] = 'in_progress';
      }

      if (typeof onStatusUpdate === 'function') {
        onStatusUpdate(current_step_id, stepStatuses);
      }

      const isTerminal = ['completed', 'failed', 'canceled'].includes(status);
      if (isTerminal) {
        stopStatusPolling();
        setIsSubmitting(false);
      }
    } catch (err) {
      console.warn('Network heartbeat failed:', err.message);
      // Surface repeated connectivity issues to the user instead of only console logging.
      setUserError(prev => prev || `Lost connection to backend while tracking execution. (${err.message})`);
    }
  };

  /**
   * Submits a user decision for an approval step.
   */
  const submitApprovalDecision = async (decision) => {
    setPendingDecisionType(decision);
    try {
      await axios.post(`${API_BASE_URL}/executions/${currentExecutionId}/approve`, {
        decision,
        approver_role: approvedBy || 'Operator'
      });
      // Refresh status immediately
      await updateExecutionSnapshot(currentExecutionId);
    } catch (err) {
      console.error(`Approval '${decision}' failed:`, err.message);
    } finally {
      setPendingDecisionType(null);
    }
  };

  const cancelActiveRun = async () => {
    if (!window.confirm('Requesting termination. Continue?')) return;
    try {
      await axios.post(`${API_BASE_URL}/executions/${currentExecutionId}/cancel`);
      await updateExecutionSnapshot(currentExecutionId);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Termination request failed';
      console.error('Termination request failed:', msg);
      setUserError(prev => prev || msg);
    }
  };

  const startFullRetry = async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/executions/${currentExecutionId}/retry`);
      const newId = response.data.retry_id;
      setCurrentExecutionId(newId);
      beginStatusPolling(newId);
    } catch (err) {
      console.error('Retry failed:', err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="execution-container animate-fade-in">
      {/* Header Section */}
      <div className="exec-header">
        <div className="header-info">
          <h2 className="exec-title">{workflow.name}</h2>
          <p className="exec-subtitle">Version v{workflow.version} • Logic: {workflow.workflow_id.slice(0,8)}</p>
        </div>
        <div className="header-actions">
           <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
             Developer logs enabled
           </div>
           {onBack && <button className="btn btn-secondary btn-sm" onClick={onBack}>Close Panel</button>}
        </div>
      </div>

      <div className="exec-body">
        {/* Input & Control Panel */}
        <section className={`input-section ${currentExecutionId ? 'minimized' : ''}`}>
          {userError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: 'rgba(255,255,255,0.92)',
                padding: '12px 14px',
                borderRadius: 14,
                fontSize: 12,
                lineHeight: 1.35
              }}
            >
              <strong style={{ color: 'var(--danger)' }}>Error</strong>
              <div style={{ marginTop: 6 }}>{userError}</div>
            </div>
          )}
          <div className="section-card">
            <h3 className="section-title">Workflow Arguments</h3>
            <div className="form-grid">
              {schemaFields.map(field => (
                <div key={field.name} className="form-group">
                  <label className="form-label">
                    {field.label || field.name.replace('_', ' ').toUpperCase()} {field.required && <span style={{color: '#ef4444'}}>*</span>}
                  </label>
                  {(field.allowed_values || field.options) ? (
                    <select
                      className="form-input"
                      value={inputValues[field.name] || ''}
                      onChange={e => handleFieldChange(field.name, e.target.value, field.type)}
                      disabled={isSubmitting}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="" disabled>Select {field.name.replace('_', ' ')}...</option>
                      {(field.allowed_values || field.options).map(val => (
                        <option key={val} value={val}>{val.toUpperCase()}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      className="form-input" 
                      type={field.type || 'text'} 
                      placeholder={`Provide ${field.name.replace('_', ' ')}...`}
                      value={inputValues[field.name] || ''} 
                      onChange={e => handleFieldChange(field.name, e.target.value, field.type)}
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary run-btn"
              onClick={currentExecutionId ? restartExecution : startExecution}
              disabled={isSubmitting}
            >
              {isSubmitting ? '🚀 Starting Run...' : currentExecutionId ? '↻ Run Again' : '▶ Launch Execution'}
            </button>

            {(currentExecutionId || executionStatus) && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                <div>
                  <strong style={{ color: 'white' }}>Latest run</strong>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span>Execution ID:</span>{' '}
                  <code style={{ color: 'var(--accent2)' }}>{currentExecutionId || '---'}</code>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span>Status:</span>{' '}
                  <strong style={{ color: 'white' }}>{executionStatus?.replace('_', ' ').toUpperCase() || '---'}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Control Cards */}
          {executionStatus === 'pending_approval' && (
            <div className="approval-card animate-fade-in">
              <div className="approval-glow" />
              <h3>Human Decision Point</h3>
              <p>Critical verification required before proceeding.</p>
              {approvedBy && (
                <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
                  👔 Approver: <strong style={{ color: 'white' }}>{approvedBy}</strong>
                </div>
              )}
              <div className="approval-btns">
                <button 
                  className="btn btn-success" 
                  onClick={() => submitApprovalDecision('approve')}
                  disabled={pendingDecisionType}
                >
                  {pendingDecisionType === 'approve' ? '...' : `✓ ${approvedBy || 'Operator'} Approves`}
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => submitApprovalDecision('reject')}
                  disabled={pendingDecisionType}
                >
                  {pendingDecisionType === 'reject' ? '...' : `✕ ${approvedBy || 'Operator'} Rejects`}
                </button>
              </div>
            </div>
          )}
          
          {(executionStatus === 'failed' || executionStatus === 'canceled') && (
            <div className="retry-card animate-fade-in">
              <p>Session stopped status: <strong>{executionStatus.toUpperCase()}</strong></p>
              <button className="btn btn-primary btn-sm" onClick={startFullRetry}>↻ Restart Workflow</button>
            </div>
          )}
        </section>

        {/* Real-time Status & Logging Section */}
        <section className="progress-section">
          <div className="status-banner">
            <div className="current-status">
              <span className="label">Execution Engine Status</span>
              <div className="status-wrapper">
                <span className={`status-dot ${executionStatus}`} />
                <span className={`status-text ${executionStatus}`}>{executionStatus?.replace('_', ' ').toUpperCase() || 'STANDBY'}</span>
              </div>
            </div>
            {currentExecutionId && ['in_progress', 'pending', 'pending_approval'].includes(executionStatus) && (
              <button className="btn btn-danger btn-sm" onClick={cancelActiveRun}>Kill Process</button>
            )}
          </div>

          <div className="log-timeline">
            {executionLogs.length === 0 ? (
              <div className="log-empty">Waiting for engine initialization...</div>
            ) : (
              executionLogs.map((log, index) => {
                // Determine if this log entry is an approval decision
                const isApproved = log.approver && log.rule_evaluation &&
                  (typeof log.rule_evaluation === 'string'
                    ? log.rule_evaluation.toLowerCase().includes('approve')
                    : log.rule_evaluation?.message?.toLowerCase()?.includes('approve') ||
                      JSON.stringify(log.rule_evaluation || '').toLowerCase().includes('approve'));
                const isRejected = log.approver && log.rule_evaluation &&
                  (typeof log.rule_evaluation === 'string'
                    ? log.rule_evaluation.toLowerCase().includes('reject')
                    : log.rule_evaluation?.message?.toLowerCase()?.includes('reject') ||
                      JSON.stringify(log.rule_evaluation || '').toLowerCase().includes('reject'));

                return (
                  <div key={log.id} className="log-row animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className={`log-indicator ${log.status}`} />
                    <div className="log-content">
                      {/* Approver Badge — shown when a role made a decision */}
                      {log.approver && (
                        <div className={`approver-badge ${isRejected ? 'rejected' : 'approved'}`}>
                          <span className="approver-badge-icon">{isRejected ? '❌' : '✅'}</span>
                          <span className="approver-badge-text">
                            {log.approver} {isRejected ? 'Rejected' : 'Approved'}
                          </span>
                          <span className="approver-badge-time">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      <div className="log-header">
                        <span className="log-step-name">
                          STEP: {log.step_name || log.step_id?.slice(0,8) || '—'}
                          {log.rule_condition ? (
                            <span style={{ marginLeft: 10, color: 'var(--muted)', fontWeight: 600 }}>
                              IF {log.rule_condition}
                            </span>
                          ) : null}
                        </span>
                        {!log.approver && (
                          <span className="log-time">{new Date(log.created_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                      <div className="log-msg">
                        {(() => {
                          const ev = log.rule_evaluation;
                          if (ev && typeof ev === 'object') {
                            if (ev.message) return ev.message;
                            if (ev.decision?.matched_rule_id) {
                              const next = ev.decision?.next_step_id ? ev.decision.next_step_id.slice(0, 8) : 'END';
                              return `Rule matched (${ev.decision.matched_rule_id.slice(0, 8)}), moving to ${next}.`;
                            }
                            if (typeof ev.decision === 'string') return ev.decision;
                            return 'Step completed.';
                          }
                          if (typeof ev === 'string') return ev;
                          return log.status === 'completed' ? 'Step completed.' : 'Step failed.';
                        })()}
                      </div>

                      {log.rule_evaluation && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setExpandedLogIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(log.id)) next.delete(log.id);
                                else next.add(log.id);
                                return next;
                              });
                            }}
                          >
                            {expandedLogIds.has(log.id) ? 'Hide JSON' : 'Show JSON'}
                          </button>
                          {expandedLogIds.has(log.id) && (
                            <pre className="log-json">{JSON.stringify(log.rule_evaluation, null, 2)}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div className="timeline-connector" />
          </div>
        </section>
      </div>

      <style jsx>{`
        .execution-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: var(--glass);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
        }

        .exec-header {
          padding: 24px 32px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(30, 41, 59, 0.5);
        }

        .exec-title { font-size: 20px; font-weight: 600; color: white; }
        .exec-subtitle { font-size: 12px; color: var(--muted); margin-top: 4px; }

        .exec-body {
          flex: 1;
          display: grid;
          grid-template-columns: 350px 1fr;
          overflow: hidden;
        }

        .input-section {
          padding: 32px;
          border-right: 1px solid var(--border);
          background: rgba(15, 23, 42, 0.2);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          transition: all 0.5s ease;
        }

        .section-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          padding: 24px;
          border-radius: 20px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 20px;
          display: block;
        }

        .run-btn { width: 100%; height: 48px; justify-content: center; margin-top: 24px; font-size: 14px; }

        .approval-card {
          position: relative;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(30, 41, 59, 0.5));
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 24px;
          border-radius: 20px;
          overflow: hidden;
          text-align: center;
        }

        .approval-glow {
          position: absolute; top: -50px; left: -50px; width: 100px; height: 100px;
          background: var(--warning); filter: blur(60px); opacity: 0.3;
        }

        .approval-card h3 { font-size: 16px; margin-bottom: 8px; color: var(--warning); }
        .approval-card p { font-size: 12px; color: var(--muted); margin-bottom: 20px; }
        .approval-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .progress-section {
          padding: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent);
        }

        .status-banner {
          padding: 24px 32px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .current-status .label { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px; }
        .status-wrapper { display: flex; align-items: center; gap: 10px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); position: relative; }
        .status-dot.in_progress, .status-dot.pending { background: var(--accent2); box-shadow: 0 0 10px var(--accent2); }
        .status-dot.completed { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .status-dot.failed { background: var(--danger); box-shadow: 0 0 10px var(--danger); }
        .status-dot.pending_approval { background: var(--warning); box-shadow: 0 0 10px var(--warning); }

        .status-text { font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
        .status-text.completed { color: var(--success); }
        .status-text.in_progress { color: var(--accent2); }
        .status-text.pending_approval { color: var(--warning); }

        .log-timeline {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .timeline-connector {
          position: absolute; left: 52px; top: 40px; bottom: 40px;
          width: 2px; background: linear-gradient(to bottom, var(--border), rgba(255,255,255,0.02));
          z-index: 1;
        }

        .log-row { display: flex; gap: 24px; position: relative; z-index: 2; }
        .log-indicator {
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--sidebar-bg); border: 2px solid var(--border);
          flex-shrink: 0;
        }
        .log-indicator.completed { background: var(--success); border-color: var(--success); box-shadow: 0 0 8px var(--success); }
        .log-indicator.failed { background: var(--danger); border-color: var(--danger); }

        .log-content {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          padding: 16px 20px;
          border-radius: 16px;
        }

        .log-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .log-step-name { font-size: 11px; font-weight: 600; color: var(--muted); }
        .log-time { font-size: 11px; color: var(--muted); opacity: 0.6; }
        .log-msg { font-size: 14px; font-weight: 600; color: white; }

        /* Approver badge styles */
        .approver-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 10px;
          margin-bottom: 10px;
          font-size: 13px;
          font-weight: 700;
        }
        .approver-badge.approved {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #10b981;
        }
        .approver-badge.rejected {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #ef4444;
        }
        .approver-badge-icon { font-size: 16px; }
        .approver-badge-text { flex: 1; }
        .approver-badge-time { font-size: 10px; font-weight: 400; opacity: 0.6; }
        
        .log-json {
          margin-top: 12px; padding: 12px;
          background: rgba(0,0,0,0.3); border-radius: 8px;
          font-family: monospace; font-size: 11px; color: var(--accent2);
          overflow-x: auto;
        }

        .log-target { margin-top: 8px; font-size: 12px; color: var(--muted); }
        .log-target .highlight { color: var(--accent); font-weight: 600; }

        .log-empty { text-align: center; color: var(--muted); padding: 64px; }
        
        .retry-card {
           background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px;
           text-align: center; font-size: 12px; color: var(--muted);
        }
        .retry-card p { margin-bottom: 12px; }
      `}</style>
    </div>
  );
};

export default ExecutionPanel;
