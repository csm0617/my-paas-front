import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import NamespaceList from "@/pages/NamespaceList";
import PodList from "@/pages/PodList";
import ServiceList from "@/pages/ServiceList";
import IngressList from "@/pages/IngressList";
import NodeList from "@/pages/NodeList";
import ConfigMapList from "@/pages/ConfigMapList";
import DeploymentList from "@/pages/DeploymentList";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nodes" element={<NodeList />} />
          <Route path="/namespaces" element={<NamespaceList />} />
          <Route path="/deployments" element={<DeploymentList />} />
          <Route path="/pods" element={<PodList />} />
          <Route path="/services" element={<ServiceList />} />
          <Route path="/ingresses" element={<IngressList />} />
          <Route path="/configmaps" element={<ConfigMapList />} />
          <Route path="/settings" element={
            <div className="flex h-full items-center justify-center text-slate-500">
              Settings Page - Coming Soon
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}
