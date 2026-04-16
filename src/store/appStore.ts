import { create } from 'zustand';
import { api, ApplicationDeployment, DeployCommand } from '@/lib/api';

interface AppState {
  namespace: string;
  deployments: ApplicationDeployment[];
  loading: boolean;
  error: string | null;

  setNamespace: (namespace: string) => void;
  fetchDeployments: () => Promise<void>;
  deploy: (command: DeployCommand) => Promise<void>;
  scale: (name: string, replicas: number) => Promise<void>;
  updateImage: (name: string, image: string) => Promise<void>;
  deleteDeployment: (name: string) => Promise<void>;
  start: (name: string) => Promise<void>;
  stop: (name: string) => Promise<void>;
  restart: (name: string) => Promise<void>;
  rollback: (name: string) => Promise<void>;
}

let fetchDeploymentsTimeout: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  namespace: 'default',
  deployments: [],
  loading: false,
  error: null,

  setNamespace: (namespace) => {
    set({ namespace });
  },

  fetchDeployments: () => {
    return new Promise<void>((resolve) => {
      if (fetchDeploymentsTimeout) {
        clearTimeout(fetchDeploymentsTimeout);
      }
      fetchDeploymentsTimeout = setTimeout(async () => {
        set({ loading: true, error: null });
        try {
          const { namespace } = get();
          const data = await api.getDeployments(namespace);
          set({ deployments: data, loading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch deployments', loading: false });
        }
        resolve();
      }, 300); // 300ms debounce
    });
  },

  deploy: async (command) => {
    try {
      await api.deploy(command);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to deploy');
    }
  },

  scale: async (name, replicas) => {
    try {
      const { namespace } = get();
      await api.scale(namespace, name, replicas);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to scale');
    }
  },

  updateImage: async (name, image) => {
    try {
      const { namespace } = get();
      await api.updateImage(namespace, name, image);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to update image');
    }
  },

  deleteDeployment: async (name) => {
    try {
      const { namespace } = get();
      await api.delete(namespace, name);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to delete deployment');
    }
  },

  start: async (name) => {
    try {
      const { namespace } = get();
      await api.start(namespace, name);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to start deployment');
    }
  },

  stop: async (name) => {
    try {
      const { namespace } = get();
      await api.stop(namespace, name);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to stop deployment');
    }
  },

  restart: async (name) => {
    try {
      const { namespace } = get();
      await api.restart(namespace, name);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to restart deployment');
    }
  },

  rollback: async (name) => {
    try {
      const { namespace } = get();
      await api.rollback(namespace, name);
      get().fetchDeployments();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to rollback deployment');
    }
  },
}));
