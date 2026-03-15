---
goal: "Implement deploy-gitops-stacks-local.ps1 — cross-platform PowerShell 7 script to automate the full local GitOps platform lifecycle"
version: "1.0"
date_created: "2026-03-15"
last_updated: "2026-03-15"
owner: "DevOps Team"
status: "Completed"
tags: ["feature", "automation", "powershell", "gitops", "argocd", "kubernetes", "local-dev"]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Create `ops/deploy-gitops-stacks-local.ps1`, a cross-platform PowerShell 7 script that
automates the full local GitOps platform lifecycle — bootstrap, deployment, status
checking, and teardown — as described in `doc/GITOPS_LOCAL_DEPLOYMENT_GUIDE.md`.

The script must run identically on Windows and Linux (`pwsh`), accept structured
user inputs, enforce prerequisite and cluster health checks before any mutating
operation, emit structured log output to file and console, and expose an interactive
menu alongside direct `‑Action` flags for automation use.

---

## 1. Requirements & Constraints

- **REQ-001**: Script must be named `deploy-gitops-stacks-local.ps1` and placed in `ops/`.
- **REQ-002**: Script must run on **PowerShell 7+** (`pwsh`) on both Windows and Linux.
- **REQ-003**: User must supply `GitopsPath` (repo root) and `RepoUrl` (Git URL) before
  any kubectl/helm operation executes.
- **REQ-004**: `TargetRevision` is optional; must default to `main` when not supplied.
- **REQ-005**: `LogPath` is optional; must default to the current working directory when
  not supplied or when `"."` is passed.
- **REQ-006**: `LogLevel` is optional; must default to `info`. Accepted values:
  `debug`, `info`, `warn`, `error`.
- **REQ-007**: `Action` is optional; must default to `menu` (interactive). Accepted
  values: `deploy`, `status`, `cleanup`, `menu`.
- **REQ-008**: Deployment sequence must follow the exact order in `GITOPS_LOCAL_DEPLOYMENT_GUIDE.md`:
  ArgoCD → AppProjects → Infrastructure App-of-Apps → Tenant App-of-Apps → Jenkins Pool.
- **REQ-009**: Cleanup sequence must follow the reverse teardown order in the guide:
  Jenkins Pool → Tenant App-of-Apps → Infrastructure App-of-Apps → AppProjects → ArgoCD → final sweep.
- **REQ-010**: Every kubectl and helm call must be wrapped; stdout/stderr must be captured
  and written to the log file.
- **REQ-011**: Script must verify cluster connectivity (`kubectl cluster-info`) before
  executing any deployment or cleanup step.
- **REQ-012**: Destructive cleanup operations must display a warning and require explicit
  `y` confirmation before proceeding.
- **SEC-001**: No credentials, tokens, or secrets may be hardcoded or logged in plain text.
- **SEC-002**: `RepoUrl` must be validated as a non-empty string; no shell injection must
  be possible from user-supplied inputs (all values passed as PowerShell variables, never
  interpolated into `Invoke-Expression`).
- **CON-001**: Script must not use `Invoke-Expression` or string-interpolated shell calls
  where user input is substituted directly.
- **CON-002**: `envsubst` is not available by default on Windows; script must fall back to
  a pure-PowerShell implementation.
- **CON-003**: Script must not install missing prerequisites — it must detect, report, and
  exit cleanly if required tools are absent.
- **GUD-001**: All filesystem paths must be constructed with `Join-Path` — no hardcoded
  path separators.
- **GUD-002**: Log file must use ISO-8601 timestamps. Log file name pattern:
  `deploy-gitops-<yyyyMMdd-HHmmss>.log`.
- **GUD-003**: Console log output must use colour coding by level
  (DEBUG=gray, INFO=cyan, WARN=yellow, ERROR=red).
- **GUD-004**: Each deployment function must log its start and completion and call
  `Wait-ForCondition` to confirm readiness before returning.
- **PAT-001**: Deployment and cleanup orchestration must follow the sync-wave ordering
  documented in `gitops/README.md` — wave `-1` (operators) before wave `0` (stacks)
  before wave `1` (collectors/pools).
- **PAT-002**: ArgoCD Application finaliser patches must use `--type=merge` to avoid
  strategic-merge-patch conflicts on CRD resources.

---

## 2. Implementation Steps

### Implementation Phase 1 — Script Foundation

