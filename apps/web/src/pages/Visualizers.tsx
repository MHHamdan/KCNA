import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { AskAI } from '../components/TutorPanel';
import { DiagramSvg, StepPlayer } from '../components/StepDiagram';
import { CLUSTER, COMPONENT_INFO, NETWORK, NETWORK_FLOWS, SEQUENCES, STORAGE, STORAGE_FLOWS } from '../components/diagrams';
import { Tabs } from '../components/ui';

export function ExplorePage() {
  const [tab, setTab] = useState<'explore' | keyof typeof SEQUENCES>('explore');
  const [sel, setSel] = useState('api');
  usePageContext({ page: 'diagram:cluster-architecture' });
  const info = COMPONENT_INFO[sel];
  return (
    <div>
      <PageHeader
        title="Architecture explorer"
        subtitle="Click any component to learn what it does and what breaks without it, or play a sequence to watch Kubernetes reconcile desired state."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'explore', label: 'Explore components' },
          { value: 'apply', label: '▶ kubectl apply' },
          { value: 'crash', label: '▶ Container crash' },
          { value: 'nodefail', label: '▶ Node failure' },
        ]}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card">
          {tab === 'explore' ? (
            <DiagramSvg spec={CLUSTER} selected={sel} onSelect={setSel} highlight={[sel]} title="Kubernetes cluster architecture" />
          ) : (
            <StepPlayer spec={CLUSTER} steps={SEQUENCES[tab].steps} title={SEQUENCES[tab].title} />
          )}
        </div>
        <aside className="card space-y-3">
          {tab === 'explore' && info ? (
            <>
              <h2 className="text-lg font-semibold">{info.title}</h2>
              <p className="text-sm">{info.what}</p>
              <p className="text-sm">
                <span className="font-semibold text-rose-600 dark:text-rose-400">If it fails: </span>
                {info.failure}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link className="btn-ghost" to={`/lessons/${info.lessonId}`}>
                  Open lesson
                </Link>
                <AskAI question={`What does the ${info.title} do, and what happens when it fails?`} context={{ lessonId: info.lessonId, page: 'diagram:cluster-architecture' }} />
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold">{tab !== 'explore' && SEQUENCES[tab].title}</h2>
              <p className="text-sm text-slate-500">Step through the sequence. Highlighted components are involved in the current step; the purple arrow shows the action.</p>
              {tab === 'crash' && (
                <p className="rounded bg-amber-50 p-2 text-sm dark:bg-amber-500/10">
                  Exam tip: a container restart (kubelet, same Pod) is different from a Pod replacement (controller, new Pod).
                </p>
              )}
              <AskAI question={`Explain the "${tab !== 'explore' ? SEQUENCES[tab].title : ''}" sequence and which components are involved.`} context={{ lessonId: 'declarative-reconciliation', page: `diagram:${tab}` }} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export function NetworkPage() {
  const [flow, setFlow] = useState<keyof typeof NETWORK_FLOWS>('internal');
  usePageContext({ lessonId: 'services', page: 'diagram:networking' });
  return (
    <div>
      <PageHeader title="Networking visualizer" subtitle="Follow traffic through DNS, Services, kube-proxy, EndpointSlices and Ingress. Notice how a Pod failing its readiness probe is removed from the endpoints." />
      <Tabs
        value={flow}
        onChange={setFlow}
        options={[
          { value: 'internal', label: 'Pod → Service (DNS)' },
          { value: 'ingress', label: 'Internet → Ingress' },
          { value: 'nodeport', label: 'NodePort / LoadBalancer' },
        ]}
      />
      <div className="card mt-4">
        <StepPlayer spec={NETWORK} steps={NETWORK_FLOWS[flow].steps} title={NETWORK_FLOWS[flow].title} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {[
          ['ClusterIP', 'Default. Stable virtual IP reachable only inside the cluster.'],
          ['NodePort', 'ClusterIP + a port (30000–32767) on every node.'],
          ['LoadBalancer', 'NodePort + an external load balancer from the cloud provider.'],
          ['ExternalName', 'DNS CNAME to an external name; no proxying, no selector.'],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-slate-500">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/lessons/services" className="btn-ghost">
          Services lesson
        </Link>
        <Link to="/lessons/ingress-and-gateway-api" className="btn-ghost">
          Ingress & Gateway API lesson
        </Link>
        <AskAI question="Why does a Service need both a selector and a ready Pod to send traffic?" context={{ lessonId: 'services', page: 'diagram:networking' }} />
      </div>
    </div>
  );
}

export function StoragePage() {
  const [flow, setFlow] = useState<keyof typeof STORAGE_FLOWS>('dynamic');
  usePageContext({ lessonId: 'persistent-volumes-and-csi', page: 'diagram:storage' });
  return (
    <div>
      <PageHeader title="Storage visualizer" subtitle="See how a Pod's claim becomes a real disk: PVC → StorageClass → CSI → PV → mount." />
      <Tabs
        value={flow}
        onChange={setFlow}
        options={[
          { value: 'dynamic', label: 'Dynamic provisioning' },
          { value: 'static', label: 'Static provisioning' },
        ]}
      />
      <div className="card mt-4">
        <StepPlayer spec={STORAGE} steps={STORAGE_FLOWS[flow].steps} title={STORAGE_FLOWS[flow].title} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card text-sm">
          <p className="font-semibold">Access modes</p>
          <ul className="mt-2 space-y-1">
            <li>
              <code>ReadWriteOnce</code> — read-write by a single node
            </li>
            <li>
              <code>ReadOnlyMany</code> — read-only by many nodes
            </li>
            <li>
              <code>ReadWriteMany</code> — read-write by many nodes (needs e.g. NFS/CephFS)
            </li>
            <li>
              <code>ReadWriteOncePod</code> — read-write by a single Pod
            </li>
          </ul>
        </div>
        <div className="card text-sm">
          <p className="font-semibold">Volume types at a glance</p>
          <ul className="mt-2 space-y-1">
            <li>
              <code>emptyDir</code> — scratch space, deleted with the Pod
            </li>
            <li>
              <code>configMap</code> / <code>secret</code> — configuration files projected into the Pod
            </li>
            <li>
              <code>hostPath</code> — node filesystem; avoid for apps (security, portability)
            </li>
            <li>
              <code>persistentVolumeClaim</code> — durable storage outliving the Pod
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-4">
        <AskAI question="When should I use emptyDir vs a PersistentVolumeClaim?" context={{ lessonId: 'volumes', page: 'diagram:storage' }} />
      </div>
    </div>
  );
}
