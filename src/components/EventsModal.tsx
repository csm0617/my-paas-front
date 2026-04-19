import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, RotateCw, AlertCircle } from 'lucide-react';
import { ApplicationDeployment, K8sEvent, eventApi } from '@/lib/api';

interface Props {
  app: ApplicationDeployment | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EventsModal({ app, isOpen, onClose }: Props) {
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = useCallback((err: unknown) => {
    if (err && typeof err === 'object') {
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

  const fetchEventsTimeout = useRef<number | null>(null);

  const fetchEvents = useCallback(() => {
    if (!app) return;
    if (fetchEventsTimeout.current) window.clearTimeout(fetchEventsTimeout.current);
    fetchEventsTimeout.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await eventApi.list(app.namespace, { limit: 100 });
        const sorted = [...data].sort((a, b) => (b.lastTimestamp || '').localeCompare(a.lastTimestamp || ''));
        
        // Filter events related to this app
        const appName = app.name.toLowerCase();
        const filtered = sorted.filter(e => {
          const involved = (e.involvedObjectName || '').toLowerCase();
          if (involved.includes(appName)) return true;
          const msg = (e.message || '').toLowerCase();
          const reason = (e.reason || '').toLowerCase();
          return msg.includes(appName) || reason.includes(appName);
        });
        
        setEvents(filtered);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [app, getErrorMessage]);

  useEffect(() => {
    if (isOpen && app) {
      fetchEvents();
    } else {
      setEvents([]);
      setError(null);
    }
  }, [isOpen, app, fetchEvents]);

  if (!isOpen || !app) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <span>Events: {app.name}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Namespace: {app.namespace}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RotateCw size={18} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
          {error && (
            <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} />
                <span className="font-medium">Failed to load events: {error}</span>
              </div>
              <button onClick={fetchEvents} className="text-red-700 hover:text-red-900 font-bold" disabled={loading}>
                Retry
              </button>
            </div>
          )}

          {loading && events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RotateCw size={32} className="animate-spin mb-4 text-blue-500" />
              <p>Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p>No events found for this application.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(e => {
                const key = `${e.namespace || app.namespace}:${e.name || ''}:${e.lastTimestamp || ''}:${e.reason || ''}`;
                const type = (e.type || '').toLowerCase();
                const typeCls = type === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' : type === 'normal' ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
                const reason = e.reason || '-';
                const message = e.message || '';
                const time = e.lastTimestamp || '';
                const involved = `${e.involvedObjectKind || 'Object'} / ${e.involvedObjectName || '-'}`;
                
                return (
                  <div key={key} className={`border rounded-xl p-4 shadow-sm ${type === 'warning' ? 'bg-amber-50/30 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${typeCls}`}>
                            {e.type || 'Unknown'}
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {reason}
                          </span>
                        </div>
                        {message && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 break-words">
                            {message}
                          </div>
                        )}
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700/50 inline-block">
                          Target: {involved}
                        </div>
                      </div>
                      {time && (
                        <div className="text-xs font-mono text-slate-400 whitespace-nowrap shrink-0 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">
                          {time}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}