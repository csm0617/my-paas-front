import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Copy, Pencil, Check } from 'lucide-react';
import { api, Application, DeployCommand, Pod, PortSpec, podApi } from '@/lib/api';
import { createTemplates, CreateTemplate } from '@/lib/createTemplates';
import { buildEntryDomain, buildEntryUrl, parseBaseDomain } from '@/lib/domain';
import { buildCreateEntryIstioDraft, buildIstioYaml, istioNames } from '@/lib/istioYaml';
import ServiceResourcesPanel from '@/components/ServiceResourcesPanel';
import LogsDrawer from '@/components/LogsDrawer';
import ServiceNetworkModal from '@/components/ServiceNetworkModal';
import {
  applyServiceResourcesToCommand,
  buildPresetServiceResourcesMap,
  defaultServiceResources,
  ensureServiceResourcesMap,
  getServiceResourcesSummary,
  parseCpuToMillicores,
  parseMemToMi,
  ResourcePreset,
  ServiceResources,
  ServiceResourcesMap,
} from '@/lib/serviceResources';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useAppStore } from '@/store/appStore';

type Step = 'template' | 'basics' | 'plan' | 'deploy' | 'exposure';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (command: DeployCommand) => Promise<string>;
}

type EntryState = {
  enabled: boolean;
  domain: string;
  path: string;
  targetServiceName: string;
  targetPort: number;
};

const isDnsLabel = (name: string) => {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
};

const defaultScheme = (import.meta.env.VITE_DEFAULT_ENTRY_SCHEME || 'https') as 'http' | 'https';
const defaultPath = (import.meta.env.VITE_DEFAULT_ENTRY_PATH || '/') as string;
const baseDomainConfig = parseBaseDomain(import.meta.env.VITE_BASE_DOMAIN, defaultScheme);

