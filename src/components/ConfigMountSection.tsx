import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConfigMount, SecretMount } from '@/lib/api';

interface Props {
  configMounts: ConfigMount[];
  setConfigMounts: React.Dispatch<React.SetStateAction<ConfigMount[]>>;
  secretMounts: SecretMount[];
  setSecretMounts: React.Dispatch<React.SetStateAction<SecretMount[]>>;
}

export default function ConfigMountSection({ configMounts, setConfigMounts, secretMounts, setSecretMounts }: Props) {
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
                      <input
                        type="text"
                        placeholder="ConfigMap Name"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.configMapName}
                        onChange={(e) => updateConfigMount(i, 'configMapName', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder={mount.subPath ? "Key (e.g. config.yaml)" : "N/A"}
                        disabled={!mount.subPath}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${!mount.subPath ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}
                        value={mount.key}
                        onChange={(e) => updateConfigMount(i, 'key', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="420"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.defaultMode || ''}
                        onChange={(e) => updateConfigMount(i, 'defaultMode', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      />
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
                      <input
                        type="text"
                        placeholder="Secret Name"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.secretName}
                        onChange={(e) => updateSecretMount(i, 'secretName', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder={mount.subPath ? "Key (e.g. tls.crt)" : "N/A"}
                        disabled={!mount.subPath}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${!mount.subPath ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}
                        value={mount.key}
                        onChange={(e) => updateSecretMount(i, 'key', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="420"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={mount.defaultMode || ''}
                        onChange={(e) => updateSecretMount(i, 'defaultMode', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      />
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
