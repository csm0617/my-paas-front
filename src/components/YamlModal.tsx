import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Copy, Check } from 'lucide-react';
import { ApplicationDeployment, api } from '@/lib/api';

interface Props {
  app: ApplicationDeployment | null;
  onClose: () => void;
}

export default function YamlModal({ app, onClose }: Props) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!app) return;
    
    const fetchYaml = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getYaml(app.namespace, app.name);
        setYaml(data);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load YAML');
      } finally {
        setLoading(false);
      }
    };

    fetchYaml();
  }, [app]);

  if (!app) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <span>{app.name} Resources YAML</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">Namespace: {app.namespace}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              disabled={!yaml}
              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Copy YAML"
            >
              {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#1e1e1e] p-6 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80">
              <div className="flex flex-col items-center space-y-3 text-slate-400">
                <RefreshCw size={32} className="animate-spin text-blue-500" />
                <p>Loading YAML...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-red-500/10 text-red-400 p-6 rounded-xl border border-red-500/20 max-w-lg text-center">
                <p className="font-semibold mb-2">Error Loading YAML</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </div>
          ) : (
            <pre className="text-sm font-mono text-slate-300 whitespace-pre overflow-x-auto">
              <code>{yaml}</code>
            </pre>
          )}
        </div>

      </div>
    </div>
  );
}
