---
post_title: "Fix: eck-operator-local, eck-stack-local, fluent-bit-local Stuck in Progressing – ImagePullBackOff on Kind Cluster"
author1: "huyng"
post_slug: "eck-fluent-bit-imagepullbackoff-fix"
microsoft_alias: "huyng"
featured_image: ""
categories: ["DevOps", "Kubernetes"]
tags: ["argocd", "eck", "elasticsearch", "kibana", "fluent-bit", "kind", "imagepullbackoff", "local"]
ai_note: true
summary: "Root cause analysis and resolution for eck-operator-local, eck-stack-local, and fluent-bit-local ArgoCD applications stuck in Progressing state due to ImagePullBackOff errors on a local Kind cluster running inside Docker Desktop."
post_date: "2026-04-05"
---

## Overview

The ArgoCD applications `eck-operator-local`, `eck-stack-local`, and `fluent-bit-local` were all
stuck in **Progressing** health state despite being `Synced`. All underlying pods were in
`ImagePullBackOff` status.

---

## Symptoms

| Signal | Detail |
|--------|--------|
| ArgoCD app status | `Synced / Progressing` |
| Affected apps | `eck-operator-local`, `eck-stack-local`, `fluent-bit-local` |
| Failing pods | `elastic-operator-0` (ns: `elastic-system`), `fluent-bit-*` (ns: `logging`) |
| Pod status | `ImagePullBackOff` |
| Kubelet error | `short read: expected N bytes but got 0: unexpected EOF` |

---

## Root Cause

The cluster is a **Kind** (Kubernetes in Docker) cluster running inside Docker Desktop on Windows.
Kind cluster nodes (`desktop-control-plane`, `desktop-worker`) run as Docker containers using
`kindest/node:v1.34.3` images, each with their own isolated **containerd** runtime.

Images pulled by Docker Desktop (the host daemon) are **not automatically shared** with the
containerd runtime inside Kind nodes. When Kubernetes tried to pull images, the Kind node's
containerd attempted to reach the external registries directly and encountered intermittent
connectivity failures, producing:

```
Failed to pull image "docker.elastic.co/eck/eck-operator:3.3.1":
  short read: expected 493 bytes but got 0: unexpected EOF

Failed to pull image "cr.fluentbit.io/fluent/fluent-bit:4.0.3":
  short read: expected 990 bytes but got 0: unexpected EOF
```

The `short read: unexpected EOF` error is the diagnostic fingerprint of this Kind/Docker Desktop
image isolation issue. It differs from a rate-limit or authentication failure.

Additionally, once ECK operator came online after being fixed, it created new `Elasticsearch`
and `Kibana` pods (from `eck-stack-local`) which also failed for the same reason:

| Image | Registry |
|-------|----------|
| `docker.elastic.co/eck/eck-operator:3.3.1` | Elastic |
| `cr.fluentbit.io/fluent/fluent-bit:4.0.3` | Fluent |
| `docker.elastic.co/elasticsearch/elasticsearch:9.3.0` | Elastic |
| `docker.elastic.co/kibana/kibana:9.3.0` | Elastic |

---

## Resolution

The fix involves manually loading all required images into each Kind node's containerd runtime
using the `k8s.io` namespace (which is the namespace kubelet reads from).

### Step 1 — Pull images on the Docker Desktop host

```powershell
docker pull docker.elastic.co/eck/eck-operator:3.3.1
docker pull cr.fluentbit.io/fluent/fluent-bit:4.0.3
docker pull docker.elastic.co/elasticsearch/elasticsearch:9.3.0
docker pull docker.elastic.co/kibana/kibana:9.3.0
```

### Step 2 — Save images to tar files

```powershell
New-Item -ItemType Directory -Force -Path C:\Temp | Out-Null
docker save docker.elastic.co/eck/eck-operator:3.3.1        -o C:\Temp\eck-operator.tar
docker save cr.fluentbit.io/fluent/fluent-bit:4.0.3         -o C:\Temp\fluent-bit.tar
docker save docker.elastic.co/elasticsearch/elasticsearch:9.3.0 -o C:\Temp\elasticsearch.tar
docker save docker.elastic.co/kibana/kibana:9.3.0           -o C:\Temp\kibana.tar
```

### Step 3 — Copy tars into each Kind node

> **Note:** Use `/kind/` as the target path. The `/tmp/` directory inside Kind nodes is a tmpfs
> mount and files copied there are not visible to subsequent `docker exec` commands.

