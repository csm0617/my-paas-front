/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';

interface TolerationUI {
  id: string;
  key: string;
  operator: 'Equal' | 'Exists';
  value: string;
  effect: '' | 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds: string;
}

interface NodeSelectorRequirementUI {
  id: string;
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
  values: string; // comma separated
}

interface NodeAffinityUI {
  required: NodeSelectorRequirementUI[];
  preferred: { weight: number; requirement: NodeSelectorRequirementUI }[];
}

interface Props {
  nodeSelectorRows: { key: string; value: string }[];
  onNodeSelectorChange: (rows: { key: string; value: string }[]) => void;
  affinityJson: string;
  onAffinityChange: (json: string) => void;
  tolerationsJson: string;
  onTolerationsChange: (json: string) => void;
}

export default function SchedulingSection({
  nodeSelectorRows, onNodeSelectorChange,
  affinityJson, onAffinityChange,
  tolerationsJson, onTolerationsChange
}: Props) {
  
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [availableNodes, setAvailableNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  useEffect(() => {
    api.getNodes().then(setAvailableNodes).catch(console.error);
  }, []);

  // Reverse parse to determine if we should be in simple mode on mount
  useEffect(() => {
    if (!affinityJson && !tolerationsJson && nodeSelectorRows.length === 0) {
      setMode('simple');
      return;
    }
    
    try {
      const parsed = JSON.parse(affinityJson);
      const req = parsed?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms?.[0]?.matchExpressions?.[0];
      if (
        req && req.key === 'kubernetes.io/hostname' && req.operator === 'In' &&
        !parsed.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution &&
        !tolerationsJson && nodeSelectorRows.length === 0
      ) {
        setSelectedNodes(req.values || []);
        setMode('simple');
      } else {
        setMode('advanced');
      }
    } catch {
      setMode('advanced');
    }
  }, []); // Only run once on mount

  // Sync simple mode state to parent
  useEffect(() => {
    if (mode !== 'simple') return;
    
    if (selectedNodes.length === 0) {
      onAffinityChange('');
      onTolerationsChange('');
      onNodeSelectorChange([]);
      return;
    }
    
    const nodeAffinity = {
      requiredDuringSchedulingIgnoredDuringExecution: {
        nodeSelectorTerms: [{
          matchExpressions: [{
            key: 'kubernetes.io/hostname',
            operator: 'In',
            values: selectedNodes
          }]
        }]
      }
    };
    onAffinityChange(JSON.stringify({ nodeAffinity }));
    onTolerationsChange('');
    onNodeSelectorChange([]);
  }, [selectedNodes, mode]);

  // Standard K8s labels and taints for datalists
  const NODE_LABEL_MAPPING: Record<string, string[]> = {
    'kubernetes.io/os': ['linux', 'windows'],
    'kubernetes.io/arch': ['amd64', 'arm64', 'arm'],
    'kubernetes.io/hostname': [],
    'node.kubernetes.io/instance-type': [],
    'topology.kubernetes.io/zone': [],
    'topology.kubernetes.io/region': [],
    'disktype': ['ssd', 'hdd', 'nvme'],
    'env': ['prod', 'staging', 'dev', 'test']
  };

  const COMMON_NODE_LABELS = Object.keys(NODE_LABEL_MAPPING);

  const COMMON_NODE_VALUES = [
    'linux', 'windows', 'amd64', 'arm64'
  ];

  const COMMON_TOLERATION_KEYS = [
    'node.kubernetes.io/not-ready',
    'node.kubernetes.io/unreachable',
    'node.kubernetes.io/memory-pressure',
    'node.kubernetes.io/disk-pressure',
    'node.kubernetes.io/pid-pressure',
    'node.kubernetes.io/network-unavailable',
    'node.kubernetes.io/unschedulable',
    'node.cloudprovider.kubernetes.io/uninitialized'
  ];

  // Initialize Tolerations
  const [tolerations, setTolerations] = useState<TolerationUI[]>(() => {
    try {
      if (!tolerationsJson) return [];
      const parsed = JSON.parse(tolerationsJson);
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) => ({
          id: Math.random().toString(36).substring(7),
          key: t.key || '',
          operator: t.operator || 'Equal',
          value: t.value || '',
          effect: t.effect || '',
          tolerationSeconds: t.tolerationSeconds?.toString() || ''
        }));
      }
    } catch (e) { console.error('Failed to parse tolerations', e); }
    return [];
  });

  // Initialize Affinity
  const [affinity, setAffinity] = useState<NodeAffinityUI>(() => {
    const defaultAffinity: NodeAffinityUI = { required: [], preferred: [] };
    try {
      if (!affinityJson) return defaultAffinity;
      const parsed = JSON.parse(affinityJson);
      const nodeAffinity = parsed?.nodeAffinity;
      
      if (nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms?.[0]?.matchExpressions) {
         defaultAffinity.required = nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions.map((m: any) => ({
           id: Math.random().toString(36).substring(7),
           key: m.key, operator: m.operator, values: m.values?.join(',') || ''
         }));
      }
      
      if (nodeAffinity?.preferredDuringSchedulingIgnoredDuringExecution) {
         defaultAffinity.preferred = nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution.map((p: any) => ({
           weight: p.weight || 1,
           requirement: {
             id: Math.random().toString(36).substring(7),
             key: p.preference?.matchExpressions?.[0]?.key || '',
             operator: p.preference?.matchExpressions?.[0]?.operator || 'In',
             values: p.preference?.matchExpressions?.[0]?.values?.join(',') || ''
           }
         }));
      }
    } catch (e) { console.error('Failed to parse affinity', e); }
    return defaultAffinity;
  });

  // Sync state to parent JSON
  useEffect(() => {
    // Check if change is real to avoid infinite loops
    let nextVal = '';
    if (tolerations.length > 0) {
      const mapped = tolerations.map(t => {
        const res: any = { operator: t.operator };
        if (t.key) res.key = t.key;
        if (t.operator === 'Equal' && t.value) res.value = t.value;
        if (t.effect) res.effect = t.effect;
        if (t.effect === 'NoExecute' && t.tolerationSeconds) res.tolerationSeconds = parseInt(t.tolerationSeconds, 10);
        return res;
      });
      nextVal = JSON.stringify(mapped);
    }
    if (nextVal !== tolerationsJson) {
      onTolerationsChange(nextVal);
    }
  }, [tolerations]); // Removed onTolerationsChange from deps to prevent infinite loops

  useEffect(() => {
    let nextVal = '';
    if (affinity.required.length > 0 || affinity.preferred.length > 0) {
      const nodeAffinity: any = {};
      
      if (affinity.required.length > 0) {
        nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution = {
          nodeSelectorTerms: [{
            matchExpressions: affinity.required.map(r => ({
              key: r.key,
              operator: r.operator,
              values: r.operator === 'Exists' || r.operator === 'DoesNotExist' ? undefined : r.values.split(',').map(v => v.trim()).filter(Boolean)
            }))
          }]
        };
      }
      
      if (affinity.preferred.length > 0) {
        nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution = affinity.preferred.map(p => ({
          weight: p.weight,
          preference: {
            matchExpressions: [{
              key: p.requirement.key,
              operator: p.requirement.operator,
              values: p.requirement.operator === 'Exists' || p.requirement.operator === 'DoesNotExist' ? undefined : p.requirement.values.split(',').map(v => v.trim()).filter(Boolean)
            }]
          }
        }));
      }
      nextVal = JSON.stringify({ nodeAffinity });
    }

    if (nextVal !== affinityJson) {
      onAffinityChange(nextVal);
    }
  }, [affinity]); // Removed onAffinityChange from deps to prevent infinite loops

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button type="button" onClick={() => setMode('simple')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'simple' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Simple</button>
          <button type="button" onClick={() => setMode('advanced')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'advanced' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Advanced</button>
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Target Nodes</label>
          <p className="text-xs text-slate-500 mb-3">Select specific nodes to schedule this service on. Leave empty to let Kubernetes decide.</p>
          <div className="flex flex-wrap gap-2">
            {availableNodes.map(node => (
              <label key={node} className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedNodes.includes(node) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}>
                <input type="checkbox" className="rounded text-blue-500" checked={selectedNodes.includes(node)} onChange={(e) => {
                  if (e.target.checked) setSelectedNodes([...selectedNodes, node]);
                  else setSelectedNodes(selectedNodes.filter(n => n !== node));
                }} />
                <span className="text-sm font-mono">{node}</span>
              </label>
            ))}
            {availableNodes.length === 0 && <span className="text-xs text-slate-400">Loading nodes...</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <datalist id="node-label-keys">
        {COMMON_NODE_LABELS.map(k => <option key={k} value={k} />)}
      </datalist>
      <datalist id="node-label-values">
        {COMMON_NODE_VALUES.map(v => <option key={v} value={v} />)}
      </datalist>
      <datalist id="toleration-keys">
        {COMMON_TOLERATION_KEYS.map(k => <option key={k} value={k} />)}
      </datalist>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Node Selector</h4>
        </div>
        <div className="space-y-2">
          {nodeSelectorRows.map((row, idx) => {
            const datalistId = `ns-val-${idx}`;
            const suggestions = NODE_LABEL_MAPPING[row.key] || COMMON_NODE_VALUES;
            return (
              <div key={idx} className="flex items-center space-x-2">
                <input type="text" list="node-label-keys" placeholder="Key (e.g. disktype)" className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs" value={row.key} onChange={(e) => { const next = [...nodeSelectorRows]; next[idx].key = e.target.value; onNodeSelectorChange(next); }} />
                <span className="text-slate-400">=</span>
                <input type="text" list={datalistId} placeholder="Value (e.g. ssd)" className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs" value={row.value} onChange={(e) => { const next = [...nodeSelectorRows]; next[idx].value = e.target.value; onNodeSelectorChange(next); }} />
                <datalist id={datalistId}>
                  {suggestions.map(v => <option key={v} value={v} />)}
                </datalist>
                <button type="button" onClick={() => onNodeSelectorChange(nodeSelectorRows.filter((_, i) => i !== idx))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            );
          })}
          <button type="button" onClick={() => onNodeSelectorChange([...nodeSelectorRows, { key: '', value: '' }])} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium mt-2">
            <Plus size={14} /><span>Add Node Label</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tolerations</h4>
        </div>
        <div className="space-y-2">
          {tolerations.map((t, idx) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <input type="text" list="toleration-keys" placeholder="Key" className="w-32 px-2 py-1 border rounded text-xs" value={t.key} onChange={(e) => { const next = [...tolerations]; next[idx].key = e.target.value; setTolerations(next); }} />
              <select className="w-24 px-2 py-1 border rounded text-xs" value={t.operator} onChange={(e) => { const next = [...tolerations]; next[idx].operator = e.target.value as 'Equal' | 'Exists'; setTolerations(next); }}>
                <option value="Equal">Equal</option>
                <option value="Exists">Exists</option>
              </select>
              {t.operator === 'Equal' && (
                <input type="text" placeholder="Value" className="w-32 px-2 py-1 border rounded text-xs" value={t.value} onChange={(e) => { const next = [...tolerations]; next[idx].value = e.target.value; setTolerations(next); }} />
              )}
              <select className="w-36 px-2 py-1 border rounded text-xs" value={t.effect} onChange={(e) => { const next = [...tolerations]; next[idx].effect = e.target.value as '' | 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'; setTolerations(next); }}>
                <option value="">Any Effect</option>
                <option value="NoSchedule">NoSchedule</option>
                <option value="PreferNoSchedule">PreferNoSchedule</option>
                <option value="NoExecute">NoExecute</option>
              </select>
              {t.effect === 'NoExecute' && (
                <input type="number" placeholder="Seconds" className="w-24 px-2 py-1 border rounded text-xs" value={t.tolerationSeconds} onChange={(e) => { const next = [...tolerations]; next[idx].tolerationSeconds = e.target.value; setTolerations(next); }} />
              )}
              <button type="button" onClick={() => setTolerations(tolerations.filter((_, i) => i !== idx))} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto"><X size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setTolerations([...tolerations, { id: Math.random().toString(36).substring(7), key: '', operator: 'Equal', value: '', effect: '', tolerationSeconds: '' }])} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium mt-2">
            <Plus size={14} /><span>Add Toleration</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Node Affinity</h4>
        </div>
        
        {/* Required */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">Required (Hard)</label>
          <div className="space-y-2">
            {affinity.required.map((r, idx) => {
              const datalistId = `aff-req-val-${r.id}`;
              const suggestions = NODE_LABEL_MAPPING[r.key] || COMMON_NODE_VALUES;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <input type="text" list="node-label-keys" placeholder="Key" className="w-32 px-2 py-1 border rounded text-xs" value={r.key} onChange={(e) => { const next = { ...affinity }; next.required[idx].key = e.target.value; setAffinity(next); }} />
                  <select className="w-28 px-2 py-1 border rounded text-xs" value={r.operator} onChange={(e) => { const next = { ...affinity }; next.required[idx].operator = e.target.value as 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt'; setAffinity(next); }}>
                    <option value="In">In</option><option value="NotIn">NotIn</option><option value="Exists">Exists</option><option value="DoesNotExist">DoesNotExist</option><option value="Gt">Gt</option><option value="Lt">Lt</option>
                  </select>
                  {r.operator !== 'Exists' && r.operator !== 'DoesNotExist' && (
                    <>
                      <input type="text" list={datalistId} placeholder="Values (comma separated)" className="flex-1 min-w-[150px] px-2 py-1 border rounded text-xs" value={r.values} onChange={(e) => { const next = { ...affinity }; next.required[idx].values = e.target.value; setAffinity(next); }} />
                      <datalist id={datalistId}>
                        {suggestions.map(v => <option key={v} value={v} />)}
                      </datalist>
                    </>
                  )}
                  <button type="button" onClick={() => { const next = { ...affinity }; next.required.splice(idx, 1); setAffinity(next); }} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto"><X size={14} /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => { const next = { ...affinity }; next.required.push({ id: Math.random().toString(36).substring(7), key: '', operator: 'In', values: '' }); setAffinity(next); }} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={14} /><span>Add Required Rule</span>
            </button>
          </div>
        </div>

        {/* Preferred */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2">Preferred (Soft)</label>
          <div className="space-y-2">
            {affinity.preferred.map((p, idx) => {
              const datalistId = `aff-pref-val-${p.requirement.id}`;
              const suggestions = NODE_LABEL_MAPPING[p.requirement.key] || COMMON_NODE_VALUES;
              return (
                <div key={p.requirement.id} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <input type="number" min="1" max="100" placeholder="Weight (1-100)" className="w-24 px-2 py-1 border rounded text-xs" value={p.weight} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].weight = parseInt(e.target.value) || 1; setAffinity(next); }} title="Weight" />
                  <input type="text" list="node-label-keys" placeholder="Key" className="w-32 px-2 py-1 border rounded text-xs" value={p.requirement.key} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.key = e.target.value; setAffinity(next); }} />
                  <select className="w-28 px-2 py-1 border rounded text-xs" value={p.requirement.operator} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.operator = e.target.value as 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt'; setAffinity(next); }}>
                    <option value="In">In</option><option value="NotIn">NotIn</option><option value="Exists">Exists</option><option value="DoesNotExist">DoesNotExist</option><option value="Gt">Gt</option><option value="Lt">Lt</option>
                  </select>
                  {p.requirement.operator !== 'Exists' && p.requirement.operator !== 'DoesNotExist' && (
                    <>
                      <input type="text" list={datalistId} placeholder="Values (comma separated)" className="flex-1 min-w-[150px] px-2 py-1 border rounded text-xs" value={p.requirement.values} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.values = e.target.value; setAffinity(next); }} />
                      <datalist id={datalistId}>
                        {suggestions.map(v => <option key={v} value={v} />)}
                      </datalist>
                    </>
                  )}
                  <button type="button" onClick={() => { const next = { ...affinity }; next.preferred.splice(idx, 1); setAffinity(next); }} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto"><X size={14} /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => { const next = { ...affinity }; next.preferred.push({ weight: 1, requirement: { id: Math.random().toString(36).substring(7), key: '', operator: 'In', values: '' } }); setAffinity(next); }} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={14} /><span>Add Preferred Rule</span>
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}