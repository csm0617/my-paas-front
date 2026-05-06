import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { Application } from '@/lib/api';
import { Rocket, RotateCcw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface ReleaseInfo {
  appName: string;
  serviceName: string;
  revisionName: string;
  image: string;
  status: string;
  mode: string;
  trafficWeight: number;
}

export default function ReleasesPage() {
  const navigate = useNavigate();
  const { deployments, fetchDeployments } = useAppStore();
  const [releases, setReleases] = useState<ReleaseInfo[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const list: ReleaseInfo[] = [];
    deployments.forEach((app: Application) => {
      app.services.forEach((svc) => {
        if (svc.revisions) {
          svc.revisions.forEach((rev) => {
            if (rev.status === 'Canary' || rev.status === 'Pending') {
              list.push({
                appName: app.name,
                serviceName: svc.name,
                revisionName: rev.name,
                image: rev.image,
                status: rev.status,
                mode: rev.status === 'Canary' ? 'canary' : 'rolling',
                trafficWeight: rev.trafficWeight,
              });
            }
          });
        }
      });
    });
    setReleases(list);
  }, [deployments]);

  const filtered = releases.filter((r) => {
    if (!filter) return true;
    return r.serviceName.toLowerCase().includes(filter.toLowerCase()) ||
      r.appName.toLowerCase().includes(filter.toLowerCase()) ||
      r.revisionName.toLowerCase().includes(filter.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Canary':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Canary</span>;
      case 'Pending':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Pending</span>;
      case 'Running':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Running</span>;
      case 'Failed':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Failed</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Releases</h1>
          <p className="text-sm text-slate-500 mt-1">Active releases and deployment history</p>
        </div>
      </div>

      {/* Active Releases Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Rocket size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Canary Releases</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{releases.filter(r => r.status === 'Canary').length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Loader2 size={16} className="text-blue-500" />
            <span className="text-xs font-medium text-slate-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{releases.filter(r => r.status === 'Pending').length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-slate-500">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{releases.filter(r => r.status === 'Failed').length}</div>
        </div>
      </div>

      {/* Filter */}
      <input
        type="text"
        placeholder="Search releases..."
        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Releases Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-medium">Service</th>
              <th className="text-left px-4 py-3 font-medium">Application</th>
              <th className="text-left px-4 py-3 font-medium">Revision</th>
              <th className="text-left px-4 py-3 font-medium">Image</th>
              <th className="text-left px-4 py-3 font-medium">Mode</th>
              <th className="text-left px-4 py-3 font-medium">Traffic</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.appName}-${r.serviceName}-${r.revisionName}-${i}`} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => navigate(`/apps/${r.appName}/services/${r.serviceName}`)}>{r.serviceName}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.appName}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-800 dark:text-slate-200">{r.revisionName}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{r.image}</td>
                <td className="px-4 py-3 text-sm capitalize text-slate-700 dark:text-slate-300">{r.mode}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{r.trafficWeight}%</td>
                <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'Canary' && (
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Promote</button>
                      <button className="text-xs text-red-600 hover:text-red-700 font-medium">Rollback</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {releases.length === 0 ? 'No active releases. All services are stable.' : 'No releases match your filter.'}
          </div>
        )}
      </div>
    </div>
  );
}
