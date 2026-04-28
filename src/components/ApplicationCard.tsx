import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Application, ApplicationService, eventApi, K8sEvent, podApi, Pod } from '@/lib/api';
import { Activity, Box, Cpu, Trash2, Edit3, TerminalSquare, FileText, ArrowUpCircle, Play, Square, RotateCw, Undo2, ChevronDown, ChevronUp, FileCode, ListOrdered, Layers, Settings } from 'lucide-react';
import { useK8sWatch } from '@/hooks/useK8sWatch';

interface Props {
  app: Application;
  onScale: (app: Application, serviceName: string, workloadName: string, replicas: number) => void;
  onUpdateImage: (app: Application, serviceName: string, workloadName: string, image: string) => void;
  onDelete: (app: Application) => void;
  onViewLogs: (pod: Pod) => void;
  onOpenTerminal: (pod: Pod) => void;
  onDeletePod: (pod: Pod) => void;
  onStart: (app: Application) => void;
  onStop: (app: Application) => void;
  onRestart: (app: Application, serviceName: string, workloadName: string) => void;
  onRollback: (app: Application, serviceName: string, workloadName: string) => void;
  onViewYaml: (app: Application, serviceName?: string, workloadName?: string) => void;
  onViewEvents: (app: Application) => void;
  onEditService: (app: Application, serviceName: string) => void;
}