```powershell
foreach ($node in @("desktop-control-plane", "desktop-worker")) {
    docker cp C:\Temp\eck-operator.tar    "${node}:/kind/eck-operator.tar"
    docker cp C:\Temp\fluent-bit.tar      "${node}:/kind/fluent-bit.tar"
    docker cp C:\Temp\elasticsearch.tar   "${node}:/kind/elasticsearch.tar"
    docker cp C:\Temp\kibana.tar          "${node}:/kind/kibana.tar"
}
```

### Step 4 — Import images into containerd k8s.io namespace

```powershell
foreach ($node in @("desktop-control-plane", "desktop-worker")) {
    docker exec $node ctr --namespace k8s.io images import /kind/eck-operator.tar
    docker exec $node ctr --namespace k8s.io images import /kind/fluent-bit.tar
    docker exec $node ctr --namespace k8s.io images import /kind/elasticsearch.tar
    docker exec $node ctr --namespace k8s.io images import /kind/kibana.tar
}
```

### Step 5 — Verify

```powershell
# Confirm images in containerd
docker exec desktop-worker ctr --namespace k8s.io images ls | grep -E "elastic|fluent|kibana"

# Confirm pods are Running
kubectl get pods -n elastic-system
kubectl get pods -n logging

# Confirm ArgoCD apps are Healthy
kubectl get applications -n argocd eck-operator-local eck-stack-local fluent-bit-local
```

**Expected output:**

```
NAME                 SYNC STATUS   HEALTH STATUS
eck-operator-local   Synced        Healthy
eck-stack-local      Synced        Healthy
fluent-bit-local     Synced        Healthy
```

---

## Key Lessons Learned

### `/tmp` is not usable for `docker cp` in Kind nodes

Kind nodes use a `tmpfs` mount for `/tmp`. Files copied via `docker cp` into `/tmp` are written
to an overlay layer invisible to subsequent `docker exec` shell sessions. Use `/kind/` instead —
it is writable and persistent within the container lifecycle.

### `ctr` requires the `k8s.io` namespace

Running `ctr images import` without `--namespace k8s.io` imports into the default `default`
containerd namespace. Kubelet only reads from the `k8s.io` namespace, so the import will appear
to succeed but kubelet will still fail to find the image.

### ECK operator creates child resources on startup

The `eck-stack-local` ArgoCD app deploys `Elasticsearch` and `Kibana` CRs. The ECK operator
reconciles these and creates pods with images not defined in the Helm chart but instead
resolved dynamically by the operator version. Ensure these images are also pre-loaded.

---

## Recommended Enhancement

Add an image pre-load step to the local deployment script
`ops/deploy-gitops-stacks-local.ps1` to automate this process before deploying ArgoCD apps:

```powershell
function Load-ImageToKindNodes {
    param(
        [string]$Image,
        [string]$TarName,
        [string[]]$Nodes = @("desktop-control-plane", "desktop-worker")
    )

    $tarPath = "C:\Temp\$TarName"
    Write-Host "Pulling $Image..."
    docker pull $Image

    Write-Host "Saving to $tarPath..."
    docker save $Image -o $tarPath

    foreach ($node in $Nodes) {
        Write-Host "Loading into $node..."
        docker cp $tarPath "${node}:/kind/$TarName"
        docker exec $node ctr --namespace k8s.io images import "/kind/$TarName"
    }
    Remove-Item $tarPath -Force
}

# Pre-load all required images
Load-ImageToKindNodes "docker.elastic.co/eck/eck-operator:3.3.1"        "eck-operator.tar"
Load-ImageToKindNodes "cr.fluentbit.io/fluent/fluent-bit:4.0.3"         "fluent-bit.tar"
Load-ImageToKindNodes "docker.elastic.co/elasticsearch/elasticsearch:9.3.0" "elasticsearch.tar"
Load-ImageToKindNodes "docker.elastic.co/kibana/kibana:9.3.0"           "kibana.tar"
```

---

## References

- [Kind: Loading an Image into Your Cluster](https://kind.sigs.k8s.io/docs/user/quick-start/#loading-an-image-into-your-cluster)
- [containerd namespaces](https://github.com/containerd/containerd/blob/main/docs/namespaces.md)
- Related fix: [KUBE_PROMETHEUS_STACK_IMAGEPULLBACKOFF_FIX.md](KUBE_PROMETHEUS_STACK_IMAGEPULLBACKOFF_FIX.md)
