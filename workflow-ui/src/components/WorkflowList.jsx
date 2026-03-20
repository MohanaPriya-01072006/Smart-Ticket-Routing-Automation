import React, { useState, useEffect } from 'react';
import axios from 'axios';

import API_BASE_URL from '../api';

const API = API_BASE_URL;

const WorkflowList = ({ onSelect, onNew, onExecute }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(6);

  useEffect(() => {
    fetchWorkflows();
  }, [page, search]);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/workflows`, {
        params: { search, page, limit }
      });
      setWorkflows(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async (e, wf) => {
    e.stopPropagation();
    if (window.confirm('Delete the entire workflow (all versions) AND its logs?')) {
      try {
        await axios.delete(`${API}/workflows/logical/${wf.workflow_id}`);
        fetchWorkflows();
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Error deleting workflow';
        alert(msg);
      }
    }
  };

  const clearWorkflowLogs = async (e, workflowLogicalId) => {
    e.stopPropagation();
    if (!window.confirm('Delete ALL executions + logs for this workflow?')) return;
    try {
      await axios.delete(`${API}/workflows/${workflowLogicalId}/executions`);
      alert('Logs deleted for this workflow.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete logs';
      alert(msg);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="workflow-list-container animate-fade-in">
      <div className="list-header" style={{ padding: '0 24px' }}>
        <div>
          <h1 className="title">Workflow Automations</h1>
          <p className="subtitle">Manage and monitor your automated processes</p>
        </div>
        <button className="btn btn-primary" onClick={onNew} style={{ margin: '0 12px' }}>
          <span style={{fontSize: '1.2em'}}>+</span> Create Workflow
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search workflows by name..." 
            className="search-input"
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loader"></div>
          <p>Fetching your workflows...</p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h3>No Workflows Found</h3>
          <p>Try adjusting your search or create a new workflow to get started.</p>
          <button className="btn btn-secondary" onClick={() => setSearch('')}>Clear Search</button>
        </div>
      ) : (
        <>
          <div className="workflow-grid">
            {workflows.map((wf, index) => (
              <div 
                key={wf.id} 
                className="workflow-card" 
                style={{animationDelay: `${index * 0.05}s`}}
                onClick={() => onSelect(wf)}
              >
                <div className="card-top">
                  <div>
                    <h3 className="wf-name">{wf.name}</h3>
                    <div className="wf-id">ID: {wf.workflow_id.slice(0, 8)}...</div>
                  </div>
                  <span className={`status-badge ${wf.is_active ? 'active' : 'draft'}`}>
                    {wf.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>

                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-label">Version</span>
                    <span className="stat-value">v{wf.version}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Steps</span>
                    <span className="stat-value">{wf.step_count || 0}</span>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="action-btn delete" title="Delete workflow" onClick={(e) => deleteWorkflow(e, wf)}>
                    🗑️
                  </button>
                  <button className="action-btn" title="Delete logs" onClick={(e) => clearWorkflowLogs(e, wf.workflow_id)}>
                    🧾
                  </button>
                  <button className="action-btn edit" title="Edit">
                    ✏️
                  </button>
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={(e) => { e.stopPropagation(); onExecute(wf); }}
                  >
                    Execute ⚡
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button 
              className="page-btn" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Previous
            </button>
            <span className="page-info">
              Page <strong>{page}</strong> of {Math.ceil(total / limit) || 1}
            </span>
            <button 
              className="page-btn" 
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .workflow-list-container {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
          height: 100%;
          overflow-y: auto;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }

        .subtitle {
          color: var(--muted);
          font-size: 14px;
        }

        .filter-bar {
          margin-bottom: 24px;
        }

        .search-wrapper {
          position: relative;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          opacity: 0.5;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 40px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: white;
          font-family: var(--font);
          backdrop-filter: var(--glass);
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .workflow-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          backdrop-filter: var(--glass);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeIn 0.4s ease-out forwards;
          opacity: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .workflow-card:hover {
          transform: translateY(-6px);
          border-color: var(--accent);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          background: rgba(30, 41, 59, 0.9);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .wf-name {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .wf-id {
          font-size: 12px;
          color: var(--muted);
          font-family: monospace;
        }

        .status-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.5px;
        }

        .status-badge.active { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-badge.draft { background: rgba(148, 163, 184, 0.1); color: var(--muted); }

        .card-stats {
          display: flex;
          gap: 24px;
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.3);
          border-radius: 12px;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 700;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: auto;
        }

        .action-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: scale(1.05);
        }

        .action-btn.delete:hover { border-color: var(--danger); color: var(--danger); }
        .action-btn.edit:hover { border-color: var(--accent); color: var(--accent); }

        .pagination {
          margin-top: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .page-btn {
          background: var(--card-bg);
          border: 1px solid var(--border);
          color: white;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-btn:not(:disabled):hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.1);
        }

        .page-info {
          font-size: 14px;
          color: var(--muted);
        }

        .loading-state {
          text-align: center;
          padding: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .loader {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 80px;
          background: var(--card-bg);
          border-radius: 20px;
          border: 1px dashed var(--border);
        }

        .empty-icon { font-size: 48px; margin-bottom: 16px; }
      `}</style>
    </div>
  );
};

export default WorkflowList;
