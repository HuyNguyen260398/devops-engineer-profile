# GitOps Platform Security Hardening — Design

**Date:** 2026-07-16
**Status:** Approved
**Scope:** The 5 high-priority findings from the 2026-07-16 security review of `gitops/` and `inf/terraform/aws-eks-argocd/`, plus secure-network requirements for the EKS + ArgoCD stack (VPC endpoints, secure ArgoCD endpoint).

## Context

A security review of the GitOps platform found five high-priority gaps:

1. Root app-of-apps Applications run in the unrestricted `default` AppProject.
2. All AppProjects allow `sourceRepos: ["*"]`.
3. Secrets management (External Secrets Operator) is designed in comments but not deployed; credential placeholders sit in Helm values.
4. Tenant namespaces have no Pod Security Standards labels, no NetworkPolicies, and no ResourceQuotas/LimitRanges.
5. The Argo Workflows ClusterRole grants ConfigMap write and Workflow CRUD cluster-wide, contradicting its own least-privilege documentation.

Additionally, the EKS network layer (`inf/terraform/aws-eks`) has no VPC endpoints (all AWS API traffic egresses via NAT), and no managed ArgoCD ingress exists — `values-aws.yaml` disables ingress with a comment that it is "managed separately", but nothing manages it.

Already in good shape (no changes needed): nodes in private subnets, private API endpoint by default with validated public CIDR gating, KMS envelope encryption of secrets, VPC flow logs, control-plane audit logging, IMDSv2 via EKS module v21 defaults, commit-pinned IAM modules, restricted container security contexts across chart values.

## Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Scope | High-priority findings + secure network/endpoint requirements |
| ESO | End-to-end, including Terraform IRSA in `inf/terraform/aws-eks-argocd` |
| Tenant guardrails delivery | Extend the `gitops/helm-charts/jenkins` wrapper chart; PSS labels via `managedNamespaceMetadata` |
| PSS level for tenant namespaces | `enforce: baseline`, `warn: restricted`, `audit: restricted` |
| Verification | Static validation (kustomize/helm/kubeconform/terraform validate/tflint) + live minikube deployment for PR 1 |
| Delivery | Three PRs (see below) |

## Delivery structure

- **PR 1 — GitOps YAML hardening** (Sections 1–4). Pure manifests; fully verifiable on a local minikube cluster.
- **PR 2 — External Secrets Operator end-to-end** (Section 5). Terraform IRSA + ESO app + SecretStore + ExternalSecrets. Functional only against AWS.
- **PR 3 — Network hardening** (Section 6). VPC endpoints in `inf/terraform/aws-eks` + ArgoCD ALB ingress values. Independent of PRs 1–2; the `secretsmanager` endpoint complements PR 2.

---

## Section 1 — Bootstrap AppProject (PR 1)

New file `gitops/bootstrap/projects/bootstrap.yaml` defining AppProject `bootstrap`:

- `sourceRepos`: only `https://github.com/HuyNguyen260398/devops-engineer-profile.git`
- `destinations`: only `https://kubernetes.default.svc`, namespace `argocd`
- `namespaceResourceWhitelist`: only `argoproj.io/Application`
- `clusterResourceWhitelist`: empty (root apps create no cluster-scoped resources)
- Roles: none needed (root apps are synced by the ArgoCD controller itself)

Switch `spec.project: default` → `bootstrap` in all five root Applications:

- `gitops/bootstrap/app-of-apps.yaml` (1)
- `gitops/bootstrap/app-of-apps-infrastructure.yaml` (3: local, staging, production)
- `gitops/bootstrap/local/app-of-apps-infrastructure.yaml` (1)

Result: a YAML merged into an `application-plane/*/` directory can only ever create ArgoCD Applications in the `argocd` namespace, and those land in the already-scoped `infrastructure`/`applications`/`tenants` projects.

## Section 2 — Pin sourceRepos (PR 1)

In `gitops/bootstrap/projects/{infrastructure,applications,tenants}.yaml`, replace `sourceRepos: ["*"]` with the single repo URL above.

Safety note: `sourceRepos` constrains `Application.spec.source.repoURL` only. Helm chart dependencies (charts.jenkins.io, etc.) are fetched by the repo-server during rendering and are not checked against `sourceRepos`, so the wrapper-chart pattern keeps working.

## Section 3 — Tenant namespace guardrails (PR 1)

### 3a. Jenkins wrapper chart templates

