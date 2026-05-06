import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { Application } from '@/lib/api';
import { TrendingUp, AlertTriangle, Timer, Cpu, HardDrive, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ServiceMetrics {
  appName: string;
  serviceName: string;
  status: string;
  protocol?: string;
  qps: string;
  errorRate: string;
  latencyP99: string;
  cpuUsage: string;
  memoryUsage: string;
}

export default function MonitoringPage() {
  const navigate = useNavigate();
  const { deployments, fetchDeployments, namespace } = useAppStore();
  const [metricsList, setMetricsList] = useState<ServiceMetrics[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'error'>('all');

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const list: ServiceMetrics[] = [];
    deployments.forEach((app: Application) => {
      app.services.forEach((svc) => {
        list.push({
          appName: app.name,
          serviceName: svc.name,
          status: svc.status || 'UNKNOWN',
          protocol: svc.protocol,
          qps: '--',
          errorRate: '--',
          latencyP99: '--',
          cpuUsage: '--',
          memoryUsage: '--',
        });
      });
    });
    setMetricsList(list);
  }, [deployments]);

  const filtered = metricsList.filter((m) => {
    const matchText = !filter || m.serviceName.toLowerCase().includes(filter.toLowerCase()) || m.appName.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'healthy' && m.status === 'RUNNING') ||
      (statusFilter === 'error' && m.status === 'FAILED');
    return matchText && matchStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'FAILED': return <XCircle size={16} className="text-red-500" />;
      case 'PENDING': return <Clock size={16} className="text-amber-500" />;
      default: return <Clock size={16} className="text-slate-400" />;
    }
  };

  const totalServices = metricsList.length;
  const healthyServices = metricsList.filter(m => m.status === 'RUNNING').length;
  const errorServices = metricsList.filter(m => m.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Monitoring</h1>
        <p className="text-sm text-slate-500 mt-1">Service health and performance overview</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">Healthy</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{healthyServices}</div>
          <div className="text-xs text-slate-400 mt-1">of {totalServices} services</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-slate-500">Errors</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{errorServices}</div>
          <div className="text-xs text-slate-400 mt-1">services with issues</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{totalServices - healthyServices - errorServices}</div>
          <div className="text-xs text-slate-400 mt-1">services pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Search services..."
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {(['all', 'healthy', 'error'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Service Metrics Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-medium">Service</th>
              <th className="text-left px-4 py-3 font-medium">Application</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">QPS</th>
              <th className="text-left px-4 py-3 font-medium">Error Rate</th>
              <th className="text-left px-4 py-3 font-medium">P99 Latency</th>
              <th className="text-left px-4 py-3 font-medium">CPU</th>
              <th className="text-left px-4 py-3 font-medium">Memory</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={`${m.appName}-${m.serviceName}`}
                className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                onClick={() => navigate(`/apps/${m.appName}/services/${m.serviceName}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(m.status)}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.serviceName}</span>
                    {m.protocol && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{m.protocol}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{m.appName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'RUNNING' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    m.status === 'FAILED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {m.status === 'RUNNING' ? 'Healthy' : m.status === 'FAILED' ? 'Error' : m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.qps}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.errorRate}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.latencyP99}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.cpuUsage}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.memoryUsage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {metricsList.length === 0 ? 'No services found. Deploy an application first.' : 'No services match your filter.'}
          </div>
        )}
      </div>
    </div>
  );
}
