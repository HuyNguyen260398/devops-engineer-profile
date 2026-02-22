---
post_title: "EKS Node Group CREATE_FAILED — Root Cause Analysis & Fix"
author1: "Huy Ng"
post_slug: "eks-node-group-create-failed-rca"
microsoft_alias: ""
featured_image: ""
categories: ["Infrastructure", "Kubernetes", "Troubleshooting"]
tags: ["eks", "terraform", "vpc-cni", "before_compute", "node-group", "aws", "kubernetes"]
ai_note: "Analysis assisted by GitHub Copilot"
summary: >
  EKS managed node group failed with NodeCreationFailure after 33 minutes due to a circular
  dependency between the vpc-cni/kube-proxy add-ons and the node group lifecycle in
  terraform-aws-modules/eks v21. Root cause, diagnosis steps, fix applied, and re-deployment
  procedure are documented here.
post_date: "2026-02-22"
---

## Overview

| Field | Value |
|---|---|
| **Cluster** | `dep-staging-eks` |
| **Region** | `ap-southeast-1` |
| **Node Group** | `general-20260222085403815500000012` |
| **Instance Types** | `t3.medium` (SPOT) |
| **Error** | `NodeCreationFailure: Unhealthy nodes in the kubernetes cluster` |
| **Failed Instances** | `i-055911596a9d9065f`, `i-0d897a2574704cce4` |
| **Terraform Module** | `terraform-aws-modules/eks/aws` v21.15.1 |
| **Date** | 2026-02-22 |

---

## Error Message

```
Error: waiting for EKS Node Group (dep-staging-eks:general-20260222085403815500000012)
create: unexpected state 'CREATE_FAILED', wanted target 'ACTIVE'.
last error: i-055911596a9d9065f, i-0d897a2574704cce4:
NodeCreationFailure: Unhealthy nodes in the kubernetes cluster

  with module.eks.module.eks_managed_node_group["general"].aws_eks_node_group.this[0],
  on .terraform\modules\eks\modules\eks-managed-node-group\main.tf line 447
```

---

## Root Cause

The failure was caused by a **circular dependency deadlock** between the `vpc-cni` / `kube-proxy`
EKS add-ons and the managed node group, introduced by how
`terraform-aws-modules/eks` **v21** manages add-on lifecycle.

### How the deadlock formed

In module v21, the EKS module provides two separate Terraform resources for add-ons:

| Terraform Resource | `depends_on` | Purpose |
|---|---|---|
| `aws_eks_addon.before_compute` | None — created before node group | Networking add-ons that must run on control plane before nodes join |
| `aws_eks_addon.this` | `depends_on = [module.eks_managed_node_group]` | Add-ons that require healthy nodes (e.g. CoreDNS) |

The add-on is routed to one resource or the other via the `before_compute` flag:

```hcl
# before_compute = false (default) → aws_eks_addon.this (waits for node group)
# before_compute = true            → aws_eks_addon.before_compute (no node dependency)
```

In the original configuration, `before_compute` was **not set** on `vpc-cni` or `kube-proxy`,
so both were placed in `aws_eks_addon.this` — the resource that waits for the node group.

This created the following deadlock:

```
vpc-cni and kube-proxy not installed (waiting on node group)
        │
        ▼
kubelet reports: "cni plugin not initialized"
        │
        ▼
Node status: NotReady
        │
        ▼
EKS: NodeCreationFailure — nodes never become ACTIVE
        │
        ▼
Terraform: node group CREATE_FAILED after 33 min timeout
        │
        ▼
aws_eks_addon.this never runs (depends_on node group that failed)
        │
        └──────────────────────────────────────┐
                                               │ ← circular
vpc-cni and kube-proxy not installed ◄─────────┘
```

### Confirmation from kubectl

```
Conditions:
  Ready   False   KubeletNotReady
          container runtime network not ready: NetworkReady=false
          reason: NetworkPluginNotReady
          message: Network plugin returns error: cni plugin not initialized
```

```
$ aws eks list-addons --cluster-name dep-staging-eks
{
    "addons": []   ← no add-ons were ever installed
}
```

---

## Diagnosis Steps

### 1. Check node group health from AWS

```bash
aws eks describe-nodegroup \
  --cluster-name dep-staging-eks \
  --nodegroup-name general-20260222085403815500000012 \
  --region ap-southeast-1 \
  --query "nodegroup.{Status:status,Health:health}" \
  --output json
```

**Result:** `"Status": "CREATE_FAILED"` with `NodeCreationFailure`.

### 2. Check EC2 instances and EBS volumes

Both instances were `running` with 20 GB `gp3` volumes attached — the instances themselves
were healthy at the OS level, ruling out storage or capacity issues.

### 3. Check node Ready condition via kubectl

```bash
aws eks update-kubeconfig --name dep-staging-eks --region ap-southeast-1
kubectl describe node ip-10-0-11-204.ap-southeast-1.compute.internal
```

Root condition identified: `NetworkPluginNotReady — cni plugin not initialized`.

### 4. Confirm no add-ons were installed

```bash
aws eks list-addons --cluster-name dep-staging-eks --region ap-southeast-1
# → "addons": []
```

### 5. Identify the missing before_compute flag

Cross-referenced the module source at:

```
.terraform/modules/eks/main.tf  line 770 and 813
```

- `aws_eks_addon.this` — default, has `depends_on` on node group.
- `aws_eks_addon.before_compute` — used only when `before_compute = true`.

