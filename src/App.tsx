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
import ApplicationRuntime from "@/pages/ApplicationRuntime";
import ServiceRuntime from "@/pages/ServiceRuntime";
import ReleasesPage from "@/pages/ReleasesPage";
import ReleaseWizard from "@/pages/ReleaseWizard";
import MonitoringPage from "@/pages/MonitoringPage";
import EntryPage from "@/pages/EntryPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apps/:appName" element={<ApplicationRuntime />} />
          <Route path="/apps/:appName/services/:serviceName" element={<ServiceRuntime />} />
          <Route path="/apps/:appName/services/:serviceName/release" element={<ReleaseWizard />} />
          <Route path="/releases" element={<ReleasesPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/entries" element={<EntryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/nodes" element={<NodeList />} />
          <Route path="/namespaces" element={<NamespaceList />} />
          <Route path="/deployments" element={<DeploymentList />} />
          <Route path="/pods" element={<PodList />} />
          <Route path="/services" element={<ServiceList />} />
          <Route path="/ingresses" element={<IngressList />} />
          <Route path="/configmaps" element={<ConfigMapList />} />
        </Routes>
      </Layout>
    </Router>
  );
}
