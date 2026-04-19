/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

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
  
  // Standard K8s labels and taints for datalists
  const COMMON_NODE_LABELS = [
    'kubernetes.io/hostname',
    'kubernetes.io/os',
    'kubernetes.io/arch',
    'node.kubernetes.io/instance-type',
    'topology.kubernetes.io/zone',
    'topology.kubernetes.io/region'
  ];

  const COMMON_NODE_VALUES: Record<string, string[]> = {
    'kubernetes.io/os': ['linux', 'windows', 'darwin'],
    'kubernetes.io/arch': ['amd64', 'arm64', 'ppc64le', 's390x'],
    'node.kubernetes.io/instance-type': ['t2.micro', 't3.medium', 'm5.large', 'c5.xlarge', 'standard-1', 'standard-2'],
    'topology.kubernetes.io/zone': ['us-east-1a', 'us-east-1b', 'us-west-2a', 'eu-west-1a', 'ap-northeast-1a'],
    'topology.kubernetes.io/region': ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'],
  };

  const getValuesForKey = (key: string): string[] => {
    return COMMON_NODE_VALUES[key] || [];
  };

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
    if (tolerations.length === 0) {
      onTolerationsChange('');
    } else {
      const mapped = tolerations.map(t => {
        const res: any = { operator: t.operator };
        if (t.key) res.key = t.key;
        if (t.operator === 'Equal' && t.value) res.value = t.value;
        if (t.effect) res.effect = t.effect;
        if (t.effect === 'NoExecute' && t.tolerationSeconds) res.tolerationSeconds = parseInt(t.tolerationSeconds, 10);
        return res;
      });
      onTolerationsChange(JSON.stringify(mapped));
    }
  }, [tolerations, onTolerationsChange]);

  useEffect(() => {
    if (affinity.required.length === 0 && affinity.preferred.length === 0) {
      onAffinityChange('');
      return;
    }
    
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
    
    onAffinityChange(JSON.stringify({ nodeAffinity }));
  }, [affinity, onAffinityChange]);

  return (
    <div className="space-y-6">
      <datalist id="node-label-keys">
        {COMMON_NODE_LABELS.map(k => <option key={k} value={k} />)}
      </datalist>
      
      {/* Generate dynamic datalists for values based on specific keys */}
      {Object.entries(COMMON_NODE_VALUES).map(([key, values]) => (
        <datalist key={key} id={`node-label-values-${key.replace(/[^a-zA-Z0-9]/g, '-')}`}>
          {values.map(v => <option key={v} value={v} />)}
        </datalist>
      ))}

      <datalist id="toleration-keys">
        {COMMON_TOLERATION_KEYS.map(k => <option key={k} value={k} />)}
      </datalist>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Node Selector</h4>
        </div>
        <div className="space-y-2">
          {nodeSelectorRows.map((row, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <input type="text" list="node-label-keys" placeholder="Key (e.g. disktype)" className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs" value={row.key} onChange={(e) => { const next = [...nodeSelectorRows]; next[idx].key = e.target.value; next[idx].value = ''; onNodeSelectorChange(next); }} />
              <span className="text-slate-400">=</span>
              <input type="text" list={row.key && getValuesForKey(row.key).length > 0 ? `node-label-values-${row.key.replace(/[^a-zA-Z0-9]/g, '-')}` : undefined} placeholder="Value (e.g. ssd)" className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs" value={row.value} onChange={(e) => { const next = [...nodeSelectorRows]; next[idx].value = e.target.value; onNodeSelectorChange(next); }} />
              <button type="button" onClick={() => onNodeSelectorChange(nodeSelectorRows.filter((_, i) => i !== idx))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
            </div>
          ))}
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
            {affinity.required.map((r, idx) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <input type="text" list="node-label-keys" placeholder="Key" className="w-32 px-2 py-1 border rounded text-xs" value={r.key} onChange={(e) => { const next = { ...affinity }; next.required[idx].key = e.target.value; setAffinity(next); }} />
                <select className="w-28 px-2 py-1 border rounded text-xs" value={r.operator} onChange={(e) => { const next = { ...affinity }; next.required[idx].operator = e.target.value as 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt'; setAffinity(next); }}>
                  <option value="In">In</option><option value="NotIn">NotIn</option><option value="Exists">Exists</option><option value="DoesNotExist">DoesNotExist</option><option value="Gt">Gt</option><option value="Lt">Lt</option>
                </select>
                {r.operator !== 'Exists' && r.operator !== 'DoesNotExist' && (
                  <input type="text" list={r.key && getValuesForKey(r.key).length > 0 ? `node-label-values-${r.key.replace(/[^a-zA-Z0-9]/g, '-')}` : undefined} placeholder="Values (comma separated)" className="flex-1 min-w-[150px] px-2 py-1 border rounded text-xs" value={r.values} onChange={(e) => { const next = { ...affinity }; next.required[idx].values = e.target.value; setAffinity(next); }} />
                )}
                <button type="button" onClick={() => { const next = { ...affinity }; next.required.splice(idx, 1); setAffinity(next); }} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => { const next = { ...affinity }; next.required.push({ id: Math.random().toString(36).substring(7), key: '', operator: 'In', values: '' }); setAffinity(next); }} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={14} /><span>Add Required Rule</span>
            </button>
          </div>
        </div>

        {/* Preferred */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2">Preferred (Soft)</label>
          <div className="space-y-2">
            {affinity.preferred.map((p, idx) => (
              <div key={p.requirement.id} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <input type="number" min="1" max="100" placeholder="Weight (1-100)" className="w-24 px-2 py-1 border rounded text-xs" value={p.weight} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].weight = parseInt(e.target.value) || 1; setAffinity(next); }} title="Weight" />
                <input type="text" list="node-label-keys" placeholder="Key" className="w-32 px-2 py-1 border rounded text-xs" value={p.requirement.key} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.key = e.target.value; setAffinity(next); }} />
                <select className="w-28 px-2 py-1 border rounded text-xs" value={p.requirement.operator} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.operator = e.target.value as 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt'; setAffinity(next); }}>
                  <option value="In">In</option><option value="NotIn">NotIn</option><option value="Exists">Exists</option><option value="DoesNotExist">DoesNotExist</option><option value="Gt">Gt</option><option value="Lt">Lt</option>
                </select>
                {p.requirement.operator !== 'Exists' && p.requirement.operator !== 'DoesNotExist' && (
                  <input type="text" list={p.requirement.key && getValuesForKey(p.requirement.key).length > 0 ? `node-label-values-${p.requirement.key.replace(/[^a-zA-Z0-9]/g, '-')}` : undefined} placeholder="Values (comma separated)" className="flex-1 min-w-[150px] px-2 py-1 border rounded text-xs" value={p.requirement.values} onChange={(e) => { const next = { ...affinity }; next.preferred[idx].requirement.values = e.target.value; setAffinity(next); }} />
                )}
                <button type="button" onClick={() => { const next = { ...affinity }; next.preferred.splice(idx, 1); setAffinity(next); }} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => { const next = { ...affinity }; next.preferred.push({ weight: 1, requirement: { id: Math.random().toString(36).substring(7), key: '', operator: 'In', values: '' } }); setAffinity(next); }} className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={14} /><span>Add Preferred Rule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}