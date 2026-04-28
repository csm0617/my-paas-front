import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CreateDeploymentRequest } from '@/lib/api';
import ResourcesSchedulingSection from '@/components/ResourcesSchedulingSection';
import { useNamespaceStore } from '@/store/namespaceStore';

interface CreateDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (namespace: string, request: CreateDeploymentRequest) => Promise<void>;
}

export default function CreateDeploymentModal({ isOpen, onClose, onSubmit }: CreateDeploymentModalProps) {
  const { namespaces, fetchNamespaces, loading: namespacesLoading, currentNamespace } = useNamespaceStore();
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [image, setImage] = useState('');
  const [port, setPort] = useState<number | ''>(80);
  const [replicas, setReplicas] = useState<number | ''>(1);
  const [resourcesScheduling, setResourcesScheduling] = useState<Pick<CreateDeploymentRequest, 'requestsCpu' | 'requestsMemory' | 'limitsCpu' | 'limitsMemory' | 'nodeSelector' | 'affinityJson' | 'tolerationsJson'>>({
    requestsCpu: '',
    requestsMemory: '',
    limitsCpu: '',
    limitsMemory: '',
    nodeSelector: {},
    affinityJson: '',
    tolerationsJson: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespaceOptions = useMemo(() => {
    return namespaces.length > 0 ? namespaces.map((ns) => ns.name) : ['default', 'kube-system', 'monitoring'];
  }, [namespaces]);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setNamespace(currentNamespace || 'default');
      setImage('');
      setPort(80);
      setReplicas(1);
      setResourcesScheduling({
        requestsCpu: '',
        requestsMemory: '',
        limitsCpu: '',
        limitsMemory: '',
        nodeSelector: {},
        affinityJson: '',
        tolerationsJson: '',
      });
      setError(null);
      if (namespaces.length === 0 && !namespacesLoading) {
        fetchNamespaces();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!namespace) return;
    if (!namespaceOptions.includes(namespace)) setNamespace('');
  }, [isOpen, namespace, namespaceOptions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !image || port === '' || replicas === '') {
      setError('All fields are required');
      return;
    }
    if (!namespace.trim()) {
      setError('Namespace is required');
      return;
    }

    if (resourcesScheduling.affinityJson?.trim()) {
      try {
        JSON.parse(resourcesScheduling.affinityJson);
      } catch {
        setError('affinityJson JSON 格式错误');
        return;
      }
    }

    if (resourcesScheduling.tolerationsJson?.trim()) {
      try {
        JSON.parse(resourcesScheduling.tolerationsJson);
      } catch {
        setError('tolerationsJson JSON 格式错误');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(namespace, {
        name,
        image,
        port: Number(port),
        replicas: Number(replicas),
        ...resourcesScheduling,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Create Deployment
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. my-app"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Namespace <span className="text-red-500">*</span>
              </label>
              <select
                value={namespace || ''}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Image <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. nginx:latest"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Port <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 80"
                  min="1"
                  max="65535"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Replicas <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={replicas}
                  onChange={(e) => setReplicas(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 1"
                  min="0"
                  required
                />
              </div>
            </div>
          </div>

          <ResourcesSchedulingSection value={resourcesScheduling} onChange={setResourcesScheduling} namespaceName={namespace} />

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
              <span>Create</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
