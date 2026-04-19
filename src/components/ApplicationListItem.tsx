import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Application, ApplicationService, eventApi, K8sEvent, podApi, Pod } from '@/lib/api';
import { Activity, Box, Cpu, Trash2, Edit3, TerminalSquare, FileText, ArrowUpCircle, Play, Square, RotateCw, Undo2, ChevronDown, ChevronUp, FileCode, ListOrdered, Layers } from 'lucide-react';
import { useK8sWatch } from '@/hooks/useK8sWatch';

interface Props {
  app: Application;
  onScale: (app: Application, serviceName: string, replicas: number) => void;
  onUpdateImage: (app: Application, serviceName: string, containerName: string, image: string) => void;
  onDelete: (app: Application) => void;
  onViewLogs: (pod: Pod) => void;
  onOpenTerminal: (pod: Pod) => void;
  onStart: (app: Application) => void;
  onStop: (app: Application) => void;
  onRestart: (app: Application, serviceName: string) => void;
  onRollback: (app: Application, serviceName: string) => void;
  onViewYaml: (app: Application) => void;
  onViewEvents: (app: Application) => void;
}

export default function ApplicationListItem({
  app,
  onScale,
  onUpdateImage,
  onDelete,
  onViewLogs,
  onOpenTerminal,
  onStart,
  onStop,
  onRestart,
  onRollback,
  onViewYaml,
  onViewEvents,
}: Props) {
  const computedStatus = app.status || (
    app.services.every(s => s.status === 'RUNNING') ? 'RUNNING' :
    app.services.every(s => s.status === 'STOPPED') ? 'STOPPED' :
    app.services.some(s => s.status === 'FAILED') ? 'FAILED' : 'PENDING'
  );

  const isRunning = computedStatus === 'RUNNING';
  const isFailed = computedStatus === 'FAILED';
  const isStopped = computedStatus === 'STOPPED';

  const [expanded, setExpanded] = useState(false);
  const totalReplicas = app.services.reduce((acc, svc) => acc + svc.replicas, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col group relative mb-3">
      <div className="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
        <div className={`w-1.5 h-12 rounded-full shrink-0 ${isRunning ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : isStopped ? 'bg-slate-500' : 'bg-amber-400'}`} />

        <div className="flex items-center space-x-3 min-w-[200px] flex-1">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate" title={app.name}>{app.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[250px]" title={app.description}>
              {app.description || 'No description'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start w-32 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center space-x-1 ${
              isRunning
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : isFailed
                ? 'bg-red-50 text-red-600 border border-red-200'
                : isStopped
                ? 'bg-slate-50 text-slate-600 border border-slate-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}
          >
            <Activity size={10} className={isRunning ? 'animate-pulse' : ''} />
            <span>{computedStatus}</span>
          </span>
        </div>

        <div className="flex flex-col items-start w-32 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Cpu size={10} />
            <span>Services</span>
          </span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {app.services.length} ({totalReplicas} Pods)
          </span>
        </div>

        <div className="flex flex-col items-start w-32 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Namespace</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate w-full" title={app.namespace}>
            {app.namespace}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 ml-auto shrink-0">
          {isStopped ? (
            <button onClick={() => onStart(app)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Start All">
              <Play size={16} />
            </button>
          ) : (
            <button onClick={() => onStop(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Stop All">
              <Square size={16} />
            </button>
          )}
          <button onClick={() => onViewYaml(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="View YAML">
            <FileCode size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-colors ${expanded ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'}`}
            title={expanded ? "Hide Services" : "Show Services"}
          >
            <ChevronDown size={16} className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => onDelete(app)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-1" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="space-y-4">
            {app.services.map(svc => (
              <ServiceSubCard
                key={svc.name}
                app={app}
                svc={svc}
                onScale={onScale}
                onUpdateImage={onUpdateImage}
                onRestart={onRestart}
                onRollback={onRollback}
                onViewLogs={onViewLogs}
                onOpenTerminal={onOpenTerminal}
                onViewEvents={onViewEvents}
              />
            ))}
          </div>
        </div>
      )}
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
  onViewLogs,
  onOpenTerminal,
  onViewEvents
}: {
  app: Application;
  svc: ApplicationService;
  onScale: Props['onScale'];
  onUpdateImage: Props['onUpdateImage'];
  onRestart: Props['onRestart'];
  onRollback: Props['onRollback'];
  onViewLogs: Props['onViewLogs'];
  onOpenTerminal: Props['onOpenTerminal'];
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
        const data = await podApi.list(app.namespace, { 'paas.csm.com/service': svc.name });
        setPods(data);
      } catch (err) {
        setPodsError(getErrorMessage(err));
      } finally {
        setLoadingPods(false);
      }
    }, 300);
  }, [app.namespace, svc.name, getErrorMessage]);

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
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row gap-4">
      {/* Service Info */}
      <div className="w-full xl:w-1/3 flex flex-col border-r-0 xl:border-r border-slate-100 dark:border-slate-700 pr-0 xl:pr-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Box size={16} className="text-blue-500" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{svc.name}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${svc.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
              {svc.status || 'UNKNOWN'}
            </span>
          </div>
          <div className="flex space-x-1">
            <button onClick={() => onScale(app, svc.name, svc.replicas)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Scale">
              <ArrowUpCircle size={14} />
            </button>
            <button onClick={() => onRestart(app, svc.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md" title="Restart">
              <RotateCw size={14} />
            </button>
            <button onClick={() => onRollback(app, svc.name)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md" title="Rollback">
              <Undo2 size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {svc.containers.map(c => (
            <div key={c.name} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
              <div className="flex flex-col truncate">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{c.name}</span>
                <span className="text-slate-500 font-mono truncate max-w-[150px]" title={c.image}>{c.image}</span>
              </div>
              <button onClick={() => onUpdateImage(app, svc.name, c.name, c.image)} className="p-1 text-slate-500 hover:text-blue-600" title="Update Image">
                <Edit3 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pods List */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Pods ({pods.length}/{svc.replicas})</span>
          <button onClick={fetchPods} disabled={loadingPods} className="text-xs text-slate-500 hover:text-slate-700">
            <RotateCw size={12} className={loadingPods ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {podsError && <div className="text-[10px] text-red-500 mb-2">{podsError}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {pods.map(pod => {
            const phaseMeta = getPhaseMeta(pod);
            const diag = podDiagnosis(pod);
            return (
              <div key={pod.name} className="flex flex-col bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate w-32 md:w-48" title={pod.name}>{pod.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${phaseMeta.cls}`}>{phaseMeta.phase}</span>
                </div>
                {diag && (
                  <div className="mt-1 text-[10px] text-slate-500 truncate" title={diag}>{diag}</div>
                )}
                <div className="flex justify-end space-x-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <button onClick={() => onViewLogs(pod)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-md" title="Logs">
                    <FileText size={14} />
                  </button>
                  <button onClick={() => onOpenTerminal(pod)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-md" title="Terminal">
                    <TerminalSquare size={14} />
                  </button>
                  <button onClick={() => onViewEvents(app)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-md" title="Events">
                    <ListOrdered size={14} />
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
