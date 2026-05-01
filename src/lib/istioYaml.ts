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
    gateway: `${safeApp}-gateway`,
    virtualService: `${safeApp}-vs`,
    destinationRule: (serviceName: string) => `${safeApp}-${serviceName}-dr`,
  };
};

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
        'apiVersion: networking.istio.io/v1beta1',
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
        'apiVersion: networking.istio.io/v1beta1',
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
        'apiVersion: networking.istio.io/v1beta1',
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

  docs.push(
    [
      '# Security placeholders (not applied in phase 1)',
      '# - PeerAuthentication',
      '# - AuthorizationPolicy',
      '# - RequestAuthentication',
      '# Observability placeholders (not applied in phase 1)',
      '# - Telemetry',
      '',
    ].join('\n')
  );

  return docs.join('---\n');
};

