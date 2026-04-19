import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useNamespaceStore } from '@/store/namespaceStore';
import ApplicationCard from '@/components/ApplicationCard';
import ApplicationListItem from '@/components/ApplicationListItem';
import DeployModal from '@/components/DeployModal';
import LogsDrawer from '@/components/LogsDrawer';
import TerminalDrawer from '@/components/TerminalDrawer';
import YamlModal from '@/components/YamlModal';
import EventsModal from '@/components/EventsModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import InputDialog from '@/components/InputDialog';
import { Application, DeployCommand, Pod, podApi } from '@/lib/api';
import { Plus, RefreshCw, FolderTree, AlertCircle, LayoutGrid, List } from 'lucide-react';
import { useK8sWatch } from '@/hooks/useK8sWatch';

export default function Dashboard() {
  const { namespace, deployments, loading, error, setNamespace, fetchDeployments, deploy, scale, updateImage, deleteDeployment, start, stop, restart, rollback } = useAppStore();
  const { namespaces, fetchNamespaces } = useNamespaceStore();

  const [isDeployModalOpen, setDeployModalOpen] = useState(false);
  const [editServiceApp, setEditServiceApp] = useState<{ app: Application; serviceName: string } | null>(null);
  const [logsPod, setLogsPod] = useState<Pod | null>(null);
  const [terminalPod, setTerminalPod] = useState<Pod | null>(null);
  const [yamlApp, setYamlApp] = useState<{ app: Application; serviceName?: string; workloadName?: string } | null>(null);
  const [eventsApp, setEventsApp] = useState<Application | null>(null);
  const [inputAction, setInputAction] = useState<{
    type: 'scale' | 'image';
    app: Application;
    serviceName: string;
    workloadName?: string;
    currentValue?: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'stop' | 'restart' | 'rollback' | 'deletePod';
    app?: Application;
    serviceName?: string;
    workloadName?: string;
    pod?: Pod;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

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

  const handleScale = async (app: Application, serviceName: string, workloadName: string, currentReplicas: number) => {
    setInputAction({ type: 'scale', app, serviceName, workloadName, currentValue: currentReplicas.toString() });
  };

  const handleUpdateImage = async (app: Application, serviceName: string, workloadName: string, currentImage: string) => {
    setInputAction({ type: 'image', app, serviceName, workloadName, currentValue: currentImage });
  };

  const handleInputConfirm = async (value: string) => {
    if (!inputAction) return;
    try {
      if (inputAction.type === 'scale' && inputAction.workloadName) {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) {
          await scale(inputAction.app.name, inputAction.serviceName, inputAction.workloadName, n);
        }
      } else if (inputAction.type === 'image' && inputAction.workloadName) {
        if (value.trim()) {
          await updateImage(inputAction.app.name, inputAction.serviceName, inputAction.workloadName, value.trim());
        }
      }
    } catch (err: any) {
      console.error(`Failed to update ${inputAction.type}:`, err);
    } finally {
      setInputAction(null);
    }
  };

  const handleDelete = async (app: Application) => {
    setConfirmAction({ type: 'delete', app });
  };

  const handleDeploy = async (command: DeployCommand) => {
    await deploy(command);
  };

  const handleStart = async (app: Application) => {
    await start(app.name);
  };

  const handleStop = async (app: Application) => {
    setConfirmAction({ type: 'stop', app });
  };

  const handleRestart = async (app: Application, serviceName: string, workloadName: string) => {
    setConfirmAction({ type: 'restart', app, serviceName, workloadName });
  };

  const handleRollback = async (app: Application, serviceName: string, workloadName: string) => {
    setConfirmAction({ type: 'rollback', app, serviceName, workloadName });
  };

  const handleEditService = (app: Application, serviceName: string) => {
    setEditServiceApp({ app, serviceName });
  };

  const handleDeletePod = (pod: Pod) => {
    setConfirmAction({ type: 'deletePod', pod: pod });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, app, serviceName, workloadName, pod } = confirmAction;
    try {
      if (type === 'delete' && app) await deleteDeployment(app.name);
      if (type === 'stop' && app) await stop(app.name);
      if (type === 'restart' && app && serviceName && workloadName) await restart(app.name, serviceName, workloadName);
      if (type === 'rollback' && app && serviceName && workloadName) await rollback(app.name, serviceName, workloadName);
      if (type === 'deletePod' && pod) {
        await podApi.delete(pod.namespace, pod.name);
      }
    } catch (err: any) {
      console.error(`Failed to ${type}:`, err);
      // Removed the alert() hard popup as requested
    } finally {
      setConfirmAction(null);
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
          
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title="Card View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title="List View"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setDeployModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium"
        >
          <Plus size={18} />
          <span>New Application</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center space-x-3">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Main Grid */}
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
              <FolderTree size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No applications found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              There are no applications in the <span className="font-mono text-blue-500">{namespace}</span> namespace.
              Click "New Application" to create one.
            </p>
            <button
              onClick={() => setDeployModalOpen(true)}
              className="mt-4 flex items-center space-x-2 text-blue-600 font-semibold hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-6 py-2 rounded-full transition-colors"
            >
              <Plus size={18} />
              <span>Deploy Now</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start pb-8">
          {deployments.map((app) => (
            <ApplicationCard
              key={app.name}
              app={app}
              onScale={handleScale}
              onUpdateImage={handleUpdateImage}
              onDelete={handleDelete}
              onViewLogs={setLogsPod}
              onOpenTerminal={setTerminalPod}
              onDeletePod={handleDeletePod}
              onEditService={handleEditService}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
              onRollback={handleRollback}
              onViewYaml={(app, serviceName, workloadName) => setYamlApp({ app, serviceName, workloadName })}
              onViewEvents={setEventsApp}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4 content-start pb-8">
          {deployments.map((app) => (
            <ApplicationListItem
              key={app.name}
              app={app}
              onScale={handleScale}
              onUpdateImage={handleUpdateImage}
              onDelete={handleDelete}
              onViewLogs={setLogsPod}
              onOpenTerminal={setTerminalPod}
              onDeletePod={handleDeletePod}
              onEditService={handleEditService}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
              onRollback={handleRollback}
              onViewYaml={(app, serviceName, workloadName) => setYamlApp({ app, serviceName, workloadName })}
              onViewEvents={setEventsApp}
            />
          ))}
        </div>
      )}

      {/* Modals & Drawers */}
      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        onDeploy={handleDeploy}
      />
      {editServiceApp && (
        <DeployModal
          isOpen={!!editServiceApp}
          onClose={() => setEditServiceApp(null)}
          onDeploy={handleDeploy}
          initialApp={editServiceApp.app}
          initialServiceName={editServiceApp.serviceName}
        />
      )}
      <LogsDrawer
        pod={logsPod}
        onClose={() => setLogsPod(null)}
      />
      <TerminalDrawer
        pod={terminalPod}
        onClose={() => setTerminalPod(null)}
      />
      <YamlModal
        app={yamlApp?.app || null}
        serviceName={yamlApp?.serviceName}
        workloadName={yamlApp?.workloadName}
        onClose={() => setYamlApp(null)}
      />
      <EventsModal
        app={eventsApp}
        isOpen={!!eventsApp}
        onClose={() => setEventsApp(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={
          confirmAction?.type === 'deletePod'
            ? 'Delete Pod'
            : confirmAction
            ? `${confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)} Application`
            : ''
        }
        message={
          confirmAction?.type === 'deletePod'
            ? `Are you sure you want to delete pod '${confirmAction.pod?.name}'? Kubernetes will automatically recreate it if governed by a Deployment.`
            : confirmAction && confirmAction.app
            ? `Are you sure you want to ${confirmAction.type} application '${confirmAction.app.name}'?`
            : ''
        }
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmAction(null)}
        confirmText={
          confirmAction?.type === 'deletePod'
            ? 'Delete'
            : confirmAction
            ? confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)
            : 'Confirm'
        }
        isDestructive={
          confirmAction?.type === 'delete' ||
          confirmAction?.type === 'stop' ||
          confirmAction?.type === 'deletePod'
        }
      />
      <InputDialog
        isOpen={!!inputAction}
        title={inputAction?.type === 'scale' ? 'Scale Application' : 'Update Image'}
        message={inputAction?.type === 'scale' ? 'Enter new replicas:' : 'Enter new image:'}
        defaultValue={inputAction?.currentValue || ''}
        inputType={inputAction?.type === 'scale' ? 'number' : 'text'}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputAction(null)}
      />
    </div>
  );
}
