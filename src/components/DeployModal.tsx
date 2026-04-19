import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { DeployCommand, ApplicationService, ContainerSpec, ConfigMount, SecretMount, PortSpec, api, K8sNode, Application } from '@/lib/api';
import { X, Plus, Trash2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, Save, Network } from 'lucide-react';
import ConfigMountSection from '@/components/ConfigMountSection';
import SchedulingSection from '@/components/SchedulingSection';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useAppStore } from '@/store/appStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (command: DeployCommand) => Promise<void>;
  initialApp?: Application | null;
  initialServiceName?: string | null;
}

interface PortSpecState {
  port: number;
  protocol: 'TCP' | 'UDP';
  enableNodePort?: boolean;
  nodePort?: number;
}

interface ContainerState {
  id: string;
  name: string;
  image: string;
  ports: PortSpecState[];
  envList: { key: string; value: string }[];
  configList: { key: string; value: string }[];
  secretList: { key: string; value: string }[];
  configMounts: ConfigMount[];
  secretMounts: SecretMount[];
  requestsCpu: string;
  requestsMemory: string;
  limitsCpu: string;
  limitsMemory: string;
  resourcePreset?: 'Small' | 'Medium' | 'Large';

  replicas: number;
  maxReplicas: number;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  enableService: boolean;
  serviceType: string;
  enableIngress: boolean;
  ingressDomain: string;
  schedulingMode: 'simple' | 'advanced';
  simpleStrategy: 'any' | 'fixed' | 'ha';
  fixedNodeName: string;
  nodeSelectorRows: { key: string; value: string }[];
  affinityJson: string;
  tolerationsJson: string;
}

interface ServiceState {
  id: string;
  name: string;
  containers: ContainerState[];
}

interface FormState {
  name: string;
  namespace: string;
  description: string;
  services: ServiceState[];
}

const generateId = () => Math.random().toString(36).substring(7);

const initialContainer = (): ContainerState => ({
  id: generateId(),
  name: 'main',
  image: '',
  ports: [{ port: 80, protocol: 'TCP' }],
  envList: [],
  configList: [],
  secretList: [],
  configMounts: [],
  secretMounts: [],
  requestsCpu: '',
  requestsMemory: '',
  limitsCpu: '',
  limitsMemory: '',
  replicas: 1,
  maxReplicas: 1,
  targetCpuUtilization: 80,
  targetMemoryUtilization: 80,
  enableService: true,
  serviceType: 'ClusterIP',
  enableIngress: false,
  ingressDomain: '',
  schedulingMode: 'simple',
  simpleStrategy: 'any',
  fixedNodeName: '',
  nodeSelectorRows: [],
  affinityJson: '',
  tolerationsJson: '',
});

const initialService = (): ServiceState => ({
  id: generateId(),
  name: 'web',
  containers: [initialContainer()],
});

