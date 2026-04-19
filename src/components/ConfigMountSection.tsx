import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConfigMount, SecretMount, configMapApi, secretApi, K8sConfigMap, K8sSecret } from '@/lib/api';
import { useNamespaceStore } from '@/store/namespaceStore';

interface Props {
  configMounts: ConfigMount[];
  setConfigMounts: React.Dispatch<React.SetStateAction<ConfigMount[]>>;
  secretMounts: SecretMount[];
  setSecretMounts: React.Dispatch<React.SetStateAction<SecretMount[]>>;
  currentNamespace: string;
}

export default function ConfigMountSection({ configMounts, setConfigMounts, secretMounts, setSecretMounts, currentNamespace }: Props) {
  const [availableConfigMaps, setAvailableConfigMaps] = useState<K8sConfigMap[]>([]);
  const [availableSecrets, setAvailableSecrets] = useState<K8sSecret[]>([]);

  useEffect(() => {
    if (!currentNamespace) return;
    
    configMapApi.list(currentNamespace).then(setAvailableConfigMaps).catch(console.error);
    secretApi.list(currentNamespace).then(setAvailableSecrets).catch(console.error);
  }, [currentNamespace]);

  const getConfigMapKeys = (cmName: string) => {
    const cm = availableConfigMaps.find(c => c.name === cmName);
    return cm && cm.data ? Object.keys(cm.data) : [];
  };

  const getSecretKeys = (secretName: string) => {
    const secret = availableSecrets.find(s => s.name === secretName);
    return secret && secret.data ? Object.keys(secret.data) : [];
  };
  const addConfigMount = () => {
    setConfigMounts([...configMounts, { mountPath: '', subPath: false, configMapName: '', key: '', defaultMode: 420 }]);
  };

  const removeConfigMount = (index: number) => {
    const newList = [...configMounts];
    newList.splice(index, 1);
    setConfigMounts(newList);
  };

  const updateConfigMount = (index: number, field: keyof ConfigMount, value: any) => {
    const newList = [...configMounts];
    newList[index] = { ...newList[index], [field]: value };
    setConfigMounts(newList);
  };

  const addSecretMount = () => {
    setSecretMounts([...secretMounts, { mountPath: '', subPath: false, secretName: '', key: '', defaultMode: 420 }]);
  };

  const removeSecretMount = (index: number) => {
    const newList = [...secretMounts];
    newList.splice(index, 1);
    setSecretMounts(newList);
  };

  const updateSecretMount = (index: number, field: keyof SecretMount, value: any) => {
    const newList = [...secretMounts];
    newList[index] = { ...newList[index], [field]: value };
    setSecretMounts(newList);
  };

  return (
    <div className="space-y-8">
      {/* ConfigMount Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">普通配置挂载 (ConfigMap)</label>
          <button
            type="button"
            onClick={addConfigMount}
            className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={16} />
            <span>添加配置目录</span>
          </button>
        </div>
        
        {configMounts.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">挂载目录</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">覆盖方式</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">配置组</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">配置文件</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">权限 (Octal)</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {configMounts.map((mount, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="/etc/config"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.mountPath}
                        onChange={(e) => updateConfigMount(i, 'mountPath', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.subPath ? 'true' : 'false'}
                        onChange={(e) => updateConfigMount(i, 'subPath', e.target.value === 'true')}
                      >
                        <option value="false">覆盖整个目录</option>
                        <option value="true">覆盖特定文件</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={mount.configMapName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const newKeys = getConfigMapKeys(newName);
                          // Auto-select first key if switching config maps while subPath is true
                          const newKey = mount.subPath && newKeys.length > 0 ? newKeys[0] : '';
                          const newList = [...configMounts];
                          newList[i] = { ...newList[i], configMapName: newName, key: newKey };
                          setConfigMounts(newList);
                        }}
                      >
                        <option value="" disabled>Select ConfigMap</option>
                        {availableConfigMaps.map(cm => (
                          <option key={cm.name} value={cm.name}>{cm.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      {mount.subPath ? (
                        <select
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          value={mount.key}
                          onChange={(e) => updateConfigMount(i, 'key', e.target.value)}
                        >
                          <option value="" disabled>Select File (Key)</option>
                          {getConfigMapKeys(mount.configMapName).map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="N/A"
                          disabled
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                          value=""
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={mount.defaultMode || 420}
                        onChange={(e) => updateConfigMount(i, 'defaultMode', parseInt(e.target.value, 10))}
                      >
                        <option value={256}>只读 (0400)</option>
                        <option value={288}>只读/可执行 (0440)</option>
                        <option value={420}>读写 (0644)</option>
                        <option value={493}>读写/可执行 (0755)</option>
                        <option value={511}>完全控制 (0777)</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeConfigMount(i)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SecretMount Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">加密配置挂载 (Secret)</label>
          <button
            type="button"
            onClick={addSecretMount}
            className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={16} />
            <span>添加配置目录</span>
          </button>
        </div>
        
        {secretMounts.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">挂载目录</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">覆盖方式</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">配置组</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">配置文件</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">权限 (Octal)</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {secretMounts.map((mount, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="/etc/secrets"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.mountPath}
                        onChange={(e) => updateSecretMount(i, 'mountPath', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.subPath ? 'true' : 'false'}
                        onChange={(e) => updateSecretMount(i, 'subPath', e.target.value === 'true')}
                      >
                        <option value="false">覆盖整个目录</option>
                        <option value="true">覆盖特定文件</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={mount.secretName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const newKeys = getSecretKeys(newName);
                          // Auto-select first key if switching secrets while subPath is true
                          const newKey = mount.subPath && newKeys.length > 0 ? newKeys[0] : '';
                          const newList = [...secretMounts];
                          newList[i] = { ...newList[i], secretName: newName, key: newKey };
                          setSecretMounts(newList);
                        }}
                      >
                        <option value="" disabled>Select Secret</option>
                        {availableSecrets.map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      {mount.subPath ? (
                        <select
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          value={mount.key}
                          onChange={(e) => updateSecretMount(i, 'key', e.target.value)}
                        >
                          <option value="" disabled>Select File (Key)</option>
                          {getSecretKeys(mount.secretName).map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="N/A"
                          disabled
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                          value=""
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={mount.defaultMode || 420}
                        onChange={(e) => updateSecretMount(i, 'defaultMode', parseInt(e.target.value, 10))}
                      >
                        <option value={256}>只读 (0400)</option>
                        <option value={288}>只读/可执行 (0440)</option>
                        <option value={420}>读写 (0644)</option>
                        <option value={493}>读写/可执行 (0755)</option>
                        <option value={511}>完全控制 (0777)</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeSecretMount(i)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