- GOAL-001: Create the script file with parameter block, help documentation, logging
  infrastructure, and core utility functions. No kubectl or helm calls in this phase.

| Task     | Description                                                                                                    | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | Create `ops/deploy-gitops-stacks-local.ps1` with `#Requires -Version 7.0` and `.SYNOPSIS`/`.DESCRIPTION` help | ✅ | 2026-03-15 |
| TASK-002 | Define `param()` block: `GitopsPath`, `RepoUrl`, `TargetRevision`, `LogPath`, `LogLevel`, `Action`            | ✅ | 2026-03-15 |
| TASK-003 | Implement `Write-Log` — accepts `Level` and `Message`; writes timestamped entry to `$script:LogFile` and console with colour coding; respects `$LogLevel` filter for console, writes all levels to file | ✅ | 2026-03-15 |
| TASK-004 | Implement `Confirm-UserInput` — checks `GitopsPath` and `RepoUrl` are non-empty; prompts `Read-Host` for each if blank; resolves `"."` to `(Get-Location).Path`; validates `LogLevel` and `Action` enum values | ✅ | 2026-03-15 |
| TASK-005 | Implement `Invoke-CommandSafe` — takes `[string[]]$Arguments` where index 0 is the executable; runs via `& $exe @rest`; captures combined stdout+stderr; logs DEBUG lines; throws `[System.Exception]` with exit code on failure | ✅ | 2026-03-15 |
| TASK-006 | Implement `Wait-ForCondition` — params: `ScriptBlock`, `TimeoutSeconds`, `IntervalSeconds`, `Description`; polls until scriptblock returns `$true` or timeout; logs each attempt at DEBUG; throws on timeout | ✅ | 2026-03-15 |
| TASK-007 | Implement `Invoke-EnvSubst` — reads template file content; replaces `${VAR}` and `$VAR` patterns using `[System.Environment]::GetEnvironmentVariable`; returns substituted string; does not eval arbitrary code | ✅ | 2026-03-15 |
| TASK-008 | Initialise `$script:LogFile` path at script start using resolved `LogPath` + timestamp filename; create parent directory if it does not exist | ✅ | 2026-03-15 |

### Implementation Phase 2 — Prerequisite and Cluster Checks

- GOAL-002: Implement non-mutating check functions that validate tooling and cluster
  availability. All functions must exit with a clear error message if checks fail.

| Task     | Description                                                                                                                                  | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-009 | Implement `Test-Prerequisites` — checks `kubectl`, `helm` are in `$env:PATH` using `Get-Command -ErrorAction SilentlyContinue`; logs version of each via `kubectl version --client -o yaml` and `helm version --short`; checks for `envsubst` binary and sets `$script:UseNativeEnvSubst` flag; aborts with WARN if envsubst missing (fallback active) | ✅ | 2026-03-15 |
| TASK-010 | Implement `Test-ClusterConnectivity` — calls `Invoke-CommandSafe kubectl cluster-info`; on failure logs ERROR "Kubernetes cluster is not reachable" and exits script with code 1; on success logs cluster server URL at INFO | ✅ | 2026-03-15 |
| TASK-011 | Implement `Test-GitopsPath` — verifies `$GitopsPath` resolves to a directory containing `gitops/bootstrap/argocd/namespace.yaml`; aborts with ERROR if path does not match expected structure | ✅ | 2026-03-15 |

### Implementation Phase 3 — Deployment Functions (Steps 1–5)

- GOAL-003: Implement all five deployment steps from the guide as discrete idempotent
  functions. Each function logs start/end, uses `Invoke-CommandSafe`, and confirms
  readiness via `Wait-ForCondition` before returning.

