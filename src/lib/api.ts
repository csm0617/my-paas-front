import axios from 'axios';

// Configure your backend base URL here or in .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface EnvVar {
  [key: string]: string;
}

export interface ResourceQuotaSpec {
  hard: Record<string, string>;
}

export interface LimitRangeSpec {
  defaultLimits: Record<string, string>;
  defaultRequests: Record<string, string>;
}

export interface NetworkPolicySpec {
  ingressRules: string[];
  egressRules: string[];
}

export interface Namespace {
  name: string;
  status?: string;
  labels?: Record<string, string>;
  resourceQuotaSpec?: ResourceQuotaSpec;
  limitRangeSpec?: LimitRangeSpec;
  networkPolicySpec?: NetworkPolicySpec;
}

export interface CreateNamespaceRequest {
  name: string;
  labels?: Record<string, string>;
  resourceQuotaSpec?: ResourceQuotaSpec;
  limitRangeSpec?: LimitRangeSpec;
  networkPolicySpec?: NetworkPolicySpec;
}

export interface ProbeSpec {
  path: string;
  port: number;
  initialDelaySeconds: number;
  periodSeconds: number;
}

export interface PortSpec {
  port: number;
  protocol: 'TCP' | 'UDP';
  enableNodePort?: boolean;
  nodePort?: number;
}

export interface ConfigMount {
  mountPath: string;
  subPath: boolean;
  configMapName: string;
  key: string;
  defaultMode?: number;
}

export interface SecretMount {
  mountPath: string;
  subPath: boolean;
  secretName: string;
  key: string;
  defaultMode?: number;
}

export interface DeployCommand {
  name: string;
  namespace: string;
  image: string;
  port?: number;
  ports: PortSpec[];
  replicas: number;
  maxReplicas: number;
  env: EnvVar;
  configs?: EnvVar;
  secrets?: EnvVar;
  configMounts?: ConfigMount[];
  secretMounts?: SecretMount[];
  livenessProbe?: ProbeSpec;
  readinessProbe?: ProbeSpec;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  enableService?: boolean;
  serviceType?: string;
  enableIngress?: boolean;
  ingressDomain?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  nodeSelector?: Record<string, string>;
  affinityJson?: string;
  tolerationsJson?: string;
}

export interface ApplicationDeployment {
  id: string;
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  status: 'PENDING' | 'RUNNING' | 'FAILED' | 'DELETED' | 'STOPPED';
}

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export interface K8sTaint {
  key: string;
  value: string;
  effect: string;
}

export interface K8sNode {
  name: string;
  status: string;
  roles: string[];
  kubeletVersion: string;
  osImage: string;
  internalIp: string;
  externalIp: string;
  cpuCapacity: string;
  memoryCapacity: string;
  podCapacity: string;
  cpuAllocatable: string;
  memoryAllocatable: string;
  podAllocatable: string;
  labels: Record<string, string>;
  taints: K8sTaint[];
  unschedulable: boolean;
}

export const nodeApi = {
  list: async (): Promise<K8sNode[]> => {
    const res = await apiClient.get<Result<K8sNode[]>>(`/nodes`);
    return res.data.data;
  },
  cordon: async (name: string): Promise<void> => {
    await apiClient.post(`/nodes/${name}/cordon`);
  },
  uncordon: async (name: string): Promise<void> => {
    await apiClient.post(`/nodes/${name}/uncordon`);
  }
};


export const namespaceApi = {
  list: async (): Promise<Namespace[]> => {
    const res = await apiClient.get<Result<Namespace[]>>(`/namespaces/`);
    return res.data.data;
  },
  get: async (name: string): Promise<Namespace> => {
    const res = await apiClient.get<Result<Namespace>>(`/namespaces/${name}`);
    return res.data.data;
  },
  create: async (request: CreateNamespaceRequest): Promise<Namespace> => {
    const res = await apiClient.post<Result<Namespace>>(`/namespaces/`, request);
    return res.data.data;
  },
  delete: async (name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${name}`);
  },
};

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  phase?: string;
  reason?: string;
  message?: string;
  nodeName: string;
  podIP: string;
  startTime: string;
  restarts: number;
}

export const podApi = {
  list: async (namespace: string, labels?: Record<string, string>): Promise<Pod[]> => {
    const res = await apiClient.get<Result<Pod[]>>(`/namespaces/${namespace}/pods`, { params: labels });
    return res.data.data;
  },
  get: async (namespace: string, name: string): Promise<Pod> => {
    const res = await apiClient.get<Result<Pod>>(`/namespaces/${namespace}/pods/${name}`);
    return res.data.data;
  },
  delete: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/pods/${name}`);
  },
  getLogs: async (namespace: string, name: string, tailLines: number = 100): Promise<string> => {
    const res = await apiClient.get<Result<string>>(`/namespaces/${namespace}/pods/${name}/logs`, {
      params: { tailLines },
    });
    return res.data.data;
  },
  getTerminalUrl: async (namespace: string, name: string): Promise<string> => {
    const res = await apiClient.get<Result<string>>(`/namespaces/${namespace}/pods/${name}/terminal`);
    return res.data.data;
  }
};

