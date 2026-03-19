import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, GitBranch, Mail, CheckCircle2, AlertCircle, Loader2, Play, Timer, Repeat, UserCheck } from 'lucide-react';

const WorkflowNode = ({ data, selected }) => {
  const { label, stepType, status = 'pending', onToggleSettings, onToggleRouting } = data;

  const getTypeIcon = () => {
    switch (stepType) {
      case 'task': return <Settings size={16} />;
      case 'approval': return <UserCheck size={16} />;
      case 'notification': return <Mail size={16} />;
      case 'condition': return <GitBranch size={16} />;
      case 'delay': return <Timer size={16} />;
      case 'loop': return <Repeat size={16} />;
      default: return <Settings size={16} />;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'failed': return <AlertCircle size={14} className="text-rose-400" />;
      case 'in_progress': return <Loader2 size={14} className="text-sky-400 animate-spin" />;
      default: return <Play size={14} className="text-slate-500" />;
    }
  };

  const typeConfig = {
    task: { color: '#10b981', label: 'Task' },      // Green
    approval: { color: '#3b82f6', label: 'Approval' }, // Blue
    notification: { color: '#f59e0b', label: 'Notify' }, // Yellow
    condition: { color: '#a855f7', label: 'Condition' }, // Purple
    delay: { color: '#f97316', label: 'Delay' }, // Orange
    loop: { color: '#14b8a6', label: 'Loop' }, // Teal
  };

  const statusConfig = {
    completed: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
    in_progress: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' },
    failed: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
    pending: { color: '#475569', glow: 'transparent' }
  };

  const active = status === 'in_progress';

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        boxShadow: active 
          ? `0 0 20px ${statusConfig.in_progress.glow}` 
          : selected ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
      }}
      className={`workflow-node-modern ${stepType} ${status}`}
    >
      <Handle type="target" position={Position.Top} className="handle-modern" />
      
      <div className="node-sidebar" style={{ backgroundColor: typeConfig[stepType].color }}>
        {getTypeIcon()}
      </div>

      <div className="node-main">
        <div className="node-header">
          <span className="type-label">{typeConfig[stepType].label}</span>
          <AnimatePresence mode="wait">
            <motion.div 
              key={status}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="status-indicator"
            >
              {getStatusIcon()}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="node-title">{label}</div>
      </div>

      <div className="node-actions-hover">
        <button onClick={(e) => { e.stopPropagation(); onToggleSettings(); }} title="Settings">
          <Settings size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleRouting(); }} title="Routing">
          <GitBranch size={14} />
        </button>
      </div>

      {active && (
        <motion.div 
          className="pulse-ring"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ borderColor: statusConfig.in_progress.color }}
        />
      )}

      <Handle type="source" position={Position.Bottom} className="handle-modern" />

      <style jsx>{`
        .workflow-node-modern {
          display: flex;
          background: #1e293b;
          border-radius: 12px;
          border: 1px solid #334155;
          min-width: 200px;
          height: 64px;
          position: relative;
          color: white;
          overflow: visible;
          transition: border-color 0.2s;
        }

        .workflow-node-modern.selected { border-color: #6366f1; }
        .workflow-node-modern.in_progress { border-color: #3b82f6; }
        .workflow-node-modern.completed { border-color: #10b981; }
        .workflow-node-modern.failed { border-color: #ef4444; }

        .node-sidebar {
          width: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px 0 0 11px;
          color: white;
        }

        .node-main {
          flex: 1;
          padding: 10px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 0 11px 11px 0;
        }

        .node-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }

        .type-label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #94a3b8;
        }

        .node-title {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .node-actions-hover {
          position: absolute;
          top: -12px;
          right: -12px;
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateY(5px);
        }

        .workflow-node-modern:hover .node-actions-hover {
          opacity: 1;
          transform: translateY(0);
        }

        .node-actions-hover button {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #334155;
          border: 1px solid #475569;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }

        .node-actions-hover button:hover {
          background: #475569;
          border-color: #6366f1;
        }

        .handle-modern {
          width: 8px !important;
          height: 8px !important;
          background: #6366f1 !important;
          border: 2px solid #1e293b !important;
        }

        .pulse-ring {
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border: 2px solid transparent;
          border-radius: 16px;
          pointer-events: none;
        }

        .status-indicator {
          display: flex;
          align-items: center;
        }
      `}</style>
    </motion.div>
  );
};

export default memo(WorkflowNode);
