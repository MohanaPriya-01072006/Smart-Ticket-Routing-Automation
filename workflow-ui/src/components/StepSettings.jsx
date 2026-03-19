import React, { useState } from 'react';
import axios from 'axios';

const StepSettings = ({ step, onSave, onClose }) => {
  const [name, setName] = useState(step.name || '');
  const [metadata, setMetadata] = useState(step.metadata || {});
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Backend reliably supports PUT (PATCH may not be routed depending on server/router version)
      const res = await axios.put(`http://localhost:5000/api/steps/${step.id}`, { name, metadata });
      onSave(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save settings';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: 400}}>
        <h3>Step Settings: {step.name}</h3>

        <div className="config-fields" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Step Name</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter step name..."
            />
          </div>
        </div>
        
        {step.step_type === 'notification' && (
          <div className="config-fields">
            <div className="form-group">
              <label>Recipient Email</label>
              <input 
                className="form-input" 
                value={metadata.recipient || ''} 
                onChange={(e) => setMetadata({ ...metadata, recipient: e.target.value })}
                placeholder="e.g. admin@example.com"
              />
            </div>
            <div className="form-group">
              <label>Message Template</label>
              <textarea 
                className="form-input" 
                rows="4"
                value={metadata.message || ''} 
                onChange={(e) => setMetadata({ ...metadata, message: e.target.value })}
                placeholder="Use {{variable}} for dynamic data"
              />
            </div>
          </div>
        )}

        {step.step_type === 'task' && (
          <div className="config-fields">
            <p style={{fontSize: 12, color: '#94a3b8'}}>No specific settings for task type yet.</p>
          </div>
        )}

        <div className="modal-actions" style={{display: 'flex', gap: 12, marginTop: 24}}>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; }
        h3 { margin-bottom: 24px; }
        .config-fields { display: flex; flex-direction: column; gap: 16px; }
      `}</style>
    </div>
  );
};

export default StepSettings;