`gitops/helm-charts/jenkins/` version 1.0.0 → 1.1.0, adding `templates/` gated and sized by a new `guardrails:` values block (all enabled by default):

- **`networkpolicy.yaml`**
  - default-deny all ingress + egress (empty podSelector)
  - allow DNS egress (UDP/TCP 53) to `kube-system`
  - allow intra-namespace traffic (agents ↔ controller on 8080 and 50000)
  - allow ingress to 8080 from the ingress-controller namespace (namespaceSelector, configurable)
  - allow egress on 443 (git clones, plugin downloads)
  - `guardrails.networkPolicy.extraIngress` / `extraEgress` value hooks for per-tier additions
- **`resourcequota.yaml`** — requests/limits CPU + memory, PVC count/storage, pod count. Defaults sized for basic tier; advanced/premium tiers override via the tenant Application's `helm.values` (same pattern as resources today).
- **`limitrange.yaml`** — container default requests/limits so limit-less pods are admitted under the quota.

### 3b. PSS labels via managedNamespaceMetadata

Add to `syncPolicy.managedNamespaceMetadata.labels` on every tenant-facing Application:

```yaml
pod-security.kubernetes.io/enforce: baseline
pod-security.kubernetes.io/warn: restricted
pod-security.kubernetes.io/audit: restricted
app.kubernetes.io/part-of: gitops-platform
```

Files: all tier templates (local ×1, staging ×2, production ×3), existing tenant Applications (`local/tenants/basic/jenkins.yaml`, `staging/tenants/advanced/jenkins.yaml`, `production/tenants/premium/jenkins.yaml`), `pooled-envs/pool-1.yaml` (×3 envs), and the ApplicationSet template in `gitops/applicationsets/jenkins-appset.yaml`.

Rationale for baseline-enforce: Jenkins controller pods comply with `restricted`, but tenant-defined agent podTemplates may not; `warn`/`audit: restricted` surfaces violations without breaking builds, and enforcement can be tightened later.

## Section 4 — Argo Workflows RBAC split (PR 1)

Rework `gitops/control-plane/rbac/workflow-rbac.yaml`:

- **ClusterRole `gitops-workflow-role`** keeps only what is genuinely cluster-wide:
  - `argoproj.io` `applications`, `applicationsets`: get/list/watch
  - `""` `namespaces`: get/list/watch/create/delete
  - `""` `pods`, `services`, `endpoints`: get/list/watch
  - `apps` `deployments`, `statefulsets`, `replicasets`: get/list/watch
- **New Role `gitops-workflow-ns-role` + RoleBinding in `argo-workflows`**:
  - `""` `configmaps`: get/list/watch/create/update/patch
  - `argoproj.io` `workflows`, `workflowtemplates`, `workflowartifactgctasks`: full CRUD

The ClusterRoleBinding continues binding `gitops-workflow-sa` to the trimmed ClusterRole.

## Section 5 — External Secrets Operator (PR 2)

### 5a. Terraform (`inf/terraform/aws-eks-argocd/external_secrets.tf`)

- IRSA role via the same commit-pinned `terraform-aws-iam` module, `role_name_prefix "${var.cluster_name}-eso-"`, bound to `external-secrets:external-secrets`.
- Custom `aws_iam_policy`: `secretsmanager:GetSecretValue` + `secretsmanager:DescribeSecret` on `arn:aws:secretsmanager:<region>:<account>:secret:gitops/${var.environment}/*` only.
- Gated by `enable_external_secrets` (default `true`); new output `external_secrets_irsa_role_arn`.

### 5b. GitOps manifests

