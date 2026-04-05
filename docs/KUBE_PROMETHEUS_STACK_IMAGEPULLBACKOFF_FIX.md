---
post_title: "Fix: kube-prometheus-stack-local Degraded – Grafana Init Container ImagePullBackOff"
author1: "huyng"
post_slug: "kube-prometheus-stack-imagepullbackoff-fix"
microsoft_alias: "huyng"
featured_image: ""
categories: ["DevOps", "Kubernetes"]
tags: ["argocd", "kube-prometheus-stack", "grafana", "kind", "imagepullbackoff", "local"]
ai_note: true
summary: "Root cause analysis and resolution for the kube-prometheus-stack-local ArgoCD application
 stuck in Degraded state due to a Grafana init container ImagePullBackOff on busybox:1.31.1 in a local Kind cluster."
post_date: "2026-04-05"
---

## Overview

The `kube-prometheus-stack-local` ArgoCD application was in a **Degraded** state despite reporting
`Synced`. All stack components were running except Grafana, whose pod was stuck in
`Init:ImagePullBackOff`.

---

## Symptoms

| Signal | Detail |
|--------|--------|
| ArgoCD app status | `Synced / Degraded` |
| Failing pod | `kube-prometheus-stack-grafana-*` in `monitoring` namespace |
| Pod status | `Init:ImagePullBackOff` |
| Affected container | `init-chmod-data` (init container) |
| Image | `docker.io/library/busybox:1.31.1` |

---

## Root Cause

The Grafana Helm chart uses an `initChownData` init container (image `busybox:1.31.1`) to set
correct filesystem ownership on the Grafana PVC before the main container starts.

The Kind cluster nodes (`desktop-worker`, `desktop-control-plane`) use **containerd** as the
container runtime. The containerd runtime inside the Kind Docker containers was intermittently
failing to pull from Docker Hub, producing the error:

```
Failed to pull image "docker.io/library/busybox:1.31.1":
  failed to pull and unpack image: short read: expected 2080 bytes but got 0: unexpected EOF
```

This is a transient Docker Hub connectivity issue from within the Kind node network — not a
credentials or rate-limit problem. The Docker Desktop daemon on the Windows host was unaffected
and could pull the image successfully.

---

## Resolution

The fix bypasses the in-cluster pull by loading the image directly into the Kind worker node's
containerd image store from the host Docker daemon.

**Step 1 – Pull the image on the host:**

```bash
docker pull busybox:1.31.1
```

**Step 2 – Load the image into the Kind worker node's containerd store:**

```bash
docker save busybox:1.31.1 | docker exec -i desktop-worker ctr images import -
```

**Step 3 – Delete the stuck pod to trigger a restart:**

```bash
kubectl delete pod <grafana-pod-name> -n monitoring
```

The new pod started cleanly: the init container found `busybox:1.31.1` already present in
containerd (`imagePullPolicy: IfNotPresent` behaviour) and did not attempt a remote pull.

**Result:**

```
kube-prometheus-stack-local   Synced   Healthy
```

---

## Verification

```bash
# All pods Running
kubectl get pods -n monitoring

# ArgoCD app Healthy
kubectl get applications kube-prometheus-stack-local -n argocd \
  -o jsonpath='{.status.health.status} / {.status.sync.status}'
# Output: Healthy / Synced
```

---

## Long-Term Recommendation

To prevent recurrence in the local Kind environment, override the `initChownData` image in the
local environment Helm values to either:

1. **Use the Kind registry mirror** (`172.18.0.2`) if it has caching configured for Docker Hub.
2. **Pre-load images during cluster setup** by adding `busybox:1.31.1` to the image pre-load
   script in `ops/deploy-gitops-stacks-local.ps1`.
3. **Set `initChownData.enabled: false`** if the PVC permissions are already correct for the
   Grafana UID (`472`) in the local environment.

Example override in the local Application `helm.values`:

```yaml
grafana:
  initChownData:
    enabled: false   # Skip if PVC fsGroup:472 is already set correctly
```
