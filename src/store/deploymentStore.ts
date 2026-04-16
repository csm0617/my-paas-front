import { create } from 'zustand';
import { deploymentApi, K8sDeployment, CreateDeploymentRequest } from '@/lib/api';

interface DeploymentState {
  deployments: K8sDeployment[];
  loading: boolean;
  error: string | null;
  fetchDeployments: (namespace: string) => Promise<void>;
  createDeployment: (namespace: string, request: CreateDeploymentRequest) => Promise<void>;
  scaleDeployment: (namespace: string, name: string, replicas: number) => Promise<void>;
  updateDeploymentImage: (namespace: string, name: string, image: string) => Promise<void>;
  restartDeployment: (namespace: string, name: string) => Promise<void>;
  deleteDeployment: (namespace: string, name: string) => Promise<void>;
}

export const useDeploymentStore = create<DeploymentState>((set, get) => ({
  deployments: [],
  loading: false,
  error: null,
  fetchDeployments: async (namespace: string) => {
    set({ loading: true, error: null });
    try {
      const deployments = await deploymentApi.list(namespace);
      set({ deployments, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  createDeployment: async (namespace: string, request: CreateDeploymentRequest) => {
    set({ loading: true, error: null });
    try {
      await deploymentApi.create(namespace, request);
      await get().fetchDeployments(namespace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  scaleDeployment: async (namespace: string, name: string, replicas: number) => {
    set({ loading: true, error: null });
    try {
      await deploymentApi.scale(namespace, name, replicas);
      await get().fetchDeployments(namespace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  updateDeploymentImage: async (namespace: string, name: string, image: string) => {
    set({ loading: true, error: null });
    try {
      await deploymentApi.updateImage(namespace, name, image);
      await get().fetchDeployments(namespace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  restartDeployment: async (namespace: string, name: string) => {
    set({ loading: true, error: null });
    try {
      await deploymentApi.restart(namespace, name);
      await get().fetchDeployments(namespace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  deleteDeployment: async (namespace: string, name: string) => {
    set({ loading: true, error: null });
    try {
      await deploymentApi.delete(namespace, name);
      await get().fetchDeployments(namespace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
