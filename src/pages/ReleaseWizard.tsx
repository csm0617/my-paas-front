import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { ApplicationService, Revision, api } from '@/lib/api';
import { ArrowLeft, Rocket, ChevronRight, Check } from 'lucide-react';

interface WizardState {
  revisionName: string;
  image: string;
  imagePullPolicy: string;
  replicas: number;
  requestsCpu: string;
  requestsMemory: string;
  limitsCpu: string;
  limitsMemory: string;
  resourcePreset: string;
  maxUnavailable: number;
  maxSurge: number;
}

export default function ReleaseWizard() {
  const { appName, serviceName } = useParams<{ appName: string; serviceName: string }>();
  const navigate = useNavigate();
  const { deployments, fetchDeployments, namespace } = useAppStore();
  const [step, setStep] = useState(0);
  const [svc, setSvc] = useState<ApplicationService | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stableRevision = useMemo(() => {
    return svc?.revisions?.find(r => r.status === 'Running');
  }, [svc]);

  const nextVersionName = useMemo(() => {
    if (!svc?.revisions?.length) return 'v1';
    const nums = svc.revisions
      .map(r => parseInt(r.name.replace('v', ''), 10))
      .filter(n => !isNaN(n));
    return `v${Math.max(0, ...nums) + 1}`;
  }, [svc]);

  const [form, setForm] = useState<WizardState>({
    revisionName: '',
    image: '',
    imagePullPolicy: 'IfNotPresent',
    replicas: 1,
    requestsCpu: '',
    requestsMemory: '',
    limitsCpu: '',
    limitsMemory: '',
    resourcePreset: '',
    maxUnavailable: 1,
    maxSurge: 1,
  });

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const app = deployments.find(d => d.name === appName);
    if (app) {
      const found = app.services.find(s => s.name === serviceName);
      setSvc(found || null);
    }
  }, [deployments, appName, serviceName]);

  useEffect(() => {
    if (stableRevision && !form.revisionName) {
      setForm(prev => ({
        ...prev,
        revisionName: nextVersionName,
        image: stableRevision.image,
        replicas: stableRevision.replicas,
        requestsCpu: stableRevision.requestsCpu || '',
        requestsMemory: stableRevision.requestsMemory || '',
        limitsCpu: stableRevision.limitsCpu || '',
        limitsMemory: stableRevision.limitsMemory || '',
      }));
    }
  }, [stableRevision, nextVersionName, form.revisionName]);

  const updateForm = (patch: Partial<WizardState>) => {
    setForm(prev => ({ ...prev, ...patch }));
  };

  const steps = ['New Revision', 'Release Strategy', 'Confirm'];

  const canNext = () => {
    if (step === 0) return form.revisionName.trim() !== '' && form.image.trim() !== '';
    return true;
  };

  const handleRelease = async () => {
    if (!appName || !serviceName) return;
    setSubmitting(true);
    try {
      await api.createRelease(namespace, appName, serviceName, {
        serviceName,
        revisionName: form.revisionName,
        image: form.image,
        replicas: form.replicas,
        mode: 'rolling',
        maxUnavailable: form.maxUnavailable,
        maxSurge: form.maxSurge,
        imagePullPolicy: form.imagePullPolicy,
        requestsCpu: form.requestsCpu || undefined,
        requestsMemory: form.requestsMemory || undefined,
        limitsCpu: form.limitsCpu || undefined,
        limitsMemory: form.limitsMemory || undefined,
        ports: stableRevision?.ports,
        env: stableRevision?.env,
      });
      navigate(`/apps/${appName}/services/${serviceName}`);
    } catch (err: any) {
      alert(err.message || 'Release failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!svc) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-slate-500">Service not found</p>
        <button onClick={() => navigate(`/apps/${appName || ''}`)} className="text-blue-600 hover:underline text-sm">Back to Application</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(`/apps/${appName}/services/${serviceName}`)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} className="text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Release New Version</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {svc.name} — Based on {stableRevision?.name || 'current version'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <ChevronRight size={16} className="text-slate-400" />}
            <div className={`flex items-center space-x-2 ${i === step ? 'text-blue-600' : i < step ? 'text-emerald-600' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step ? 'bg-emerald-500 text-white' :
                i === step ? 'bg-blue-600 text-white' :
                'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className="text-sm font-medium">{s}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Revision Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                  value={form.revisionName}
                  onChange={(e) => updateForm({ revisionName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Image</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                  value={form.image}
                  onChange={(e) => updateForm({ image: e.target.value })}
                  placeholder="e.g. reviews:v2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Image Pull Policy</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={form.imagePullPolicy}
                  onChange={(e) => updateForm({ imagePullPolicy: e.target.value })}
                >
                  <option value="Always">Always</option>
                  <option value="IfNotPresent">IfNotPresent</option>
                  <option value="Never">Never</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Replicas</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={form.replicas}
                  onChange={(e) => updateForm({ replicas: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Runtime Profile</label>
              <div className="flex items-center space-x-2">
                {(['Small', 'Medium', 'Large'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const presets: Record<string, Partial<WizardState>> = {
                        Small: { requestsCpu: '250m', limitsCpu: '500m', requestsMemory: '256Mi', limitsMemory: '512Mi', resourcePreset: 'Small' },
                        Medium: { requestsCpu: '500m', limitsCpu: '1000m', requestsMemory: '512Mi', limitsMemory: '1Gi', resourcePreset: 'Medium' },
                        Large: { requestsCpu: '1000m', limitsCpu: '2000m', requestsMemory: '1Gi', limitsMemory: '2Gi', resourcePreset: 'Large' },
                      };
                      updateForm(presets[p]);
                    }}
                    className={`text-xs px-3 py-1.5 border rounded-lg transition-colors ${
                      form.resourcePreset === p
                        ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Resources</label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">Request CPU</label>
                  <input type="text" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={form.requestsCpu} onChange={(e) => updateForm({ requestsCpu: e.target.value })} placeholder="e.g. 100m" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">Request Mem</label>
                  <input type="text" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={form.requestsMemory} onChange={(e) => updateForm({ requestsMemory: e.target.value })} placeholder="e.g. 128Mi" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">Limit CPU</label>
                  <input type="text" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={form.limitsCpu} onChange={(e) => updateForm({ limitsCpu: e.target.value })} placeholder="e.g. 500m" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">Limit Mem</label>
                  <input type="text" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500" value={form.limitsMemory} onChange={(e) => updateForm({ limitsMemory: e.target.value })} placeholder="e.g. 256Mi" />
                </div>
              </div>
            </div>

            {stableRevision && (
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-xs font-medium text-slate-500 mb-3">Inherited from {stableRevision.name} (read-only)</h4>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {stableRevision.ports && stableRevision.ports.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 w-16">Ports:</span>
                      <span className="font-mono">{stableRevision.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}</span>
                    </div>
                  )}
                  {stableRevision.env && Object.keys(stableRevision.env).length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 w-16">Env:</span>
                      <span className="font-mono">{Object.keys(stableRevision.env).length} variables</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-3">Release Mode</label>
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Rolling Update</div>
                <div className="text-xs text-slate-500 mt-0.5">Replace all instances gradually. Zero downtime.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">maxUnavailable</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={form.maxUnavailable}
                  onChange={(e) => updateForm({ maxUnavailable: Number(e.target.value) })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Maximum number of unavailable pods during update</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">maxSurge</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={form.maxSurge}
                  onChange={(e) => updateForm({ maxSurge: Number(e.target.value) })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Maximum number of extra pods created during update</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Release Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Service</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{svc.name}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">New Revision</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{form.revisionName}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Image</div>
                <div className="font-mono text-slate-800 dark:text-slate-200">{form.image}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Replicas</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{form.replicas}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Release Mode</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">Rolling Update</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">maxUnavailable</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{form.maxUnavailable}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">maxSurge</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{form.maxSurge}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Based On</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">{stableRevision?.name || 'N/A'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Resources</div>
                <div className="font-mono text-xs text-slate-800 dark:text-slate-200">
                  {form.requestsCpu}/{form.limitsCpu} CPU, {form.requestsMemory}/{form.limitsMemory} Mem
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : navigate(`/apps/${appName}/services/${serviceName}`)}
          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          {step > 0 ? 'Back' : 'Cancel'}
        </button>
        <div className="flex items-center space-x-3">
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleRelease}
              disabled={submitting}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Rocket size={16} />
              <span>{submitting ? 'Releasing...' : 'Release'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
