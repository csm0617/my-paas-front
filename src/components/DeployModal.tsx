import React, { useEffect, useMemo, useState } from 'react';
import { DeployCommand, ConfigMount, SecretMount, api, K8sNode, Application } from '@/lib/api';
import { X, Plus, Trash2, ChevronDown, ChevronRight, Network, Globe, Info } from 'lucide-react';
import ConfigMountSection from '@/components/ConfigMountSection';
import SchedulingSection from '@/components/SchedulingSection';
import ConfirmDialog from '@/components/ConfirmDialog';
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

interface WizardState {
  serviceName: string;
  serviceDescription: string;
  serviceType: 'internal' | 'entry';
  protocol: 'HTTP' | 'GRPC' | 'TCP';
  namespace: string;

  revisionName: string;
  image: string;
  imagePullPolicy: string;
  imagePullSecrets: string;
  replicas: number;
  maxReplicas: number;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  resourcePreset?: 'Small' | 'Medium' | 'Large';
  ports: PortSpecState[];
  envList: { key: string; value: string }[];
  requestsCpu: string;
  requestsMemory: string;
  limitsCpu: string;
  limitsMemory: string;
  configMounts: ConfigMount[];
  secretMounts: SecretMount[];
  schedulingMode: 'simple' | 'advanced';
  simpleStrategy: 'any' | 'fixed' | 'ha';
  fixedNodeName: string;
  nodeSelectorRows: { key: string; value: string }[];
  affinityJson: string;
  tolerationsJson: string;

  domain: string;
  path: string;
  enableHttps: boolean;
}

const initialWizardState = (namespace: string): WizardState => ({
  serviceName: '',
  serviceDescription: '',
  serviceType: 'internal',
  protocol: 'HTTP',
  namespace,

  revisionName: 'v1',
  image: '',
  imagePullPolicy: 'Always',
  imagePullSecrets: '',
  replicas: 1,
  maxReplicas: 1,
  targetCpuUtilization: 80,
  targetMemoryUtilization: 80,
  resourcePreset: undefined,
  ports: [{ port: 80, protocol: 'TCP' }],
  envList: [],
  requestsCpu: '',
  requestsMemory: '',
  limitsCpu: '',
  limitsMemory: '',
  configMounts: [],
  secretMounts: [],
  schedulingMode: 'simple',
  simpleStrategy: 'any',
  fixedNodeName: '',
  nodeSelectorRows: [],
  affinityJson: '',
  tolerationsJson: '',

  domain: '',
  path: '/',
  enableHttps: false,
});

const fromMap = (obj?: Record<string, string>) => {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
};

