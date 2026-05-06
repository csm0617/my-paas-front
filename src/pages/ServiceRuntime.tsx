import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { Application, ApplicationService, Revision } from '@/lib/api';
import { ArrowLeft, Rocket, RotateCcw, CheckCircle2, AlertCircle, XCircle, Clock, TrendingUp, AlertTriangle, Timer } from 'lucide-react';

export default function ServiceRuntime() {
  const { appName, serviceName } = useParams<{ appName: string; serviceName: string }>();
  const navigate = useNavigate();
  const { deployments, fetchDeployments, namespace } = useAppStore();
  const [app, setApp] = useState<Application | null>(null);
  const [svc, setSvc] = useState<ApplicationService | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const found = deployments.find(d => d.name === appName);
    setApp(found || null);
    if (found) {
      const foundSvc = found.services.find(s => s.name === serviceName);
      setSvc(foundSvc || null);
    }
  }, [deployments, appName, serviceName]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'RUNNING': return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'FAILED': return <XCircle size={20} className="text-red-500" />;
      case 'PENDING': return <Clock size={20} className="text-amber-500" />;
      default: return <AlertCircle size={20} className="text-slate-400" />;
    }
  };

  const getRevisionStatusBadge = (status: string) => {
    switch (status) {
      case 'Stable':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Stable</span>;
      case 'Canary':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Canary</span>;
      case 'Pending':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Pending</span>;
      case 'Failed':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Failed</span>;
      case 'Offline':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">Offline</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{status}</span>;
    }
  };

  if (!app || !svc) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-slate-500">Service not found</p>
        <button onClick={() => navigate(`/apps/${appName || ''}`)} className="text-blue-600 hover:underline text-sm">Back to Application</button>
      </div>
    );
  }

  const revisions = svc.revisions || [];
  const activeRevisions = revisions.filter(r => r.status !== 'Offline');
  const stableRevision = revisions.find(r => r.status === 'Stable');
  const canaryRevisions = revisions.filter(r => r.status === 'Canary');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(`/apps/${app.name}`)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div className="flex items-center space-x-3">
            {getStatusIcon(svc.status)}
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{svc.name}</h1>
              {svc.description && <p className="text-sm text-slate-500 mt-0.5">{svc.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {svc.protocol && (
            <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">{svc.protocol}</span>
          )}
          {svc.serviceType && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium">
              {svc.serviceType === 'entry' ? 'Entry Service' : 'Internal Service'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-xs font-medium text-slate-500">QPS</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">--</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Error Rate</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">--</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Timer size={16} className="text-purple-500" />
            <span className="text-xs font-medium text-slate-500">Latency P99</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">--</div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(`/apps/${app.name}/services/${svc.name}/release`)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Rocket size={16} />
          <span>Release New Version</span>
        </button>
        <button
          className="flex items-center space-x-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
          disabled={!stableRevision}
        >
          <RotateCcw size={16} />
          <span>Rollback</span>
        </button>
      </div>

      {activeRevisions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Traffic Overview</h3>
          <div className="space-y-3">
            {activeRevisions.map((rev) => (
              <div key={rev.name} className="flex items-center space-x-3">
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 w-12">{rev.name}</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      rev.status === 'Canary'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${rev.trafficWeight}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-12 text-right">{rev.trafficWeight}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Revisions</h3>
        </div>
        {revisions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-4 py-2 font-medium">Revision</th>
                <th className="text-left px-4 py-2 font-medium">Image</th>
                <th className="text-left px-4 py-2 font-medium">Replicas</th>
                <th className="text-left px-4 py-2 font-medium">Traffic</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((rev) => (
                <tr key={rev.name} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-800 dark:text-slate-200">{rev.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{rev.image}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{rev.replicas}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{rev.trafficWeight}%</td>
                  <td className="px-4 py-3">{getRevisionStatusBadge(rev.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {rev.status === 'Canary' && (
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Promote</button>
                        <button className="text-xs text-red-600 hover:text-red-700 font-medium">Offline</button>
                      </div>
                    )}
                    {rev.status === 'Stable' && canaryRevisions.length > 0 && (
                      <span className="text-xs text-slate-400">Receiving traffic</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No revisions found. This service may have been created before the Revision model was introduced.
          </div>
        )}
      </div>
    </div>
  );
}
