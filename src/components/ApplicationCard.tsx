import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ApplicationDeployment, eventApi, K8sEvent, podApi, Pod } from '@/lib/api';
import { Activity, Box, Cpu, Trash2, Edit3, TerminalSquare, FileText, ArrowUpCircle, Play, Square, RotateCw, Undo2, ChevronDown, ChevronUp, FileCode, ListOrdered } from 'lucide-react';
import { useK8sWatch } from '@/hooks/useK8sWatch';

interface Props {
  app: ApplicationDeployment;
  onScale: (app: ApplicationDeployment) => void;
  onUpdateImage: (app: ApplicationDeployment) => void;
  onDelete: (app: ApplicationDeployment) => void;
  onViewLogs: (pod: Pod) => void;
  onOpenTerminal: (pod: Pod) => void;
  onStart: (app: ApplicationDeployment) => void;
  onStop: (app: ApplicationDeployment) => void;
  onRestart: (app: ApplicationDeployment) => void;
  onRollback: (app: ApplicationDeployment) => void;
  onViewYaml: (app: ApplicationDeployment) => void;
}

export default function ApplicationCard({
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
}: Props) {
  const isRunning = app.status === 'RUNNING';
  const isFailed = app.status === 'FAILED';
  const isStopped = app.status === 'STOPPED';

  const [pods, setPods] = useState<Pod[]>([]);
  const [showPods, setShowPods] = useState(false);
  const [loadingPods, setLoadingPods] = useState(false);
  const [podsError, setPodsError] = useState<string | null>(null);

  const [showEvents, setShowEvents] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<K8sEvent[]>([]);

  const getErrorMessage = useCallback((err: unknown) => {
    if (typeof err === 'object' && err !== null) {
      const e = err as {
        message?: unknown;
        response?: { data?: { message?: unknown } };
      };
      const responseMessage = e.response?.data?.message;
      if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return '请求失败';
  }, []);

  const fetchPodsTimeout = useRef<number | null>(null);

  const fetchPods = useCallback(() => {
    if (fetchPodsTimeout.current) window.clearTimeout(fetchPodsTimeout.current);
    fetchPodsTimeout.current = window.setTimeout(async () => {
      try {
        setLoadingPods(true);
        setPodsError(null);
        const data = await podApi.list(app.namespace, { app: app.name });
        setPods(data);
      } catch (err) {
        setPodsError(getErrorMessage(err));
      } finally {
        setLoadingPods(false);
      }
    }, 300);
  }, [app.namespace, app.name, getErrorMessage]);

  const fetchEventsTimeout = useRef<number | null>(null);

  const fetchEvents = useCallback(() => {
    if (fetchEventsTimeout.current) window.clearTimeout(fetchEventsTimeout.current);
    fetchEventsTimeout.current = window.setTimeout(async () => {
      try {
        setLoadingEvents(true);
        setEventsError(null);
        const data = await eventApi.list(app.namespace, { limit: 50 });
        const sorted = [...data].sort((a, b) => (b.lastTimestamp || '').localeCompare(a.lastTimestamp || ''));
        setEvents(sorted);
      } catch (err) {
        setEventsError(getErrorMessage(err));
      } finally {
        setLoadingEvents(false);
      }
    }, 300);
  }, [app.namespace, getErrorMessage]);

  useEffect(() => {
    if (showPods) {
      fetchPods();
    }
  }, [showPods, fetchPods]);

  useEffect(() => {
    if (showPods && showEvents) {
      fetchEvents();
    }
  }, [showPods, showEvents, fetchEvents]);

  useK8sWatch(showPods ? app.namespace : '', (event) => {
    if (event.type === 'pod' && event.name.startsWith(app.name)) {
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

  const relatedEvents = (() => {
    const appName = app.name.toLowerCase();
    const podNameSet = new Set(pods.map(p => p.name));
    return events.filter(e => {
      const involved = (e.involvedObjectName || '').toLowerCase();
      if (involved.includes(appName)) return true;
      if (e.involvedObjectName && podNameSet.has(e.involvedObjectName)) return true;
      const msg = (e.message || '').toLowerCase();
      const reason = (e.reason || '').toLowerCase();
      return msg.includes(appName) || reason.includes(appName);
    });
  })();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col group relative">
      <div className={`h-1 w-full ${isRunning ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : isStopped ? 'bg-slate-500' : 'bg-amber-400'}`} />

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl text-blue-600 dark:text-blue-400">
              <Box size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{app.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 flex items-center">
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                  {app.image}
                </span>
              </p>
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
            <span>{app.status}</span>
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
              <span>Replicas</span>
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {app.replicas} Pods
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <button
            onClick={() => onScale(app)}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
          >
            <ArrowUpCircle size={16} />
            <span>Scale</span>
          </button>
          <button
            onClick={() => onUpdateImage(app)}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
            <Edit3 size={16} />
            <span>Image</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {isStopped ? (
            <button
              onClick={() => onStart(app)}
              className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              title="Start"
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              onClick={() => onStop(app)}
              className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Stop"
            >
              <Square size={18} />
            </button>
          )}
          <button
            onClick={() => onRestart(app)}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Restart"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={() => onRollback(app)}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Rollback"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={() => onViewYaml(app)}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="View YAML"
          >
            <FileCode size={18} />
          </button>
          <button
            onClick={() => {
              if (showPods) {
                setShowEvents(false);
              }
              setShowPods(!showPods);
            }}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title={showPods ? "Hide Pods" : "Show Pods"}
          >
            {showPods ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => onDelete(app)}
            className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors ml-auto"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {showPods && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700/50 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pods</h4>
              <button
                onClick={fetchPods}
                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700"
                disabled={loadingPods}
                title="Refresh Pods"
              >
                <RotateCw size={14} className={loadingPods ? 'animate-spin' : ''} />
                <span>刷新</span>
              </button>
            </div>

            {podsError && (
              <div className="mb-2 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                <span className="truncate" title={podsError}>加载 Pods 失败：{podsError}</span>
                <button onClick={fetchPods} className="ml-3 text-red-700 hover:text-red-900 font-medium" disabled={loadingPods}>
                  重试
                </button>
              </div>
            )}

            {loadingPods ? (
              <div className="text-sm text-slate-400">Loading pods...</div>
            ) : pods.length === 0 ? (
              <div className="text-sm text-slate-400">No pods found.</div>
            ) : (
              <div className="space-y-2">
                {pods.map(pod => {
                  const phaseMeta = getPhaseMeta(pod);
                  const diag = podDiagnosis(pod);
                  return (
                    <div key={pod.name} className="flex flex-col bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate w-32" title={pod.name}>{pod.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${phaseMeta.cls}`}>{phaseMeta.phase}</span>
                      </div>
                      {diag && (
                        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate" title={diag}>
                          {diag}
                        </div>
                      )}
                      <div className="flex justify-end space-x-1 mt-2">
                        <button onClick={() => onViewLogs(pod)} className="p-1 text-slate-500 hover:text-blue-500" title="Logs">
                          <FileText size={14} />
                        </button>
                        <button onClick={() => onOpenTerminal(pod)} className="p-1 text-slate-500 hover:text-blue-500" title="Terminal">
                          <TerminalSquare size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (!showEvents) setShowEvents(true);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-500"
                          title="Events"
                        >
                          <ListOrdered size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showEvents && (
              <div className="mt-3 border-t border-slate-200 dark:border-slate-700/60 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Events</h4>
                  <button
                    onClick={fetchEvents}
                    className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700"
                    disabled={loadingEvents}
                    title="Refresh Events"
                  >
                    <RotateCw size={14} className={loadingEvents ? 'animate-spin' : ''} />
                    <span>刷新</span>
                  </button>
                </div>

                {eventsError && (
                  <div className="mb-2 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                    <span className="truncate" title={eventsError}>加载 Events 失败：{eventsError}</span>
                    <button onClick={fetchEvents} className="ml-3 text-red-700 hover:text-red-900 font-medium" disabled={loadingEvents}>
                      重试
                    </button>
                  </div>
                )}

                {loadingEvents ? (
                  <div className="text-sm text-slate-400">Loading events...</div>
                ) : relatedEvents.length === 0 ? (
                  <div className="text-sm text-slate-400">No events found.</div>
                ) : (
                  <div className="space-y-2">
                    {relatedEvents.map(e => {
                      const key = `${e.namespace || app.namespace}:${e.name || ''}:${e.lastTimestamp || ''}:${e.reason || ''}`;
                      const type = (e.type || '').toLowerCase();
                      const typeCls = type === 'warning' ? 'bg-amber-100 text-amber-800' : type === 'normal' ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-700';
                      const reason = e.reason || '-';
                      const message = e.message || '';
                      const time = e.lastTimestamp || '';
                      const involved = `${e.involvedObjectKind || 'Object'}/${e.involvedObjectName || '-'}`;
                      return (
                        <div key={key} className="bg-white/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${typeCls}`}>{e.type || 'Unknown'}</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={reason}>{reason}</span>
                              </div>
                              {message && (
                                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 truncate" title={message}>
                                  {message}
                                </div>
                              )}
                            </div>
                            {time && (
                              <div className="text-[10px] text-slate-400 whitespace-nowrap" title={time}>
                                {time}
                              </div>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400 truncate" title={involved}>
                            {involved}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