`vpc-cni` and `kube-proxy` were missing `before_compute = true` and were routed to
the wrong resource, causing the deadlock.

---

## Fix Applied

**File:** [`inf/terraform/aws-eks/main.tf`](../inf/terraform/aws-eks/main.tf)

### Before

```hcl
addons = {
  coredns = {
    most_recent = true
  }
  kube-proxy = {
    most_recent = true
  }
  vpc-cni = {
    most_recent = true
  }
  aws-ebs-csi-driver = var.enable_ebs_csi_driver ? {
    most_recent              = true
    service_account_role_arn = module.ebs_csi_irsa[0].arn
  } : null
}
```

### After

```hcl
addons = {
  coredns = {
    most_recent = true
    # CoreDNS needs schedulable nodes — runs after node group (default).
  }
  kube-proxy = {
    most_recent    = true
    before_compute = true  # Required before nodes join — sets up iptables service routing.
  }
  vpc-cni = {
    most_recent    = true
    before_compute = true  # Required before nodes join — CNI plugin initialises node networking.
  }
  aws-ebs-csi-driver = var.enable_ebs_csi_driver ? {
    most_recent              = true
    service_account_role_arn = module.ebs_csi_irsa[0].arn
  } : null
}
```

### Why CoreDNS stays as default (no before_compute)

CoreDNS runs as a Deployment inside the cluster and **requires schedulable nodes** to run its
pods. It is safe — and correct by design — to install it after nodes are healthy.

---

## Remediation Procedure

### Step 1 — Remove the failed node group from Terraform state

```powershell
terraform state rm `
  "module.eks.module.eks_managed_node_group[`"general`"].aws_eks_node_group.this[0]"
```

This prevents Terraform from treating the `CREATE_FAILED` resource as already managed,
allowing it to create a fresh node group on the next apply.

### Step 2 — Delete the CREATE_FAILED node group from AWS

```bash
aws eks delete-nodegroup \
  --cluster-name dep-staging-eks \
  --nodegroup-name general-20260222085403815500000012 \
  --region ap-southeast-1

aws eks wait nodegroup-deleted \
  --cluster-name dep-staging-eks \
  --nodegroup-name general-20260222085403815500000012 \
  --region ap-southeast-1
```

EKS automatically terminates the two underlying EC2 SPOT instances during deletion.

### Step 3 — Apply the corrected configuration

```bash
cd inf/terraform/aws-eks
terraform apply --var-file environments/staging.tfvars --auto-approve
```

---

## Deployment Result (After Fix)

### Terraform creation order

```
module.eks.aws_eks_addon.before_compute["kube-proxy"]  → created in  10s  ✓
module.eks.aws_eks_addon.before_compute["vpc-cni"]     → created in  14s  ✓
module.eks.eks_managed_node_group["general"]           → ACTIVE in  1m49s ✓
module.eks.aws_eks_addon.this["coredns"]               → created in  14s  ✓
module.eks.aws_eks_addon.this["aws-ebs-csi-driver"]    → created in  45s  ✓
helm_release.cluster_autoscaler                        → deployed   in   7s  ✓
helm_release.metrics_server                            → deployed   in  29s  ✓

Apply complete! Resources: 7 added, 0 changed, 0 destroyed.
```

### Final cluster state

```
NAME                                              STATUS   VERSION
ip-10-0-11-226.ap-southeast-1.compute.internal   Ready    v1.35.0-eks-70ce843
ip-10-0-12-85.ap-southeast-1.compute.internal    Ready    v1.35.0-eks-70ce843
```

```
NAME                                                          READY   STATUS
aws-node-klfwt                                                2/2     Running
aws-node-pcf5g                                                2/2     Running
cluster-autoscaler-aws-cluster-autoscaler-7b446c8dc7-68gm4   1/1     Running
coredns-7487bb5658-kgczd                                      1/1     Running
coredns-7487bb5658-ncqjg                                      1/1     Running
ebs-csi-controller-65d879f5cc-t95k6                           6/6     Running
ebs-csi-controller-65d879f5cc-xnbwp                           6/6     Running
ebs-csi-node-fnp5x                                            3/3     Running
ebs-csi-node-lm8rf                                            3/3     Running
kube-proxy-2bcmx                                              1/1     Running
kube-proxy-s2tmq                                              1/1     Running
metrics-server-8699ccc578-lq5bm                               1/1     Running
```

---

## Lessons Learned

- When upgrading `terraform-aws-modules/eks` from v19/v20 to **v21+**, audit all add-on
  definitions and explicitly set `before_compute = true` on `vpc-cni` and `kube-proxy`.
  These two add-ons are networking primitives — nodes cannot become `Ready` without them.
- `kube-proxy` configures `iptables` rules for `Service` network traffic.
  `vpc-cni` initialises the AWS VPC CNI plugin that assigns pod IPs.
  Both must exist on the control plane side **before** the kubelet on new nodes attempts
  to register with the cluster.
- Add-ons with `before_compute = false` (default) are gated behind a successful node group
  creation. Use this only for workloads that genuinely need running nodes, such as `coredns`.

---

## References

- [terraform-aws-modules/eks — Add-ons documentation](https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/addons.md)
- [AWS EKS — Managing add-ons](https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html)
- [Amazon VPC CNI plugin for Kubernetes](https://docs.aws.amazon.com/eks/latest/userguide/managing-vpc-cni.html)
