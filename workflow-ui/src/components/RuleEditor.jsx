import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * RuleEditor Component
 * Responsible for managing transition logic (rules) for a specific step.
 * Includes drag-and-drop reordering for priority management.
 * 
 * @param {Object} props
 * @param {Object} props.step - The step object including its rules and all available destination steps.
 * @param {Function} props.onClose - Modal close callback.
 */
const RuleEditor = ({ step, onClose, onRulesChanged }) => {
  const [transitionRules, setTransitionRules] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [newRuleData, setNewRuleData] = useState({ condition: '', next_step_id: '', priority: 0 });
  const [syntaxErrorMessage, setSyntaxErrorMessage] = useState('');
  const [activeDragIndex, setActiveDragIndex] = useState(null);


  /**
   * Loads rules associated with the current step from the API.
   */
  const loadTransitionRules = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/steps/${step.id}/rules`);
      // Ensure rules are sorted by priority for the UI
      const sortedRules = response.data.sort((a, b) => a.priority - b.priority);
      setTransitionRules(sortedRules);
    } catch (err) {
      console.error('Failed to load transition rules:', err.message);
    } finally {
      setIsDataLoading(false);
    }
  }, [step.id]);

  useEffect(() => {
    loadTransitionRules();
  }, [step.id, loadTransitionRules]);

  /**
   * Performs client-side syntax validation for the DSL.
   * Mirrors backend RuleEngine validation.
   */
  const validateRuleCondition = (expression) => {
    if (!expression) return '';
    
    // Basic structural checks
    const validChars = /^[a-zA-Z0-9_.\s\w"'()><=!&|]+$/;
    const openParens = (expression.match(/\(/g) || []).length;
    const closeParens = (expression.match(/\)/g) || []).length;
    
    if (!validChars.test(expression)) return 'Contains unauthorized characters';
    if (openParens !== closeParens) return 'Unbalanced logic parentheses';
    if (/\w\s*=\s*[^=]/.test(expression) && !/==/.test(expression)) return 'Use "==" for comparison';
    
    return '';
  };

  const handleConditionUpdate = (value) => {
    setNewRuleData(prev => ({ ...prev, condition: value }));
    setSyntaxErrorMessage(validateRuleCondition(value));
  };

  /**
   * Submits a new rule to the API.
   */
  const submitNewRule = async () => {
    const error = validateRuleCondition(newRuleData.condition);
    if (error || !newRuleData.condition) {
      console.warn('Blocked invalid rule submission:', error);
      return;
    }

    try {
      // Calculate next priority in sequence
      const nextPriority = transitionRules.length > 0 
        ? Math.max(...transitionRules.map(r => r.priority)) + 1 
        : 0;
        
      await axios.post(`${API_BASE_URL}/steps/${step.id}/rules`, { 
        ...newRuleData, 
        priority: nextPriority 
      });
      
      setNewRuleData({ condition: '', next_step_id: '', priority: 0 });
      loadTransitionRules();
      if (typeof onRulesChanged === 'function') onRulesChanged();
    } catch (err) {
      console.error('Rule creation failed', err);
    }
  };

  const deleteExistingRule = async (ruleId) => {
    if (!window.confirm('Purge this transition rule?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/rules/${ruleId}`);
      loadTransitionRules();
      if (typeof onRulesChanged === 'function') onRulesChanged();
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  /**
   * Synchronizes the prioritized order of rules with the database.
   */
  const synchronizePriorityOrder = async (reorderedSet) => {
    try {
      await Promise.all(reorderedSet.map((rule, idx) => 
        axios.put(`${API_BASE_URL}/rules/${rule.id}`, { priority: idx })
      ));
      loadTransitionRules();
      if (typeof onRulesChanged === 'function') onRulesChanged();
    } catch (err) {
      console.error('Priority synchronization failed', err);
    }
  };

  // --- HTML5 Drag-and-Drop Implementation ---
  
  const handleDragInitiate = (index) => setActiveDragIndex(index);

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (activeDragIndex === null || activeDragIndex === index) return;
    
    const workingSet = [...transitionRules];
    const itemToMove = workingSet[activeDragIndex];
    
    workingSet.splice(activeDragIndex, 1);
    workingSet.splice(index, 0, itemToMove);
    
    setActiveDragIndex(index);
    setTransitionRules(workingSet);
  };

  const finalizeReorder = () => {
    setActiveDragIndex(null);
    synchronizePriorityOrder(transitionRules);
  };

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Logic Transitions: {step.name}</h3>
            <p className="modal-subtitle">Reorder rules to set evaluation priority (top evaluated first).</p>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="rule-list-container">
          <label className="section-label">Ordered Evaluation Logic</label>
          {isDataLoading ? (
            <div className="loading-rules">Scanning transition logic...</div>
          ) : transitionRules.length === 0 ? (
            <div className="empty-rules">No conditional logic defined. Process stops here.</div>
          ) : (
            <div className="rule-list">
              {transitionRules.map((rule, index) => (
                <div 
                  key={rule.id} 
                  className={`rule-item draggable ${activeDragIndex === index ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragInitiate(index)}
                  onDragOver={(e) => handleDragOverItem(e, index)}
                  onDragEnd={finalizeReorder}
                >
                  <div className="drag-handle">⠿</div>
                  <div className="rule-info">
                    <div className="rule-condition">
                      <span className="keyword">CASE:</span> {rule.condition}
                    </div>
                    <div className="rule-target">
                      <span className="arrow">→</span> Destination: <strong>{step.allSteps?.find(s => s.id === rule.next_step_id)?.name || 'Exit Pipeline'}</strong>
                    </div>
                  </div>
                  <div className="rule-badge">PRIORITY {index + 1}</div>
                  <button className="icon-btn delete-small" onClick={() => deleteExistingRule(rule.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area for new rules */}
        <div className="add-rule-section" style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
          <label className="section-label">Define New Logical Branch</label>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Logic Expression
                {syntaxErrorMessage && <span style={{ color: 'var(--danger)', fontSize: 9 }}>{syntaxErrorMessage}</span>}
              </label>
              <input 
                className={`form-input ${syntaxErrorMessage ? 'error' : ''}`}
                value={newRuleData.condition} 
                onChange={e => handleConditionUpdate(e.target.value)} 
                placeholder="e.g., amount > 1000 && status == 'valid'" 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Destination Node</label>
              <select 
                className="form-input custom-select" 
                value={newRuleData.next_step_id} 
                onChange={e => setNewRuleData({ ...newRuleData, next_step_id: e.target.value })}
              >
                <option value="" style={{ background: '#1e293b' }}>Exit Pipeline (Finish)</option>
                {step.allSteps && step.allSteps.filter(s => s.id !== step.id).map(s => (
                  <option key={s.id} value={s.id} style={{ background: '#1e293b' }}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Action</label>
              <button className="btn btn-primary" onClick={submitNewRule} style={{ height: 44, width: '100%' }}>Append Rule</button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(8px);
        }

        .modal-content {
          background: #1e293b;
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 32px;
          width: 580px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .modal-title { font-size: 20px; font-weight: 600; color: white; margin-bottom: 4px; }
        .modal-subtitle { font-size: 13px; color: var(--muted); }

        .close-btn { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid var(--border); 
          color: white; 
          width: 32px; height: 32px;
          border-radius: 50%;
          cursor: pointer; 
          font-size: 20px;
          display: flex; align-items: center; justify-content: center;
        }

        .section-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          display: block;
          margin-bottom: 12px;
        }

        .rule-list { display: flex; flex-direction: column; gap: 10px; }

        .rule-item {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex; align-items: center; gap: 12px;
          transition: transform 0.2s, background 0.2s;
          cursor: default;
        }

        .rule-item.draggable { cursor: grab; }
        .rule-item.dragging { opacity: 0.4; transform: scale(0.98); background: var(--accent); }
        .rule-item:hover { border-color: var(--accent); }

        .drag-handle { color: var(--muted); cursor: grab; font-size: 18px; opacity: 0.5; }

        .rule-info { flex: 1; }
        .rule-condition { font-size: 13px; font-weight: 600; color: var(--accent2); }
        .rule-condition .keyword { color: var(--muted); font-size: 11px; margin-right: 4px; }
        .rule-target { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .rule-target strong { color: white; }

        .rule-badge {
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 600;
          color: var(--muted);
          font-family: monospace;
        }

        .delete-small {
          width: 28px;
          height: 28px;
          font-size: 12px;
          opacity: 0.5;
        }
        .delete-small:hover { opacity: 1; color: var(--danger); border-color: var(--danger); }

        .form-grid { display: grid; grid-template-columns: 1fr 180px; gap: 16px; }
        .full-width { grid-column: span 2; }

        .form-input.error { border-color: var(--danger); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }

        .custom-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 40px;
          color: white;
          cursor: pointer;
        }
        
        .custom-select option {
          background-color: #0f172a;
          color: white;
          padding: 12px;
        }

        .loading-rules, .empty-rules {
          padding: 20px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
          border-radius: 12px;
          border: 1px dashed var(--border);
        }
      `}</style>
    </div>
  );
};

export default RuleEditor;
