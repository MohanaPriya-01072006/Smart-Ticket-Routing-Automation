import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * HistoryView Component
 * Provides a searchable/filterable audit log of all system executions.
 */
const HistoryView = () => {
  const [executionHistory, setExecutionHistory] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeStepLogs, setActiveStepLogs] = useState(null);
  const [inspectingId, setInspectingId] = useState(null);

  useEffect(() => {
    loadExecutionHistory();
  }, []);

  /**
   * Fetches the full list of execution records.
   */
  const loadExecutionHistory = async () => {
    setIsDataLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/executions`);
      setExecutionHistory(response.data);
    } catch (err) {
      console.error('Audit log retrieval failed:', err.message);
    } finally {
      setIsDataLoading(false);
    }
  };

  /**
   * Fetches detailed step logs for a specific execution record.
   */
  const loadDetailedLogs = async (id) => {
    setInspectingId(id);
    try {
      const response = await axios.get(`${API_BASE_URL}/executions/${id}`);
      const normalized = (response.data.logs || []).map((log) => {
        if (log && typeof log.rule_evaluation === 'string') {
          try {
            return { ...log, rule_evaluation: JSON.parse(log.rule_evaluation) };
          } catch {
            return log;
          }
        }
        return log;
      });
      setActiveStepLogs(normalized);
    } catch (err) {
      console.error(`Failed to fetch logs for ${id}:`, err.message);
    }
  };

  const deleteExecution = async (id) => {
    if (!window.confirm("Delete this execution and all its logs?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/executions/${id}`);
      setActiveStepLogs(null);
      setInspectingId(null);
      loadExecutionHistory();
      alert("Execution deleted.");
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleRetry = async (id) => {
    if (!window.confirm("Perform step-level recovery for this failed protocol?")) return;
    try {
      await axios.post(`${API_BASE_URL}/executions/${id}/retry`);
      loadExecutionHistory();
      alert("System: Recovery sequence initiated.");
    } catch (err) {
      alert("Recovery failed: " + err.message);
    }
  };



  const mapStatusToColor = (status) => {
    const colors = {
      completed: 'var(--success)',
      failed: 'var(--danger)',
      canceled: 'var(--muted)',
      in_progress: 'var(--accent2)',
      pending_approval: 'var(--warning)',
    };
    return colors[status] || 'var(--text)';
  };

  return (
    <div className="history-container animate-fade-in">
      {/* Header section with refresh control */}
      <div className="history-header">
        <div>
          <h2 className="history-title">Audit Log Explorer</h2>
          <p className="history-subtitle">Immutable record of every workflow decision and automated state change.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadExecutionHistory} disabled={isDataLoading}>
          {isDataLoading ? 'Syncing...' : '🔄 Refresh Logs'}
        </button>
      </div>

      {isDataLoading ? (
        <div className="history-state">
          <div className="loading-spinner" />
          <p>Scanning audit trails...</p>
        </div>
      ) : executionHistory.length === 0 ? (
        <div className="history-state">
          <p>The archives are empty. Start an execution to see records here.</p>
        </div>
      ) : (
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Logical ID</th>
                <th>Workflow Name</th>
                <th>Ver.</th>
                <th>System Status</th>
                <th>Triggered By</th>
                <th>Initialized</th>
                <th>Completed</th>
                <th>Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {executionHistory.map(record => (
                <tr key={record.id}>
                  <td className="id-cell">{record.id.slice(0, 8)}...</td>
                  <td className="workflow-cell">{record.workflow_name}</td>
                  <td>v{record.workflow_version || '1'}</td>
                  <td>
                    <div className="status-cell">
                      <span className="status-indicator" style={{ background: mapStatusToColor(record.status) }} />
                      <span style={{ color: mapStatusToColor(record.status), fontWeight: 700 }}>
                        {record.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td>{record.triggered_by}</td>
                  <td className="time-cell">{new Date(record.created_at).toLocaleString()}</td>
                  <td className="time-cell">{record.completed_at ? new Date(record.completed_at).toLocaleString() : '---'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => loadDetailedLogs(record.id)}>
                        🔍 Inspect
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--danger)', padding: '4px 8px' }}
                        onClick={() => deleteExecution(record.id)}
                      >
                        🗑️ Delete
                      </button>
                      {(record.status === 'failed' || record.status === 'canceled') && (
                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--warning)', padding: '4px 8px' }} onClick={() => handleRetry(record.id)}>
                          ⚡ Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Detail Modal */}
      {activeStepLogs && (
        <div className="modal-overlay animate-fade-in" onClick={() => setActiveStepLogs(null)}>
          <div className="modal-content log-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Protocol Diagnostics</h3>
                <p className="modal-subtitle">Full step-by-step trace for: <code style={{color:'var(--accent)'}}>{inspectingId}</code></p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-danger btn-sm" onClick={() => deleteExecution(inspectingId)}>
                  🗑️ Delete Logs
                </button>
                <button className="close-btn" onClick={() => setActiveStepLogs(null)}>&times;</button>
              </div>
            </div>
            
            <div className="log-list">
              {activeStepLogs.length === 0 ? (
                <div className="empty-logs">No operational logs recorded for this transaction.</div>
              ) : (
                activeStepLogs.map((log, index) => (
                  <div key={log.id} className="log-record">
                    <div className="log-meta">
                      <span className="log-badge">{log.status.toUpperCase()}</span>
                      <span className="log-stamp">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="log-main">
                      <div className="log-step">STEP: <strong>{log.step_id.slice(0,8)}</strong> ({log.execution_time_ms}ms)</div>
                      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'white' }}>
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
                      <div className="log-eval">
                        <div style={{ marginTop: 10, marginBottom: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                          Raw evaluation (JSON)
                        </div>
                        <pre style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          padding: '12px', 
                          borderRadius: '8px', 
                          fontSize: '11px', 
                          color: '#f8fafc',
                          overflowX: 'auto',
                          marginTop: '8px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {JSON.stringify(log.rule_evaluation, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer" style={{marginTop: '24px', textAlign: 'right'}}>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveStepLogs(null)}>Close Trace</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .history-container { padding: 4px; }
        .history-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .history-title { font-size: 26px; font-weight: 900; color: white; margin-bottom: 4px; letter-spacing: -0.5px; }
        .history-subtitle { font-size: 13px; color: var(--muted); }

        .history-table-wrapper { 
          background: rgba(30, 41, 59, 0.4); 
          border: 1px solid var(--border); 
          border-radius: 20px; 
          overflow: hidden; 
          backdrop-filter: var(--glass);
        }

        .history-table { width: 100%; border-collapse: collapse; text-align: left; }
        .history-table th { 
          padding: 16px 20px; 
          background: rgba(255,255,255,0.02); 
          font-size: 10px; 
          font-weight: 800; 
          color: var(--muted); 
          text-transform: uppercase; 
          letter-spacing: 1.5px; 
        }
        .history-table td { 
          padding: 16px 20px; 
          border-top: 1px solid var(--border); 
          font-size: 13px; 
          color: var(--text-bright);
        }

        .history-table tr:hover td { background: rgba(255,255,255,0.03); }

        .id-cell { font-family: monospace; color: var(--muted); font-size: 11px; }
        .workflow-cell { font-weight: 700; color: white; }
        .status-cell { display: flex; align-items: center; gap: 10px; font-size: 10px; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
        .time-cell { font-size: 12px; color: var(--muted); }

        .history-state { text-align: center; padding: 100px 0; color: var(--muted); }
        .loading-spinner { 
          width: 32px; height: 32px; border: 3px solid var(--border); 
          border-top-color: var(--accent); border-radius: 50%; 
          margin: 0 auto 16px; animation: spin 0.8s linear infinite; 
        }

        .log-modal { width: 650px; }
        .log-list { display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; padding-right: 8px; margin-top: 24px; }
        
        .log-record {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 8px;
        }

        .log-meta { display: flex; justify-content: space-between; align-items: center; }
        .log-badge { font-size: 9px; font-weight: 800; padding: 2px 8px; background: var(--border); border-radius: 4px; color: var(--muted); }
        .log-stamp { font-size: 11px; color: var(--muted); opacity: 0.6; }

        .log-main { display: flex; flex-direction: column; gap: 4px; }
        .log-step { font-size: 11px; color: var(--muted); }
        .log-eval { font-size: 13px; font-weight: 600; color: var(--accent2); }

        .empty-logs { padding: 40px; text-align: center; color: var(--muted); border: 2px dashed var(--border); border-radius: 16px; }

        .btn-ghost { background: transparent; border: 1px solid transparent; color: var(--accent); font-weight: 700; }
        .btn-ghost:hover { background: rgba(99, 102, 241, 0.1); border-color: var(--accent); }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default HistoryView;