| Task     | Description                                                                                                                                                                                                  | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-012 | Implement `Install-ArgoCD` — (a) checks namespace status; if `Terminating` clears finalizers on ApplicationSets and Applications using `kubectl patch --type=merge`; waits for deletion; (b) applies `gitops/bootstrap/argocd/namespace.yaml`; (c) runs `helm repo add argo`/`helm repo update`; (d) runs `helm upgrade --install argocd argo/argo-cd --namespace argocd --version 9.4.7 --values values-base.yaml --values values-local.yaml --wait --timeout 10m`; (e) waits for all argocd pods Running | ✅ | 2026-03-15 |
| TASK-013 | Implement `Apply-AppProjects` — calls `Invoke-CommandSafe kubectl apply -f <GitopsPath>/gitops/bootstrap/projects/`; verifies three AppProjects (`infrastructure`, `applications`, `tenants`) exist via `kubectl get appprojects -n argocd` | ✅ | 2026-03-15 |
| TASK-014 | Implement `Deploy-Infrastructure` — (a) sets `$env:GIT_REPO_URL` and `$env:GIT_TARGET_REVISION`; (b) uses `Invoke-EnvSubst` (or native) on `gitops/bootstrap/local/app-of-apps-infrastructure.yaml`; (c) pipes result to `kubectl apply -f -`; (d) waits for Application `app-of-apps-infrastructure-local` to reach `Synced` and `Healthy` via `kubectl get application` every 15s, timeout 600s | ✅ | 2026-03-15 |
| TASK-015 | Implement `Deploy-Tenants` — (a) uses `Invoke-EnvSubst` on `gitops/bootstrap/app-of-apps.yaml`; (b) applies result; (c) waits for Application `app-of-apps-local` Synced+Healthy | ✅ | 2026-03-15 |
| TASK-016 | Implement `Deploy-JenkinsPool` — applies `gitops/application-plane/local/pooled-envs/pool-1.yaml`; waits for pods in `pool-1-local` namespace: at least one pod Running with label `app.kubernetes.io/component=jenkins-controller` | ✅ | 2026-03-15 |
| TASK-017 | Implement `Deploy-AllStacks` — calls TASK-012 through TASK-016 in sequence; between each step logs `"Step N/5 complete"`; on any failure logs ERROR with step name and rethrows | ✅ | 2026-03-15 |

### Implementation Phase 4 — Status and Cleanup Functions

- GOAL-004: Implement platform status reporting and all six cleanup steps. Cleanup
  functions must be individually callable and collectively composed by `Invoke-FullCleanup`.

| Task     | Description                                                                                                                                                                | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-018 | Implement `Get-PlatformStatus` — runs `kubectl get applications -n argocd`, `kubectl get namespaces`, `kubectl get pods -n argocd`, `kubectl get pods -n monitoring`, `kubectl get pods -n elastic-system`, `kubectl get pods -n logging`, `kubectl get pods -n pool-1-local`, `kubectl get elasticsearch -n logging`; writes all output to log at INFO | ✅ | 2026-03-15 |
| TASK-019 | Implement `Remove-JenkinsPool` — (a) patches finalizer on `jenkins-pool-1-local`; (b) deletes Application; (c) `Wait-ForCondition` namespace `pool-1-local` deleted, timeout 120s; (d) deletes orphaned PVCs in namespace if any remain | ✅ | 2026-03-15 |
| TASK-020 | Implement `Remove-TenantsApp` — (a) patches finalizer on `app-of-apps-local`; (b) deletes Application; (c) waits until no Applications with `environment=local` label and name matching `jenkins-` remain | ✅ | 2026-03-15 |
| TASK-021 | Implement `Remove-InfrastructureApp` — (a) patches finalizer on `app-of-apps-infrastructure-local`; (b) deletes Application; (c) waits for cascade; (d) deletes PVCs in `monitoring`; (e) deletes namespace `monitoring` with wait; (f) deletes PVCs in `logging`; (g) deletes namespace `logging` with wait 120s; (h) deletes namespace `elastic-system` with wait 60s | ✅ | 2026-03-15 |
| TASK-022 | Implement `Remove-AppProjects` — calls `kubectl delete -f <GitopsPath>/gitops/bootstrap/projects/`; verifies zero AppProjects remain | ✅ | 2026-03-15 |
| TASK-023 | Implement `Remove-ArgoCD` — (a) calls `helm uninstall argocd --namespace argocd`; (b) clears remaining ApplicationSet and Application finalizers; (c) deletes namespace `argocd`; (d) waits for namespace deletion timeout 60s | ✅ | 2026-03-15 |
| TASK-024 | Implement `Remove-OrphanedResources` — lists PVs in `Released` or `Failed` phase; lists ArgoCD CRDs (`argoproj.io`); lists ECK CRDs (`k8s.elastic.co`); for each category prompts user `y/n` before deletion | ✅ | 2026-03-15 |
| TASK-025 | Implement `Invoke-FullCleanup` — (a) displays destructive warning banner; (b) prompts `y` confirmation; (c) calls TASK-019 through TASK-024 in sequence; logs each step start/end | ✅ | 2026-03-15 |

