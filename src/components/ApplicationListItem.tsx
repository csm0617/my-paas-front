import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ApplicationDeployment, eventApi, K8sEvent, podApi, Pod } from '@/lib/api';
import { Activity, Box, Cpu, Trash2, Edit3, TerminalSquare, FileText, ArrowUpCircle, Play, Square, RotateCw, Undo2, ChevronDown, ChevronUp, FileCode } from 'lucide-react';
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col group relative mb-3">
      <div className="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
        <div className={`w-1.5 h-12 rounded-full shrink-0 ${isRunning ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : isStopped ? 'bg-slate-500' : 'bg-amber-400'}`} />

        <div className="flex items-center space-x-3 min-w-[200px] flex-1">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <Box size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate" title={app.name}>{app.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate max-w-[250px]" title={app.image}>
              {app.image}
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
            <span>{app.status}</span>
          </span>
        </div>

        <div className="flex flex-col items-start w-24 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Cpu size={10} />
            <span>Replicas</span>
          </span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {app.replicas} Pods
          </span>
        </div>

        <div className="flex flex-col items-start w-32 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Namespace</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate w-full" title={app.namespace}>
            {app.namespace}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 ml-auto shrink-0">
          <button onClick={() => onScale(app)} className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Scale">
            <ArrowUpCircle size={16} />
          </button>
          <button onClick={() => onUpdateImage(app)} className="p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors" title="Update Image">
            <Edit3 size={16} />
          </button>
          {isStopped ? (
            <button onClick={() => onStart(app)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Start">
              <Play size={16} />
            </button>
          ) : (
            <button onClick={() => onStop(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Stop">
              <Square size={16} />
            </button>
          )}
          <button onClick={() => onRestart(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Restart">
            <RotateCw size={16} />
          </button>
          <button onClick={() => onRollback(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Rollback">
            <Undo2 size={16} />
          </button>
          <button onClick={() => onViewYaml(app)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="View YAML">
            <FileCode size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button
            onClick={() => {
              if (showPods) setShowEvents(false);
              setShowPods(!showPods);
            }}
            className={`p-1.5 rounded-lg transition-colors ${showPods ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'}`}
            title={showPods ? "Hide Pods" : "Show Pods"}
          >
            <ChevronDown size={16} className={`transform transition-transform ${showPods ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => onDelete(app)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-1" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {showPods && (
        <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 bg-slate-50/50 dark:bg-slate-900/20">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pods.map(pod => {
                const phaseMeta = getPhaseMeta(pod);
                const diag = podDiagnosis(pod);
                return (
                  <div key={pod.name} className="flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate w-32 md:w-48" title={pod.name}>{pod.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${phaseMeta.cls}`}>{phaseMeta.phase}</span>
                    </div>
                    {diag && (
                      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate" title={diag}>
                        {diag}
                      </div>
                    )}
                    <div className="flex justify-end space-x-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                      <button onClick={() => onViewLogs(pod)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors" title="Logs">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => onOpenTerminal(pod)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors" title="Terminal">
                        <TerminalSquare size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 border-t border-slate-200 dark:border-slate-700/60 pt-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowEvents(v => !v)}
                className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-800"
                title={showEvents ? 'Hide Events' : 'Show Events'}
              >
                {showEvents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>Events</span>
              </button>
              <button
                onClick={() => {
                  if (!showEvents) setShowEvents(true);
                  fetchEvents();
                }}
                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700"
                disabled={loadingEvents}
                title="Refresh Events"
              >
                <RotateCw size={14} className={loadingEvents ? 'animate-spin' : ''} />
                <span>刷新</span>
              </button>
            </div>

            {showEvents && (
              <div className="mt-3">
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
        </div>
      )}
    </div>
  );
}
