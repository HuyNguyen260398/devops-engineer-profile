---
post_title: "GitOps Local Deploy Script — Implementation Plan"
author1: "DevOps Team"
post_slug: "gitops-local-deploy-script-plan"
microsoft_alias: ""
featured_image: ""
categories: []
tags: ["powershell", "gitops", "argocd", "kubernetes", "local-dev", "automation", "scripting"]
ai_note: "Assisted"
summary: "Implementation plan for deploy-gitops-stacks-local.ps1 — a cross-platform PowerShell script that automates the full local GitOps platform lifecycle: bootstrap, deployment, status checking, and teardown following the GITOPS_LOCAL_DEPLOYMENT_GUIDE."
post_date: "2026-03-15"
---

## GitOps Local Deploy Script — Implementation Plan

This document tracks the design decisions and implementation plan for
`ops/deploy-gitops-stacks-local.ps1`, a cross-platform PowerShell 7 script that
automates the full local GitOps platform lifecycle as described in
[GITOPS_LOCAL_DEPLOYMENT_GUIDE.md](GITOPS_LOCAL_DEPLOYMENT_GUIDE.md).

---

## Output File

```
ops/deploy-gitops-stacks-local.ps1
```

---

## Script Parameters

| Parameter        | Type   | Required | Default  | Description                                         |
| ---------------- | ------ | -------- | -------- | --------------------------------------------------- |
| `GitopsPath`     | string | Yes      | —        | Path to the gitops repo root (`"."` for cwd)        |
| `RepoUrl`        | string | Yes      | —        | Target Git repository URL (used by ArgoCD)          |
| `TargetRevision` | string | No       | `main`   | Branch, tag, or commit SHA for ArgoCD to track      |
| `LogPath`        | string | No       | `"."`    | Directory where the log file is written             |
| `LogLevel`       | string | No       | `info`   | Verbosity: `debug`, `info`, `warn`, `error`         |
| `Action`         | string | No       | `menu`   | `deploy`, `status`, `cleanup`, `menu`               |

All required parameters are validated before any kubectl or helm call. If a required
parameter is missing the script prompts interactively rather than failing silently.

---

## Modules and Functions

### Utility Layer

| Function              | Purpose                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `Write-Log`           | Timestamped, leveled output to console + rotating log file. Respects `LogLevel` filter.       |
| `Confirm-UserInput`   | Validates required parameters; prompts interactively for any that are blank or missing.        |
| `Invoke-CommandSafe`  | Wraps all `kubectl`/`helm` calls, captures stdout/stderr, logs output, throws on non-zero exit. |
| `Wait-ForCondition`   | Polls a kubectl command with configurable timeout and interval; logs each attempt.             |
| `Invoke-EnvSubst`     | Pure-PowerShell `envsubst` fallback for Windows; replaces `$VAR`/`${VAR}` from `$env:*`.      |

### Prerequisite Checks

| Function                  | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `Test-Prerequisites`      | Verifies `kubectl`, `helm`, and `envsubst` (or fallback) are available; logs versions. |
| `Test-ClusterConnectivity`| Runs `kubectl cluster-info` and `kubectl get nodes`; exits gracefully if unreachable. |

### Deployment Functions (Steps 1–5)

Follows the deployment order from the guide:

```
1. ArgoCD                  ← GitOps engine (manual Helm install)
2. AppProjects             ← RBAC scoping for ArgoCD
3. App-of-Apps (infra)     ← kube-prometheus-stack + ECK Operator + eck-stack + fluent-bit
4. App-of-Apps (tenants)   ← Jenkins tenant Applications
5. Jenkins Pool (manual)   ← shared pool bootstrap (pooled-envs)
```

| Function                  | Guide Step | What it does                                                                                 |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `Install-ArgoCD`          | Step 1     | Detects stuck Terminating namespace, applies `argocd/namespace.yaml`, adds Helm repo, runs `helm upgrade --install argocd` |
| `Apply-AppProjects`       | Step 2     | `kubectl apply -f gitops/bootstrap/projects/`                                                |
| `Deploy-Infrastructure`   | Step 3     | Sets env vars, runs `Invoke-EnvSubst` on local app-of-apps-infrastructure, applies to cluster; watches ArgoCD Application rollout |
| `Deploy-Tenants`          | Step 4     | `Invoke-EnvSubst` + applies `gitops/bootstrap/app-of-apps.yaml`                             |
| `Deploy-JenkinsPool`      | Step 5     | `kubectl apply -f gitops/application-plane/local/pooled-envs/pool-1.yaml`                   |
| `Deploy-AllStacks`        | Full       | Orchestrates Steps 1 → 5 in sequence with per-step confirmation prompts                     |

### Status Function

| Function              | Purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `Get-PlatformStatus`  | Runs the full status check from the guide: Applications, namespaces, pod health across `argocd`/`monitoring`/`elastic-system`/`logging`/`pool-1-local`, Elasticsearch health. |

### Cleanup Functions (Steps C1–C6)

Follows the teardown order from the guide (reverse of deployment):

```
C1. Jenkins Pool Application    ← delete first (wave 1 resources)
C2. Tenants App-of-Apps         ← removes Jenkins tenant Applications
C3. Infrastructure App-of-Apps  ← removes kube-prometheus-stack + ELK stack
C4. AppProjects                 ← remove RBAC scoping
C5. ArgoCD                      ← uninstall Helm release
C6. Final sweep                 ← orphaned PVs and optional CRD removal
```

