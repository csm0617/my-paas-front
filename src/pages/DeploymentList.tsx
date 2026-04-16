import React, { useEffect, useState } from 'react';
import { useDeploymentStore } from '@/store/deploymentStore';
import { useNamespaceStore } from '@/store/namespaceStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import InputDialog from '@/components/InputDialog';
import CreateDeploymentModal from '@/components/CreateDeploymentModal';
import { K8sDeployment, CreateDeploymentRequest } from '@/lib/api';
import { RefreshCw, FolderTree, AlertCircle, Trash2, Edit, Plus, RotateCw, Activity } from 'lucide-react';

export default function DeploymentList() {
  const { currentNamespace, setCurrentNamespace, namespaces, fetchNamespaces } = useNamespaceStore();
  const { deployments, loading, error, fetchDeployments, deleteDeployment, createDeployment, scaleDeployment, updateDeploymentImage, restartDeployment } = useDeploymentStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<K8sDeployment | null>(null);
  const [inputAction, setInputAction] = useState<{
    type: 'scale' | 'image';
    deployment: K8sDeployment;
  } | null>(null);
  const [confirmRestart, setConfirmRestart] = useState<K8sDeployment | null>(null);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  useEffect(() => {
    fetchDeployments(currentNamespace);
  }, [fetchDeployments, currentNamespace]);

  const handleDeleteClick = (deployment: K8sDeployment) => {
    setConfirmDelete(deployment);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDeployment(currentNamespace, confirmDelete.name);
    } catch (err: any) {
      alert(err.message || 'Failed to delete deployment');
    }
  };

  const handleCreateSubmit = async (namespace: string, request: CreateDeploymentRequest) => {
    await createDeployment(namespace, request);
  };

  const handleScaleClick = async (deployment: K8sDeployment) => {
    setInputAction({ type: 'scale', deployment });
  };

  const handleUpdateImageClick = async (deployment: K8sDeployment) => {
    setInputAction({ type: 'image', deployment });
  };

  const handleInputConfirm = async (value: string) => {
    if (!inputAction) return;
    try {
      if (inputAction.type === 'scale') {
        const replicas = parseInt(value, 10);
        if (!isNaN(replicas) && replicas >= 0) {
          await scaleDeployment(currentNamespace, inputAction.deployment.name, replicas);
        } else {
          alert('Invalid replicas count');
        }
      } else if (inputAction.type === 'image') {
        const image = value.trim();
        if (image) {
          await updateDeploymentImage(currentNamespace, inputAction.deployment.name, image);
        }
      }
    } catch (err: any) {
      alert(err.message || `Failed to update ${inputAction.type}`);
    } finally {
      setInputAction(null);
    }
  };

  const handleRestartClick = async (deployment: K8sDeployment) => {
    setConfirmRestart(deployment);
  };

  const handleConfirmRestart = async () => {
    if (!confirmRestart) return;
    try {
      await restartDeployment(currentNamespace, confirmRestart.name);
    } catch (err: any) {
      alert(err.message || 'Failed to restart deployment');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <FolderTree size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Namespace</span>
            <select
              value={currentNamespace}
              onChange={(e) => setCurrentNamespace(e.target.value)}
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
                </>
              )}
            </select>
          </div>
          <button
            onClick={() => fetchDeployments(currentNamespace)}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          <span>Create Deployment</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center space-x-3">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Image</th>
                <th className="p-4 font-medium">Replicas</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Age</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading && deployments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
                    Loading deployments...
                  </td>
                </tr>
              ) : deployments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3 py-8">
                      <Activity size={48} className="text-slate-300 dark:text-slate-600" />
                      <p>No deployments found in namespace {currentNamespace}.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                deployments.map((deployment) => (
                  <tr key={deployment.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                    <td className="p-4 font-medium text-sm text-slate-800 dark:text-slate-200">
                      {deployment.name}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {deployment.image}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {deployment.availableReplicas} / {deployment.replicas}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        deployment.availableReplicas >= deployment.replicas && deployment.replicas > 0
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {deployment.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {deployment.creationTimestamp ? new Date(deployment.creationTimestamp).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleScaleClick(deployment)}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Scale Deployment"
                        >
                          <Activity size={18} />
                        </button>
                        <button
                          onClick={() => handleUpdateImageClick(deployment)}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title="Update Image"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleRestartClick(deployment)}
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                          title="Restart Deployment"
                        >
                          <RotateCw size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(deployment)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete Deployment"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateDeploymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Deployment"
        message={`Are you sure you want to delete deployment '${confirmDelete?.name}'?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
        confirmText="Delete"
        isDestructive={true}
      />
      <ConfirmDialog
        isOpen={!!confirmRestart}
        title="Restart Deployment"
        message={`Are you sure you want to restart deployment '${confirmRestart?.name}'?`}
        onConfirm={handleConfirmRestart}
        onCancel={() => setConfirmRestart(null)}
        confirmText="Restart"
        isDestructive={false}
      />
      <InputDialog
        isOpen={!!inputAction}
        title={inputAction?.type === 'scale' ? 'Scale Deployment' : 'Update Image'}
        message={inputAction?.type === 'scale' ? 'Enter new replicas:' : 'Enter new image:'}
        defaultValue={inputAction?.type === 'scale' ? inputAction.deployment.replicas.toString() : inputAction?.deployment.image}
        inputType={inputAction?.type === 'scale' ? 'number' : 'text'}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputAction(null)}
      />
    </div>
  );
}