export interface K8sEvent {
  namespace?: string;
  name?: string;
  type?: string;
  reason?: string;
  message?: string;
  involvedObjectKind?: string;
  involvedObjectName?: string;
  lastTimestamp?: string;
}

export const eventApi = {
  list: async (namespace: string, params?: Record<string, unknown>): Promise<K8sEvent[]> => {
    const res = await apiClient.get<Result<K8sEvent[]>>(`/namespaces/${namespace}/events`, { params });
    return res.data.data;
  },
};

export const api = {
  getDeployments: async (namespace: string): Promise<ApplicationDeployment[]> => {
    const res = await apiClient.get<Result<ApplicationDeployment[]>>(`/applications/deployments/${namespace}`);
    return res.data.data;
  },

  deploy: async (command: DeployCommand): Promise<string> => {
    const res = await apiClient.post<Result<string>>(`/applications/deployments`, command);
    return res.data.data;
  },

  scale: async (namespace: string, name: string, replicas: number): Promise<void> => {
    await apiClient.put(`/applications/deployments/${namespace}/${name}/scale`, null, {
      params: { replicas },
    });
  },

  updateImage: async (namespace: string, name: string, image: string): Promise<void> => {
    await apiClient.put(`/applications/deployments/${namespace}/${name}/image`, null, {
      params: { image },
    });
  },

  delete: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/applications/deployments/${namespace}/${name}`);
  },

  stop: async (namespace: string, name: string): Promise<void> => {
    await apiClient.post(`/applications/deployments/${namespace}/${name}/stop`);
  },

  start: async (namespace: string, name: string): Promise<void> => {
    await apiClient.post(`/applications/deployments/${namespace}/${name}/start`);
  },

  restart: async (namespace: string, name: string): Promise<void> => {
    await apiClient.post(`/applications/deployments/${namespace}/${name}/restart`);
  },

  rollback: async (namespace: string, name: string): Promise<void> => {
    await apiClient.post(`/applications/deployments/${namespace}/${name}/rollback`);
  },

  getLogs: async (namespace: string, name: string, tailLines: number = 100): Promise<string> => {
    const res = await apiClient.get<Result<string>>(`/applications/deployments/${namespace}/${name}/logs`, {
      params: { tailLines },
    });
    return res.data.data;
  },

  getTerminalUrl: async (namespace: string, name: string, podName: string): Promise<string> => {
    const res = await apiClient.get<Result<string>>(`/applications/deployments/${namespace}/${name}/terminal`, {
      params: { podName },
    });
    return res.data.data;
  },

  getYaml: async (namespace: string, name: string): Promise<string> => {
    const res = await apiClient.get<Result<string>>(`/applications/deployments/${namespace}/${name}/yaml`);
    return res.data.data;
  },

  checkNodePort: async (port: number): Promise<boolean> => {
    const res = await apiClient.get<Result<boolean>>(`/applications/ports/check-nodeport`, {
      params: { port },
    });
    return res.data.data;
  },
};

export interface ServicePort {
  name?: string;
  port: number;
  targetPort?: number;
  nodePort?: number;
  protocol?: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs?: string[];
  ports: ServicePort[];
  selector?: Record<string, string>;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  paths: string[];
  loadBalancerIPs?: string[];
}

export interface CreateServiceCommand {
  name: string;
  type: string;
  ports: ServicePort[];
  selector: Record<string, string>;
}

export interface IngressRuleDto {
  host: string;
  path: string;
  pathType: string;
  serviceName: string;
  servicePort: number;
}

export interface CreateIngressCommand {
  name: string;
  rules: IngressRuleDto[];
}

export const networkApi = {
  listServices: async (namespace: string): Promise<K8sService[]> => {
    const res = await apiClient.get<Result<K8sService[]>>(`/namespaces/${namespace}/services`);
    return res.data.data;
  },
  getService: async (namespace: string, name: string): Promise<K8sService> => {
    const res = await apiClient.get<Result<K8sService>>(`/namespaces/${namespace}/services/${name}`);
    return res.data.data;
  },
  createService: async (namespace: string, command: CreateServiceCommand): Promise<K8sService> => {
    const res = await apiClient.post<Result<K8sService>>(`/namespaces/${namespace}/services`, command);
    return res.data.data;
  },
  deleteService: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/services/${name}`);
  },
  listIngresses: async (namespace: string): Promise<K8sIngress[]> => {
    const res = await apiClient.get<Result<K8sIngress[]>>(`/namespaces/${namespace}/ingresses`);
    return res.data.data;
  },
  getIngress: async (namespace: string, name: string): Promise<K8sIngress> => {
    const res = await apiClient.get<Result<K8sIngress>>(`/namespaces/${namespace}/ingresses/${name}`);
    return res.data.data;
  },
  createIngress: async (namespace: string, command: CreateIngressCommand): Promise<K8sIngress> => {
    const res = await apiClient.post<Result<K8sIngress>>(`/namespaces/${namespace}/ingresses`, command);
    return res.data.data;
  },
  deleteIngress: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/ingresses/${name}`);
  }
};

export interface K8sConfigMap {
  name: string;
  namespace: string;
  data: Record<string, string>;
  creationTimestamp?: string;
}

export const configMapApi = {
  list: async (namespace: string): Promise<K8sConfigMap[]> => {
    const res = await apiClient.get<Result<K8sConfigMap[]>>(`/namespaces/${namespace}/configmaps`);
    return res.data.data;
  },
  get: async (namespace: string, name: string): Promise<K8sConfigMap> => {
    const res = await apiClient.get<Result<K8sConfigMap>>(`/namespaces/${namespace}/configmaps/${name}`);
    return res.data.data;
  },
  create: async (namespace: string, configMap: { name: string; data: Record<string, string> }): Promise<K8sConfigMap> => {
    const res = await apiClient.post<Result<K8sConfigMap>>(`/namespaces/${namespace}/configmaps`, configMap);
    return res.data.data;
  },
  update: async (namespace: string, name: string, configMap: { data: Record<string, string> }): Promise<K8sConfigMap> => {
    const res = await apiClient.put<Result<K8sConfigMap>>(`/namespaces/${namespace}/configmaps/${name}`, configMap);
    return res.data.data;
  },
  delete: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/configmaps/${name}`);
  }
};

