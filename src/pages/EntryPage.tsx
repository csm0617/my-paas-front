import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { Application } from '@/lib/api';
import { Globe, Plus, Edit2, Trash2 } from 'lucide-react';

interface EntryRoute {
  domain: string;
  path: string;
  serviceName: string;
  https: boolean;
}

export default function EntryPage() {
  const navigate = useNavigate();
  const { deployments, fetchDeployments } = useAppStore();
  const [entries, setEntries] = useState<EntryRoute[]>([]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const routes: EntryRoute[] = [];
    deployments.forEach((app: Application) => {
      app.services.forEach((svc) => {
        if (svc.enableIngress && svc.ingressDomain) {
          routes.push({
            domain: svc.ingressDomain,
            path: '/',
            serviceName: svc.name,
            https: false,
          });
        }
      });
    });
    setEntries(routes);
  }, [deployments]);

  const domains = [...new Set(entries.map(e => e.domain))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">入口</h1>
          <p className="text-sm text-slate-500 mt-1">Manage application entry points and routes</p>
        </div>
      </div>

      {domains.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <Globe size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Entry Services</h3>
          <p className="text-sm text-slate-500 mb-4">Create an entry service to expose your applications to external traffic.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Create Service
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => {
            const domainRoutes = entries.filter(e => e.domain === domain);
            return (
              <div key={domain} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Globe size={18} className="text-blue-500" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{domain}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left px-4 py-2 font-medium">Path</th>
                      <th className="text-left px-4 py-2 font-medium">Service</th>
                      <th className="text-left px-4 py-2 font-medium">HTTPS</th>
                      <th className="text-right px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainRoutes.map((route, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">{route.path}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                            onClick={() => {
                              const app = deployments.find((a: Application) => a.services.some(s => s.name === route.serviceName));
                              if (app) navigate(`/apps/${app.name}/services/${route.serviceName}`);
                            }}
                          >
                            {route.serviceName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{route.https ? '✔' : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
                    <Plus size={12} />
                    <span>Add Route</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