### Implementation Phase 5 — Orchestration and Entry Point

- GOAL-005: Implement the interactive menu and `Main` entry point that wires all
  components together, dispatches on `‑Action`, and ensures correct initialisation order.

| Task     | Description                                                                                                                                                                       | Completed | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-026 | Implement `Show-MainMenu` — displays numbered menu; reads user choice in a `do…while` loop; dispatches: 1→`Deploy-AllStacks`, 2→sub-menu of individual steps, 3→`Get-PlatformStatus`, 4→`Invoke-FullCleanup`, 5→exit | ✅ | 2026-03-15 |
| TASK-027 | Implement `Show-StepMenu` — sub-menu for individual step selection (steps 1–5 individually) used from option 2 in `Show-MainMenu` | ✅ | 2026-03-15 |
| TASK-028 | Implement `Main` — resolves paths, calls `Confirm-UserInput`, `Test-Prerequisites`, `Test-ClusterConnectivity`, `Test-GitopsPath`, then dispatches on `$Action`: `deploy`→`Deploy-AllStacks`, `status`→`Get-PlatformStatus`, `cleanup`→`Invoke-FullCleanup`, `menu`→`Show-MainMenu` | ✅ | 2026-03-15 |
| TASK-029 | Add script exit handler (`trap`) to log any unhandled exceptions with ERROR level and exit code 1 | ✅ | 2026-03-15 |
| TASK-030 | Call `Main` at bottom of script (outside all function definitions) | ✅ | 2026-03-15 |

---

## 3. Alternatives

- **ALT-001**: **Bash script instead of PowerShell** — rejected because the requirement
  explicitly specifies PowerShell and cross-platform support on Windows without WSL.
- **ALT-002**: **Makefile targets** — rejected; `make` is not universally available on
  Windows and does not satisfy the structured logging or interactive menu requirements.
- **ALT-003**: **Python script** — rejected; adds a Python runtime dependency and
  `subprocess` management of kubectl/helm is more complex than native PowerShell with
  equivalent cross-platform support.
- **ALT-004**: **Native `envsubst` required** — rejected; made optional with fallback to
  keep the script self-contained on Windows without requiring Chocolatey/scoop installs.
- **ALT-005**: **Single monolithic function** — rejected; discrete functions per guide step
  enable individual step execution, testability, and future extension without refactoring.

---

## 4. Dependencies

- **DEP-001**: `kubectl` >= 1.29 in `$env:PATH` — required for all cluster operations.
- **DEP-002**: `helm` >= 3.14 in `$env:PATH` — required for ArgoCD installation.
- **DEP-003**: `envsubst` (optional) — if absent, `Invoke-EnvSubst` PowerShell fallback
  is used automatically.
- **DEP-004**: PowerShell 7+ (`pwsh`) — required runtime; script declares
  `#Requires -Version 7.0`.
- **DEP-005**: A running local Kubernetes cluster (minikube / kind / k3s) with storage
  class `standard` available.
- **DEP-006**: `gitops/bootstrap/argocd/values-base.yaml` and
  `gitops/bootstrap/argocd/values-local.yaml` — Helm values files referenced by
  `Install-ArgoCD`.
- **DEP-007**: `gitops/bootstrap/local/app-of-apps-infrastructure.yaml` — template file
  with `${GIT_REPO_URL}` and `${GIT_TARGET_REVISION}` substitution tokens.
- **DEP-008**: `gitops/bootstrap/app-of-apps.yaml` — tenant root Application template.
- **DEP-009**: `gitops/application-plane/local/pooled-envs/pool-1.yaml` — Jenkins shared
  pool manifest.
- **DEP-010**: `gitops/bootstrap/projects/` directory — contains the three AppProject
  YAML files.

---

## 5. Files

- **FILE-001**: `ops/deploy-gitops-stacks-local.ps1` — **new file** — primary deliverable;
  the cross-platform PowerShell 7 deployment script.
- **FILE-002**: `gitops/bootstrap/argocd/namespace.yaml` — read-only reference; applied
  by `Install-ArgoCD`.
- **FILE-003**: `gitops/bootstrap/argocd/values-base.yaml` — read-only reference; Helm
  values passed to `helm upgrade --install`.