export interface K8sSecret {
  name: string;
  namespace: string;
  data: Record<string, string>;
  creationTimestamp?: string;
}

export const secretApi = {
  list: async (namespace: string): Promise<K8sSecret[]> => {
    const res = await apiClient.get<Result<K8sSecret[]>>(`/namespaces/${namespace}/secrets`);
    return res.data.data;
  },
  get: async (namespace: string, name: string): Promise<K8sSecret> => {
    const res = await apiClient.get<Result<K8sSecret>>(`/namespaces/${namespace}/secrets/${name}`);
    return res.data.data;
  },
  create: async (namespace: string, secret: { name: string; data: Record<string, string> }): Promise<K8sSecret> => {
    const res = await apiClient.post<Result<K8sSecret>>(`/namespaces/${namespace}/secrets`, secret);
    return res.data.data;
  },
  update: async (namespace: string, name: string, secret: { data: Record<string, string> }): Promise<K8sSecret> => {
    const res = await apiClient.put<Result<K8sSecret>>(`/namespaces/${namespace}/secrets/${name}`, secret);
    return res.data.data;
  },
  delete: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/secrets/${name}`);
  }
};

export interface K8sDeployment {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  availableReplicas: number;
  status: string;
  creationTimestamp?: string;
}

export interface CreateDeploymentCommand {
  name: string;
  image: string;
  port: number;
  replicas: number;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  nodeSelector?: Record<string, string>;
  affinityJson?: string;
  tolerationsJson?: string;
}

export type CreateDeploymentRequest = CreateDeploymentCommand;

export const deploymentApi = {
  list: async (namespace: string): Promise<K8sDeployment[]> => {
    const res = await apiClient.get<Result<K8sDeployment[]>>(`/namespaces/${namespace}/deployments`);
    return res.data.data;
  },
  create: async (namespace: string, request: CreateDeploymentRequest): Promise<K8sDeployment> => {
    const res = await apiClient.post<Result<K8sDeployment>>(`/namespaces/${namespace}/deployments`, request);
    return res.data.data;
  },
  scale: async (namespace: string, name: string, replicas: number): Promise<void> => {
    await apiClient.put(`/namespaces/${namespace}/deployments/${name}/scale`, null, {
      params: { replicas },
    });
  },
  updateImage: async (namespace: string, name: string, image: string): Promise<void> => {
    await apiClient.put(`/namespaces/${namespace}/deployments/${name}/image`, null, {
      params: { image },
    });
  },
  restart: async (namespace: string, name: string): Promise<void> => {
    await apiClient.post(`/namespaces/${namespace}/deployments/${name}/restart`);
  },
  delete: async (namespace: string, name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${namespace}/deployments/${name}`);
  }
};