export default function DeployModal({ isOpen, onClose, onDeploy, initialApp, initialServiceName }: Props) {
  const { namespaces, fetchNamespaces, loading: namespacesLoading } = useNamespaceStore();
  const { namespace: currentNamespace } = useAppStore();
  const steps = ['Service Info', 'Initial Revision', 'Network Access', 'Confirm'] as const;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespaceOptions = useMemo(() => {
    return namespaces.length > 0 ? namespaces.map((ns) => ns.name) : ['default', 'kube-system', 'monitoring'];
  }, [namespaces]);

  const [formState, setFormState] = useState<WizardState>(initialWizardState(currentNamespace || 'default'));

  const [expandedSections, setExpandedSections] = useState<Set<'hpa' | 'mounts'>>(new Set(['hpa', 'mounts']));
  const [nodePortStatus, setNodePortStatus] = useState<Record<number, { checking: boolean; available: boolean | null }>>({});
  const [showSchedulingConfirm, setShowSchedulingConfirm] = useState(false);
  const [nodeList, setNodeList] = useState<K8sNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const updateForm = (patch: Partial<WizardState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setNodePortStatus({});
    setExpandedSections(new Set(['hpa', 'mounts']));

    if (initialApp && initialServiceName) {
      const svc = initialApp.services.find((s) => s.name === initialServiceName);
      if (svc) {
        const c = svc.containers[0];
        setFormState({
          serviceName: svc.name,
          serviceDescription: svc.description || '',
          serviceType: svc.enableIngress ? 'entry' : 'internal',
          protocol: svc.exposureType || 'HTTP',
          namespace: initialApp.namespace,
          revisionName: c?.name || 'v1',
          image: c?.image || '',
          imagePullPolicy: c?.imagePullPolicy || 'Always',
          imagePullSecrets: c?.imagePullSecrets?.join(', ') || '',
          replicas: c?.replicas ?? svc.replicas ?? 1,
          maxReplicas: c?.maxReplicas ?? svc.maxReplicas ?? 1,
          targetCpuUtilization: c?.targetCpuUtilization ?? svc.targetCpuUtilization,
          targetMemoryUtilization: c?.targetMemoryUtilization ?? svc.targetMemoryUtilization,
          resourcePreset: undefined,
          ports: c?.ports?.map((p) => ({
            port: p.port,
            protocol: (p.protocol as 'TCP' | 'UDP') || 'TCP',
            enableNodePort: p.enableNodePort,
            nodePort: p.nodePort,
          })) || [{ port: c?.port || 80, protocol: 'TCP' as const }],
          envList: fromMap(c?.env),
          requestsCpu: c?.requestsCpu || '',
          requestsMemory: c?.requestsMemory || '',
          limitsCpu: c?.limitsCpu || '',
          limitsMemory: c?.limitsMemory || '',
          configMounts: c?.configMounts || [],
          secretMounts: c?.secretMounts || [],
          schedulingMode: 'advanced' as const,
          simpleStrategy: 'any' as const,
          fixedNodeName: '',
          nodeSelectorRows: fromMap(c?.nodeSelector ?? svc.nodeSelector),
          affinityJson: c?.affinityJson ?? svc.affinityJson ?? '',
          tolerationsJson: c?.tolerationsJson ?? svc.tolerationsJson ?? '',
          domain: svc.ingressDomain || '',
          path: '/',
          enableHttps: false,
        });
      }
    } else {
      setFormState(initialWizardState(currentNamespace || 'default'));
    }

    if (namespaces.length === 0 && !namespacesLoading) {
      fetchNamespaces();
    }

    setLoadingNodes(true);
    api.getNodes().then((nodes) => {
      setNodeList(nodes);
      setLoadingNodes(false);
    }).catch(() => {
      setLoadingNodes(false);
    });
  }, [isOpen, initialApp, initialServiceName]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialApp) return;
    if (!formState.namespace) return;
    if (!namespaceOptions.includes(formState.namespace)) {
      setFormState((prev) => ({ ...prev, namespace: '' }));
    }
  }, [isOpen, initialApp, formState.namespace, namespaceOptions]);

  const toggleSection = (section: 'hpa' | 'mounts') => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleNodePortCheck = async (port: number) => {
    if (!port || port < 30000 || port > 32767) return;
    setNodePortStatus((prev) => ({ ...prev, [port]: { checking: true, available: null } }));
    try {
      const available = await api.checkNodePort(port);
      setNodePortStatus((prev) => ({ ...prev, [port]: { checking: false, available } }));
    } catch {
      setNodePortStatus((prev) => ({ ...prev, [port]: { checking: false, available: null } }));
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
    const s = formState;
    let finalNodeSelectorRows = s.nodeSelectorRows;
    let finalAffinityJson = s.affinityJson;
    let finalTolerationsJson = s.tolerationsJson;

    if (s.schedulingMode === 'simple') {
      finalNodeSelectorRows = [];
      finalAffinityJson = '';
      finalTolerationsJson = '';

      if (s.simpleStrategy === 'fixed' && s.fixedNodeName) {
        finalAffinityJson = JSON.stringify({
          nodeAffinity: {
            requiredDuringSchedulingIgnoredDuringExecution: {
              nodeSelectorTerms: [{
                matchExpressions: [{
                  key: 'kubernetes.io/hostname',
                  operator: 'In',
                  values: [s.fixedNodeName],
                }],
              }],
            },
          },
        });
        finalTolerationsJson = JSON.stringify([{ operator: 'Exists' }]);
      } else if (s.simpleStrategy === 'ha') {
        finalAffinityJson = JSON.stringify({
          podAntiAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [{
              weight: 100,
              podAffinityTerm: {
                labelSelector: {
                  matchExpressions: [{
                    key: 'paas.csm.com/service',
                    operator: 'In',
                    values: [s.serviceName],
                  }],
                },
                topologyKey: 'kubernetes.io/hostname',
              },
            }],
          },
        });
      }
    }

    const mainPort = s.ports[0]?.port;
    const isIngress = s.serviceType === 'entry';

    return {
      name: s.serviceName,
      namespace: s.namespace,
      description: s.serviceDescription || undefined,
      services: [{
        name: s.serviceName,
        description: s.serviceDescription || undefined,
        exposureType: s.protocol,
        replicas: s.replicas,
        maxReplicas: s.maxReplicas,
        targetCpuUtilization: s.targetCpuUtilization,
        targetMemoryUtilization: s.targetMemoryUtilization,
        enableService: true,
        serviceType: 'ClusterIP',
        enableIngress: isIngress,
        ingressDomain: isIngress ? s.domain : '',
        nodeSelector: toMap(finalNodeSelectorRows),
        affinityJson: finalAffinityJson,
        tolerationsJson: finalTolerationsJson,
        containers: [{
          name: s.revisionName,
          image: s.image,
          imagePullPolicy: s.imagePullPolicy,
          imagePullSecrets: s.imagePullSecrets ? s.imagePullSecrets.split(',').map((v) => v.trim()).filter(Boolean) : [],
          port: mainPort,
          ports: s.ports.map((p) => ({
            port: p.port,
            protocol: p.protocol,
            enableNodePort: p.enableNodePort,
            nodePort: p.nodePort,
          })),
          env: toMap(s.envList),
          configs: {},
          secrets: {},
          configMounts: s.configMounts.filter((cm) => cm.configMapName && cm.mountPath && (!cm.subPath || cm.key)),
          secretMounts: s.secretMounts.filter((sm) => sm.secretName && sm.mountPath && (!sm.subPath || sm.key)),
          livenessProbe: mainPort ? { path: '/healthz', port: mainPort, initialDelaySeconds: 15, periodSeconds: 10 } : undefined,
          readinessProbe: mainPort ? { path: '/ready', port: mainPort, initialDelaySeconds: 5, periodSeconds: 10 } : undefined,
          requestsCpu: s.requestsCpu || undefined,
          requestsMemory: s.requestsMemory || undefined,
          limitsCpu: s.limitsCpu || undefined,
          limitsMemory: s.limitsMemory || undefined,
          replicas: s.replicas,
          maxReplicas: s.maxReplicas,
          targetCpuUtilization: s.targetCpuUtilization,
          targetMemoryUtilization: s.targetMemoryUtilization,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: isIngress,
          ingressDomain: isIngress ? s.domain : '',
          nodeSelector: toMap(finalNodeSelectorRows),
          affinityJson: finalAffinityJson,
          tolerationsJson: finalTolerationsJson,
        }],
      }],
    };
  };

  const commandPreview = useMemo(() => buildCommand(), [formState]);

  if (!isOpen) return null;

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
      if (!formState.serviceName?.trim()) return '服务名称不能为空';
      if (!formState.namespace?.trim()) return 'Namespace 不能为空';
    }

    if (currentStep === 1) {
      if (!formState.image?.trim()) return '镜像地址不能为空';
      if (!Number.isFinite(formState.replicas) || formState.replicas < 0) return 'Replicas 不能小于 0';
      if (!Number.isFinite(formState.maxReplicas) || formState.maxReplicas < formState.replicas) return 'Max Replicas 不能小于 Replicas';

      if (validateJson(formState.affinityJson)) return 'affinityJson 格式错误';
      if (validateJson(formState.tolerationsJson)) return 'tolerationsJson 格式错误';

      const nodePorts = new Set<number>();
      for (const p of formState.ports) {
        if (!Number.isFinite(p.port) || p.port < 1 || p.port > 65535) return '端口必须在 1-65535 之间';
        if (p.enableNodePort && p.nodePort !== undefined) {
          if (p.nodePort < 30000 || p.nodePort > 32767) return 'NodePort 必须在 30000-32767 之间';
          if (nodePorts.has(p.nodePort)) return `NodePort ${p.nodePort} 重复配置`;
          nodePorts.add(p.nodePort);
          if (nodePortStatus[p.nodePort]?.available === false) return `NodePort ${p.nodePort} 已被占用`;
        }
      }
    }

    if (currentStep === 2) {
      if (formState.serviceType === 'entry' && !formState.domain?.trim()) return '入口服务必须填写域名';
    }

    return null;
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 3) {
      for (let i = 0; i < 3; i++) {
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
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      await onDeploy(commandPreview);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const renderKeyValueList = (
    list: { key: string; value: string }[],
    onChange: (list: { key: string; value: string }[]) => void,
    placeholderKey: string = 'KEY',
    placeholderValue: string = 'VALUE',
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
            Create Service
          </h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="deploy-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 max-w-2xl mx-auto mb-8">
              {steps.map((label, i) => (
                <div key={label} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center min-w-0 w-full">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        i <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {i + 1}
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
              ))}
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
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Name</label>
                    <input
                      type="text"
                      placeholder="e.g. my-service"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={formState.serviceName}
                      onChange={(e) => updateForm({ serviceName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Namespace</label>
                    <select
                      value={formState.namespace || ''}
                      onChange={(e) => updateForm({ namespace: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="" disabled>Select a namespace</option>
                      {namespaceOptions.map((ns) => (
                        <option key={ns} value={ns}>{ns}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Description</label>
                  <textarea
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formState.serviceDescription}
                    onChange={(e) => updateForm({ serviceDescription: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Type</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="serviceType"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={formState.serviceType === 'internal'}
                        onChange={() => updateForm({ serviceType: 'internal' })}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">Internal</span>
                      <span className="text-xs text-slate-400">(集群内部访问)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="serviceType"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={formState.serviceType === 'entry'}
                        onChange={() => updateForm({ serviceType: 'entry' })}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">Entry</span>
                      <span className="text-xs text-slate-400">(外部流量入口)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Protocol</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="protocol"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={formState.protocol === 'HTTP'}
                        onChange={() => updateForm({ protocol: 'HTTP' })}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">HTTP</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="protocol"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={formState.protocol === 'GRPC'}
                        onChange={() => updateForm({ protocol: 'GRPC' })}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">gRPC</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="protocol"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={formState.protocol === 'TCP'}
                        onChange={() => updateForm({ protocol: 'TCP' })}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">TCP</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Revision Name</label>
                    <input
                      type="text"
                      placeholder="e.g. v1"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                      value={formState.revisionName}
                      onChange={(e) => updateForm({ revisionName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Image</label>
                    <input
                      type="text"
                      placeholder="e.g. nginx:latest"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                      value={formState.image}
                      onChange={(e) => updateForm({ image: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Image Pull Policy</label>
                    <select
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={formState.imagePullPolicy}
                      onChange={(e) => updateForm({ imagePullPolicy: e.target.value })}
                    >
                      <option value="Always">Always</option>
                      <option value="IfNotPresent">IfNotPresent</option>
                      <option value="Never">Never</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Image Pull Secrets</label>
                    <input
                      type="text"
                      placeholder="Comma separated secrets"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                      value={formState.imagePullSecrets}
                      onChange={(e) => updateForm({ imagePullSecrets: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Replicas</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      className="w-24 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={formState.replicas}
                      onChange={(e) => updateForm({ replicas: Number(e.target.value) })}
                    />
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-slate-500">Runtime Profile:</span>
                      {(['Small', 'Medium', 'Large'] as const).map((preset) => {
                        const configs: Record<string, { cpu: string; mem: string }> = {
                          Small: { cpu: '250m/500m', mem: '256Mi/512Mi' },
                          Medium: { cpu: '500m/1000m', mem: '512Mi/1Gi' },
                          Large: { cpu: '1000m/2000m', mem: '1Gi/2Gi' },
                        };
                        const presetValues: Record<string, { requestsCpu: string; limitsCpu: string; requestsMemory: string; limitsMemory: string }> = {
                          Small: { requestsCpu: '250m', limitsCpu: '500m', requestsMemory: '256Mi', limitsMemory: '512Mi' },
                          Medium: { requestsCpu: '500m', limitsCpu: '1000m', requestsMemory: '512Mi', limitsMemory: '1Gi' },
                          Large: { requestsCpu: '1000m', limitsCpu: '2000m', requestsMemory: '1Gi', limitsMemory: '2Gi' },
                        };
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateForm({ ...presetValues[preset], resourcePreset: preset })}
                            className={`text-[10px] px-2 py-0.5 border rounded transition-colors ${
                              formState.resourcePreset === preset
                                ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                                : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                            }`}
                            title={`${preset}: ${configs[preset].cpu} CPU, ${configs[preset].mem} Mem`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 cursor-pointer select-none"
                    onClick={() => toggleSection('hpa')}
                  >
                    <div className="flex items-center space-x-2">
                      {expandedSections.has('hpa') ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Scaling</span>
                      <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        {formState.maxReplicas > formState.replicas ? `${formState.replicas}-${formState.maxReplicas}` : `${formState.replicas}`}
                      </span>
                    </div>
                  </div>
                  {expandedSections.has('hpa') && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Replicas</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={formState.replicas}
                            onChange={(e) => updateForm({ replicas: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Max Replicas</label>
                          <input
                            type="number"
                            min={formState.replicas}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={formState.maxReplicas}
                            onChange={(e) => updateForm({ maxReplicas: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Target CPU/Mem (%)</label>
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              min="1" max="100" placeholder="CPU"
                              className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={formState.targetCpuUtilization || ''}
                              onChange={(e) => updateForm({ targetCpuUtilization: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <input
                              type="number"
                              min="1" max="100" placeholder="Mem"
                              className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={formState.targetMemoryUtilization || ''}
                              onChange={(e) => updateForm({ targetMemoryUtilization: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ports</label>
                  <div className="space-y-2">
                    {formState.ports.map((p, pIdx) => (
                      <div key={pIdx} className="flex items-center space-x-2">
                        <input
                          type="number" min="1" max="65535" placeholder="Port"
                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm outline-none"
                          value={p.port || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const next = [...formState.ports];
                            next[pIdx] = { ...next[pIdx], port: val };
                            updateForm({ ports: next });
                          }}
                        />
                        <select
                          className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm outline-none"
                          value={p.protocol}
                          onChange={(e) => {
                            const val = e.target.value as 'TCP' | 'UDP';
                            const next = [...formState.ports];
                            next[pIdx] = { ...next[pIdx], protocol: val };
                            updateForm({ ports: next });
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
                              const next = [...formState.ports];
                              next[pIdx] = { ...next[pIdx], enableNodePort: chk, nodePort: chk ? next[pIdx].nodePort : undefined };
                              updateForm({ ports: next });
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
                              const next = [...formState.ports];
                              next[pIdx] = { ...next[pIdx], nodePort: val || undefined };
                              updateForm({ ports: next });
                              if (val >= 30000 && val <= 32767) handleNodePortCheck(val);
                            }}
                          />
                        )}
                        <button type="button" onClick={() => updateForm({ ports: formState.ports.filter((_, i) => i !== pIdx) })} className="p-1 text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => updateForm({ ports: [...formState.ports, { port: 8080, protocol: 'TCP' as const }] })} className="text-xs text-blue-600 hover:underline">
                      + Add Port
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Environment Variables</label>
                  {renderKeyValueList(formState.envList, (l) => updateForm({ envList: l }))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-500">Resources (CPU / Memory)</label>
                    <div className="flex items-center space-x-2">
                      {(['Small', 'Medium', 'Large'] as const).map((preset) => {
                        const presetValues: Record<string, { requestsCpu: string; limitsCpu: string; requestsMemory: string; limitsMemory: string }> = {
                          Small: { requestsCpu: '250m', limitsCpu: '500m', requestsMemory: '256Mi', limitsMemory: '512Mi' },
                          Medium: { requestsCpu: '500m', limitsCpu: '1000m', requestsMemory: '512Mi', limitsMemory: '1Gi' },
                          Large: { requestsCpu: '1000m', limitsCpu: '2000m', requestsMemory: '1Gi', limitsMemory: '2Gi' },
                        };
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateForm({ ...presetValues[preset], resourcePreset: preset })}
                            className={`text-[10px] px-2 py-0.5 border rounded transition-colors ${
                              formState.resourcePreset === preset
                                ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                                : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-1">Request CPU</label>
                      <input type="text" placeholder="e.g. 100m" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={formState.requestsCpu} onChange={(e) => updateForm({ requestsCpu: e.target.value, resourcePreset: undefined })} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-1">Request Mem</label>
                      <input type="text" placeholder="e.g. 128Mi" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={formState.requestsMemory} onChange={(e) => updateForm({ requestsMemory: e.target.value, resourcePreset: undefined })} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-1">Limit CPU</label>
                      <input type="text" placeholder="e.g. 500m" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={formState.limitsCpu} onChange={(e) => updateForm({ limitsCpu: e.target.value, resourcePreset: undefined })} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-1">Limit Mem</label>
                      <input type="text" placeholder="e.g. 256Mi" className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={formState.limitsMemory} onChange={(e) => updateForm({ limitsMemory: e.target.value, resourcePreset: undefined })} />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 cursor-pointer select-none"
                    onClick={() => toggleSection('mounts')}
                  >
                    <div className="flex items-center space-x-2">
                      {expandedSections.has('mounts') ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Configuration Mounts</span>
                      <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        {(formState.configMounts?.length || 0) + (formState.secretMounts?.length || 0)} items
                      </span>
                    </div>
                  </div>
                  {expandedSections.has('mounts') && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                      <ConfigMountSection
                        namespace={formState.namespace}
                        configMounts={formState.configMounts}
                        setConfigMounts={(cm) => updateForm({ configMounts: typeof cm === 'function' ? cm(formState.configMounts) : cm })}
                        secretMounts={formState.secretMounts}
                        setSecretMounts={(sm) => updateForm({ secretMounts: typeof sm === 'function' ? sm(formState.secretMounts) : sm })}
                      />
                    </div>
                  )}
                </div>

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
                          if (formState.schedulingMode === 'advanced') {
                            setShowSchedulingConfirm(true);
                          }
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${formState.schedulingMode === 'simple' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Simple
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm({ schedulingMode: 'advanced' })}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${formState.schedulingMode === 'advanced' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Advanced
                      </button>
                    </div>
                  </div>

                  {formState.schedulingMode === 'simple' ? (
                    <div className="space-y-3">
                      <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${formState.simpleStrategy === 'any' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <input type="radio" name="strategy" className="mt-1" checked={formState.simpleStrategy === 'any'} onChange={() => updateForm({ simpleStrategy: 'any' })} />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Any Worker Node (Default)</div>
                          <div className="text-xs text-slate-500 mt-0.5">Automatically schedule on any available node.</div>
                        </div>
                      </label>

                      <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${formState.simpleStrategy === 'fixed' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <input type="radio" name="strategy" className="mt-1" checked={formState.simpleStrategy === 'fixed'} onChange={() => updateForm({ simpleStrategy: 'fixed' })} />
                        <div className="ml-3 w-full pr-4">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Fixed Node</div>
                          <div className="text-xs text-slate-500 mt-0.5 mb-2">Pin this service to a specific node (bypasses Master taints).</div>
                          {formState.simpleStrategy === 'fixed' && (
                            <div className="relative">
                              {loadingNodes ? (
                                <div className="text-xs text-slate-400 mt-2">Loading nodes...</div>
                              ) : (
                                <select
                                  className="w-full mt-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                                  value={formState.fixedNodeName}
                                  onChange={(e) => updateForm({ fixedNodeName: e.target.value })}
                                >
                                  <option value="" disabled>Select a Node...</option>
                                  {nodeList.map((node) => (
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

                      <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${formState.simpleStrategy === 'ha' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <input type="radio" name="strategy" className="mt-1" checked={formState.simpleStrategy === 'ha'} onChange={() => updateForm({ simpleStrategy: 'ha' })} />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">High Availability (Anti-Affinity)</div>
                          <div className="text-xs text-slate-500 mt-0.5">Spread replicas across different nodes to prevent single-point-of-failure.</div>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <SchedulingSection
                      nodeSelectorRows={formState.nodeSelectorRows}
                      onNodeSelectorChange={(rows) => updateForm({ nodeSelectorRows: rows })}
                      affinityJson={formState.affinityJson}
                      onAffinityChange={(json) => updateForm({ affinityJson: json })}
                      tolerationsJson={formState.tolerationsJson}
                      onTolerationsChange={(json) => updateForm({ tolerationsJson: json })}
                    />
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 max-w-2xl mx-auto">
                {formState.serviceType === 'entry' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe size={18} className="text-blue-500" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Network Access Configuration</span>
                      <span className="text-xs text-slate-500 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">Entry Service</span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Domain</label>
                      <input
                        type="text"
                        placeholder="e.g. api.example.com"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={formState.domain}
                        onChange={(e) => updateForm({ domain: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Path</label>
                      <input
                        type="text"
                        placeholder="e.g. /api"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={formState.path}
                        onChange={(e) => updateForm({ path: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <div
                          className={`relative w-10 h-5 rounded-full transition-colors ${formState.enableHttps ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                          onClick={() => updateForm({ enableHttps: !formState.enableHttps })}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formState.enableHttps ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">Enable HTTPS</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Info size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Network access is automatically configured for internal services.</p>
                    <p className="text-xs text-slate-400 mt-1">Internal services are accessible within the cluster via internal cluster address.</p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Summary</div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-200 dark:border-slate-700 pb-4">
                      <div>
                        <span className="text-slate-500 block mb-1">Service Name</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{formState.serviceName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Namespace</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{formState.namespace || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Service Type</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${formState.serviceType === 'entry' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          {formState.serviceType === 'entry' ? 'Entry' : 'Internal'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Protocol</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium">
                          {formState.protocol}
                        </span>
                      </div>
                    </div>

                    {formState.serviceDescription && (
                      <div className="text-sm border-b border-slate-200 dark:border-slate-700 pb-4">
                        <span className="text-slate-500 block mb-1">Description</span>
                        <span className="text-slate-700 dark:text-slate-300">{formState.serviceDescription}</span>
                      </div>
                    )}

                    <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                      <span className="text-slate-500 text-sm font-medium block mb-2">Initial Revision</span>
                      <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Revision</span>
                          <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">{formState.revisionName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Image</span>
                          <span className="font-mono text-xs text-slate-800 dark:text-slate-200">{formState.image || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Replicas</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200">{formState.replicas} / {formState.maxReplicas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ports</span>
                          <span className="text-xs bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{formState.ports.map((p) => p.port).join(', ') || '—'}</span>
                        </div>
                        {(formState.requestsCpu || formState.limitsCpu) && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Resources</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200">
                              {formState.requestsCpu || '?'}-{formState.limitsCpu || '?'} CPU / {formState.requestsMemory || '?'}-{formState.limitsMemory || '?'} Mem
                            </span>
                          </div>
                        )}
                        {formState.envList.filter((e) => e.key.trim()).length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Env Vars</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200">{formState.envList.filter((e) => e.key.trim()).length} entries</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {formState.serviceType === 'entry' && (
                      <div>
                        <span className="text-slate-500 text-sm font-medium block mb-2">Network Access</span>
                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Domain</span>
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">{formState.domain || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Path</span>
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">{formState.path || '/'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">HTTPS</span>
                            <span className={`text-xs font-medium ${formState.enableHttps ? 'text-green-600' : 'text-slate-400'}`}>
                              {formState.enableHttps ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
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
                {loading ? 'Creating...' : 'Create Service'}
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showSchedulingConfirm}
        title="Switch to Simple Mode"
        message="Switching to Simple mode will clear your advanced scheduling rules. Continue?"
        onConfirm={() => {
          updateForm({ schedulingMode: 'simple', nodeSelectorRows: [], affinityJson: '', tolerationsJson: '' });
          setShowSchedulingConfirm(false);
        }}
        onCancel={() => setShowSchedulingConfirm(false)}
        confirmText="Continue"
        isDestructive={true}
      />
    </div>
  );
}
