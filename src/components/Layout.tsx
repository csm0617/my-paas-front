import React, { useState } from 'react';
import { Layers, Rocket, Activity, Server, FolderTree, Package, Box, Share2, Link as LinkIcon, FileCode, Settings, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInfraExpanded, setIsInfraExpanded] = useState(false);

  const infraPaths = ['/nodes', '/namespaces', '/deployments', '/pods', '/services', '/ingresses', '/configmaps'];
  const isInfraActive = infraPaths.some(p => location.pathname.startsWith(p));

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full relative group`}>
        {/* Collapse toggle button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 text-slate-500 hover:text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 focus:outline-none"
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`p-6 flex items-center shrink-0 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="bg-blue-600 text-white p-2 rounded-lg shrink-0">
            <Layers size={24} />
          </div>
          {!isSidebarCollapsed && (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 truncate transition-opacity duration-300">
              PaaS Console
            </h1>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto mt-6 px-4 space-y-2 pb-6 overflow-x-hidden">
          <Link
            to="/"
            title={isSidebarCollapsed ? "Applications" : ""}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${
              location.pathname === '/'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Layers size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Applications</span>}
          </Link>
          <Link
            to="/releases"
            title={isSidebarCollapsed ? "Releases" : ""}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${
              location.pathname === '/releases'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Rocket size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Releases</span>}
          </Link>
          <Link
            to="/monitoring"
            title={isSidebarCollapsed ? "Monitoring" : ""}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${
              location.pathname === '/monitoring'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Activity size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Monitoring</span>}
          </Link>
          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
          <button
            onClick={() => {
              if (isSidebarCollapsed) {
                setIsSidebarCollapsed(false);
                setIsInfraExpanded(true);
              } else {
                setIsInfraExpanded(!isInfraExpanded);
              }
            }}
            title={isSidebarCollapsed ? "Infrastructure" : ""}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${
              isInfraActive
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Server size={20} className="shrink-0" />
            {!isSidebarCollapsed && (
              <>
                <span className="truncate flex-1 text-left">Infrastructure</span>
                {isInfraExpanded ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
              </>
            )}
          </button>
          {!isSidebarCollapsed && isInfraExpanded && (
            <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
              <Link
                to="/nodes"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/nodes'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <Server size={16} className="shrink-0" />
                <span className="truncate">Nodes</span>
              </Link>
              <Link
                to="/namespaces"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/namespaces'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <FolderTree size={16} className="shrink-0" />
                <span className="truncate">Namespaces</span>
              </Link>
              <Link
                to="/deployments"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/deployments'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <Package size={16} className="shrink-0" />
                <span className="truncate">Workloads</span>
              </Link>
              <Link
                to="/pods"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/pods'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <Box size={16} className="shrink-0" />
                <span className="truncate">Instances</span>
              </Link>
              <Link
                to="/services"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/services'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <Share2 size={16} className="shrink-0" />
                <span className="truncate">Endpoints</span>
              </Link>
              <Link
                to="/ingresses"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/ingresses'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <LinkIcon size={16} className="shrink-0" />
                <span className="truncate">Routes</span>
              </Link>
              <Link
                to="/configmaps"
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 space-x-3 ${
                  location.pathname === '/configmaps'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm'
                }`}
              >
                <FileCode size={16} className="shrink-0" />
                <span className="truncate">Config Groups</span>
              </Link>
            </div>
          )}
          <Link
            to="/settings"
            title={isSidebarCollapsed ? "Settings" : ""}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${
              location.pathname === '/settings'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Settings size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Settings</span>}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-8 shadow-sm z-10">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {location.pathname === '/' ? 'Applications' : location.pathname === '/releases' ? 'Releases' : location.pathname === '/monitoring' ? 'Monitoring' : location.pathname === '/nodes' ? 'Node Management' : location.pathname === '/namespaces' ? 'Namespace Management' : location.pathname === '/deployments' ? 'Workload Management' : location.pathname === '/pods' ? 'Instance Management' : location.pathname === '/services' ? 'Endpoint Management' : location.pathname === '/ingresses' ? 'Route Management' : location.pathname === '/configmaps' ? 'Config Group Management' : 'Settings'}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