| Function                    | Guide Step | What it does                                                                                  |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `Remove-JenkinsPool`        | C1         | Patches finalizer, deletes pool Application, waits for namespace termination, cleans PVCs     |
| `Remove-TenantsApp`         | C2         | Patches finalizer, deletes app-of-apps, verifies child Applications are gone                 |
| `Remove-InfrastructureApp`  | C3         | Patches finalizer, deletes infra App-of-Apps, deletes `monitoring`/`logging`/`elastic-system` namespaces, cleans PVCs |
| `Remove-AppProjects`        | C4         | `kubectl delete -f gitops/bootstrap/projects/`                                               |
| `Remove-ArgoCD`             | C5         | `helm uninstall argocd`, clears lingering finalizers, deletes namespace                       |
| `Remove-OrphanedResources`  | C6         | Checks for Released/Failed PVs; optionally removes ArgoCD and ECK CRDs                       |
| `Invoke-FullCleanup`        | All        | Orchestrates C1 → C6 with destructive-action warning and per-step confirmation               |

---

## Cross-Platform Compatibility Strategy

- Target **PowerShell 7+** (`pwsh`) which supports Windows, Linux, and macOS identically.
- All filesystem paths constructed with `Join-Path` — no hardcoded separators.
- `$IsWindows` / `$IsLinux` guards used only where OS behaviour differs (e.g., informational
  `open` vs `xdg-open` hints in status output).
- **`envsubst` fallback:** `envsubst` is not available on Windows by default. The script
  tries the system binary first, then falls back to `Invoke-EnvSubst` — a pure-PowerShell
  implementation that replaces `$VAR` and `${VAR}` tokens from `$env:*` variables.

---

## Logging Mechanism

- Log file named `deploy-gitops-<timestamp>.log` written to `LogPath`.
- Every console line is also written to the log file with an ISO-8601 timestamp prefix.
- `LogLevel` controls minimum severity written to the console; the log file always
  captures `DEBUG` and above for post-incident analysis.
- Log rotation is not implemented in v1; the timestamp in the filename provides a
  separate file per run.

---

## Main Orchestration Flow (Happy Path)

```
Main()
  ├── Confirm-UserInput            ← prompt for missing required params
  ├── Test-Prerequisites           ← kubectl, helm, envsubst/fallback present
  ├── Test-ClusterConnectivity     ← kubectl cluster-info + get nodes
  └── Dispatch on -Action
        ├── deploy   → Deploy-AllStacks (Steps 1–5)
        ├── status   → Get-PlatformStatus
        ├── cleanup  → Invoke-FullCleanup (Steps C1–C6)
        └── menu     → Show-MainMenu (interactive numbered menu)
```

### Interactive Menu Options

```
[1] Deploy full stack
[2] Deploy individual step
[3] Check platform status
[4] Cleanup / Teardown
[5] Exit
```

---

## Implementation Checklist

> The detailed, machine-readable implementation plan with phased tasks, requirements,
> risks, and testing criteria is tracked in
> [plan/feature-gitops-local-deploy-script-1.md](../plan/feature-gitops-local-deploy-script-1.md).

- [ ] Script file created at `ops/deploy-gitops-stacks-local.ps1`
- [ ] Parameter block and help documentation
- [ ] `Write-Log` with console + file output
- [ ] `Confirm-UserInput` with interactive prompts
- [ ] `Invoke-CommandSafe` wrapper
- [ ] `Wait-ForCondition` polling helper
- [ ] `Invoke-EnvSubst` PowerShell fallback
- [ ] `Test-Prerequisites` (kubectl, helm, envsubst)
- [ ] `Test-ClusterConnectivity`
- [ ] `Test-GitopsPath`
- [ ] `Install-ArgoCD` (Step 1 — includes stuck namespace recovery)
- [ ] `Apply-AppProjects` (Step 2)
- [ ] `Deploy-Infrastructure` (Step 3 — infra App-of-Apps + rollout watch)
- [ ] `Deploy-Tenants` (Step 4)
- [ ] `Deploy-JenkinsPool` (Step 5)
- [ ] `Deploy-AllStacks` orchestrator
- [ ] `Get-PlatformStatus`
- [ ] `Remove-JenkinsPool` (C1)
- [ ] `Remove-TenantsApp` (C2)
- [ ] `Remove-InfrastructureApp` (C3)
- [ ] `Remove-AppProjects` (C4)
- [ ] `Remove-ArgoCD` (C5)
- [ ] `Remove-OrphanedResources` (C6)
- [ ] `Invoke-FullCleanup` orchestrator
- [ ] `Show-MainMenu` interactive dispatcher
- [ ] `Show-StepMenu` sub-menu for individual steps
- [ ] `Main` entry point
- [ ] Script exit trap handler

---

## References

- [GITOPS_LOCAL_DEPLOYMENT_GUIDE.md](GITOPS_LOCAL_DEPLOYMENT_GUIDE.md) — step-by-step guide this script automates
- [gitops/README.md](../gitops/README.md) — platform architecture and tier strategy overview
- [gitops/bootstrap/local/app-of-apps-infrastructure.yaml](../gitops/bootstrap/local/app-of-apps-infrastructure.yaml) — local-only infra root Application
- [gitops/bootstrap/app-of-apps.yaml](../gitops/bootstrap/app-of-apps.yaml) — tenant root Application
- [gitops/bootstrap/projects/](../gitops/bootstrap/projects/) — AppProject RBAC definitions
- [gitops/application-plane/local/pooled-envs/pool-1.yaml](../gitops/application-plane/local/pooled-envs/pool-1.yaml) — Jenkins shared pool
