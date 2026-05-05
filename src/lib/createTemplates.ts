import { DeployCommand } from '@/lib/api';

export type CreateTemplateId = 'bookinfo' | 'empty';

export type CreateTemplate = {
  id: CreateTemplateId;
  title: string;
  description: string;
  hasEntry: boolean;
  hasVersions: boolean;
  defaultEntryServiceName: string;
  defaultEntryPort: number;
  buildInitialCommand: (namespace: string) => Omit<DeployCommand, 'name'>;
};

export const createTemplates: CreateTemplate[] = [
  {
    id: 'bookinfo',
    title: 'Bookinfo',
    description: 'Istio sample microservices app with a single public entry.',
    hasEntry: true,
    hasVersions: true,
    defaultEntryServiceName: 'productpage',
    defaultEntryPort: 9080,
    buildInitialCommand: (namespace) => ({
      namespace,
      description: 'Istio bookinfo sample',
      services: [
        {
          name: 'productpage',
          replicas: 1,
          maxReplicas: 1,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: true,
          ingressDomain: '',
          containers: [
            {
              name: 'v1',
              image: 'docker.io/istio/examples-bookinfo-productpage-v1:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: true,
              ingressDomain: '',
            },
          ],
        },
        {
          name: 'details',
          replicas: 1,
          maxReplicas: 1,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: false,
          ingressDomain: '',
          containers: [
            {
              name: 'v1',
              image: 'docker.io/istio/examples-bookinfo-details-v1:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: false,
              ingressDomain: '',
            },
          ],
        },
        {
          name: 'ratings',
          replicas: 1,
          maxReplicas: 1,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: false,
          ingressDomain: '',
          containers: [
            {
              name: 'v1',
              image: 'docker.io/istio/examples-bookinfo-ratings-v1:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: false,
              ingressDomain: '',
            },
          ],
        },
        {
          name: 'reviews',
          replicas: 1,
          maxReplicas: 1,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: false,
          ingressDomain: '',
          containers: [
            {
              name: 'v1',
              image: 'docker.io/istio/examples-bookinfo-reviews-v1:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: false,
              ingressDomain: '',
            },
            {
              name: 'v2',
              image: 'docker.io/istio/examples-bookinfo-reviews-v2:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: false,
              ingressDomain: '',
            },
            {
              name: 'v3',
              image: 'docker.io/istio/examples-bookinfo-reviews-v3:1.20.0',
              ports: [{ port: 9080, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: false,
              ingressDomain: '',
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'empty',
    title: 'Empty',
    description: 'Start from a minimal skeleton with one public service.',
    hasEntry: true,
    hasVersions: false,
    defaultEntryServiceName: 'web',
    defaultEntryPort: 80,
    buildInitialCommand: (namespace) => ({
      namespace,
      description: '',
      services: [
        {
          name: 'web',
          replicas: 1,
          maxReplicas: 1,
          enableService: true,
          serviceType: 'ClusterIP',
          enableIngress: true,
          ingressDomain: '',
          containers: [
            {
              name: 'main',
              image: '',
              ports: [{ port: 80, protocol: 'TCP' }],
              replicas: 1,
              maxReplicas: 1,
              enableService: true,
              serviceType: 'ClusterIP',
              enableIngress: true,
              ingressDomain: '',
            },
          ],
        },
      ],
    }),
  },
];

