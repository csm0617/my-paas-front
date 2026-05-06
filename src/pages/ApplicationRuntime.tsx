import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { Application } from '@/lib/api';
import { ArrowLeft, Plus, CheckCircle2, AlertCircle, XCircle, Clock, Layers, TrendingUp, AlertTriangle, Timer } from 'lucide-react';

export default function ApplicationRuntime() {
  const { appName } = useParams<{ appName: string }>();
  const navigate = useNavigate();
  const { deployments, fetchDeployments, namespace } = useAppStore();
  const [app, setApp] = useState<Application | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const found = deployments.find(d => d.name === appName);
    setApp(found || null);
  }, [deployments, appName]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'RUNNING': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'FAILED': return <XCircle size={16} className="text-red-500" />;
      case 'PENDING': return <Clock size={16} className="text-amber-500" />;
      default: return <AlertCircle size={16} className="text-slate-400" />;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'RUNNING': return 'Healthy';
      case 'FAILED': return 'Error';
      case 'PENDING': return 'Pending';
      case 'STOPPED': return 'Stopped';
      default: return 'Unknown';
    }
  };

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-slate-500">Application not found</p>
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">Back to Applications</button>
      </div>
    );
  }

  const activeRevisions = app.services.reduce((sum, svc) => {
    return sum + (svc.revisions?.filter(r => r.status !== 'Offline').length || 1);
  }, 0);

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{app.name}</h1>
            {app.description && <p className="text-sm text-slate-500 mt-1">{app.description}</p>}
          </div>
        </div>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-1.5">
            <Layers size={14} className="text-slate-400" />
            <span className="text-slate-500">Services</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{app.services.length}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-slate-500">QPS</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">--</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-slate-500">Error</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">--</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Timer size={14} className="text-purple-400" />
            <span className="text-slate-500">Latency</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">--</span>
          </div>
        </div>
      </div>

      {/* 服务网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {app.services.map((svc) => {
          const activeRevision = svc.revisions?.find(r => r.status === 'Running' || r.status === 'Canary');
          const canaryRevision = svc.revisions?.find(r => r.status === 'Canary');
          const isHealthy = svc.status === 'RUNNING';

          return (
            <div
              key={svc.name}
              onClick={() => navigate(`/apps/${app.name}/services/${svc.name}`)}
              className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{svc.name}</h3>
                <div className="flex items-center space-x-1.5">
                  {getStatusIcon(svc.status)}
                  <span className={`text-xs font-medium ${isHealthy ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {getStatusLabel(svc.status)}
                  </span>
                </div>
              </div>

              {svc.description && (
                <p className="text-xs text-slate-500 mb-3">{svc.description}</p>
              )}

              <div className="space-y-2">
                {svc.protocol && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{svc.protocol}</span>
                    {svc.serviceType && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{svc.serviceType === 'entry' ? 'Entry' : 'Internal'}</span>
                    )}
                  </div>
                )}

                {activeRevision ? (
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>{activeRevision.name}</span>
                      <span className="font-mono">{activeRevision.image}</span>
                    </div>
                    {canaryRevision && (
                      <div className="flex items-center justify-between text-amber-600">
                        <span>{canaryRevision.name}</span>
                        <span>{canaryRevision.trafficWeight}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No active revision</div>
                )}
              </div>
            </div>
          );
        })}

        {/* 添加服务卡片 */}
        <div
          className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all min-h-[140px]"
          onClick={() => navigate(`/?deploy=true&app=${app.name}`)}
        >
          <Plus size={24} className="text-slate-400 mb-2" />
          <span className="text-sm text-slate-500">Add Service</span>
        </div>
      </div>
    </div>
  );
}