- New wrapper chart `gitops/helm-charts/external-secrets/` pinning the upstream `external-secrets` chart to an exact version (look up the latest stable release at implementation time and record it in `Chart.yaml`, matching the other wrapper charts), restricted security contexts, resource requests/limits, `serviceAccount.annotations` carrying the IRSA role ARN.
- Application per env: `application-plane/{staging,production}/infrastructure/external-secrets.yaml`, registered in each env's `kustomization.yaml`, `project: infrastructure`, **sync-wave -1** (before monitoring at wave 0). Not deployed to `local` (no AWS) — local keeps manually created secrets, documented in the gitops README.
- `ClusterSecretStore aws-secrets-manager` (per env values) referencing the ESO service account. Add `external-secrets.io/ClusterSecretStore` to the `infrastructure` AppProject `clusterResourceWhitelist` (namespaced `ExternalSecret` is already covered by that project's `group: "*" / kind: "*"` namespace whitelist).
- IRSA role ARN is committed per env after `terraform apply` (repo's existing "UPDATE THIS" convention; the ARN is not secret).

### 5c. Secret consumers (Secrets Manager naming: `gitops/<env>/<name>`)

| Secrets Manager key | ExternalSecret target | Consumer change |
|---|---|---|
| `gitops/<env>/grafana-admin` | `grafana-admin-credentials` (monitoring) | Grafana `admin.existingSecret`; delete both `adminPassword` placeholders |
| `gitops/<env>/alertmanager-receivers` | `alertmanager-receivers` (monitoring) | Mounted via `alertmanagerSpec.secrets`; Alertmanager config stays in Git but uses `*_file` references (PagerDuty `service_key_file`, Slack `api_url_file`) — key material never in the repo |
| `gitops/<env>/git-credentials` | `git-credentials` (argo-workflows) | Replaces the manual template for AWS envs; template retained for local |

Secrets Manager entries are created out-of-band (documented `aws secretsmanager create-secret` commands in the module README) — never in Terraform, keeping secret values out of state.

## Section 6 — Secure network & endpoints (PR 3)

### 6a. VPC endpoints (`inf/terraform/aws-eks`)

Add the pinned `terraform-aws-modules/vpc/aws//modules/vpc-endpoints` module:

- **Gateway endpoint:** S3 (no cost; image layers)
- **Interface endpoints:** `ecr.api`, `ecr.dkr`, `sts`, `ec2`, `elasticloadbalancing`, `logs`, `autoscaling`, `eks`, `secretsmanager`
- Dedicated endpoint security group: ingress 443 from the VPC CIDR only
- `private_dns_enabled: true` on interface endpoints; endpoints placed in private subnets
- Gated by `enable_vpc_endpoints` (default `true`) with an `vpc_endpoint_services` list variable so staging can trim the paid interface endpoints

Node internet egress via NAT remains (builds pull from GitHub/Docker Hub); this tradeoff is already documented in `main.tf`.

### 6b. Secure ArgoCD endpoint (`gitops/bootstrap/argocd/values-aws.yaml`)

Replace `server.ingress.enabled: false` with an ALB ingress via the chart's ingress values:

- `alb.ingress.kubernetes.io/scheme: ${ARGOCD_ALB_SCHEME}` — default `internal`
- TLS via ACM: `certificate-arn: ${ARGOCD_CERT_ARN}`, `ssl-redirect`, HTTPS-only listeners, `ssl-policy` TLS 1.2+ (`ELBSecurityPolicy-TLS13-1-2-2021-06`)
- `inbound-cidrs: ${ARGOCD_ALLOWED_CIDRS}`
- `target-type: ip`; backend protocol HTTPS to argocd-server (keeps `server.insecure: false` end-to-end)
- New envsubst variables documented in the file header alongside `ARGOCD_IRSA_ROLE_ARN`

## Verification / success criteria

**PR 1 (static + live):**
- `kustomize build` succeeds on every kustomization directory
- `helm template` on the jenkins chart with basic/advanced/premium values renders valid NetworkPolicy/ResourceQuota/LimitRange; `kubeconform` passes on rendered output
- On minikube: root apps sync under the `bootstrap` project (not `default`); a tenant namespace carries the three PSS labels; NetworkPolicies, ResourceQuota, and LimitRange exist in it; Jenkins reaches Healthy; `kubectl auth can-i create configmaps --as=system:serviceaccount:argo-workflows:gitops-workflow-sa -n <other-ns>` returns `no` while the same in `argo-workflows` returns `yes`

**PR 2 (static):**
- `terraform validate` + `tflint --recursive` pass; `terraform plan` if credentials available
- `helm template` + `kubeconform` on the ESO wrapper and ExternalSecret manifests
- AWS apply is post-merge, with documented steps (create Secrets Manager entries → terraform apply → commit role ARN → sync)

**PR 3 (static):**
- `terraform validate` + `tflint --recursive` pass; plan shows only endpoint/SG additions
- ArgoCD values render a valid Ingress via `helm template` with envsubst sample values

## Out of scope (tracked as follow-ups from the review)

Medium findings: ApplicationSet/app-of-apps overlap, production targetRevision pinning, `aws-eks-argocd` remote state, vendored ALB IAM policy, ArgoCD RBAC role scoping. Low findings: workflow image pins, Jenkins plugin pins, self-managed ArgoCD, exec-based provider auth, WAF on the ALB, argocd namespace `enforce: restricted`.
