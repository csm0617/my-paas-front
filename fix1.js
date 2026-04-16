const fs = require('fs');
const path = '/Users/csm/Desktop/Project/test/frontend/src/components/DeployModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// I want to completely replace the content between:
// `            )}` (line 322)
// and
// `            {step === 3 && (` (line 630)

const lines = content.split('\n');

const startIdx = lines.findIndex(line => line === '            )}' && lines[lines.indexOf(line) - 1] === '              </div>');
const endIdx = lines.findIndex(line => line === '            {step === 3 && (');

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find boundaries');
  process.exit(1);
}

const before = lines.slice(0, startIdx + 1);
const after = lines.slice(endIdx);

const replacement = `
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Port Configuration
                  </h3>
                  <div className="col-span-3">
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Container Ports</label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        这是容器内部监听的端口。如果下方开启了NodePort服务，可选择配置映射到宿主机的端口。
                      </p>
                    </div>
                    <div className="space-y-3">
                      {formData.ports.map((portSpec, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="number"
                            min="1"
                            max="65535"
                            placeholder="Port (e.g. 80)"
                            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={portSpec.port || ''}
                            onChange={(e) => {
                              const newPorts = [...formData.ports];
                              newPorts[index].port = Number(e.target.value);
                              setFormData({ ...formData, ports: newPorts });
                            }}
                          />
                          {formData.enableService && formData.serviceType === 'NodePort' && (
                            <input
                              type="number"
                              min="30000"
                              max="32767"
                              placeholder="NodePort (Auto)"
                              className="w-32 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={portSpec.nodePort || ''}
                              onChange={(e) => {
                                const newPorts = [...formData.ports];
                                const val = e.target.value;
                                newPorts[index].nodePort = val ? Number(val) : undefined;
                                setFormData({ ...formData, ports: newPorts });
                              }}
                            />
                          )}
                          <select
                            className="w-32 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={portSpec.protocol}
                            onChange={(e) => {
                              const newPorts = [...formData.ports];
                              newPorts[index].protocol = e.target.value as 'TCP' | 'UDP';
                              setFormData({ ...formData, ports: newPorts });
                            }}
                          >
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.ports.length > 1) {
                                const newPorts = formData.ports.filter((_, i) => i !== index);
                                setFormData({ ...formData, ports: newPorts });
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"
                            disabled={formData.ports.length === 1}
                          >
                            <X size={20} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ports: [...formData.ports, { port: 8080, protocol: 'TCP' }] })}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center mt-2"
                      >
                        <Plus size={16} className="mr-1" /> Add Port
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Service & Routing
                  </h3>
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Internal Service</label>
                      <p className="text-xs text-slate-500">Creates a Kubernetes Service to expose the application within the cluster.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.enableService}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData({
                            ...formData,
                            enableService: checked,
                            enableIngress: checked ? formData.enableIngress : false,
                          });
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.enableService && (
                    <div className="pl-4 border-l-2 border-blue-500 space-y-4 animate-in fade-in slide-in-from-left-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Type</label>
                        <select
                          value={formData.serviceType}
                          onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="ClusterIP">ClusterIP (Internal Only)</option>
                          <option value="NodePort">NodePort (Expose on Node IPs)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable External Access (Ingress)</label>
                          <p className="text-xs text-slate-500">Expose the application to the internet via a domain name.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.enableIngress}
                            onChange={(e) => setFormData({ ...formData, enableIngress: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.enableIngress && (
                        <div className="pl-4 border-l-2 border-purple-500 animate-in fade-in slide-in-from-left-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Domain (Host)</label>
                          <input
                            type="text"
                            placeholder="e.g. app.example.com"
                            value={formData.ingressDomain}
                            onChange={(e) => setFormData({ ...formData, ingressDomain: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <ResourcesSchedulingSection
                value={{
                  requestsCpu: formData.requestsCpu ?? '',
                  requestsMemory: formData.requestsMemory ?? '',
                  limitsCpu: formData.limitsCpu ?? '',
                  limitsMemory: formData.limitsMemory ?? '',
                  nodeSelector: formData.nodeSelector,
                  affinityJson: formData.affinityJson ?? '',
                  tolerationsJson: formData.tolerationsJson ?? '',
                }}
                onChange={(next) => setFormData((prev) => ({ ...prev, ...next }))}
                namespaceName={formData.namespace}
              />
            )}
`.slice(1);

const newLines = [...before, replacement, ...after];
fs.writeFileSync(path, newLines.join('\\n'));
console.log('Done!');