export default function DeployModal({ isOpen, onClose, onDeploy, initialApp, initialServiceName }: Props) {
  const { namespaces, fetchNamespaces, loading: namespacesLoading } = useNamespaceStore();
  const { namespace: currentNamespace } = useAppStore();
  const steps = ['App Info', 'Services & Containers', 'Review'] as const;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState>({
    name: '',
    namespace: currentNamespace || 'default',
    description: '',
    services: [initialService()],
  });

  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());
  const [nodePortStatus, setNodePortStatus] = useState<Record<number, { checking: boolean, available: boolean | null }>>({});
  
  const [nodeList, setNodeList] = useState<K8sNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const fromMap = (obj?: Record<string, string>) => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep(initialApp ? 1 : 0);
    setError(null);
    setNodePortStatus({});

    if (initialApp && initialServiceName) {
      const svc = initialApp.services.find(s => s.name === initialServiceName);
      if (svc) {
        setFormState({
          name: initialApp.name,
          namespace: initialApp.namespace,
          description: initialApp.description || '',
          services: [{
            id: generateId(),
            name: svc.name,
            containers: svc.containers.map(c => ({
              id: generateId(),
              name: c.name,
              image: c.image,
              ports: c.ports?.map(p => ({
                port: p.port,
                protocol: (p.protocol as 'TCP' | 'UDP') || 'TCP',
                enableNodePort: p.enableNodePort,
                nodePort: p.nodePort
              })) || [{ port: c.port || 80, protocol: 'TCP' }],
              envList: fromMap(c.env),
              configList: fromMap(c.configs),
              secretList: fromMap(c.secrets),
              configMounts: c.configMounts || [],
              secretMounts: c.secretMounts || [],
              requestsCpu: c.requestsCpu || '',
              requestsMemory: c.requestsMemory || '',
              limitsCpu: c.limitsCpu || '',
              limitsMemory: c.limitsMemory || '',
              replicas: c.replicas ?? svc.replicas,
              maxReplicas: c.maxReplicas ?? c.replicas ?? svc.maxReplicas ?? svc.replicas,
              targetCpuUtilization: c.targetCpuUtilization ?? svc.targetCpuUtilization,
              targetMemoryUtilization: c.targetMemoryUtilization ?? svc.targetMemoryUtilization,
              enableService: c.enableService ?? svc.enableService ?? false,
              serviceType: c.serviceType ?? svc.serviceType ?? 'ClusterIP',
              enableIngress: c.enableIngress ?? svc.enableIngress ?? false,
              ingressDomain: c.ingressDomain ?? svc.ingressDomain ?? '',
              schedulingMode: 'advanced',
              simpleStrategy: 'any',
              fixedNodeName: '',
              nodeSelectorRows: fromMap(c.nodeSelector ?? svc.nodeSelector),
              affinityJson: c.affinityJson ?? svc.affinityJson ?? '',
              tolerationsJson: c.tolerationsJson ?? svc.tolerationsJson ?? '',
            }))
          }]
        });
      }
    } else {
      setFormState((prev) => ({
        ...prev,
        name: '',
        description: '',
        namespace: currentNamespace || prev.namespace,
        services: [initialService()]
      }));
    }

    if (namespaces.length === 0 && !namespacesLoading) {
      fetchNamespaces();
    }
    
    // Fetch nodes for Fixed Node dropdown
    setLoadingNodes(true);
    api.getNodes().then(nodes => {
      setNodeList(nodes);
      setLoadingNodes(false);
    }).catch(e => {
      console.error('Failed to fetch nodes', e);
      setLoadingNodes(false);
    });
  }, [isOpen, initialApp, initialServiceName]);

  const toggleService = (id: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleContainer = (id: string) => {
    setExpandedContainers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateService = (sIdx: number, updater: (s: ServiceState) => ServiceState) => {
    setFormState(prev => {
      const next = [...prev.services];
      next[sIdx] = updater(next[sIdx]);
      return { ...prev, services: next };
    });
  };

  const updateContainer = (sIdx: number, cIdx: number, updater: (c: ContainerState) => ContainerState) => {
    updateService(sIdx, s => {
      const nextC = [...s.containers];
      nextC[cIdx] = updater(nextC[cIdx]);
      return { ...s, containers: nextC };
    });
  };

  const handleNodePortCheck = async (port: number) => {
    if (!port || port < 30000 || port > 32767) return;
    setNodePortStatus(prev => ({ ...prev, [port]: { checking: true, available: null } }));
    try {
      const available = await api.checkNodePort(port);
      setNodePortStatus(prev => ({ ...prev, [port]: { checking: false, available } }));
    } catch (err) {
      setNodePortStatus(prev => ({ ...prev, [port]: { checking: false, available: null } }));
    }
  };

  const toMap = (list: { key: string; value: string }[]) => {
    return list.reduce((acc, curr) => {
      const k = curr.key.trim();
      if (k) acc[k] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  };

  const buildCommand = (): DeployCommand => {
    return {
      name: formState.name,
      namespace: formState.namespace,
      description: formState.description,
      services: formState.services.map(s => {
        return {
          name: s.name,
          replicas: s.containers[0]?.replicas ?? 1, // Fallback for old mode if needed
          maxReplicas: s.containers[0]?.maxReplicas ?? 1,
          targetCpuUtilization: s.containers[0]?.targetCpuUtilization,
          targetMemoryUtilization: s.containers[0]?.targetMemoryUtilization,
          enableService: s.containers[0]?.enableService ?? true,
          serviceType: s.containers[0]?.serviceType ?? 'ClusterIP',
          enableIngress: s.containers[0]?.enableIngress ?? false,
          ingressDomain: s.containers[0]?.ingressDomain ?? '',
          nodeSelector: toMap(s.containers[0]?.nodeSelectorRows ?? []),
          affinityJson: s.containers[0]?.affinityJson ?? '',
          tolerationsJson: s.containers[0]?.tolerationsJson ?? '',
          containers: s.containers.map(c => {
            let finalNodeSelectorRows = c.nodeSelectorRows;
            let finalAffinityJson = c.affinityJson;
            let finalTolerationsJson = c.tolerationsJson;

            if (c.schedulingMode === 'simple') {
              finalNodeSelectorRows = [];
              finalAffinityJson = '';
              finalTolerationsJson = '';

              if (c.simpleStrategy === 'fixed' && c.fixedNodeName) {
                finalAffinityJson = JSON.stringify({
                  nodeAffinity: {
                    requiredDuringSchedulingIgnoredDuringExecution: {
                      nodeSelectorTerms: [{
                        matchExpressions: [{
                          key: 'kubernetes.io/hostname',
                          operator: 'In',
                          values: [c.fixedNodeName]
                        }]
                      }]
                    }
                  }
                });
                finalTolerationsJson = JSON.stringify([{ operator: 'Exists' }]);
              } else if (c.simpleStrategy === 'ha') {
                finalAffinityJson = JSON.stringify({
                  podAntiAffinity: {
                    preferredDuringSchedulingIgnoredDuringExecution: [{
                      weight: 100,
                      podAffinityTerm: {
                        labelSelector: {
                          matchExpressions: [{
                            key: 'paas.csm.com/service',
                            operator: 'In',
                            values: [s.name]
                          }]
                        },
                        topologyKey: 'kubernetes.io/hostname'
                      }
                    }]
                  }
                });
              }
            }

            const mainPort = c.ports[0]?.port;
            return {
              name: c.name,
              image: c.image,
              port: mainPort,
              ports: c.ports.map(p => ({
                port: p.port,
                protocol: p.protocol,
                enableNodePort: p.enableNodePort,
                nodePort: p.nodePort
              })),
              env: toMap(c.envList),
              configs: toMap(c.configList),
              secrets: toMap(c.secretList),
              configMounts: c.configMounts.filter(cm => cm.configMapName && cm.mountPath && (!cm.subPath || cm.key)),
              secretMounts: c.secretMounts.filter(sm => sm.secretName && sm.mountPath && (!sm.subPath || sm.key)),
              livenessProbe: mainPort ? { path: '/healthz', port: mainPort, initialDelaySeconds: 15, periodSeconds: 10 } : undefined,
              readinessProbe: mainPort ? { path: '/ready', port: mainPort, initialDelaySeconds: 5, periodSeconds: 10 } : undefined,
              requestsCpu: c.requestsCpu || undefined,
              requestsMemory: c.requestsMemory || undefined,
              limitsCpu: c.limitsCpu || undefined,
              limitsMemory: c.limitsMemory || undefined,
              replicas: c.replicas,
              maxReplicas: c.maxReplicas,
              targetCpuUtilization: c.targetCpuUtilization,
              targetMemoryUtilization: c.targetMemoryUtilization,
              enableService: c.enableService,
              serviceType: c.serviceType,
              enableIngress: c.enableIngress,
              ingressDomain: c.ingressDomain,
              nodeSelector: toMap(finalNodeSelectorRows),
              affinityJson: finalAffinityJson,
              tolerationsJson: finalTolerationsJson,
            };
          })
        };
      })
    };
  };

  const commandPreview = useMemo(() => buildCommand(), [formState]);

  if (!isOpen) return null;

  const namespaceOptions = namespaces.length > 0 ? namespaces.map((ns) => ns.name) : ['default', 'kube-system', 'monitoring'];
  const namespaceInOptions = namespaceOptions.includes(formState.namespace);

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
      if (!formState.name?.trim()) return '应用名称不能为空';
      if (!formState.namespace?.trim()) return 'Namespace 不能为空';
    }

    if (currentStep === 1) {
      if (formState.services.length === 0) return '至少需要一个 Service';
      
      const nodePorts = new Set<number>();
      for (const s of formState.services) {
        if (!s.name?.trim()) return 'Service 名称不能为空';
        if (s.containers.length === 0) return `Service ${s.name} 至少需要一个 Container`;

        for (const c of s.containers) {
          if (!c.name?.trim()) return `Container 名称不能为空 (in Service ${s.name})`;
          if (!c.image?.trim()) return `Container ${c.name} 镜像不能为空`;
          
          if (!Number.isFinite(c.replicas) || c.replicas < 0) return `Container ${c.name} Replicas 不能小于 0`;
          if (!Number.isFinite(c.maxReplicas) || c.maxReplicas < c.replicas) return `Container ${c.name} Max Replicas 不能小于 Replicas`;
          if (c.enableIngress && !c.ingressDomain?.trim()) return `Container ${c.name} 启用 Ingress 时必须填写域名`;
          
          if (validateJson(c.affinityJson)) return `Container ${c.name} affinityJson 格式错误`;
          if (validateJson(c.tolerationsJson)) return `Container ${c.name} tolerationsJson 格式错误`;

          for (const p of c.ports) {
            if (!Number.isFinite(p.port) || p.port < 1 || p.port > 65535) return `Container ${c.name} 端口必须在 1-65535 之间`;
            if (p.enableNodePort && p.nodePort !== undefined) {
              if (p.nodePort < 30000 || p.nodePort > 32767) return `NodePort 必须在 30000-32767 之间`;
              if (nodePorts.has(p.nodePort)) return `NodePort ${p.nodePort} 在当前表单中重复配置`;
              nodePorts.add(p.nodePort);
              if (nodePortStatus[p.nodePort]?.available === false) return `NodePort ${p.nodePort} 已被占用`;
            }
          }
        }
      }
    }

    return null;
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 2) {
      for (let i = 0; i < 2; i++) {
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
    setStep((s) => Math.max(initialApp ? 1 : 0, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(2)) return;

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

  const renderKeyValueList = (
    list: { key: string; value: string }[],
    onChange: (list: { key: string; value: string }[]) => void,
    placeholderKey: string = 'KEY',
    placeholderValue: string = 'VALUE'
  ) => {
    return (
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder={placeholderKey}
              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
              value={item.key}
              onChange={(e) => {
                const next = [...list];
                next[i].key = e.target.value;
                onChange(next);
              }}
            />
            <span className="text-slate-400">=</span>
            <input
              type="text"
              placeholder={placeholderValue}
              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm outline-none"
              value={item.value}
              onChange={(e) => {
                const next = [...list];
                next[i].value = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => {
                const next = [...list];
                next.splice(i, 1);
                onChange(next);
              }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...list, { key: '', value: '' }])}
          className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={14} />
          <span>Add Entry</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            {initialApp && initialServiceName ? `Edit Service: ${initialServiceName}` : 'Deploy New Application'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="deploy-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 max-w-2xl mx-auto mb-8">
              {steps.map((label, i) => {
                if (initialApp && i === 0) return null; // 隐藏步骤 1：App Info
                const displayIndex = initialApp ? i : i + 1;
                return (
                  <div key={label} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center min-w-0 w-full">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          i <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {displayIndex}
                      </div>
                      <div
                        className={`mt-2 text-xs font-medium text-center truncate w-full ${
                          i === step ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                        title={label}
                      >
                        {label}
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 mb-6">
                {error}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Application Name</label>
                    <input
                      type="text"
                      placeholder="e.g. my-app"
                      disabled={!!initialApp}
                      className={`w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none ${initialApp ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Namespace</label>
                    <div className="space-y-2">
                      <select
                        disabled={!!initialApp}
                        value={namespaceInOptions ? formState.namespace : '__custom__'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            setFormState({ ...formState, namespace: '' });
                            return;
                          }
                          setFormState({ ...formState, namespace: v });
                        }}
                        className={`w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none ${initialApp ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                      >
                        {namespaceOptions.map((ns) => (
                          <option key={ns} value={ns}>{ns}</option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {!namespaceInOptions && (
                        <input
                          type="text"
                          placeholder="e.g. my-namespace"
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          value={formState.namespace}
                          onChange={(e) => setFormState({ ...formState, namespace: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
                  <textarea
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Services</h3>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, services: [...prev.services, initialService()] }))}
                    disabled={!!initialApp}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${initialApp ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    <Plus size={16} /> <span>Add Service</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formState.services.map((svc, sIdx) => {
                    const isSvcExpanded = expandedServices.has(svc.id) || formState.services.length === 1;
                    return (
                      <div key={svc.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                        <div 
                          className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 cursor-pointer select-none"
                          onClick={() => toggleService(svc.id)}
                        >
                          <div className="flex items-center space-x-3">
                            {isSvcExpanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{svc.name || 'Unnamed Service'}</span>
                            <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{svc.containers.length} containers</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormState(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== sIdx) }));
                            }}
                            disabled={!!initialApp}
                            className={`p-1.5 rounded transition-colors ${initialApp ? 'text-slate-400 cursor-not-allowed' : 'text-red-500 hover:bg-red-100'}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {isSvcExpanded && (
                          <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-6">
                            {/* Service Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Service Name</label>
                                <input
                                  type="text"
                                  disabled={!!initialApp}
                                  className={`w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded outline-none text-sm ${initialApp ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500'}`}
                                  value={svc.name}
                                  onChange={(e) => updateService(sIdx, s => ({ ...s, name: e.target.value }))}
                                />
                              </div>
                            </div>

                            {/* Containers List */}
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Containers</h4>
                                <button
                                  type="button"
                                  onClick={() => updateService(sIdx, s => ({ ...s, containers: [...s.containers, initialContainer()] }))}
                                  className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                                  disabled={!!initialApp}
                                >
                                  <Plus size={14} /> <span>Add Container</span>
                                </button>
                              </div>
                              <div className="space-y-3">
                                {svc.containers.map((cnt, cIdx) => {
                                  const isCntExpanded = expandedContainers.has(cnt.id) || svc.containers.length === 1;
                                  return (
                                    <div key={cnt.id} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
                                      <div 
                                        className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/50 cursor-pointer"
                                        onClick={() => toggleContainer(cnt.id)}
                                      >
                                        <div className="flex items-center space-x-2">
                                          {isCntExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cnt.name || 'Unnamed'}</span>
                                          <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{cnt.image}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updateService(sIdx, s => ({ ...s, containers: s.containers.filter((_, i) => i !== cIdx) }));
                                            }}
                                            disabled={!!initialApp}
                                            className={`p-1 rounded transition-colors ${initialApp ? 'text-slate-400 cursor-not-allowed' : 'text-red-500 hover:bg-red-100'}`}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                      </div>
                                      
                                      {isCntExpanded && (
                                        <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                                              <input
                                                type="text"
                                                disabled={!!initialApp}
                                                className={`w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded outline-none text-sm ${initialApp ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500'}`}
                                                value={cnt.name}
                                                onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, name: e.target.value }))}
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Image</label>
                                              <input
                                                type="text"
                                                placeholder="e.g. nginx:latest"
                                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                                value={cnt.image}
                                                onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, image: e.target.value }))}
                                              />
                                            </div>
                                          </div>

                                          {/* Scaling */}
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Replicas</label>
                                              <input
                                                type="number"
                                                min="0"
                                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                value={cnt.replicas}
                                                onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, replicas: Number(e.target.value) }))}
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Max Replicas</label>
                                              <input
                                                type="number"
                                                min={cnt.replicas}
                                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                value={cnt.maxReplicas}
                                                onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, maxReplicas: Number(e.target.value) }))}
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Target CPU/Mem (%)</label>
                                              <div className="flex space-x-2">
                                                <input
                                                  type="number"
                                                  min="1" max="100" placeholder="CPU"
                                                  className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                  value={cnt.targetCpuUtilization || ''}
                                                  onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, targetCpuUtilization: e.target.value ? Number(e.target.value) : undefined }))}
                                                />
                                                <input
                                                  type="number"
                                                  min="1" max="100" placeholder="Mem"
                                                  className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                  value={cnt.targetMemoryUtilization || ''}
                                                  onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, targetMemoryUtilization: e.target.value ? Number(e.target.value) : undefined }))}
                                                />
                                              </div>
                                            </div>
                                          </div>

                                          {/* Routing */}
                                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Routing & Ingress</h4>
                                            <div className="flex items-center space-x-6">
                                              <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                  type="checkbox" 
                                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                  checked={cnt.enableService}
                                                  onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, enableService: e.target.checked }))}
                                                />
                                                <span className="text-sm text-slate-600 dark:text-slate-400">Enable Service</span>
                                              </label>
                                              <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                  type="checkbox" 
                                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                  checked={cnt.enableIngress}
                                                  onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, enableIngress: e.target.checked }))}
                                                />
                                                <span className="text-sm text-slate-600 dark:text-slate-400">Enable Ingress</span>
                                              </label>
                                              {cnt.enableIngress && (
                                                <input
                                                  type="text"
                                                  placeholder="Ingress Domain (e.g. app.domain.com)"
                                                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                  value={cnt.ingressDomain}
                                                  onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, ingressDomain: e.target.value }))}
                                                />
                                              )}
                                            </div>
                                          </div>

                                          {/* Ports */}
                                          <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Ports</label>
                                            <div className="space-y-2">
                                              {cnt.ports.map((p, pIdx) => (
                                                <div key={pIdx} className="flex items-center space-x-2">
                                                  <input
                                                    type="number" min="1" max="65535" placeholder="Port"
                                                    className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm outline-none"
                                                    value={p.port || ''}
                                                    onChange={(e) => {
                                                      const val = Number(e.target.value);
                                                      updateContainer(sIdx, cIdx, c => {
                                                        const next = [...c.ports];
                                                        next[pIdx] = { ...next[pIdx], port: val };
                                                        return { ...c, ports: next };
                                                      });
                                                    }}
                                                  />
                                                  <select
                                                    className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm outline-none"
                                                    value={p.protocol}
                                                    onChange={(e) => {
                                                      const val = e.target.value as 'TCP'|'UDP';
                                                      updateContainer(sIdx, cIdx, c => {
                                                        const next = [...c.ports];
                                                        next[pIdx] = { ...next[pIdx], protocol: val };
                                                        return { ...c, ports: next };
                                                      });
                                                    }}
                                                  >
                                                    <option value="TCP">TCP</option>
                                                    <option value="UDP">UDP</option>
                                                  </select>
                                                  <label className="flex items-center space-x-1 text-xs">
                                                    <input 
                                                      type="checkbox"
                                                      checked={!!p.enableNodePort}
                                                      onChange={(e) => {
                                                        const chk = e.target.checked;
                                                        updateContainer(sIdx, cIdx, c => {
                                                          const next = [...c.ports];
                                                          next[pIdx] = { ...next[pIdx], enableNodePort: chk, nodePort: chk ? next[pIdx].nodePort : undefined };
                                                          return { ...c, ports: next };
                                                        });
                                                      }}
                                                    />
                                                    <span>NodePort</span>
                                                  </label>
                                                  {p.enableNodePort && (
                                                    <input
                                                      type="number" min="30000" max="32767" placeholder="Auto"
                                                      className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm outline-none"
                                                      value={p.nodePort || ''}
                                                      onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        updateContainer(sIdx, cIdx, c => {
                                                          const next = [...c.ports];
                                                          next[pIdx] = { ...next[pIdx], nodePort: val || undefined };
                                                          return { ...c, ports: next };
                                                        });
                                                        if (val >= 30000 && val <= 32767) handleNodePortCheck(val);
                                                      }}
                                                    />
                                                  )}
                                                  <button type="button" onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, ports: c.ports.filter((_, i) => i !== pIdx) }))} className="p-1 text-red-500">
                                                    <X size={16} />
                                                  </button>
                                                </div>
                                              ))}
                                              <button type="button" onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, ports: [...c.ports, { port: 8080, protocol: 'TCP' }] }))} className="text-xs text-blue-600 hover:underline">
                                                + Add Port
                                              </button>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 gap-4">
                                            {/* Env */}
                                            <div>
                                              <label className="block text-xs font-medium text-slate-500 mb-1">Environment Variables</label>
                                              {renderKeyValueList(cnt.envList, (l) => updateContainer(sIdx, cIdx, c => ({ ...c, envList: l })))}
                                            </div>
                                          </div>

                                          {/* Resources */}
                                          <div>
                                            <div className="flex items-center justify-between mb-2">
                                              <label className="text-xs font-medium text-slate-500">Resources (CPU / Memory)</label>
                                              <div className="flex items-center space-x-2">
                                                <button
                                                  type="button"
                                                  onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, requestsCpu: '250m', limitsCpu: '500m', requestsMemory: '256Mi', limitsMemory: '512Mi', resourcePreset: 'Small' }))}
                                                  className={`text-[10px] px-2 py-0.5 border rounded transition-colors ${cnt.resourcePreset === 'Small' ? 'bg-blue-500 text-white border-blue-600 shadow-sm' : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'}`}
                                                  title="Small: 0.25-0.5 CPU, 256-512MB Mem"
                                                >
                                                  Small
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, requestsCpu: '500m', limitsCpu: '1000m', requestsMemory: '512Mi', limitsMemory: '1Gi', resourcePreset: 'Medium' }))}
                                                  className={`text-[10px] px-2 py-0.5 border rounded transition-colors ${cnt.resourcePreset === 'Medium' ? 'bg-blue-500 text-white border-blue-600 shadow-sm' : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'}`}
                                                  title="Medium: 0.5-1 CPU, 0.5-1GB Mem"
                                                >
                                                  Medium
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, requestsCpu: '1000m', limitsCpu: '2000m', requestsMemory: '1Gi', limitsMemory: '2Gi', resourcePreset: 'Large' }))}
                                                  className={`text-[10px] px-2 py-0.5 border rounded transition-colors ${cnt.resourcePreset === 'Large' ? 'bg-blue-500 text-white border-blue-600 shadow-sm' : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'}`}
                                                  title="Large: 1-2 CPU, 1-2GB Mem"
                                                >
                                                  Large
                                                </button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <div className="flex flex-col">
                                                <label className="text-[10px] text-slate-400 mb-1">Request CPU</label>
                                                <input type="text" placeholder="e.g. 100m" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={cnt.requestsCpu} onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, requestsCpu: e.target.value }))} />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="text-[10px] text-slate-400 mb-1">Request Mem</label>
                                                <input type="text" placeholder="e.g. 128Mi" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={cnt.requestsMemory} onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, requestsMemory: e.target.value }))} />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="text-[10px] text-slate-400 mb-1">Limit CPU</label>
                                                <input type="text" placeholder="e.g. 500m" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={cnt.limitsCpu} onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, limitsCpu: e.target.value }))} />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="text-[10px] text-slate-400 mb-1">Limit Mem</label>
                                                <input type="text" placeholder="e.g. 256Mi" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={cnt.limitsMemory} onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, limitsMemory: e.target.value }))} />
                                              </div>
                                            </div>
                                          </div>

                                          {/* Mounts */}
                                          <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Volume Mounts</label>
                                            <ConfigMountSection
                                              namespace={formState.namespace}
                                              configMounts={cnt.configMounts}
                                              setConfigMounts={(cm) => updateContainer(sIdx, cIdx, c => ({ ...c, configMounts: typeof cm === 'function' ? cm(c.configMounts) : cm }))}
                                              secretMounts={cnt.secretMounts}
                                              setSecretMounts={(sm) => updateContainer(sIdx, cIdx, c => ({ ...c, secretMounts: typeof sm === 'function' ? sm(c.secretMounts) : sm }))}
                                            />
                                          </div>

                                          {/* Scheduling */}
                                          <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                                            <div className="flex items-center justify-between mb-4">
                                              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <Network size={16} className="text-blue-500" />
                                                Scheduling Strategy
                                              </label>
                                              <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (cnt.schedulingMode === 'advanced') {
                                                       if (!confirm('Switching to Simple mode will clear your advanced scheduling rules. Continue?')) return;
                                                       updateContainer(sIdx, cIdx, c => ({ ...c, schedulingMode: 'simple', nodeSelectorRows: [], affinityJson: '', tolerationsJson: '' }));
                                                    }
                                                  }}
                                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${cnt.schedulingMode === 'simple' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                >
                                                  Simple
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => updateContainer(sIdx, cIdx, c => ({ ...c, schedulingMode: 'advanced' }))}
                                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${cnt.schedulingMode === 'advanced' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                >
                                                  Advanced
                                                </button>
                                              </div>
                                            </div>

                                            {cnt.schedulingMode === 'simple' ? (
                                              <div className="space-y-3">
                                                {/* Any Node */}
                                                <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${cnt.simpleStrategy === 'any' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                  <input type="radio" name={`strategy-${sIdx}-${cIdx}`} className="mt-1" checked={cnt.simpleStrategy === 'any'} onChange={() => updateContainer(sIdx, cIdx, c => ({ ...c, simpleStrategy: 'any' }))} />
                                                  <div className="ml-3">
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Any Worker Node (Default)</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Automatically schedule on any available node.</div>
                                                  </div>
                                                </label>

                                                {/* Fixed Node */}
                                                <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${cnt.simpleStrategy === 'fixed' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                  <input type="radio" name={`strategy-${sIdx}-${cIdx}`} className="mt-1" checked={cnt.simpleStrategy === 'fixed'} onChange={() => updateContainer(sIdx, cIdx, c => ({ ...c, simpleStrategy: 'fixed' }))} />
                                                  <div className="ml-3 w-full pr-4">
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Fixed Node</div>
                                                    <div className="text-xs text-slate-500 mt-0.5 mb-2">Pin this service to a specific node (bypasses Master taints).</div>
                                                    {cnt.simpleStrategy === 'fixed' && (
                                                      <div className="relative">
                                                        {loadingNodes ? (
                                                          <div className="text-xs text-slate-400 mt-2">Loading nodes...</div>
                                                        ) : (
                                                          <select
                                                            className="w-full mt-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                                                            value={cnt.fixedNodeName}
                                                            onChange={(e) => updateContainer(sIdx, cIdx, c => ({ ...c, fixedNodeName: e.target.value }))}
                                                            onClick={(e) => e.preventDefault()}
                                                          >
                                                            <option value="" disabled>Select a Node...</option>
                                                            {nodeList.map(node => (
                                                              <option key={node.name} value={node.name}>
                                                                {node.name} ({node.roles.join(', ') || 'worker'}) - {node.status}
                                                              </option>
                                                            ))}
                                                          </select>
                                                        )}
                                                        <div className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 pointer-events-none text-slate-400">
                                                          <ChevronDown size={14} />
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </label>

                                                {/* High Availability */}
                                                <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${cnt.simpleStrategy === 'ha' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                  <input type="radio" name={`strategy-${sIdx}-${cIdx}`} className="mt-1" checked={cnt.simpleStrategy === 'ha'} onChange={() => updateContainer(sIdx, cIdx, c => ({ ...c, simpleStrategy: 'ha' }))} />
                                                  <div className="ml-3">
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">High Availability (Anti-Affinity)</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Spread replicas across different nodes to prevent single-point-of-failure.</div>
                                                  </div>
                                                </label>
                                              </div>
                                            ) : (
                                              <SchedulingSection
                                                nodeSelectorRows={cnt.nodeSelectorRows}
                                                onNodeSelectorChange={(rows) => updateContainer(sIdx, cIdx, c => ({ ...c, nodeSelectorRows: rows }))}
                                                affinityJson={cnt.affinityJson}
                                                onAffinityChange={(json) => updateContainer(sIdx, cIdx, c => ({ ...c, affinityJson: json }))}
                                                tolerationsJson={cnt.tolerationsJson}
                                                onTolerationsChange={(json) => updateContainer(sIdx, cIdx, c => ({ ...c, tolerationsJson: json }))}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Summary</div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-200 dark:border-slate-700 pb-4">
                      <div>
                        <span className="text-slate-500 block mb-1">Application</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{commandPreview.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Namespace</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{commandPreview.namespace}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <span className="text-slate-500 text-sm font-medium">Services ({commandPreview.services.length})</span>
                      {commandPreview.services.map((svc, i) => (
                        <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                          <div className="flex justify-between font-medium mb-2">
                            <span>{svc.name}</span>
                            <span>{svc.replicas} / {svc.maxReplicas} Replicas</span>
                          </div>
                          <div className="text-slate-500 text-xs mb-2">
                            {svc.enableIngress ? `Ingress: ${svc.ingressDomain}` : 'No Ingress'}
                          </div>
                          <div className="space-y-1">
                            {svc.containers.map((c, j) => (
                              <div key={j} className="flex items-center justify-between pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                                <span className="font-mono text-xs">{c.image}</span>
                                <span className="text-xs bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{c.ports.map(p => p.port).join(', ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
            Step {initialApp ? step : step + 1} / {initialApp ? steps.length - 1 : steps.length}
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

            {step > (initialApp ? 1 : 0) && (
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