- **FILE-004**: `gitops/bootstrap/argocd/values-local.yaml` — read-only reference; Helm
  values passed to `helm upgrade --install`.
- **FILE-005**: `gitops/bootstrap/local/app-of-apps-infrastructure.yaml` — read-only
  template; processed by `Invoke-EnvSubst` in `Deploy-Infrastructure`.
- **FILE-006**: `gitops/bootstrap/app-of-apps.yaml` — read-only template; processed by
  `Invoke-EnvSubst` in `Deploy-Tenants`.
- **FILE-007**: `gitops/bootstrap/projects/*.yaml` — read-only references; applied by
  `Apply-AppProjects` and deleted by `Remove-AppProjects`.
- **FILE-008**: `gitops/application-plane/local/pooled-envs/pool-1.yaml` — read-only
  reference; applied by `Deploy-JenkinsPool`.
- **FILE-009**: `doc/GITOPS_LOCAL_DEPLOY_SCRIPT_PLAN.md` — design context document
  (updated to reference this plan file).

---

## 6. Testing

- **TEST-001**: Run `Get-Help .\deploy-gitops-stacks-local.ps1 -Full` — verify synopsis,
  parameter descriptions, and examples are present.
- **TEST-002**: Invoke with no parameters — verify script prompts for `GitopsPath` and
  `RepoUrl` interactively via `Read-Host`.
- **TEST-003**: Invoke with invalid `LogLevel` value (e.g., `verbose`) — verify script
  logs a validation error and exits with code 1 without touching the cluster.
- **TEST-004**: Invoke with `RepoUrl` set to a string containing shell metacharacters
  (`; rm -rf /`) — verify the string is passed as a literal variable to kubectl/helm and
  no shell injection occurs.
- **TEST-005**: Invoke `Test-ClusterConnectivity` with no cluster running — verify ERROR
  log entry and exit code 1.
- **TEST-006**: Invoke `-Action status` against a running cluster — verify all six
  namespaces are reported and output is written to log file.
- **TEST-007**: Invoke `-Action deploy` against a clean local cluster — verify all five
  steps complete, all ArgoCD Applications reach `Synced` + `Healthy`, and the log file
  contains timestamped entries for every step.
- **TEST-008**: Invoke `-Action cleanup` after full deploy — verify cleanup warning is
  displayed, all namespaces are removed, no PVCs or orphaned PVs remain, and the log file
  records each teardown step.
- **TEST-009**: Run script on Linux (`pwsh` on Ubuntu) with same parameters as
  TEST-007 — verify identical output and successful deployment (cross-platform validation).
- **TEST-010**: Invoke `Invoke-EnvSubst` directly with a template containing
  `${GIT_REPO_URL}` and `${GIT_TARGET_REVISION}` — verify correct substitution from
  environment variables without executing arbitrary code.

---

## 7. Risks & Assumptions

- **RISK-001**: `Wait-ForCondition` timeout values are calibrated for a typical laptop
  (Docker Desktop, kind). Under-resourced environments may need longer timeouts — expose
  timeout constants as script-level variables so they can be overridden without editing
  function bodies.
- **RISK-002**: ArgoCD Helm chart version is pinned to `9.4.7` in the guide. If the
  upstream chart changes its values schema the `values-local.yaml` overrides may break —
  document the pinned version in the script header and log a WARNING if the installed
  chart version differs.
- **RISK-003**: `Invoke-EnvSubst` uses a simple regex replacement. Templates that contain
  Bash-style parameter expansion (e.g., `${VAR:-default}`) will not be handled correctly —
  the guide templates do not use this syntax, but a comment in the function should warn
  future contributors.
- **RISK-004**: Cascade deletion of ArgoCD Applications depends on the
  `resources-finalizer.argocd.argoproj.io` finalizer. If ArgoCD is already partially
  removed the finalizer processor may not run, leaving child resources orphaned — the
  cleanup functions include fallback namespace deletion after a wait timeout.
- **ASS-001**: The local cluster has the `standard` storage class available. The script
  does not create storage classes; it logs an ERROR and points to the troubleshooting
  section of the guide if PVCs are stuck in `Pending`.
- **ASS-002**: `GIT_REPO_URL` is a publicly accessible HTTPS URL (no SSH key management
  required for local ArgoCD).
- **ASS-003**: The user running the script has sufficient `kubectl` RBAC permissions to
  create and delete namespaces, CRDs, and cluster-scoped resources.