export default function CreateWizardModal({ isOpen, onClose, onDeploy }: Props) {
  const { namespaces, fetchNamespaces, loading: namespacesLoading, currentNamespace } = useNamespaceStore();
  const { fetchDeployments, deployments } = useAppStore();

  const DEFAULT_NEW_CONTAINER_NAME = 'main';
  const DEFAULT_NEW_VERSION_NAME = 'v1';
  const DEFAULT_NEW_VERSION_REPLICAS = '1';
  const DEFAULT_SERVICE_PORT = '80';
  const DEFAULT_SERVICE_PROTOCOL = 'TCP' as const;
  const UNSET_SERVICE_NAME_PREFIX = '__unset_service__';

  type NewVersionRow = {
    id: string;
    name: string;
    image: string;
    replicas: string;
  };

  const newId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const newUnsetServiceName = () => `${UNSET_SERVICE_NAME_PREFIX}${newId()}`;
  const isUnsetServiceName = (name: string) => name.startsWith(UNSET_SERVICE_NAME_PREFIX);

  const [step, setStep] = useState<Step>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [appName, setAppName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [description, setDescription] = useState('');
  const [operatorView, setOperatorView] = useState(false);
  const [resourcePreset, setResourcePreset] = useState<ResourcePreset>('Small');

  const [commandDraft, setCommandDraft] = useState<DeployCommand | null>(null);
  const [serviceResources, setServiceResources] = useState<ServiceResourcesMap>({});
  const [touchedServices, setTouchedServices] = useState<Set<string>>(new Set());
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePort, setNewServicePort] = useState(DEFAULT_SERVICE_PORT);
  const [newVersions, setNewVersions] = useState<NewVersionRow[]>([
    { id: newId(), name: DEFAULT_NEW_VERSION_NAME, image: '', replicas: DEFAULT_NEW_VERSION_REPLICAS },
  ]);
  const [newServiceError, setNewServiceError] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryState>({
    enabled: false,
    domain: '',
    path: defaultPath,
    targetServiceName: '',
    targetPort: 80,
  });

  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [renamingService, setRenamingService] = useState<{ from: string; to: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [istioYaml, setIstioYaml] = useState<string>('');
  const [exposureApplied, setExposureApplied] = useState(false);
  const [readyLogsPod, setReadyLogsPod] = useState<Pod | null>(null);
  const [readyServiceNetwork, setReadyServiceNetwork] = useState<{ app: Application; serviceName: string } | null>(null);
  const domainInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate: CreateTemplate | undefined = useMemo(() => {
    return createTemplates.find((t) => t.id === selectedTemplateId);
  }, [selectedTemplateId]);

  const namespaceOptions = useMemo(() => {
    return namespaces.length > 0 ? namespaces.map((ns) => ns.name) : ['default', 'kube-system', 'monitoring'];
  }, [namespaces]);

  const publicUrl = useMemo(() => {
    const domain = entry.domain.trim();
    return buildEntryUrl(baseDomainConfig.scheme, domain, entry.path);
  }, [entry.domain, entry.path]);

  const renameService = (fromName: string, toName: string) => {
    if (!commandDraft) return;
    setCommandDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        services: prev.services.map((s) => (s.name === fromName ? { ...s, name: toName } : s)),
      };
    });
    setServiceResources((prev) => {
      if (!prev[fromName]) return prev;
      const { [fromName]: moved, ...rest } = prev;
      return { ...rest, [toName]: moved };
    });
    setTouchedServices((prev) => {
      const next = new Set(prev);
      if (next.has(fromName)) {
        next.delete(fromName);
        next.add(toName);
      }
      return next;
    });
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(fromName)) {
        next.delete(fromName);
        next.add(toName);
      }
      return next;
    });
    setEntry((prev) => (prev.targetServiceName === fromName ? { ...prev, targetServiceName: toName } : prev));
  };

  const planIstioYaml = useMemo(() => {
    if (!commandDraft) return '';
    const draft = buildCreateEntryIstioDraft(
      commandDraft.namespace,
      commandDraft.name,
      { enabled: entry.enabled, domain: entry.domain, targetServiceName: entry.targetServiceName, targetPort: entry.targetPort },
      commandDraft.services.map((s) => ({ name: s.name }))
    );
    return buildIstioYaml(commandDraft.namespace, commandDraft.name, draft);
  }, [commandDraft, entry.enabled, entry.domain, entry.targetServiceName, entry.targetPort]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('template');
    setSelectedTemplateId('empty');
    setAppName('');
    setNamespace(currentNamespace || 'default');
    setDescription('');
    setOperatorView(false);
    setResourcePreset('Small');
    setCommandDraft(null);
    setServiceResources({});
    setTouchedServices(new Set());
    setAddServiceOpen(false);
    setNewServiceName('');
    setNewServicePort(DEFAULT_SERVICE_PORT);
    setNewVersions([{ id: newId(), name: DEFAULT_NEW_VERSION_NAME, image: '', replicas: DEFAULT_NEW_VERSION_REPLICAS }]);
    setNewServiceError(null);
    setEntry({
      enabled: false,
      domain: '',
      path: defaultPath,
      targetServiceName: '',
      targetPort: 80,
    });
    setExpandedServices(new Set());
    setRenamingService(null);
    setRenameError(null);
    setError(null);
    setLoading(false);
    setCopied(false);
    setDeploymentId(null);
    setIstioYaml('');
    setExposureApplied(false);
    setReadyLogsPod(null);
    setReadyServiceNetwork(null);
    if (namespaces.length === 0 && !namespacesLoading) fetchNamespaces();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'deploy') return;
    if (!deploymentId) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await fetchDeployments();
      if (cancelled) return;
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, deploymentId, fetchDeployments]);

  useEffect(() => {
    if (!isOpen) return;
    if (!namespace) return;
    if (!namespaceOptions.includes(namespace)) setNamespace('');
  }, [isOpen, namespace, namespaceOptions]);

  const observedApp = useMemo(() => {
    if (!commandDraft) return null;
    return deployments.find((a) => a.name === commandDraft.name && a.namespace === commandDraft.namespace) || null;
  }, [deployments, commandDraft?.name, commandDraft?.namespace]);

  type DeployStage = 'SUBMITTING' | 'CREATING' | 'SUCCEEDED' | 'FAILED' | 'STOPPED';
  const deployStage: DeployStage = useMemo(() => {
    if (!deploymentId) return 'SUBMITTING';
    if (!observedApp) return 'CREATING';
    if (observedApp.status === 'RUNNING') return 'SUCCEEDED';
    if (observedApp.status === 'FAILED') return 'FAILED';
    if (observedApp.status === 'STOPPED') return 'STOPPED';
    return 'CREATING';
  }, [deploymentId, observedApp?.status]);

  if (!isOpen) return null;

  const steps = [
    { key: 'template' as const, label: 'Template' },
    { key: 'basics' as const, label: 'Basics' },
    { key: 'plan' as const, label: 'Plan' },
    { key: 'deploy' as const, label: 'Deploy' },
    { key: 'exposure' as const, label: 'Exposure' },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  const toggleService = (name: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const validateBasics = () => {
    const a = appName.trim();
    if (!a) return 'App Name 不能为空';
    if (!isDnsLabel(a)) return 'App Name 必须符合 DNS label（小写字母/数字/短横线）';
    if (!namespace.trim()) return 'Namespace 不能为空';
    if (!selectedTemplate) return '请选择模板';
    if (commandDraft) {
      const names = commandDraft.services.map((s) => s.name);
      for (const n of names) {
        if (isUnsetServiceName(n)) return 'Service Name 不能为空';
        if (!n.trim()) return 'Service Name 不能为空';
        if (!isDnsLabel(n)) return `Service Name 不合法：${n}`;
      }
      const uniq = new Set(names.map((n) => n.toLowerCase()));
      if (uniq.size !== names.length) return 'Service Name 不能重复';
    }
    return null;
  };

  const updateServiceResources = (svcName: string, next: ServiceResources) => {
    setTouchedServices((prev) => {
      const n = new Set(prev);
      n.add(svcName);
      return n;
    });
    setServiceResources((prev) => {
      const nextMap = { ...prev, [svcName]: next };
      setCommandDraft((cmdPrev) => (cmdPrev ? applyServiceResourcesToCommand(cmdPrev, nextMap) : cmdPrev));
      return nextMap;
    });
  };

  const applyPreset = (nextPreset: ResourcePreset) => {
    if (!commandDraft) return;
    const base = buildPresetServiceResourcesMap(commandDraft, nextPreset);
    const nextMap = Object.keys(base).reduce((acc, svc) => {
      acc[svc] = touchedServices.has(svc) && serviceResources[svc] ? serviceResources[svc] : base[svc];
      return acc;
    }, {} as ServiceResourcesMap);
    setServiceResources(nextMap);
    setCommandDraft(applyServiceResourcesToCommand(commandDraft, nextMap));
  };

  const resetAddServiceForm = () => {
    setNewServiceName('');
    setNewServicePort(DEFAULT_SERVICE_PORT);
    setNewVersions([{ id: newId(), name: DEFAULT_NEW_VERSION_NAME, image: '', replicas: DEFAULT_NEW_VERSION_REPLICAS }]);
    setNewServiceError(null);
  };

  const openAddServiceForm = () => {
    setAddServiceOpen(true);
    resetAddServiceForm();
  };

  const addVersionRow = () => {
    setNewVersions((prev) => [...prev, { id: newId(), name: '', image: '', replicas: DEFAULT_NEW_VERSION_REPLICAS }]);
  };

  const removeVersionRow = (id: string) => {
    setNewVersions((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  };

  const updateVersionRow = (id: string, patch: Partial<NewVersionRow>) => {
    setNewVersions((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  /**
   * Create Wizard 的新增 service 采用最小可运行骨架：1 service = 1 container(main)。
   * 入口/网络配置由 ensureEntryInCommand 统一收敛，避免在新增逻辑里散落规则。
   */
  const buildNewService = (name: string, ports: number[], versions: Array<{ name: string; image: string; replicas: number }>) => {
    const normalizedPorts = normalizePortNumbers(ports);
    return {
      name,
      replicas: 1,
      maxReplicas: 1,
      enableService: true,
      serviceType: 'ClusterIP',
      enableIngress: false,
      ingressDomain: '',
      containers: versions.map((v) => ({
        name: v.name || DEFAULT_NEW_CONTAINER_NAME,
        image: v.image,
        ports: normalizedPorts.map((p) => ({ port: p, protocol: DEFAULT_SERVICE_PROTOCOL })),
        replicas: v.replicas,
        maxReplicas: v.replicas,
        enableService: true,
        serviceType: 'ClusterIP',
        enableIngress: false,
        ingressDomain: '',
      })),
    };
  };

  /**
   * 新增 service 的阻塞校验：name 合法/不重名 + image 非空 + port 范围合法。
   */
  const validateNewService = () => {
    const name = newServiceName.trim().toLowerCase();
    if (!name) return 'Service Name 不能为空';
    if (!isDnsLabel(name)) return 'Service Name 必须符合 DNS label（小写字母/数字/短横线）';
    const exists = (commandDraft?.services || []).some((s) => s.name.toLowerCase() === name);
    if (exists) return 'Service Name 已存在';
    const ports = normalizePortNumbers(String(newServicePort).split(',').map((x) => x.trim()).filter(Boolean).map((x) => Number(x)));
    if (!ports.length) return '至少需要一个端口（1-65535）';

    if (!newVersions.length) return '至少需要一个版本（v1/v2/v3）';
    const versionNames: string[] = [];
    for (const v of newVersions) {
      const vn = v.name.trim().toLowerCase();
      if (!vn) return 'Version Name 不能为空';
      if (!isDnsLabel(vn)) return `Version Name 不合法：${vn}`;
      versionNames.push(vn);
      if (!v.image.trim()) return `Version ${vn} 的 Image 不能为空`;
      const r = Number(v.replicas);
      if (!Number.isInteger(r) || r < 0) return `Version ${vn} 的 Replicas 必须是 >=0 的整数`;
    }
    const uniq = new Set(versionNames);
    if (uniq.size !== versionNames.length) return 'Version Name 不能重复';
    return null;
  };

  const handleAddService = () => {
    if (!commandDraft) return;
    const err = validateNewService();
    if (err) {
      setNewServiceError(err);
      return;
    }

    const name = newServiceName.trim().toLowerCase();
    const ports = normalizePortNumbers(String(newServicePort).split(',').map((x) => x.trim()).filter(Boolean).map((x) => Number(x)));
    const versions = newVersions.map((v) => ({
      name: v.name.trim().toLowerCase(),
      image: v.image.trim(),
      replicas: Number(v.replicas),
    }));
    const svc = buildNewService(name, ports, versions);

    const nextCommand: DeployCommand = {
      ...commandDraft,
      services: [...commandDraft.services, svc],
    };

    const nextMap: ServiceResourcesMap = {
      ...serviceResources,
      [name]: defaultServiceResources(resourcePreset),
    };

    const nextWithRes = applyServiceResourcesToCommand(nextCommand, nextMap);
    const nextWithEntry = ensureEntryInCommand(nextWithRes, entry);

    setServiceResources(nextMap);
    setCommandDraft(nextWithEntry);
    setExpandedServices((prev) => {
      const n = new Set(prev);
      n.add(name);
      return n;
    });
    setAddServiceOpen(false);
    resetAddServiceForm();
  };

  const ensureEntryInCommand = (cmd: DeployCommand, nextEntry: EntryState) => {
    const entryService = nextEntry.targetServiceName.trim();
    const domain = nextEntry.domain.trim();
    return {
      ...cmd,
      services: cmd.services.map((s) => {
        const isEntry = s.name === entryService;
        const enableIngress = nextEntry.enabled && isEntry;
        return {
          ...s,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress,
          ingressDomain: enableIngress ? domain : '',
          containers: s.containers.map((c) => ({
            ...c,
            enableService: true,
            serviceType: 'ClusterIP',
            enableIngress,
            ingressDomain: enableIngress ? domain : '',
          })),
        };
      }),
    };
  };

  const generatePlan = () => {
    const err = validateBasics();
    if (err) {
      setError(err);
      return;
    }
    const template = selectedTemplate!;
    const a = appName.trim();
    const ns = namespace.trim();

    const initial = commandDraft ? { services: commandDraft.services } : template.buildInitialCommand(ns);
    const targetServiceName =
      entry.targetServiceName && initial.services.some((s) => s.name === entry.targetServiceName)
        ? entry.targetServiceName
        : template.defaultEntryServiceName;
    const targetPort = entry.targetPort || template.defaultEntryPort;

    const domain = buildEntryDomain(a, ns, baseDomainConfig.host);
    const nextEntry: EntryState = {
      enabled: commandDraft ? entry.enabled : template.hasEntry,
      domain,
      path: defaultPath,
      targetServiceName,
      targetPort,
    };

    const draft: DeployCommand = {
      name: a,
      namespace: ns,
      description: description.trim(),
      services: initial.services.map((s) => ({
        ...s,
        enableService: true,
        serviceType: 'ClusterIP',
        enableIngress: false,
        ingressDomain: '',
      })),
    };

    const ensuredMap = ensureServiceResourcesMap(draft, resourcePreset);
    const nextMap = { ...ensuredMap, ...serviceResources };
    const withResources = applyServiceResourcesToCommand(draft, nextMap);
    const next = ensureEntryInCommand(withResources, nextEntry);
    setEntry(nextEntry);
    setServiceResources(nextMap);
    if (!commandDraft) setTouchedServices(new Set());
    setCommandDraft(next);
    setStep('plan');
    setError(null);
  };

  const normalizePortNumbers = (ports: number[]) => {
    const cleaned = ports
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p >= 1 && p <= 65535);
    const uniq = Array.from(new Set(cleaned));
    uniq.sort((a, b) => a - b);
    return uniq;
  };

  const normalizePortSpecs = (ports: PortSpec[]) => {
    const cleaned = ports
      .map((p) => ({ port: Number(p.port), protocol: (p.protocol || 'TCP') as PortSpec['protocol'] }))
      .filter((p) => Number.isFinite(p.port) && p.port >= 1 && p.port <= 65535);
    const uniq = new Map<string, PortSpec>();
    for (const p of cleaned) {
      uniq.set(`${p.protocol}:${p.port}`, { port: p.port, protocol: p.protocol });
    }
    const arr = Array.from(uniq.values());
    arr.sort((a, b) => (a.protocol === b.protocol ? a.port - b.port : a.protocol.localeCompare(b.protocol)));
    return arr;
  };

  const formatPortSpecs = (ports: PortSpec[] | undefined) => {
    const normalized = normalizePortSpecs(ports || []);
    return normalized.length ? normalized.map((p) => `${p.port}/${p.protocol}`).join(', ') : '-';
  };

  const updateServicePorts = (svcName: string, ports: PortSpec[]) => {
    if (!commandDraft) return;
    const nextPorts = normalizePortSpecs(ports);
    if (nextPorts.length === 0) return;
    setCommandDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        services: prev.services.map((s) => {
          if (s.name !== svcName) return s;
          return {
            ...s,
            containers: s.containers.map((c) => ({
              ...c,
              ports: nextPorts,
            })),
          };
        }),
      };
    });

    if (entry.enabled && entry.targetServiceName === svcName) {
      const tcpPorts = nextPorts.filter((p) => p.protocol === 'TCP').map((p) => p.port);
      if (tcpPorts.length) {
        setEntry((prev) => ({
          ...prev,
          targetPort: tcpPorts.includes(prev.targetPort) ? prev.targetPort : tcpPorts[0],
        }));
      }
    }
  };

  const suggestNextPort = (existing: PortSpec[], protocol: PortSpec['protocol']) => {
    const set = new Set(existing.filter((p) => (p.protocol || 'TCP') === protocol).map((p) => p.port));
    const preferred = [80, 8080, 8000, 3000, 9090];
    for (const p of preferred) {
      if (!set.has(p)) return p;
    }
    const existingNums = Array.from(set);
    const max = existingNums.length ? Math.max(...existingNums) : 80;
    return Math.min(65535, max + 1);
  };

  const updateContainer = (svcName: string, containerName: string, patch: Partial<{ image: string; replicas: number }>) => {
    if (!commandDraft) return;
    setCommandDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        services: prev.services.map((s) => {
          if (s.name !== svcName) return s;
          return {
            ...s,
            containers: s.containers.map((c) => {
              if (c.name !== containerName) return c;
              return { ...c, ...patch };
            }),
          };
        }),
      };
    });
  };

  const validateForDeploy = () => {
    if (!commandDraft) return '请先生成 Plan';
    if (!commandDraft.name.trim()) return 'App Name 不能为空';
    if (!commandDraft.namespace.trim()) return 'Namespace 不能为空';

    for (const s of commandDraft.services) {
      if (!s.name.trim()) return 'Service name 不能为空';
      if (!s.containers?.length) return `Service ${s.name} 至少需要一个 Workload`;
      const r = serviceResources[s.name];
      if (!r) return `Service ${s.name} 资源未初始化`;
      const rc = parseCpuToMillicores(r.requestsCpu);
      const lc = parseCpuToMillicores(r.limitsCpu);
      const rm = parseMemToMi(r.requestsMemory);
      const lm = parseMemToMi(r.limitsMemory);
      if (!rc || !lc || !rm || !lm) return `Service ${s.name} 资源格式不合法`;
      if (rc > lc) return `Service ${s.name} CPU requests 不能大于 limits`;
      if (rm > lm) return `Service ${s.name} 内存 requests 不能大于 limits`;

      const firstPorts = normalizePortSpecs(s.containers[0]?.ports || []);
      if (!firstPorts.length) return `Service ${s.name} 至少需要一个端口`;
      for (const c of s.containers) {
        if (!c.name.trim()) return `Service ${s.name} 的 Workload name 不能为空`;
        if (!c.image?.trim()) return `Workload ${s.name}/${c.name} 的镜像不能为空`;
        const ports = c.ports || [];
        const normalized = normalizePortSpecs(ports as PortSpec[]);
        if (!normalized.length) return `Service ${s.name} 至少需要一个端口`;
        if (normalized.length !== ports.length) return `Service ${s.name} 端口不合法或重复`;
        if (normalized.map((p) => `${p.protocol}:${p.port}`).join(',') !== firstPorts.map((p) => `${p.protocol}:${p.port}`).join(',')) {
          return `Service ${s.name} 的版本端口必须一致`;
        }
      }
    }
    return null;
  };

  const validateForExposure = () => {
    if (!deploymentId) return '请先完成 Deploy';
    if (!entry.enabled) return null;
    if (!entry.domain.trim()) return 'Domain 不能为空';
    const entrySvc = entry.targetServiceName.trim();
    if (!entrySvc) return 'Entry Target 不能为空';
    const svc = commandDraft?.services.find((s) => s.name === entrySvc);
    if (!svc) return 'Entry Target 不存在';
    const svcPorts = normalizePortSpecs(svc.containers?.[0]?.ports || []).filter((p) => p.protocol === 'TCP').map((p) => p.port);
    if (!svcPorts.length) return 'Entry Target 没有可用 TCP 端口';
    const port = entry.targetPort;
    if (!svcPorts.includes(port)) return 'Entry Port 必须从 Service Ports 中选择';
    return null;
  };

  const handleCopyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openReadyLogs = async () => {
    if (!commandDraft) return;
    setError(null);
    setLoading(true);
    try {
      const pods = await podApi.list(commandDraft.namespace, { 'paas.csm.com/app': commandDraft.name });
      const candidate =
        pods.find((p) => String(p.status).toLowerCase() === 'running' || String(p.phase).toLowerCase() === 'running') ||
        pods[0] ||
        null;
      if (!candidate) {
        setError('当前未找到 Pod，请稍后重试');
        return;
      }
      setReadyLogsPod(candidate);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '获取 Pod 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openReadyServiceNetwork = () => {
    if (!observedApp) {
      setError('当前未获取到应用状态，请稍后重试');
      return;
    }
    const svcName = entry.targetServiceName || commandDraft?.services?.[0]?.name || '';
    if (!svcName) {
      setError('当前没有可配置的 Service');
      return;
    }
    setReadyServiceNetwork({ app: observedApp, serviceName: svcName });
  };

  const handleDeploy = async () => {
    const err = validateForDeploy();
    if (err) {
      setError(err);
      if (err.includes('Domain')) {
        setTimeout(() => domainInputRef.current?.focus(), 0);
      }
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const final = ensureEntryInCommand(commandDraft!, entry);
      const id = await onDeploy(final);
      setDeploymentId(id);
      await fetchDeployments();
      setStep('deploy');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Deploy failed';
      setError(msg);
      if (String(msg).toLowerCase().includes('domain')) {
        setTimeout(() => domainInputRef.current?.focus(), 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyExposure = async () => {
    const err = validateForExposure();
    if (err) {
      setError(err);
      if (err.includes('Domain')) setTimeout(() => domainInputRef.current?.focus(), 0);
      return;
    }
    if (!deploymentId) return;
    if (!entry.enabled) {
      setExposureApplied(true);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const draft = buildCreateEntryIstioDraft(
        commandDraft!.namespace,
        commandDraft!.name,
        { enabled: entry.enabled, domain: entry.domain, targetServiceName: entry.targetServiceName, targetPort: entry.targetPort },
        commandDraft!.services.map((s) => ({ name: s.name }))
      );
      const yaml = buildIstioYaml(commandDraft!.namespace, commandDraft!.name, draft);
      setIstioYaml(yaml);
      await api.applyIstioYaml(commandDraft!.namespace, commandDraft!.name, yaml);
      setExposureApplied(true);
      await fetchDeployments();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Apply exposure failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canContinueTemplate = Boolean(selectedTemplate);
  const canContinueBasics = !validateBasics();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create Application</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {steps.map((s, idx) => {
                  const active = step === s.key;
                  const done = stepIndex > idx;
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <div className={`px-2 py-0.5 rounded-full ${active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {done ? '✓' : idx + 1} {s.label}
                      </div>
                      {idx !== steps.length - 1 && <span className="text-slate-400">/</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={operatorView} onChange={(e) => setOperatorView(e.target.checked)} />
              Operator
            </label>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-3">
                {createTemplates.map((t) => {
                  const selected = selectedTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</div>
                        {selected && <CheckCircle2 size={18} className="text-blue-600" />}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">{t.description}</div>
                      <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Entry: {t.hasEntry ? 'Yes' : 'No'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Versions: {t.hasVersions ? 'Yes' : 'No'}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {step === 'basics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">App Name *</label>
                    <input
                      value={appName}
                      onChange={(e) => setAppName(e.target.value.toLowerCase())}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. my-app"
                    />
                    {appName.trim() && !isDnsLabel(appName.trim()) && (
                      <div className="text-xs text-amber-600 mt-1">只允许小写字母/数字/短横线，且不能以短横线开头或结尾</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Namespace *</label>
                    <select
                      value={namespace || ''}
                      onChange={(e) => setNamespace(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="" disabled>Select a namespace</option>
                      {namespaceOptions.map((ns) => (
                        <option key={ns} value={ns}>
                          {ns}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="optional"
                    />
                  </div>
                </div>
              </div>

              {commandDraft && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Services</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (addServiceOpen) setAddServiceOpen(false);
                          else openAddServiceForm();
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        {addServiceOpen ? 'Close' : 'Add Service'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {addServiceOpen && (
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Service Name *</label>
                            <input
                              value={newServiceName}
                              onChange={(e) => {
                                setNewServiceName(e.target.value.toLowerCase());
                                setNewServiceError(null);
                              }}
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. api"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Ports (comma separated) *</label>
                            <input
                              value={newServicePort}
                              onChange={(e) => {
                                setNewServicePort(e.target.value);
                                setNewServiceError(null);
                              }}
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="80,8080"
                            />
                          </div>
                          <div className="flex items-end justify-end">
                            <button
                              type="button"
                              onClick={addVersionRow}
                              className="w-full px-4 py-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                              + Add Version
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {newVersions.map((v) => (
                            <div key={v.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Version Name *</label>
                                <input
                                  value={v.name}
                                  onChange={(e) => {
                                    updateVersionRow(v.id, { name: e.target.value.toLowerCase() });
                                    setNewServiceError(null);
                                  }}
                                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g. v1"
                                />
                              </div>
                              <div className="md:col-span-7">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Image *</label>
                                <input
                                  value={v.image}
                                  onChange={(e) => {
                                    updateVersionRow(v.id, { image: e.target.value });
                                    setNewServiceError(null);
                                  }}
                                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g. nginx:latest"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Replicas *</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    value={v.replicas}
                                    onChange={(e) => {
                                      updateVersionRow(v.id, { replicas: e.target.value });
                                      setNewServiceError(null);
                                    }}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeVersionRow(v.id)}
                                    disabled={newVersions.length <= 1}
                                    className="px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {newServiceError && <div className="text-sm text-red-600 dark:text-red-400">{newServiceError}</div>}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAddServiceOpen(false);
                              resetAddServiceForm();
                            }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddService}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {commandDraft.services.map((s) => {
                      const expanded = expandedServices.has(s.name) || commandDraft.services.length === 1;
                      const isEntry = entry.enabled && s.name === entry.targetServiceName;
                      const summaryImage = s.containers[0]?.image || '';
                      const summaryPorts = formatPortSpecs(s.containers[0]?.ports);
                      const summaryRes = getServiceResourcesSummary(s.containers);
                      const svcPorts = normalizePortSpecs(s.containers[0]?.ports || []);
                      const isRenaming = renamingService?.from === s.name;
                      return (
                        <div key={s.name} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleService(s.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') toggleService(s.name);
                            }}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between cursor-pointer"
                          >
                            <div className="min-w-0 text-left">
                              <div className="flex items-center gap-2">
                                {isRenaming ? (
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      value={renamingService?.to ?? ''}
                                      onChange={(e) => {
                                        setRenamingService((prev) => (prev ? { ...prev, to: e.target.value.toLowerCase() } : prev));
                                        setRenameError(null);
                                      }}
                                      className="w-40 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const from = renamingService?.from ?? s.name;
                                        const to = (renamingService?.to ?? '').trim().toLowerCase();
                                        if (!to) {
                                          setRenameError('Service Name 不能为空');
                                          return;
                                        }
                                        if (!isDnsLabel(to)) {
                                          setRenameError('Service Name 必须符合 DNS label（小写字母/数字/短横线）');
                                          return;
                                        }
                                        const exists = commandDraft.services.some((it) => it.name.toLowerCase() === to && it.name !== from);
                                        if (exists) {
                                          setRenameError('Service Name 已存在');
                                          return;
                                        }
                                        if (to === from) {
                                          setRenamingService(null);
                                          setRenameError(null);
                                          return;
                                        }
                                        renameService(from, to);
                                        setRenamingService(null);
                                        setRenameError(null);
                                      }}
                                      className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                      title="Save"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isUnsetServiceName(s.name)) {
                                          setRenamingService({ from: s.name, to: '' });
                                          setRenameError('Service Name 不能为空');
                                          return;
                                        }
                                        setRenamingService(null);
                                        setRenameError(null);
                                      }}
                                      className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                      title="Cancel"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{s.name}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedServices((prev) => {
                                          const next = new Set(prev);
                                          next.add(s.name);
                                          return next;
                                        });
                                        setRenamingService({ from: s.name, to: s.name });
                                        setRenameError(null);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                      title="Rename"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  </div>
                                )}
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                                    isEntry ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {isEntry ? 'Entry' : 'Internal'}
                                </span>
                              </div>
                              {isRenaming && renameError && (
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1" onClick={(e) => e.stopPropagation()}>
                                  {renameError}
                                </div>
                              )}
                              <div className="text-xs text-slate-500 mt-1 truncate">
                                {summaryImage || 'No image'}
                                {summaryPorts ? ` · ${summaryPorts}` : ''}
                                <span className="ml-2">CPU {summaryRes.cpu}</span>
                                <span className="ml-2">Mem {summaryRes.mem}</span>
                              </div>
                            </div>
                            {expanded ? <ChevronLeft size={18} className="text-slate-400 rotate-90" /> : <ChevronRight size={18} className="text-slate-400" />}
                          </div>
                          {expanded && (
                            <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-700">
                              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Resources</div>
                                <ServiceResourcesPanel value={serviceResources[s.name] || defaultServiceResources(resourcePreset)} onChange={(next) => updateServiceResources(s.name, next)} />
                              </div>
                              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Service Ports</div>
                                  <button
                                    type="button"
                                    onClick={() => updateServicePorts(s.name, [...svcPorts, { port: suggestNextPort(svcPorts, 'TCP'), protocol: 'TCP' }])}
                                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    Add Port
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {svcPorts.length === 0 && <div className="text-xs text-slate-400">No ports</div>}
                                  {svcPorts.map((p, idx) => (
                                    <div key={`${p.protocol}:${p.port}:${idx}`} className="flex items-center gap-2">
                                      <select
                                        value={p.protocol || 'TCP'}
                                        onChange={(e) => {
                                          const next = svcPorts.slice();
                                          next[idx] = { ...p, protocol: e.target.value as PortSpec['protocol'] };
                                          updateServicePorts(s.name, next);
                                        }}
                                        className="w-28 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                      >
                                        <option value="TCP">TCP</option>
                                        <option value="UDP">UDP</option>
                                      </select>
                                      <input
                                        type="number"
                                        min={1}
                                        max={65535}
                                        value={p.port}
                                        onChange={(e) => {
                                          const next = svcPorts.slice();
                                          next[idx] = { ...p, port: Number(e.target.value) };
                                          updateServicePorts(s.name, next);
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = svcPorts.slice();
                                          next.splice(idx, 1);
                                          updateServicePorts(s.name, next);
                                        }}
                                        disabled={svcPorts.length <= 1}
                                        className="px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {s.containers.map((c) => (
                                <div key={c.name} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-500 mb-1">Image *</label>
                                      <input
                                        value={c.image || ''}
                                        onChange={(e) => updateContainer(s.name, c.name, { image: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. nginx:latest"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-slate-500 mb-1">Replicas</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={c.replicas ?? 1}
                                        onChange={(e) => updateContainer(s.name, c.name, { replicas: Number(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'plan' && commandDraft && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Deployment Plan</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Namespace <span className="font-medium text-slate-700 dark:text-slate-200">{commandDraft.namespace}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        Services: {commandDraft.services.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        Versions: {commandDraft.services.reduce((acc, s) => acc + (s.containers?.length || 0), 0)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500">
                          <th className="py-2 pr-4 font-medium">Service</th>
                          <th className="py-2 pr-4 font-medium">Port</th>
                          <th className="py-2 pr-4 font-medium">Versions</th>
                          <th className="py-2 pr-4 font-medium">CPU req/lim</th>
                          <th className="py-2 pr-0 font-medium">Mem req/lim</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700 dark:text-slate-200">
                        {commandDraft.services.map((s) => {
                          const port = formatPortSpecs(s.containers?.[0]?.ports);
                          const versions = (s.containers || []).map((c) => c.name).join(', ') || '-';
                          const res = getServiceResourcesSummary(s.containers);
                          return (
                            <tr key={s.name} className="border-t border-slate-200/70 dark:border-slate-700/60">
                              <td className="py-2 pr-4 font-medium">{s.name}</td>
                              <td className="py-2 pr-4">{port}</td>
                              <td className="py-2 pr-4">{versions}</td>
                              <td className="py-2 pr-4">{res.cpu}</td>
                              <td className="py-2 pr-0">{res.mem}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(operatorView || entry.enabled) && (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Exposure Preview</div>
                      <div className="text-xs text-slate-500 mt-1">Istio Gateway + VirtualService</div>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${entry.enabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {entry.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Public URL</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">{publicUrl || '-'}</div>
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        disabled={!publicUrl}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50"
                        title="Copy URL"
                      >
                        {copied ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Target</div>
                      <div className="mt-1 text-slate-700 dark:text-slate-200">{entry.targetServiceName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Port</div>
                      <div className="mt-1 text-slate-700 dark:text-slate-200">{entry.targetPort || '-'}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Gateway: <span className="text-slate-700 dark:text-slate-200">{istioNames(commandDraft.name).gateway}</span></div>
                    <div>VirtualService: <span className="text-slate-700 dark:text-slate-200">{istioNames(commandDraft.name).virtualService}</span></div>
                  </div>

                  {operatorView && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-xs font-medium text-slate-500 mb-2">Istio YAML Preview</div>
                      <textarea
                        readOnly
                        rows={10}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                        value={planIstioYaml || '-'}
                      />
                    </div>
                  )}
                </div>
                )}
              </div>

              {operatorView && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200">Command Preview</div>
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <textarea
                      readOnly
                      rows={12}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      value={JSON.stringify(ensureEntryInCommand(commandDraft, entry), null, 2)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'deploy' && commandDraft && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Deploy</div>
                    <div className="text-xs text-slate-500 mt-1">
                      App <span className="font-medium text-slate-700 dark:text-slate-200">{commandDraft.name}</span>
                      <span className="mx-2 text-slate-300">/</span>
                      Namespace <span className="font-medium text-slate-700 dark:text-slate-200">{commandDraft.namespace}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      deployStage === 'SUCCEEDED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : deployStage === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : deployStage === 'STOPPED'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {deployStage}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Deployment ID: {deploymentId || '-'}</div>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Submitted Plan</div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-2 pr-4 font-medium">Service</th>
                        <th className="py-2 pr-4 font-medium">Port</th>
                        <th className="py-2 pr-4 font-medium">Versions</th>
                        <th className="py-2 pr-0 font-medium">Images</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-200">
                      {commandDraft.services.map((s) => {
                        const port = formatPortSpecs(s.containers?.[0]?.ports);
                        const versions = (s.containers || []).map((c) => c.name).join(', ') || '-';
                        const images = (s.containers || []).map((c) => c.image).join(', ') || '-';
                        return (
                          <tr key={s.name} className="border-t border-slate-200/70 dark:border-slate-700/60">
                            <td className="py-2 pr-4 font-medium">{s.name}</td>
                            <td className="py-2 pr-4">{port}</td>
                            <td className="py-2 pr-4">{versions}</td>
                            <td className="py-2 pr-0 truncate max-w-[360px]" title={images}>{images}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backend Status</div>
                  <button
                    type="button"
                    onClick={() => fetchDeployments()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  Application: <span className="font-medium">{observedApp?.status || 'PENDING'}</span>
                </div>
                {deployStage === 'FAILED' && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={handleDeploy}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                      Retry Deploy
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('basics')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors"
                    >
                      Back to Basics
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'exposure' && commandDraft && (
            exposureApplied ? (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={22} className="text-emerald-600 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">Ready</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {entry.enabled ? 'Public access is enabled.' : 'Deployed successfully (public access disabled).'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Done</span>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-medium text-slate-500">Public URL</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">{entry.enabled ? (publicUrl || '-') : '-'}</div>
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        disabled={!entry.enabled || !publicUrl}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title="Copy URL"
                      >
                        {copied ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <div className="text-xs font-medium text-slate-500">Deployment</div>
                      <div className="mt-1 text-slate-800 dark:text-slate-100 font-semibold">{deploymentId || '-'}</div>
                      <div className="mt-2 text-xs text-slate-500">Services {commandDraft.services.length} · Versions {commandDraft.services.reduce((acc, s) => acc + (s.containers?.length || 0), 0)}</div>
                    </div>
                    {entry.enabled && (
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="text-xs font-medium text-slate-500">Traffic Resources</div>
                        <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                          <div>Gateway: <span className="font-semibold">{istioNames(commandDraft.name).gateway}</span></div>
                          <div>VirtualService: <span className="font-semibold">{istioNames(commandDraft.name).virtualService}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openReadyLogs}
                    disabled={loading}
                    className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    Open Logs
                  </button>
                  <button
                    type="button"
                    onClick={openReadyServiceNetwork}
                    disabled={loading}
                    className="px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors"
                  >
                    Traffic Governance
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">Public URL</div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">{publicUrl || '-'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      disabled={!publicUrl}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                      title="Copy URL"
                    >
                      {copied ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-600 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Istio</span>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Exposure</div>
                  </div>
                  <div className="p-4 space-y-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={entry.enabled}
                        onChange={(e) => {
                          const next = { ...entry, enabled: e.target.checked };
                          setEntry(next);
                          setCommandDraft(ensureEntryInCommand(commandDraft, next));
                        }}
                      />
                      Enable Public Access (Advanced)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Domain</label>
                        <input
                          ref={domainInputRef}
                          disabled={!entry.enabled}
                          value={entry.domain}
                          onChange={(e) => {
                            const next = { ...entry, domain: e.target.value };
                            setEntry(next);
                            setCommandDraft(ensureEntryInCommand(commandDraft, next));
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Path</label>
                        <input
                          disabled={!entry.enabled}
                          value={entry.path}
                          onChange={(e) => setEntry((prev) => ({ ...prev, path: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Target Service</label>
                        <select
                          disabled={!entry.enabled}
                          value={entry.targetServiceName}
                          onChange={(e) => {
                            const svcName = e.target.value;
                            const svc = commandDraft.services.find((s) => s.name === svcName);
                            const svcPorts = normalizePortSpecs(svc?.containers?.[0]?.ports || []).filter((p) => p.protocol === 'TCP').map((p) => p.port);
                            const next = {
                              ...entry,
                              targetServiceName: svcName,
                              targetPort: svcPorts.includes(entry.targetPort) ? entry.targetPort : (svcPorts[0] || entry.targetPort),
                            };
                            setEntry(next);
                            setCommandDraft(ensureEntryInCommand(commandDraft, next));
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                        >
                          {commandDraft.services.map((s) => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
                        <select
                          disabled={!entry.enabled}
                          value={entry.targetPort}
                          onChange={(e) => setEntry((prev) => ({ ...prev, targetPort: Number(e.target.value) }))}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                        >
                          {normalizePortSpecs(commandDraft.services.find((s) => s.name === entry.targetServiceName)?.containers?.[0]?.ports || []).filter((p) => p.protocol === 'TCP').map((p) => p.port).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {operatorView && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200">Istio YAML Preview</div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                      <textarea
                        readOnly
                        rows={12}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        value={planIstioYaml || '-'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (step === 'template') onClose();
              else setStep(steps[Math.max(0, stepIndex - 1)].key);
            }}
            className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            disabled={loading}
          >
            Back
          </button>

          {step === 'template' && (
            <button
              type="button"
              onClick={() => {
                if (!selectedTemplate) return;
                const ns = (namespace || 'default').trim() || 'default';
                const initial = selectedTemplate.buildInitialCommand(ns);
                const forceServiceNameInput = selectedTemplate.id === 'empty';
                const unsetName = forceServiceNameInput ? newUnsetServiceName() : '';
                const initialServices = initial.services.map((s) => {
                  if (!forceServiceNameInput) return s;
                  return { ...s, name: unsetName };
                });
                const targetServiceName = forceServiceNameInput ? unsetName : selectedTemplate.defaultEntryServiceName;
                const targetPort = selectedTemplate.defaultEntryPort;
                const nextEntry: EntryState = {
                  enabled: selectedTemplate.hasEntry,
                  domain: '',
                  path: defaultPath,
                  targetServiceName,
                  targetPort,
                };
                const draft: DeployCommand = {
                  name: '',
                  namespace: ns,
                  description: '',
                  services: initialServices.map((s) => ({
                    ...s,
                    enableService: true,
                    serviceType: 'ClusterIP',
                    enableIngress: false,
                    ingressDomain: '',
                  })),
                };
                const initialMap = ensureServiceResourcesMap(draft, resourcePreset);
                const withResources = applyServiceResourcesToCommand(draft, initialMap);
                const next = ensureEntryInCommand(withResources, nextEntry);
                setEntry(nextEntry);
                setServiceResources(initialMap);
                setTouchedServices(new Set());
                setCommandDraft(next);
                setExpandedServices(new Set());
                if (forceServiceNameInput) {
                  setExpandedServices(new Set([unsetName]));
                  setRenamingService({ from: unsetName, to: '' });
                } else {
                  setRenamingService(null);
                }
                setRenameError(null);
                setAddServiceOpen(false);
                resetAddServiceForm();
                setStep('basics');
              }}
              disabled={!canContinueTemplate || loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              Continue
            </button>
          )}

          {step === 'basics' && (
            <button
              type="button"
              onClick={generatePlan}
              disabled={!canContinueBasics || loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              Generate Plan
            </button>
          )}

          {step === 'plan' && (
            <button
              type="button"
              onClick={handleDeploy}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Deploying...' : 'Deploy'}
            </button>
          )}

          {step === 'deploy' && (
            <button
              type="button"
              onClick={() => setStep('exposure')}
              disabled={loading || !deploymentId || deployStage !== 'SUCCEEDED'}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              Continue
            </button>
          )}

          {step === 'exposure' && (
            exposureApplied ? (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyExposure}
                disabled={loading || !deploymentId}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Applying...' : 'Apply'}
              </button>
            )
          )}
        </div>

        {readyServiceNetwork && (
          <ServiceNetworkModal
            isOpen={!!readyServiceNetwork}
            onClose={() => setReadyServiceNetwork(null)}
            app={readyServiceNetwork.app}
            serviceName={readyServiceNetwork.serviceName}
          />
        )}
        <LogsDrawer pod={readyLogsPod} onClose={() => setReadyLogsPod(null)} />
      </div>
    </div>
  );
}
