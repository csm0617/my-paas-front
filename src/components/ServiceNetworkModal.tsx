import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api, Application, PortSpec, UpdateServiceNetworkRequest } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  app: Application;
  serviceName: string;
}

type PortRow = PortSpec & { id: string };

const generateId = () => Math.random().toString(36).slice(2);

const normalizeServiceType = (value: unknown): 'ClusterIP' | 'NodePort' => {
  return value === 'NodePort' ? 'NodePort' : 'ClusterIP';
};

const normalizeProtocol = (value: unknown): 'TCP' | 'UDP' => {
  return value === 'UDP' ? 'UDP' : 'TCP';
};

export default function ServiceNetworkModal({ isOpen, onClose, app, serviceName }: Props) {
  const { updateServiceNetwork } = useAppStore();

  const svc = useMemo(() => app.services.find((s) => s.name === serviceName), [app.services, serviceName]);
  const openKeyRef = useRef<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enableService, setEnableService] = useState(false);
  const [serviceType, setServiceType] = useState<'ClusterIP' | 'NodePort'>('ClusterIP');
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [enableIngress, setEnableIngress] = useState(false);
  const [ingressDomain, setIngressDomain] = useState('');

  const [nodePortStatus, setNodePortStatus] = useState<Record<number, { checking: boolean; available: boolean | null }>>({});

  useEffect(() => {
    if (!isOpen) {
      openKeyRef.current = null;
      return;
    }
    if (!svc) return;

    const openKey = `${app.namespace}/${app.name}/${serviceName}`;
    if (openKeyRef.current === openKey) return;
    openKeyRef.current = openKey;

    const containers = svc.containers ?? [];

    const nextPorts: PortRow[] = [];
    const seenPorts = new Set<number>();

    for (const c of containers) {
      const mergedPorts: PortSpec[] = (c.ports && c.ports.length > 0)
        ? c.ports
        : (typeof c.port === 'number' ? [{ port: c.port, protocol: 'TCP' }] : []);

      for (const p of mergedPorts) {
        if (!seenPorts.has(p.port)) {
          seenPorts.add(p.port);
          nextPorts.push({
            id: generateId(),
            port: p.port,
            protocol: normalizeProtocol(p.protocol),
            enableNodePort: p.enableNodePort,
            nodePort: p.nodePort,
          });
        }
      }
    }

    const nextEnableService = containers.some((c) => c.enableService === true) || svc.enableService === true;
    const nextEnableIngress = containers.some((c) => c.enableIngress === true) || svc.enableIngress === true;
    const nextServiceType = normalizeServiceType(
      containers.find((c) => c.serviceType)?.serviceType ?? svc.serviceType ?? 'ClusterIP'
    );
    const nextIngressDomain = String(containers.find((c) => c.ingressDomain)?.ingressDomain ?? svc.ingressDomain ?? '');

    setSaving(false);
    setError(null);
    setNodePortStatus({});
    setEnableService(nextEnableService);
    setServiceType(nextServiceType);
    setPorts(nextPorts);
    setEnableIngress(nextEnableIngress);
    setIngressDomain(nextIngressDomain);
  }, [isOpen, svc, serviceName, app.name, app.namespace]);

  if (!isOpen) return null;
  if (!svc) return null;

  const addPort = () => {
    const candidatePort = ports[0]?.port;
    setPorts((prev) => [
      ...prev,
      {
        id: generateId(),
        port: typeof candidatePort === 'number' ? candidatePort : 0,
        protocol: 'TCP',
      },
    ]);
  };

  const removePort = (id: string) => setPorts((prev) => prev.filter((p) => p.id !== id));

  const updatePort = (id: string, patch: Partial<PortRow>) => {
    setPorts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const validate = () => {
    if (!enableService && enableIngress) return '关闭 Service 时不能单独启用 Ingress';
    if (enableIngress && !ingressDomain.trim()) return '启用 Ingress 时必须填写域名';

    if (enableService) {
      if (ports.length === 0) return '至少需要一个端口';

      const nodePorts = new Set<number>();
      for (const p of ports) {
        if (!Number.isFinite(p.port) || p.port < 1 || p.port > 65535) return '端口必须在 1-65535 之间';

        if (serviceType === 'NodePort' && p.enableNodePort) {
          if (!Number.isFinite(p.nodePort)) return '启用 NodePort 时必须填写 nodePort';
          if ((p.nodePort as number) < 30000 || (p.nodePort as number) > 32767) return 'NodePort 必须在 30000-32767 之间';
          if (nodePorts.has(p.nodePort as number)) return `NodePort ${(p.nodePort as number)} 重复配置`;
          nodePorts.add(p.nodePort as number);
          if (nodePortStatus[p.nodePort as number]?.available === false) return `NodePort ${(p.nodePort as number)} 已被占用`;
        }
      }
    }

    return null;
  };

  const handleNodePortCheck = async (port: number | undefined) => {
    if (!Number.isFinite(port)) return;
    if ((port as number) < 30000 || (port as number) > 32767) return;

    setNodePortStatus((prev) => ({ ...prev, [port as number]: { checking: true, available: null } }));
    try {
      const available = await api.checkNodePort(port as number);
      setNodePortStatus((prev) => ({ ...prev, [port as number]: { checking: false, available } }));
    } catch {
      setNodePortStatus((prev) => ({ ...prev, [port as number]: { checking: false, available: null } }));
    }
  };

  const handleSubmit = async () => {
    // 仅提交网络字段，后端会按 labels 批量更新该 Service 下所有 Workload 的 Service/Ingress，不会触碰 Deployment
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    const request: UpdateServiceNetworkRequest = {
      enableService,
      serviceType,
      ports: ports.map(({ id, ...p }) => ({ ...p, protocol: normalizeProtocol(p.protocol) })),
      enableIngress,
      ingressDomain: ingressDomain.trim(),
    };

    setSaving(true);
    setError(null);
    try {
      await updateServiceNetwork(app.name, serviceName, request);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update service network');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Service Network</h2>
            <div className="text-xs text-slate-500">{app.namespace} / {app.name} / {serviceName}</div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input id="enableService" type="checkbox" checked={enableService} onChange={(e) => setEnableService(e.target.checked)} />
            <label htmlFor="enableService" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Service</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Type</label>
            <select
              disabled={!enableService}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none cursor-pointer disabled:opacity-60"
              value={serviceType}
              onChange={(e) => setServiceType(normalizeServiceType(e.target.value))}
            >
              <option value="ClusterIP">ClusterIP</option>
              <option value="NodePort">NodePort</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ports</label>
              <button type="button" onClick={addPort} className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
                <Plus size={16} />
                <span>Add Port</span>
              </button>
            </div>
            <div className="space-y-3">
              {ports.length === 0 && (
                <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                  当前没有可编辑端口（需要先在部署中声明 ports）。
                </div>
              )}
              {ports.map((p) => (
                <div key={p.id} className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none"
                      value={p.port}
                      onChange={(e) => updatePort(p.id, { port: Number(e.target.value) })}
                      placeholder="1-65535"
                    />
                    <select
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none cursor-pointer"
                      value={normalizeProtocol(p.protocol)}
                      onChange={(e) => updatePort(p.id, { protocol: normalizeProtocol(e.target.value) })}
                    >
                      <option value="TCP">TCP</option>
                      <option value="UDP">UDP</option>
                    </select>

                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={p.enableNodePort === true}
                        disabled={!enableService || serviceType !== 'NodePort'}
                        onChange={(e) => updatePort(p.id, { enableNodePort: e.target.checked, nodePort: e.target.checked ? p.nodePort : undefined })}
                      />
                      Enable NodePort
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        disabled={!enableService || serviceType !== 'NodePort' || p.enableNodePort !== true}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none disabled:opacity-60"
                        value={p.nodePort ?? ''}
                        onChange={(e) => updatePort(p.id, { nodePort: e.target.value ? Number(e.target.value) : undefined })}
                        onBlur={() => handleNodePortCheck(p.nodePort)}
                        placeholder="30000-32767"
                      />
                      {p.nodePort && nodePortStatus[p.nodePort]?.checking && (
                        <span className="text-xs text-slate-400">Checking…</span>
                      )}
                      {p.nodePort && nodePortStatus[p.nodePort]?.available === true && (
                        <span className="text-xs text-emerald-600">Available</span>
                      )}
                      {p.nodePort && nodePortStatus[p.nodePort]?.available === false && (
                        <span className="text-xs text-red-600">In use</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePort(p.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors self-start mt-1"
                    title="Remove Port"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-3">
              <input id="enableIngress" type="checkbox" checked={enableIngress} onChange={(e) => setEnableIngress(e.target.checked)} />
              <label htmlFor="enableIngress" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Ingress</label>
            </div>
            <input
              disabled={!enableIngress}
              type="text"
              placeholder="example.com"
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none disabled:opacity-60"
              value={ingressDomain}
              onChange={(e) => setIngressDomain(e.target.value)}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
