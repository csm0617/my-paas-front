import React, { useEffect, useState } from 'react';
import { useNamespaceStore } from '@/store/namespaceStore';
import { Plus, RefreshCw, Trash2, FolderTree, AlertCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function NamespaceList() {
  const { namespaces, loading, error, fetchNamespaces, createNamespace, deleteNamespace } = useNamespaceStore();
  const [newNamespaceName, setNewNamespaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteNamespace, setConfirmDeleteNamespace] = useState<string | null>(null);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNamespaceName.trim()) return;
    
    setIsCreating(true);
    try {
      await createNamespace({ name: newNamespaceName.trim() });
      setNewNamespaceName('');
    } catch (err: any) {
      alert(err.message || 'Failed to create namespace');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (name: string) => {
    if (name === 'default' || name === 'kube-system' || name === 'kube-public' || name === 'kube-node-lease') {
      alert(`Cannot delete system namespace: ${name}`);
      return;
    }
    setConfirmDeleteNamespace(name);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteNamespace) return;
    try {
      await deleteNamespace(confirmDeleteNamespace);
    } catch (err: any) {
      alert(err.message || 'Failed to delete namespace');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <FolderTree size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Namespaces</span>
          </div>
          <button
            onClick={() => fetchNamespaces()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="New namespace name..."
            className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-sm w-48"
            value={newNamespaceName}
            onChange={(e) => setNewNamespaceName(e.target.value)}
            disabled={isCreating}
            required
            pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
            title="Must be a valid DNS label (lowercase alphanumeric and hyphens)"
          />
          <button
            type="submit"
            disabled={isCreating || !newNamespaceName.trim()}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>Create</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center space-x-3">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Namespace Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && namespaces.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
                      <RefreshCw size={24} className="animate-spin text-blue-500" />
                      <span>Loading namespaces...</span>
                    </div>
                  </td>
                </tr>
              ) : namespaces.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No namespaces found.
                  </td>
                </tr>
              ) : (
                namespaces.map((ns) => {
                  const isSystem = ns.name === 'default' || ns.name === 'kube-system' || ns.name === 'kube-public' || ns.name === 'kube-node-lease';
                  
                  return (
                    <tr key={ns.name} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                        <FolderTree size={16} className="text-blue-500" />
                        <span>{ns.name}</span>
                        {isSystem && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                            SYSTEM
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ns.status === 'Active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {ns.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteClick(ns.name)}
                          disabled={isSystem}
                          className={`p-2 rounded-lg transition-colors ${
                            isSystem 
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                              : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                          title={isSystem ? "System namespaces cannot be deleted" : "Delete namespace"}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteNamespace}
        title="Delete Namespace"
        message={`Are you sure you want to delete namespace '${confirmDeleteNamespace}'? This action cannot be undone and will delete all resources within it.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteNamespace(null)}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
