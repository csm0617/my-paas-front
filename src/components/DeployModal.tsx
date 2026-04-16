import React, { useEffect, useMemo, useState } from 'react';
import { DeployCommand } from '@/lib/api';
import { X, Plus, Trash2 } from 'lucide-react';
import ResourcesSchedulingSection from '@/components/ResourcesSchedulingSection';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useAppStore } from '@/store/appStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (command: DeployCommand) => Promise<void>;
}

export default function DeployModal({ isOpen, onClose, onDeploy }: Props) {
  const { namespaces, fetchNamespaces, loading: namespacesLoading } = useNamespaceStore();
  const { namespace: currentNamespace } = useAppStore();
  const steps = ['Basic', 'Networking', 'Resources & Scheduling', 'Advanced', 'Review'] as const;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeployCommand>({
    name: '',
    namespace: currentNamespace || 'default',
    image: '',
    ports: [{ port: 80, protocol: 'TCP' }],
    replicas: 1,
    maxReplicas: 5,
    env: {},
    targetCpuUtilization: 80,
    targetMemoryUtilization: 80,
    enableService: true,
    serviceType: 'ClusterIP',
    enableIngress: false,
    ingressDomain: '',
  });

  const [envList, setEnvList] = useState<{ key: string; value: string }[]>([]);
  const [configList, setConfigList] = useState<{ key: string; value: string }[]>([]);
  const [secretList, setSecretList] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setFormData((prev) => ({ ...prev, namespace: currentNamespace || prev.namespace }));
    if (namespaces.length === 0 && !namespacesLoading) {
      fetchNamespaces();
    }
  }, [isOpen]);

  const handleListChange = (
    list: { key: string; value: string }[],
    setList: React.Dispatch<React.SetStateAction<{ key: string; value: string }[]>>,
    index: number,
    field: 'key' | 'value',
    val: string
  ) => {
    const newList = [...list];
    newList[index][field] = val;
    setList(newList);
  };

  const addToList = (
    list: { key: string; value: string }[],
    setList: React.Dispatch<React.SetStateAction<{ key: string; value: string }[]>>
  ) => {
    setList([...list, { key: '', value: '' }]);
  };

  const removeFromList = (
    list: { key: string; value: string }[],
    setList: React.Dispatch<React.SetStateAction<{ key: string; value: string }[]>>,
    index: number
  ) => {
    const newList = [...list];
    newList.splice(index, 1);
    setList(newList);
  };

  const toMap = (list: { key: string; value: string }[]) => {
    return list.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  };

  const buildCommand = (): DeployCommand => {
    return {
      ...formData,
      port: formData.ports[0].port, // Keep for legacy backend compatibility
      enableService: true, // Auto-enable service since we manage it at port level
      env: toMap(envList),
      configs: toMap(configList),
      secrets: toMap(secretList),
      livenessProbe: { path: '/healthz', port: formData.ports[0].port, initialDelaySeconds: 15, periodSeconds: 10 },
      readinessProbe: { path: '/ready', port: formData.ports[0].port, initialDelaySeconds: 5, periodSeconds: 10 },
    };
  };

  const commandPreview = useMemo(() => buildCommand(), [formData, envList, configList, secretList]);

  if (!isOpen) return null;

  const namespaceOptions = namespaces.length > 0 ? namespaces.map((ns) => ns.name) : ['default', 'kube-system', 'monitoring'];
  const namespaceInOptions = namespaceOptions.includes(formData.namespace);

  const validateJson = (text: string | undefined) => {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return 'JSON 格式错误';
    }
  };

  const getStepError = (currentStep: number) => {
    if (currentStep === 0) {
      if (!formData.name?.trim()) return '应用名称不能为空';
      if (!formData.namespace?.trim()) return 'Namespace 不能为空';
      if (!formData.image?.trim()) return '镜像不能为空';
      if (!Number.isFinite(formData.replicas) || formData.replicas < 0) return 'Replicas 不能小于 0';
      if (!Number.isFinite(formData.maxReplicas) || formData.maxReplicas < formData.replicas) return 'Max Replicas 不能小于 Replicas';
    }

    if (currentStep === 1) {
      if (!formData.ports || formData.ports.length === 0) return '至少配置一个端口';
      for (const p of formData.ports) {
        if (!Number.isFinite(p.port) || p.port < 1 || p.port > 65535) return '端口必须在 1-65535 之间';
      }
      if (formData.enableIngress && !formData.ingressDomain?.trim()) return '启用 Ingress 时必须填写域名 (Host)';
    }

    if (currentStep === 2) {
      if (validateJson(formData.affinityJson)) return 'affinityJson JSON 格式错误';
      if (validateJson(formData.tolerationsJson)) return 'tolerationsJson JSON 格式错误';
    }

    if (currentStep === 3) {
      const cpu = formData.targetCpuUtilization;
      const mem = formData.targetMemoryUtilization;
      if (cpu !== undefined && (!Number.isFinite(cpu) || cpu < 1 || cpu > 100)) return 'Target CPU (%) 必须在 1-100 之间';
      if (mem !== undefined && (!Number.isFinite(mem) || mem < 1 || mem > 100)) return 'Target Memory (%) 必须在 1-100 之间';
    }

    return null;
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 4) {
      for (let i = 0; i < 4; i++) {
        const err = getStepError(i);
        if (err) {
          setError(err);
          setStep(i);
          return false;
        }
      }
      return true;
    }

    const err = getStepError(currentStep);
    if (err) {
      setError(err);
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setLoading(true);
    try {
      await onDeploy(commandPreview);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || '部署失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Deploy New Application</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="deploy-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2">
              {steps.map((label, i) => (
                <div key={label} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        i <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div
                      className={`mt-1 text-[11px] font-medium text-center truncate w-20 ${
                        i === step ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title={label}
                    >
                      {label}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Application Name</label>
                    <input
                      type="text"
                      placeholder="e.g. my-nginx"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Namespace</label>
                    <div className="space-y-2">
                      <select
                        value={namespaceInOptions ? formData.namespace : '__custom__'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            setFormData({ ...formData, namespace: '' });
                            return;
                          }
                          setFormData({ ...formData, namespace: v });
                        }}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                      >
                        {namespaceOptions.map((ns) => (
                          <option key={ns} value={ns}>
                            {ns}
                          </option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {!namespaceInOptions && (
                        <input
                          type="text"
                          placeholder="e.g. my-namespace"
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                          value={formData.namespace}
                          onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Docker Image</label>
                  <input
                    type="text"
                    placeholder="e.g. nginx:latest"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none font-mono"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>



                <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Replicas</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={formData.replicas}
                      onChange={(e) => setFormData({ ...formData, replicas: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Max Replicas</label>
                    <input
                      type="number"
                      min={formData.replicas}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={formData.maxReplicas}
                      onChange={(e) => setFormData({ ...formData, maxReplicas: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Port Configuration & Service
                  </h3>
                  <div className="col-span-3">
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Container Ports</label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        这是容器内部监听的端口。可通过开启 NodePort 精确控制该端口是否映射到宿主机对外暴露。
                      </p>
                    </div>
                    <div className="space-y-3">
                      {formData.ports.map((portSpec, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="number"
                            min="1"
                            max="65535"
                            placeholder="Port (e.g. 80)"
                            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={portSpec.port || ''}
                            onChange={(e) => {
                              const newPorts = [...formData.ports];
                              newPorts[index].port = Number(e.target.value);
                              setFormData({ ...formData, ports: newPorts });
                            }}
                          />
                          <select
                            className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={portSpec.protocol}
                            onChange={(e) => {
                              const newPorts = [...formData.ports];
                              newPorts[index].protocol = e.target.value as 'TCP' | 'UDP';
                              setFormData({ ...formData, ports: newPorts });
                            }}
                          >
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                          </select>
                          
                          <div className="flex items-center space-x-2 px-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">NodePort</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!portSpec.enableNodePort}
                                onChange={(e) => {
                                  const newPorts = [...formData.ports];
                                  newPorts[index].enableNodePort = e.target.checked;
                                  if (!e.target.checked) newPorts[index].nodePort = undefined;
                                  setFormData({ ...formData, ports: newPorts });
                                }}
                              />
                              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          {portSpec.enableNodePort && (
                            <input
                              type="number"
                              min="30000"
                              max="32767"
                              placeholder="Auto"
                              className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={portSpec.nodePort || ''}
                              onChange={(e) => {
                                const newPorts = [...formData.ports];
                                const val = e.target.value;
                                newPorts[index].nodePort = val ? Number(val) : undefined;
                                setFormData({ ...formData, ports: newPorts });
                              }}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (formData.ports.length > 1) {
                                const newPorts = formData.ports.filter((_, i) => i !== index);
                                setFormData({ ...formData, ports: newPorts });
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"
                            disabled={formData.ports.length === 1}
                          >
                            <X size={20} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ports: [...formData.ports, { port: 8080, protocol: 'TCP' }] })}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center mt-2"
                      >
                        <Plus size={16} className="mr-1" /> Add Port
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Routing
                  </h3>

                  <div className="pl-4 space-y-4 animate-in fade-in slide-in-from-left-2">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable External Access (Ingress)</label>
                        <p className="text-xs text-slate-500">Expose the application to the internet via a domain name.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.enableIngress}
                          onChange={(e) => setFormData({ ...formData, enableIngress: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {formData.enableIngress && (
                      <div className="pl-4 border-l-2 border-purple-500 animate-in fade-in slide-in-from-left-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Domain (Host)</label>
                        <input
                          type="text"
                          placeholder="e.g. app.example.com"
                          value={formData.ingressDomain}
                          onChange={(e) => setFormData({ ...formData, ingressDomain: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <ResourcesSchedulingSection
                value={{
                  requestsCpu: formData.requestsCpu ?? '',
                  requestsMemory: formData.requestsMemory ?? '',
                  limitsCpu: formData.limitsCpu ?? '',
                  limitsMemory: formData.limitsMemory ?? '',
                  nodeSelector: formData.nodeSelector,
                  affinityJson: formData.affinityJson ?? '',
                  tolerationsJson: formData.tolerationsJson ?? '',
                }}
                onChange={(next) => setFormData((prev) => ({ ...prev, ...next }))}
                namespaceName={formData.namespace}
              />
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Environment Variables</label>
                    <button
                      type="button"
                      onClick={() => addToList(envList, setEnvList)}
                      className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus size={16} />
                      <span>Add Variable</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {envList.length === 0 && (
                      <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        No environment variables configured.
                      </div>
                    )}
                    {envList.map((env, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <input
                          type="text"
                          placeholder="KEY"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.key}
                          onChange={(e) => handleListChange(envList, setEnvList, i, 'key', e.target.value)}
                        />
                        <span className="text-slate-400">=</span>
                        <input
                          type="text"
                          placeholder="VALUE"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.value}
                          onChange={(e) => handleListChange(envList, setEnvList, i, 'value', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeFromList(envList, setEnvList, i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target CPU (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.targetCpuUtilization ?? ''}
                      onChange={(e) => setFormData({ ...formData, targetCpuUtilization: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target Memory (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.targetMemoryUtilization ?? ''}
                      onChange={(e) => setFormData({ ...formData, targetMemoryUtilization: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ConfigMap Entries</label>
                    <button
                      type="button"
                      onClick={() => addToList(configList, setConfigList)}
                      className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus size={16} />
                      <span>Add Config</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {configList.length === 0 && (
                      <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        No config entries configured.
                      </div>
                    )}
                    {configList.map((env, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <input
                          type="text"
                          placeholder="KEY"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.key}
                          onChange={(e) => handleListChange(configList, setConfigList, i, 'key', e.target.value)}
                        />
                        <span className="text-slate-400">=</span>
                        <input
                          type="text"
                          placeholder="VALUE"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.value}
                          onChange={(e) => handleListChange(configList, setConfigList, i, 'value', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeFromList(configList, setConfigList, i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Secret Entries</label>
                    <button
                      type="button"
                      onClick={() => addToList(secretList, setSecretList)}
                      className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus size={16} />
                      <span>Add Secret</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {secretList.length === 0 && (
                      <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        No secret entries configured.
                      </div>
                    )}
                    {secretList.map((env, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <input
                          type="text"
                          placeholder="KEY"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.key}
                          onChange={(e) => handleListChange(secretList, setSecretList, i, 'key', e.target.value)}
                        />
                        <span className="text-slate-400">=</span>
                        <input
                          type="text"
                          placeholder="VALUE"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
                          value={env.value}
                          onChange={(e) => handleListChange(secretList, setSecretList, i, 'value', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeFromList(secretList, setSecretList, i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Summary</div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Name</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right break-all">{commandPreview.name}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Namespace</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right break-all">{commandPreview.namespace}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 col-span-2">
                      <dt className="text-slate-500 dark:text-slate-400">Image</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right break-all font-mono">{commandPreview.image}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Ports</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
                        {commandPreview.ports.map(p => `${p.port}/${p.protocol}${p.enableNodePort ? ` (NodePort${p.nodePort ? `: ${p.nodePort}` : ''})` : ''}`).join(', ')}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Replicas</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
                        {commandPreview.replicas} / {commandPreview.maxReplicas}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Service</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
                        {commandPreview.ports.some(p => p.enableNodePort) ? 'ClusterIP + NodePort' : 'ClusterIP'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Ingress</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right break-all">
                        {commandPreview.enableIngress ? commandPreview.ingressDomain : 'Disabled'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Env</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">{Object.keys(commandPreview.env ?? {}).length}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Configs</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">{Object.keys(commandPreview.configs ?? {}).length}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Secrets</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">{Object.keys(commandPreview.secrets ?? {}).length}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">HPA CPU</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">{commandPreview.targetCpuUtilization ?? '-'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">HPA Memory</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">{commandPreview.targetMemoryUtilization ?? '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Deploy JSON</label>
                  <textarea
                    readOnly
                    rows={12}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    value={JSON.stringify(commandPreview, null, 2)}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Step {step + 1} / {steps.length}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              Cancel
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                Back
              </button>
            )}

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                form="deploy-form"
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all"
              >
                {loading ? 'Deploying...' : 'Deploy'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
