# Curriculum

## Official alignment (verified 2026-11-12)

Source: CNCF [KCNA curriculum](https://github.com/cncf/curriculum) (`KCNA_Curriculum.pdf`) and the Linux Foundation [exam page](https://training.linuxfoundation.org/certification/kubernetes-cloud-native-associate/).

| Domain | Weight | Competencies |
|---|---:|---|
| Kubernetes Fundamentals | 44% | Core Concepts · Administration · Scheduling · Containerization |
| Container Orchestration | 28% | Networking · Security · Troubleshooting · Storage |
| Cloud Native Application Delivery | 16% | Application Delivery · Debugging |
| Cloud Native Architecture | 12% | Observability · Cloud Native Ecosystem and Principles · Cloud Native Community and Collaboration |

Exam format: online, proctored, multiple choice, 90 minutes (LF page). 60 questions and a 75% pass mark are widely reported for KCNA, but the exam page we checked does not state them. Confirm both in the LF Candidate Handbook before booking. The app's mock exam defaults come from `EXAM_FORMAT` in `packages/content/src/curriculum.ts`.

## Mapping

Every lesson, question, flashcard, glossary term, lab and challenge carries an `ObjectiveId` (one of the 13 competencies). Lessons also carry a **scope**:

- `kcna` — tested on the exam
- `foundation` — prerequisite knowledge the exam assumes (Linux, networking, YAML, distributed systems)
- `beyond` — deeper CKA/CKAD/DevOps material, clearly labelled. Lessons also hold optional "Beyond the exam" notes.

The auditable matrix lives in **[COVERAGE_MATRIX.md](COVERAGE_MATRIX.md)**. It is generated from the content (`npm run coverage:matrix`), and CI fails if it is stale. It lists every competency against its lessons, questions, labs and practice items, and it flags thin areas.

Known thin area: *Cloud Native Community and Collaboration* has lessons, questions and flashcards but no hands-on practice. The topic is conceptual (governance, SIGs, KEPs, maturity levels), so it is practised through questions only.

## Learning path

| Stage | Lessons |
|---|---|
| 0 Foundations | Linux essentials, networking fundamentals, VMs vs containers, images/OCI/registries, YAML, distributed systems |
| 1 Architecture | Cluster architecture, API server & etcd, scheduler & controllers, node components, desired-state reconciliation |
| 2 Workloads | Pods, ReplicaSets & Deployments, namespaces/labels/selectors, Jobs & CronJobs, DaemonSets & StatefulSets, requests/limits/QoS, probes, scheduling & placement |
| 3 Networking | Pod network & CNI, Services, DNS/CoreDNS, Ingress & Gateway API, NetworkPolicies |
| 4 Config & storage | ConfigMaps & Secrets, volumes, PV/PVC/StorageClass/CSI |
| 5 Security & ops | AuthN/AuthZ/RBAC & ServiceAccounts, Pod security & least privilege, kubectl & administration, troubleshooting workloads |
| 6 Delivery | CI/CD & GitOps, Helm & Kustomize, rollouts & strategies, debugging applications |
| 7 Architecture | Cloud-native principles, autoscaling & serverless, observability, Prometheus, service mesh & Envoy, CNCF community & governance |
| 8 Exam prep | Domain tests, smart review, flashcards, timed mocks, readiness evaluation (tools, not lessons) |

## Updating the curriculum

When CNCF publishes a new curriculum version:

1. Update `DOMAINS`, `OBJECTIVES`, `EXAM_FORMAT` and `CURRICULUM_VERIFIED_AT` in `packages/content/src/curriculum.ts`.
2. Run `npm test`. Content tests fail for any item mapped to a removed objective.
3. Re-map content, run `npm run coverage:matrix`, review the gaps section and commit.
