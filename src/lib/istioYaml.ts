export type IstioGatewayRef = {
  namespace: string;
  name: string;
};

export type IstioEntryTarget = {
  serviceName: string;
  workloadName: string;
  port: number;
};

export type IstioEntryDraft = {
  enabled: boolean;
  host: string;
  gatewayRef: IstioGatewayRef;
  target: IstioEntryTarget | null;
};

export type IstioSubsetDraft = {
  name: string;
  labels: Record<string, string>;
};

export type IstioTrafficSplitDraft = {
  enabled: boolean;
  weights: Record<string, number>;
};

export type IstioResilienceDraft = {
  timeout: string;
  retriesAttempts: number;
  perTryTimeout: string;
};

export type IstioServiceDraft = {
  enabled: boolean;
  subsets: IstioSubsetDraft[];
  trafficSplit: IstioTrafficSplitDraft;
  resilience: IstioResilienceDraft;
};

export type IstioDraft = {
  entry: IstioEntryDraft;
  services: Record<string, IstioServiceDraft>;
};

export const istioNames = (appName: string) => {
  const safeApp = appName.trim() || 'app';
  return {
    gateway: `${safeApp}-gw`,
    virtualService: `${safeApp}-vs`,
    destinationRule: (serviceName: string) => `${safeApp}-${serviceName}-dr`,
    serviceVirtualService: (serviceName: string) => `${safeApp}-${serviceName}-vs`,
    telemetry: `${safeApp}-telemetry`,
    peerAuthentication: `${safeApp}-mtls`,
  };
};

export const buildCreateEntryIstioDraft = (
  namespace: string,
  appName: string,
  entry: { enabled: boolean; domain: string; targetServiceName: string; targetPort: number },
  services: Array<{ name: string }>
): IstioDraft => {
  const host = entry.domain.trim()
  const names = istioNames(appName)
  const targetSvc = services.find((s) => s.name === entry.targetServiceName) || null

  return {
    entry: {
      enabled: entry.enabled,
      host,
      gatewayRef: { namespace, name: names.gateway },
      target:
        entry.enabled && host && targetSvc
          ? { serviceName: targetSvc.name, workloadName: 'v1', port: entry.targetPort }
          : null,
    },
    services: {
      ...(targetSvc
        ? {
            [targetSvc.name]: {
              enabled: true,
              subsets: [],
              trafficSplit: { enabled: false, weights: {} },
              resilience: { timeout: '2s', retriesAttempts: 2, perTryTimeout: '1s' },
            },
          }
        : {}),
    },
  }
}

const ISTIO_NETWORKING_API_VERSION = 'networking.istio.io/v1beta1';
const ISTIO_SECURITY_API_VERSION = 'security.istio.io/v1beta1';
const ISTIO_TELEMETRY_API_VERSION = 'telemetry.istio.io/v1alpha1';

const indent = (s: string, n: number) => {
  const pad = ' '.repeat(n);
  return s
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
};

