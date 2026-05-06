import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useNamespaceStore } from '@/store/namespaceStore';
import DeployModal from '@/components/DeployModal';
import { DeployCommand } from '@/lib/api';
import { Plus, RefreshCw, FolderTree, AlertCircle, Activity, Layers, Cpu } from 'lucide-react';
import { useK8sWatch } from '@/hooks/useK8sWatch';

export default function Dashboard() {
  const { namespace, deployments, loading, error, setNamespace, fetchDeployments, deploy } = useAppStore();
  const { namespaces, fetchNamespaces } = useNamespaceStore();
  const navigate = useNavigate();

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments, namespace]);

  useK8sWatch(namespace, (event) => {
    if (event.type === 'deployment') {
      fetchDeployments();
    }
  });

  const handleDeploy = async (command: DeployCommand): Promise<string> => {
    return await deploy(command);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-emerald-500';
      case 'FAILED': return 'bg-red-500';
      case 'STOPPED': return 'bg-slate-500';
      default: return 'bg-amber-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const isRunning = status === 'RUNNING';
    const isFailed = status === 'FAILED';
    const isStopped = status === 'STOPPED';
    return `px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1 ${
      isRunning
        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
        : isFailed
        ? 'bg-red-50 text-red-600 border border-red-200'
        : isStopped
        ? 'bg-slate-50 text-slate-600 border border-slate-200'
        : 'bg-amber-50 text-amber-600 border border-amber-200'
    }`;
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <FolderTree size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Namespace</span>
            <select
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-blue-600 dark:text-blue-400 outline-none cursor-pointer"
            >
              {namespaces.length > 0 ? (
                namespaces.map(ns => (
                  <option key={ns.name} value={ns.name}>{ns.name}</option>
                ))
              ) : (
                <>
                  <option value="default">default</option>
                  <option value="kube-system">kube-system</option>
                  <option value="monitoring">monitoring</option>
                </>
              )}
            </select>
          </div>
          <button
            onClick={() => fetchDeployments()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        <button
          onClick={() => setIsDeployModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium"
        >
          <Plus size={18} />
          <span>Create Application</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center space-x-3">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 应用列表 */}
      {loading && deployments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4 text-slate-400">
            <RefreshCw size={32} className="animate-spin text-blue-500" />
            <p>Loading applications...</p>
          </div>
        </div>
      ) : deployments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="flex flex-col items-center space-y-4 max-w-md text-center p-8">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500 mb-2">
              <Layers size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No applications found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              There are no applications in the <span className="font-mono text-blue-500">{namespace}</span> namespace.
              Click "Create Application" to create one.
            </p>
            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="mt-4 flex items-center space-x-2 text-blue-600 font-semibold hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-6 py-2 rounded-full transition-colors"
            >
              <Plus size={18} />
              <span>Create Application</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start pb-8">
          {deployments.map((app) => {
            const computedStatus = app.status || 'UNKNOWN';
            return (
              <div
                key={app.name}
                onClick={() => navigate(`/apps/${app.name}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 group"
              >
                <div className={`h-1 w-full ${getStatusColor(computedStatus)}`} />

                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl text-blue-600 dark:text-blue-400">
                        <Layers size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{app.name}</h3>
                        {app.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[200px]" title={app.description}>
                            {app.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={getStatusBadge(computedStatus)}>
                      <Activity size={12} className={computedStatus === 'RUNNING' ? 'animate-pulse' : ''} />
                      <span>{computedStatus}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">
                        Namespace
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {app.namespace}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center space-x-1">
                        <Cpu size={12} />
                        <span>Services</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {app.services.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 创建应用弹窗 */}
      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onDeploy={(command) => handleDeploy(command).then(() => {})}
      />
    </div>
  );
}
