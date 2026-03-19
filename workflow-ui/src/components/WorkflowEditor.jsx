import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  MarkerType 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import RuleEditor from './RuleEditor';
import WorkflowNode from './WorkflowNode';
import StepSettings from './StepSettings';
import ErrorBoundary from './ErrorBoundary';
import { motion } from 'framer-motion';

const API_BASE_URL = 'http://localhost:5000/api';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const WorkflowEditor = ({ workflow, onBack, executionState, onWorkflowUpdate }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workflowMetadata, setWorkflowMetadata] = useState({ 
    name: workflow.name, 
    input_schema: workflow.input_schema || { fields: [] },
    max_iterations: workflow.max_iterations || 50
  });
  
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeStepContext, setActiveStepContext] = useState(null);
  const [isRuleEditorVisible, setIsRuleEditorVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isOperationPending, setIsOperationPending] = useState(false);
  
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [customBlocks, setCustomBlocks] = useState([]);
  const nodesRef = React.useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const loadWorkflowData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const stepsRes = await axios.get(`${API_BASE_URL}/workflows/${workflow.id}/steps`);
      const steps = stepsRes.data;

      // Group steps and their rules
      const nodesData = steps.map((step, index) => ({
        id: step.id,
        type: 'workflowNode',
        position: step.metadata?.position || { x: 250, y: index * 100 + 50 },
        data: { 
          label: step.name, 
          stepType: step.step_type,
          metadata: step.metadata,
          onToggleSettings: () => {
            setActiveStepContext(step);
            setIsSettingsVisible(true);
          },
          onToggleRouting: () => initiateRuleConfiguration(step)
        },
      }));

      const edgesData = [];
      for (const step of steps) {
        const rulesRes = await axios.get(`${API_BASE_URL}/steps/${step.id}/rules`);
        rulesRes.data.forEach(rule => {
          if (rule.next_step_id) {
            edgesData.push({
              id: rule.id,
              source: step.id,
              target: rule.next_step_id,
              label: rule.condition !== 'true' ? rule.condition : '',
              labelStyle: { fill: '#94a3b8', fontWeight: 600, fontSize: '11px' },
              labelBgPadding: [8, 4],
              labelBgBorderRadius: 4,
              labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, stroke: '#334155' },
              markerEnd: { type: MarkerType.ArrowClosed },
              animated: true,
            });
          }
        });
      }

      setNodes(nodesData);
      setEdges(edgesData);
    } catch (err) {
      console.error('Failed to load workflow data:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [workflow.id]);

  useEffect(() => {
    loadWorkflowData();
  }, [loadWorkflowData]);

  useEffect(() => {
    if (executionState && executionState.statuses) {
      setNodes((nds) => 
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            status: executionState.statuses[node.id] || 'pending'
          }
        }))
      );
    }
  }, [executionState]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(async (params) => {
    const condition = prompt('Enter transition condition (e.g. true, amount > 100):', 'true');
    if (condition === null) return;

    try {
      const res = await axios.post(`${API_BASE_URL}/steps/${params.source}/rules`, {
        condition,
        next_step_id: params.target,
        priority: 0 // Simplification for now
      });

      setEdges((eds) => addEdge({ 
        ...params, 
        id: res.data.id,
        label: condition !== 'true' ? condition : '',
        labelStyle: { fill: '#94a3b8', fontWeight: 600, fontSize: '11px' },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, stroke: '#334155' },
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: true 
      }, eds));
    } catch (err) {
      alert('Failed to create transition rule');
    }
  }, []);

  const onDragStart = (event, type, blockName) => {
    event.dataTransfer.setData('application/reactflow/type', type);
    event.dataTransfer.setData('application/reactflow/name', blockName);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(async (event) => {
    event.preventDefault();

    if (!reactFlowInstance) return;

    const type = event.dataTransfer.getData('application/reactflow/type');
    const name = event.dataTransfer.getData('application/reactflow/name');
    if (!type || !name) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    try {
      const res = await axios.post(`${API_BASE_URL}/workflows/${workflow.id}/steps`, {
        name,
        step_type: type,
        step_order: nodes.length + 1,
        metadata: { position }
      });
      
      const newNode = {
        id: res.data.id,
        type: 'workflowNode',
        position,
        data: { 
          label: name, 
          stepType: type,
          metadata: res.data.metadata,
          onToggleSettings: () => {
            setActiveStepContext(res.data);
            setIsSettingsVisible(true);
          },
          onToggleRouting: () => initiateRuleConfiguration(res.data)
        },
      };
      setNodes((nds) => nds.concat(newNode));
    } catch (err) {
      alert('Failed to create step');
    }
  }, [reactFlowInstance, nodes, workflow.id]);

  const createCustomBlock = () => {
    const name = prompt('Custom Block Name:');
    if (!name) return;
    const type = prompt('Base Step Type (task, approval, notification, condition, delay, loop):', 'task');
    if (!['task', 'approval', 'notification', 'condition', 'delay', 'loop'].includes(type)) return;
    setCustomBlocks(prev => [...prev, { id: Date.now().toString(), name, type }]);
  };

  const persistChanges = async () => {
    setIsOperationPending(true);
    try {
      // Save metadata
      // Update workflow version in-place (do NOT create a new version here)
      await axios.patch(`${API_BASE_URL}/workflows/${workflow.id}`, workflowMetadata);
      
      // Save node positions
      await Promise.all(nodes.map(node => 
        // Backend reliably supports PUT (PATCH may not be routed depending on server/router version)
        axios.put(`${API_BASE_URL}/steps/${node.id}`, { 
          metadata: { ...node.data.metadata, position: node.position } 
        })
      ));

      alert('Changes persisted successfully!');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save changes';
      console.error('Persistence failed:', msg, err);
      alert(`Failed to save changes: ${msg}`);
    } finally {
      setIsOperationPending(false);
    }
  };

  const initiateRuleConfiguration = (step) => {
    setActiveStepContext({ 
      ...step, 
      allSteps: nodesRef.current.map(n => ({ id: n.id, name: n.data.label })) 
    });
    setIsRuleEditorVisible(true);
  };

  const completedCount = nodes.filter(n => executionState?.statuses?.[n.id] === 'completed').length;
  const progressPercent = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0;
  const isExecuting = executionState?.activeId != null || Object.keys(executionState?.statuses || {}).length > 0;

  return (
    <div className="workflow-editor-container animate-fade-in">
      <div className="editor-top-nav">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Return to Index</button>
        <div className="status-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textTransform: 'none' }}>
           <span style={{ fontWeight: 800 }}>Protocol v{workflow.version}</span>
           {isExecuting && (
             <div className="progress-container" style={{ flex: 1, maxWidth: '300px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ height: '100%', background: '#10b981', borderRadius: '3px' }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>{progressPercent}%</span>
             </div>
           )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={persistChanges} disabled={isOperationPending}>
          {isOperationPending ? 'Processing...' : '💾 Persist Manifest'}
        </button>
      </div>

      <div className="editor-grid">
        <aside className="editor-aside">
          <section className="config-section">
            <h3 className="section-title">Protocol configuration</h3>
            <div className="form-group">
              <label className="form-label">Protocol label</label>
              <input 
                className="form-input" 
                value={workflowMetadata.name} 
                onChange={(e) => setWorkflowMetadata({ ...workflowMetadata, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Iterations (Loop Limit)</label>
              <input 
                type="number"
                className="form-input" 
                value={workflowMetadata.max_iterations} 
                onChange={(e) => setWorkflowMetadata({ ...workflowMetadata, max_iterations: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group" style={{marginTop: 16}}>
              <label className="form-label">Data Schema Specification (JSON)</label>
              <textarea 
                className="form-input json-editor"
                rows="6"
                value={JSON.stringify(workflowMetadata.input_schema, null, 2)}
                onChange={(e) => {
                  try {
                    const parsedSchema = JSON.parse(e.target.value);
                    setWorkflowMetadata({ ...workflowMetadata, input_schema: parsedSchema });
                    if (onWorkflowUpdate) {
                      onWorkflowUpdate({ input_schema: parsedSchema });
                    }
                  } catch (err) {}
                }}
              />
            </div>
          </section>

          <section className="config-section">
            <h3 className="section-title">Blocks</h3>
            <div className="block-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <div className="dnd-node" draggable onDragStart={(e) => onDragStart(e, 'task', 'New Task')} style={{ padding: '10px', border: '1px dashed var(--muted)', borderRadius: '8px', cursor: 'grab', background: 'rgba(255,255,255,0.02)', fontSize: '13px', fontWeight: 600 }}>
                  <span style={{ marginRight: '8px' }}>⚡</span> Task
               </div>
               <div className="dnd-node" draggable onDragStart={(e) => onDragStart(e, 'approval', 'New Approval')} style={{ padding: '10px', border: '1px dashed var(--muted)', borderRadius: '8px', cursor: 'grab', background: 'rgba(255,255,255,0.02)', fontSize: '13px', fontWeight: 600 }}>
                  <span style={{ marginRight: '8px' }}>✔️</span> Approval
               </div>
               <div className="dnd-node" draggable onDragStart={(e) => onDragStart(e, 'notification', 'New Notification')} style={{ padding: '10px', border: '1px dashed var(--muted)', borderRadius: '8px', cursor: 'grab', background: 'rgba(255,255,255,0.02)', fontSize: '13px', fontWeight: 600 }}>
                  <span style={{ marginRight: '8px' }}>📩</span> Notification
               </div>
               
               {customBlocks.length > 0 && <h4 className="section-title" style={{marginTop: '16px'}}>Custom Blocks</h4>}
               {customBlocks.map(b => (
                 <div key={b.id} className="dnd-node custom" draggable onDragStart={(e) => onDragStart(e, b.type, b.name)} style={{ padding: '10px', border: '1px dashed var(--accent)', borderRadius: '8px', cursor: 'grab', background: 'rgba(99,102,241,0.05)', fontSize: '13px', fontWeight: 600 }}>
                    <span style={{ marginRight: '8px' }}>🗂️</span> {b.name} ({b.type})
                 </div>
               ))}
               <button className="btn btn-secondary btn-sm" style={{width: '100%', marginTop: '8px'}} onClick={createCustomBlock}>+ Custom Block</button>
            </div>
          </section>
          
          <div className="stats-card">
            <div className="stat"><span>Nodes</span><strong>{nodes.length}</strong></div>
            <div className="stat"><span>Transfers</span><strong>{edges.length}</strong></div>
          </div>
        </aside>

        <main className="editor-main" style={{ padding: 0, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#334155" gap={20} />
            <Controls />
          </ReactFlow>
        </main>
      </div>

      {isRuleEditorVisible && (
        <ErrorBoundary onClose={() => setIsRuleEditorVisible(false)}>
          <RuleEditor 
            step={activeStepContext} 
            onRulesChanged={() => loadWorkflowData()}
            onClose={() => {
              setIsRuleEditorVisible(false);
              loadWorkflowData(); // Refresh edges
            }} 
          />
        </ErrorBoundary>
      )}

      {isSettingsVisible && (
        <StepSettings 
          step={activeStepContext} 
          onSave={() => loadWorkflowData()}
          onClose={() => setIsSettingsVisible(false)}
        />
      )}

      <style jsx>{`
        .workflow-editor-container { height: 100%; display: flex; flex-direction: column; }
        .editor-top-nav { padding: 16px 32px; display: flex; align-items: center; gap: 24px; border-bottom: 1px solid var(--border); background: #1e293b; }
        .status-pill { font-size: 11px; font-weight: 600; color: #22d3ee; background: rgba(6, 182, 212, 0.1); padding: 4px 12px; border-radius: 20px; flex: 1; }
        .editor-grid { display: grid; grid-template-columns: 320px 1fr; flex: 1; overflow: hidden; }
        .editor-aside { background: #0f172a; border-right: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; }
        .section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; }
        .json-editor { font-family: monospace; font-size: 11px; }
        .stats-card { margin-top: auto; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .stat { display: flex; justify-content: space-between; font-size: 11px; }
        .stat span { color: #64748b; }
        .editor-main { background: #020617; }
      `}</style>
    </div>
  );
};

export default WorkflowEditor;