export const buildIstioYaml = (namespace: string, appName: string, draft: IstioDraft) => {
  const docs: string[] = [];
  const names = istioNames(appName);

  if (draft.entry.enabled && draft.entry.host.trim() && draft.entry.target) {
    const host = draft.entry.host.trim();
    const gatewayNs = draft.entry.gatewayRef.namespace.trim() || 'istio-system';
    const gatewayName = draft.entry.gatewayRef.name.trim() || 'istio-ingressgateway';

    docs.push(
      [
        `apiVersion: ${ISTIO_NETWORKING_API_VERSION}`,
        'kind: Gateway',
        'metadata:',
        indent(`name: ${names.gateway}\nnamespace: ${namespace}`, 2),
        'spec:',
        indent(
          [
            'selector:',
            indent(`istio: ingressgateway`, 2),
            'servers:',
            indent(
              [
                '- port:',
                indent('number: 80\nname: http\nprotocol: HTTP', 2),
                '  hosts:',
                indent(`- "${host}"`, 2),
              ].join('\n'),
              2
            ),
          ].join('\n'),
          2
        ),
        '',
      ].join('\n')
    );

    const target = draft.entry.target;
    const svcDraft = draft.services[target.serviceName];
    const timeout = svcDraft?.resilience.timeout || '2s';
    const attempts = svcDraft?.resilience.retriesAttempts ?? 2;
    const perTryTimeout = svcDraft?.resilience.perTryTimeout || '1s';

    docs.push(
      [
        `apiVersion: ${ISTIO_NETWORKING_API_VERSION}`,
        'kind: VirtualService',
        'metadata:',
        indent(`name: ${names.virtualService}\nnamespace: ${namespace}`, 2),
        'spec:',
        indent(
          [
            'hosts:',
            indent(`- "${host}"`, 2),
            'gateways:',
            indent(`- ${gatewayNs}/${gatewayName}`, 2),
            'http:',
            indent(
              [
                '- match:',
                indent('- uri:\n    prefix: "/"', 2),
                '  route:',
                indent(
                  [
                    '- destination:',
                    indent(`host: ${target.serviceName}\nport:\n  number: ${target.port}`, 2),
                  ].join('\n'),
                  2
                ),
                `  timeout: ${timeout}`,
                '  retries:',
                indent(`attempts: ${attempts}\nperTryTimeout: ${perTryTimeout}`, 2),
              ].join('\n'),
              2
            ),
          ].join('\n'),
          2
        ),
        '',
      ].join('\n')
    );
  }

  for (const [svcName, svcDraft] of Object.entries(draft.services)) {
    if (!svcDraft.enabled) continue;
    const drName = names.destinationRule(svcName);

    if (svcDraft.trafficSplit?.enabled) {
      const timeout = svcDraft.resilience?.timeout || '2s';
      const attempts = svcDraft.resilience?.retriesAttempts ?? 2;
      const perTryTimeout = svcDraft.resilience?.perTryTimeout || '1s';

      const weights = svcDraft.trafficSplit.weights || {};
      const routes = Object.entries(weights)
        .filter(([, w]) => Number.isFinite(w) && w > 0)
        .map(([subset, w]) => {
          return [
            '- destination:',
            indent(`host: ${svcName}\nsubset: ${subset}`, 2),
            `  weight: ${w}`,
          ].join('\n');
        })
        .join('\n');

      docs.push(
        [
          `apiVersion: ${ISTIO_NETWORKING_API_VERSION}`,
          'kind: VirtualService',
          'metadata:',
          indent(`name: ${names.serviceVirtualService(svcName)}\nnamespace: ${namespace}`, 2),
          'spec:',
          indent(
            [
              'hosts:',
              indent(`- "${svcName}"`, 2),
              'http:',
              indent(
                [
                  '- route:',
                  indent(routes || '', 2),
                  `  timeout: ${timeout}`,
                  '  retries:',
                  indent(`attempts: ${attempts}\nperTryTimeout: ${perTryTimeout}`, 2),
                ].join('\n'),
                2
              ),
            ].join('\n'),
            2
          ),
          '',
        ].join('\n')
      );
    }

    const subsetsYaml = svcDraft.subsets.length
      ? [
          'subsets:',
          indent(
            svcDraft.subsets
              .map((s) => {
                const labels = Object.entries(s.labels)
                  .map(([k, v]) => `${k}: "${v}"`)
                  .join('\n');
                return ['- name: ' + s.name, '  labels:', indent(labels || '', 4)].join('\n');
              })
              .join('\n'),
            2
          ),
        ].join('\n')
      : '';

    docs.push(
      [
        `apiVersion: ${ISTIO_NETWORKING_API_VERSION}`,
        'kind: DestinationRule',
        'metadata:',
        indent(`name: ${drName}\nnamespace: ${namespace}`, 2),
        'spec:',
        indent(`host: ${svcName}`, 2),
        subsetsYaml ? indent(subsetsYaml, 2) : '',
        '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return docs.join('---\n');
};

export type SecurityObsDraft = {
  enablePeerAuthenticationStrict: boolean;
  enableTelemetry: boolean;
};

export const buildSecurityObsYaml = (namespace: string, appName: string, draft: SecurityObsDraft) => {
  const names = istioNames(appName);
  const docs: string[] = [];

  if (draft.enablePeerAuthenticationStrict) {
    docs.push(
      [
        `apiVersion: ${ISTIO_SECURITY_API_VERSION}`,
        'kind: PeerAuthentication',
        'metadata:',
        indent(`name: ${names.peerAuthentication}\nnamespace: ${namespace}`, 2),
        'spec:',
        indent('mtls:\n  mode: STRICT', 2),
        '',
      ].join('\n')
    );
  }

  if (draft.enableTelemetry) {
    docs.push(
      [
        `apiVersion: ${ISTIO_TELEMETRY_API_VERSION}`,
        'kind: Telemetry',
        'metadata:',
        indent(`name: ${names.telemetry}\nnamespace: ${namespace}`, 2),
        'spec: {}',
        '',
      ].join('\n')
    );
  }

  return docs.join('---\n');
};