export default function ApplicationCard({
  app,
  onScale,
  onUpdateImage,
  onDelete,
  onViewLogs,
  onOpenTerminal,
  onDeletePod,
  onStart,
  onStop,
  onRestart,
  onRollback,
  onViewYaml,
  onViewEvents,
  onEditService,
}: Props) {
  const isRunning = app.status === 'RUNNING';
  const isFailed = app.status === 'FAILED';
  const isStopped = app.status === 'STOPPED';

  const [expanded, setExpanded] = useState(false);

  const totalReplicas = app.services.reduce((acc, svc) => acc + svc.replicas, 0);
  const computedStatus = app.status || 'UNKNOWN';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col group relative">
      <div className={`h-1 w-full ${isRunning ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : isStopped ? 'bg-slate-500' : 'bg-amber-400'}`} />

      <div className="p-6 flex-1 flex flex-col">
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
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1 ${
              isRunning
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : isFailed
                ? 'bg-red-50 text-red-600 border border-red-200'
                : isStopped
                ? 'bg-slate-50 text-slate-600 border border-slate-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}
          >
            <Activity size={12} className={isRunning ? 'animate-pulse' : ''} />
            <span>{computedStatus}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-auto mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">
              Namespace
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center">
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

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
          {isStopped ? (
            <button
              onClick={() => onStart(app)}
              className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              title="Start All"
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              onClick={() => onStop(app)}
              className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Stop All"
            >
              <Square size={18} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors ${expanded ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
            title={expanded ? "Hide Services" : "Show Services"}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => onDelete(app)}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors ml-auto"
            title="Delete Application"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {expanded && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-4">
            {app.services.map(svc => (
              <ServiceSubCard
                key={svc.name}
                app={app}
                svc={svc}
                onScale={onScale}
                onUpdateImage={onUpdateImage}
                onRestart={onRestart}
                onRollback={onRollback}
                onViewYaml={onViewYaml}
                onViewLogs={onViewLogs}
                onOpenTerminal={onOpenTerminal}
                onDeletePod={onDeletePod}
                onViewEvents={onViewEvents}
                onEditService={onEditService}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceSubCard({
  app,
  svc,
  onScale,
  onUpdateImage,
  onRestart,
  onRollback,
  onViewYaml,
  onViewLogs,
  onOpenTerminal,
  onDeletePod,
  onViewEvents,
  onEditService
}: {
  app: Application;
  svc: ApplicationService;
  onScale: Props['onScale'];
  onUpdateImage: Props['onUpdateImage'];
  onRestart: Props['onRestart'];
  onRollback: Props['onRollback'];
  onViewYaml: Props['onViewYaml'];
  onViewLogs: Props['onViewLogs'];
  onOpenTerminal: Props['onOpenTerminal'];
  onDeletePod: Props['onDeletePod'];
  onViewEvents: Props['onViewEvents'];
  onEditService: Props['onEditService'];
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Box size={16} className="text-blue-500" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{svc.name}</h4>
          <span className={`flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded-sm ${svc.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
            <Activity size={10} className={svc.status === 'RUNNING' ? 'animate-pulse' : ''} />
            <span>{svc.status || 'UNKNOWN'}</span>
          </span>
        </div>
        <div className="flex space-x-1">
          <button onClick={() => onEditService(app, svc.name)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Edit Service">
            <Settings size={14} />
          </button>
          <button onClick={() => onViewYaml(app, svc.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md" title="View Service YAML">
            <FileCode size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        {svc.containers.map(c => (
          <WorkloadSubCard
            key={c.name}
            app={app}
            svc={svc}
            workload={c}
            onScale={onScale}
            onUpdateImage={onUpdateImage}
            onRestart={onRestart}
            onRollback={onRollback}
            onViewYaml={onViewYaml}
            onViewLogs={onViewLogs}
            onOpenTerminal={onOpenTerminal}
            onDeletePod={onDeletePod}
            onViewEvents={onViewEvents}
          />
        ))}
      </div>
    </div>
  );
}

function WorkloadSubCard({
  app,
  svc,
  workload,
  onScale,
  onUpdateImage,
  onRestart,
  onRollback,
  onViewYaml,
  onViewLogs,
  onOpenTerminal,
  onDeletePod,
  onViewEvents
}: {
  app: Application;
  svc: ApplicationService;
  workload: any;
  onScale: Props['onScale'];
  onUpdateImage: Props['onUpdateImage'];
  onRestart: Props['onRestart'];
  onRollback: Props['onRollback'];
  onViewYaml: Props['onViewYaml'];
  onViewLogs: Props['onViewLogs'];
  onOpenTerminal: Props['onOpenTerminal'];
  onDeletePod: Props['onDeletePod'];
  onViewEvents: Props['onViewEvents'];
}) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loadingPods, setLoadingPods] = useState(false);
  const [podsError, setPodsError] = useState<string | null>(null);

  const getErrorMessage = useCallback((err: unknown) => {
    if (typeof err === 'object' && err !== null) {
      const e = err as { message?: unknown; response?: { data?: { message?: unknown } } };
      const responseMessage = e.response?.data?.message;
      if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return 'Request failed';
  }, []);

  const fetchPodsTimeout = useRef<number | null>(null);

  const fetchPods = useCallback(() => {
    if (fetchPodsTimeout.current) window.clearTimeout(fetchPodsTimeout.current);
    fetchPodsTimeout.current = window.setTimeout(async () => {
      try {
        setLoadingPods(true);
        setPodsError(null);
        const data = await podApi.list(app.namespace, { 'paas.csm.com/service': svc.name, 'paas.csm.com/workload': workload.name });
        setPods(data);
      } catch (err) {
        setPodsError(getErrorMessage(err));
      } finally {
        setLoadingPods(false);
      }
    }, 300);
  }, [app.namespace, svc.name, workload.name, getErrorMessage]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  useK8sWatch(app.namespace, (event) => {
    if (event.type === 'pod') {
      fetchPods();
    }
  });

  const getPhaseMeta = (pod: Pod) => {
    const phase = pod.phase || pod.status || 'Unknown';
    const normalized = phase.toLowerCase();
    if (normalized === 'running') return { phase, cls: 'bg-emerald-100 text-emerald-700' };
    if (normalized === 'succeeded') return { phase, cls: 'bg-emerald-100 text-emerald-700' };
    if (normalized === 'failed') return { phase, cls: 'bg-red-100 text-red-700' };
    if (normalized === 'pending') return { phase, cls: 'bg-amber-100 text-amber-700' };
    return { phase, cls: 'bg-slate-200 text-slate-700' };
  };

  const podDiagnosis = (pod: Pod) => {
    const reason = (pod.reason || '').trim();
    const message = (pod.message || '').trim();
    if (!reason && !message) return '';
    if (reason && message) return `${reason}: ${message}`;
    return reason || message;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col truncate">
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{workload.name}</span>
          <span className="text-slate-500 font-mono text-xs truncate max-w-[200px]">{workload.image}</span>
        </div>
        <div className="flex space-x-1">
          <button onClick={() => onUpdateImage(app, svc.name, workload.name, workload.image)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Update Image">
            <Edit3 size={14} />
          </button>
          <button onClick={() => onScale(app, svc.name, workload.name, workload.replicas ?? 1)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Scale">
            <ArrowUpCircle size={14} />
          </button>
          <button onClick={() => onRestart(app, svc.name, workload.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md" title="Restart">
            <RotateCw size={14} />
          </button>
          <button onClick={() => onRollback(app, svc.name, workload.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md" title="Rollback">
            <Undo2 size={14} />
          </button>
          <button onClick={() => onViewYaml(app, svc.name, workload.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md" title="View Workload YAML">
            <FileCode size={14} />
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Pods ({pods.length}/{workload.replicas ?? 1})</span>
          <button onClick={fetchPods} disabled={loadingPods} className="text-xs text-slate-500 hover:text-slate-700">
            <RotateCw size={12} className={loadingPods ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {podsError && <div className="text-[10px] text-red-500 mb-2">{podsError}</div>}
        
        <div className="space-y-1">
          {pods.map(pod => {
            const phaseMeta = getPhaseMeta(pod);
            const diag = podDiagnosis(pod);
            return (
              <div key={pod.name} className="flex flex-col bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 truncate w-32" title={pod.name}>{pod.name}</span>
                  <span className={`flex items-center space-x-1 text-[9px] px-1 py-0.5 rounded-sm ${phaseMeta.cls}`}>
                    <Activity size={8} className={phaseMeta.phase.toLowerCase() === 'running' ? 'animate-pulse' : ''} />
                    <span>{phaseMeta.phase}</span>
                  </span>
                </div>
                {diag && (
                  <div className="mt-0.5 text-[9px] text-slate-500 truncate" title={diag}>{diag}</div>
                )}
                <div className="flex justify-end space-x-1 mt-1">
                  <button onClick={() => onViewLogs(pod)} className="p-0.5 text-slate-400 hover:text-blue-500" title="Logs">
                    <FileText size={12} />
                  </button>
                  <button onClick={() => onOpenTerminal(pod)} className="p-0.5 text-slate-400 hover:text-blue-500" title="Terminal">
                    <TerminalSquare size={12} />
                  </button>
                  <button onClick={() => onViewEvents(app)} className="p-0.5 text-slate-400 hover:text-blue-500" title="Events">
                    <ListOrdered size={12} />
                  </button>
                  <button onClick={() => onDeletePod(pod)} className="p-0.5 text-slate-400 hover:text-red-500 ml-1" title="Delete Pod">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
