import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNamespaceStore } from '@/store/namespaceStore';

export type ResourcesSchedulingValue = {
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  nodeSelector?: Record<string, string>;
  affinityJson?: string;
  tolerationsJson?: string;
};

type Props = {
  value: ResourcesSchedulingValue;
  onChange: (next: ResourcesSchedulingValue) => void;
  namespaceName?: string;
};

const validateJson = (text: string | undefined) => {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return null;
  } catch (e: any) {
    return e?.message ? String(e.message) : 'Invalid JSON';
  }
};

export default function ResourcesSchedulingSection({ value, onChange, namespaceName }: Props) {
  const { namespaces, currentNamespace } = useNamespaceStore();
  const nsName = namespaceName ?? currentNamespace;

  const [nodeSelectorRows, setNodeSelectorRows] = useState<{ key: string; value: string }[]>(
    Object.entries(value.nodeSelector ?? {}).map(([k, v]) => ({ key: k, value: v }))
  );

  const currentNs = useMemo(() => namespaces.find((n) => n.name === nsName), [namespaces, nsName]);

  const resourceQuotaHardEntries = useMemo(() => {
    const hard = currentNs?.resourceQuotaSpec?.hard ?? {};
    return Object.entries(hard);
  }, [currentNs]);

  const limitRangeDefaultRequestsEntries = useMemo(() => {
    const req = currentNs?.limitRangeSpec?.defaultRequests ?? {};
    return Object.entries(req);
  }, [currentNs]);

  const limitRangeDefaultLimitsEntries = useMemo(() => {
    const lim = currentNs?.limitRangeSpec?.defaultLimits ?? {};
    return Object.entries(lim);
  }, [currentNs]);

  const affinityError = validateJson(value.affinityJson);
  const tolerationsError = validateJson(value.tolerationsJson);

  const toNodeSelectorMap = (rows: { key: string; value: string }[]) => {
    return rows.reduce((acc, curr) => {
      const k = curr.key.trim();
      if (k) acc[k] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  };

  const updateNodeSelectorRows = (rows: { key: string; value: string }[]) => {
    setNodeSelectorRows(rows);
    onChange({ ...value, nodeSelector: toNodeSelectorMap(rows) });
  };

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Resources & Scheduling</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Requests CPU</label>
          <input
            type="text"
            placeholder="e.g. 100m"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.requestsCpu ?? ''}
            onChange={(e) => onChange({ ...value, requestsCpu: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Requests Memory</label>
          <input
            type="text"
            placeholder="e.g. 128Mi"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.requestsMemory ?? ''}
            onChange={(e) => onChange({ ...value, requestsMemory: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limits CPU</label>
          <input
            type="text"
            placeholder="e.g. 500m"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.limitsCpu ?? ''}
            onChange={(e) => onChange({ ...value, limitsCpu: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limits Memory</label>
          <input
            type="text"
            placeholder="e.g. 256Mi"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.limitsMemory ?? ''}
            onChange={(e) => onChange({ ...value, limitsMemory: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">nodeSelector</label>
          <button
            type="button"
            onClick={() => updateNodeSelectorRows([...nodeSelectorRows, { key: '', value: '' }])}
            className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={16} />
            <span>添加</span>
          </button>
        </div>

        {nodeSelectorRows.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
            未配置 nodeSelector
          </div>
        ) : (
          <div className="space-y-3">
            {nodeSelectorRows.map((row, i) => (
              <div key={i} className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="KEY"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...nodeSelectorRows];
                    next[i] = { ...next[i], key: e.target.value };
                    updateNodeSelectorRows(next);
                  }}
                />
                <span className="text-slate-400">=</span>
                <input
                  type="text"
                  placeholder="VALUE"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...nodeSelectorRows];
                    next[i] = { ...next[i], value: e.target.value };
                    updateNodeSelectorRows(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = [...nodeSelectorRows];
                    next.splice(i, 1);
                    updateNodeSelectorRows(next);
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">affinityJson</label>
          <textarea
            rows={6}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.affinityJson ?? ''}
            onChange={(e) => onChange({ ...value, affinityJson: e.target.value })}
            placeholder='e.g. {"nodeAffinity": {...}}'
          />
          <div className={`mt-1 text-xs ${affinityError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {affinityError ? `JSON 无效：${affinityError}` : 'JSON 格式正确或为空'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">tolerationsJson</label>
          <textarea
            rows={6}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={value.tolerationsJson ?? ''}
            onChange={(e) => onChange({ ...value, tolerationsJson: e.target.value })}
            placeholder='e.g. [{"key":"dedicated","operator":"Equal","value":"gpu","effect":"NoSchedule"}]'
          />
          <div className={`mt-1 text-xs ${tolerationsError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {tolerationsError ? `JSON 无效：${tolerationsError}` : 'JSON 格式正确或为空'}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          当前命名空间配额与限制：{nsName}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">ResourceQuota (hard)</div>
            {resourceQuotaHardEntries.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">无</div>
            ) : (
              <div className="space-y-1">
                {resourceQuotaHardEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-300">
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">LimitRange (defaultRequests)</div>
              {limitRangeDefaultRequestsEntries.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">无</div>
              ) : (
                <div className="space-y-1">
                  {limitRangeDefaultRequestsEntries.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-300">
                      <span>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">LimitRange (defaultLimits)</div>
              {limitRangeDefaultLimitsEntries.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">无</div>
              ) : (
                <div className="space-y-1">
                  {limitRangeDefaultLimitsEntries.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-300">
                      <span>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
