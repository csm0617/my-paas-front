import React from 'react';
import { Settings, User, Bell, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
  const sections = [
    { icon: User, title: 'Account', description: 'Manage your account and profile settings' },
    { icon: Bell, title: 'Notifications', description: 'Configure alert and notification preferences' },
    { icon: Shield, title: 'Security', description: 'Authentication, authorization and access control' },
    { icon: Database, title: 'Clusters', description: 'Manage connected Kubernetes clusters' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">设置</h1>
        <p className="text-sm text-slate-500 mt-1">Platform configuration and preferences</p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center space-x-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <section.icon size={20} className="text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{section.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
