#!/usr/bin/env python3
"""
deploy_gitops_stacks_local.py

Automates the full local GitOps platform lifecycle on a local Kubernetes cluster.
Python equivalent of deploy-gitops-stacks-local.ps1

Bootstraps, deploys, reports status on, and tears down the full GitOps platform
(ArgoCD, kube-prometheus-stack, ELK stack, Jenkins, AWX) on a local Kubernetes
cluster (minikube / kind / k3s) following the sequence defined in
doc/GITOPS_LOCAL_DEPLOYMENT_GUIDE.md.

Usage:
    python deploy_gitops_stacks_local.py [options]

Dependencies:
    pip install rich

Arguments:
    --gitops-path     Path to the repository root containing the gitops/ directory
    --repo-url        Full HTTPS URL of the Git repository ArgoCD will track
    --target-revision Branch/tag/SHA ArgoCD will track (default: main)
    --log-path        Directory where log file is written (default: .)
    --log-level       Console log level: debug|info|warn|error (default: info)
    --action          Operation: deploy|status|cleanup|menu (default: menu)

Examples:
    # Interactive menu (default)
    python deploy_gitops_stacks_local.py --gitops-path . --repo-url https://github.com/your-org/repo.git

    # Non-interactive full deploy
    python deploy_gitops_stacks_local.py --gitops-path . --repo-url https://github.com/your-org/repo.git --action deploy

    # Check platform status
    python deploy_gitops_stacks_local.py --gitops-path . --repo-url https://github.com/your-org/repo.git --action status

    # Full teardown with debug logging
    python deploy_gitops_stacks_local.py --gitops-path . --repo-url https://github.com/your-org/repo.git --action cleanup --log-level debug
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

# ── Rich dependency check ────────────────────────────────────────────────────
try:
    from rich.console import Console
    from rich.logging import RichHandler
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.table import Table
    from rich.text import Text
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print(
        "[ERROR] The 'rich' library is required for the CLI interface.\n"
        "Install it with:  pip install rich",
        file=sys.stderr,
    )
    sys.exit(1)

# ============================================================================
# CONSTANTS
# ============================================================================

ARGOCD_CHART_VERSION        = "9.4.7"
ARGOCD_HELM_REPO            = "https://argoproj.github.io/argo-helm"
ARGOCD_NAMESPACE            = "argocd"
MONITORING_NAMESPACE        = "monitoring"
LOGGING_NAMESPACE           = "logging"
ELASTIC_SYSTEM_NAMESPACE    = "elastic-system"
JENKINS_POOL_NAMESPACE      = "pool-1-local"
AWX_NAMESPACE               = "awx"

TIMEOUT_ARGOCD_INSTALL      = 600
TIMEOUT_ARGOCD_NS_DEL       = 60
TIMEOUT_INFRA_SYNC          = 600
TIMEOUT_TENANT_SYNC         = 300
TIMEOUT_JENKINS_POOL        = 300
TIMEOUT_NAMESPACE_DEL       = 120
TIMEOUT_MONITORING_DEL      = 120
TIMEOUT_LOGGING_DEL         = 120
TIMEOUT_ELASTIC_DEL         = 60
TIMEOUT_AWX_DEPLOY          = 600
TIMEOUT_AWX_DEL             = 180

# ============================================================================
# LOGGING SETUP
# ============================================================================

console = Console()

LOG_LEVEL_MAP = {
    "debug": logging.DEBUG,
    "info":  logging.INFO,
    "warn":  logging.WARNING,
    "error": logging.ERROR,
}

LOG_COLORS = {
    "debug": "dim white",
    "info":  "cyan",
    "warn":  "yellow",
    "error": "bold red",
}

# Module-level logger — configured in main()
logger = logging.getLogger("gitops")

_log_file_path: Optional[Path] = None
_console_log_level: str = "info"


def _write_to_file(level: str, message: str) -> None:
    """Append a timestamped log entry to the log file."""
    if _log_file_path is None:
        return
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    entry = f"[{ts}] [{level.upper():<5}] {message}\n"
    try:
        with _log_file_path.open("a", encoding="utf-8") as f:
            f.write(entry)
    except OSError:
        pass  # Never crash on log write failure


def log(level: str, message: str) -> None:
    """
    Write a timestamped, level-tagged message to the console and log file.

    The log file always captures all levels. The console only shows messages
    at or above the configured threshold.
    """
    _write_to_file(level, message)

    threshold = LOG_LEVEL_MAP.get(_console_log_level, logging.INFO)
    msg_level = LOG_LEVEL_MAP.get(level, logging.INFO)
    if msg_level < threshold:
        return

    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    color = LOG_COLORS.get(level, "white")
    tag = level.upper().ljust(5)
    console.print(f"[{ts}] [[{color}]{tag}[/{color}]] {message}")


# Convenience wrappers
def log_debug(msg: str) -> None: log("debug", msg)
def log_info(msg: str)  -> None: log("info",  msg)
def log_warn(msg: str)  -> None: log("warn",  msg)
def log_error(msg: str) -> None: log("error", msg)


# ============================================================================
# PHASE 1 — UTILITY LAYER
# ============================================================================

def run_command(args: list[str], check: bool = True) -> str:
    """
    Run an external command, capture output, log it, and raise on failure.

    Parameters
    ----------
    args  : list where args[0] is the executable and the rest are arguments.
    check : if True, raises CalledProcessError on non-zero exit.

    Returns
    -------
    Combined stdout+stderr of the command as a string.
    """
    if not args:
        raise ValueError("run_command: args list must not be empty.")

    log_debug(f"CMD: {' '.join(args)}")

    try:
        result = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    except FileNotFoundError:
        raise RuntimeError(
            f"Executable not found: '{args[0]}'. Ensure it is installed and in PATH."
        )

    for line in result.stdout.splitlines():
        log_debug(f"  OUT: {line}")

    if check and result.returncode != 0:
        raise RuntimeError(
            f"Command '{args[0]}' exited with code {result.returncode}.\n{result.stdout}"
        )

    return result.stdout.strip()


def wait_for_condition(
    condition: Callable[[], bool],
    timeout_seconds: int,
    interval_seconds: int = 10,
    description: str = "condition",
) -> None:
    """
    Poll *condition* every *interval_seconds* until it returns True or timeout.

    Raises RuntimeError on timeout.
    """
    log_info(f"Waiting for: {description} (timeout {timeout_seconds}s)")
    deadline = time.monotonic() + timeout_seconds
    attempt = 0

    while time.monotonic() < deadline:
        attempt += 1
        try:
            if condition():
                log_info(f"  [OK] {description} — satisfied after attempt {attempt}")
                return
        except Exception as exc:
            log_debug(f"  [POLL {attempt}] {description} — error: {exc}")

        log_debug(
            f"  [POLL {attempt}] {description} — not yet satisfied, "
            f"retrying in {interval_seconds}s"
        )
        time.sleep(interval_seconds)

    raise RuntimeError(
        f"Timeout waiting for: {description} ({timeout_seconds}s elapsed)"
    )


def envsubst(template_path: Path) -> str:
    """
    Pure-Python envsubst: replaces ${VAR} and $VAR tokens with values from
    the current process environment. Unknown tokens are left unchanged.

    Only simple $VAR and ${VAR} forms are supported (no Bash parameter expansion).
    """
    content = template_path.read_text(encoding="utf-8")

    # Replace ${VAR} form
    def replace_braced(m: re.Match) -> str:
        val = os.environ.get(m.group(1))
        return val if val is not None else m.group(0)

    content = re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}", replace_braced, content)

    # Replace bare $VAR form (skip common literals)
    _skip = {"true", "false", "null"}

    def replace_bare(m: re.Match) -> str:
        name = m.group(1)
        if name.lower() in _skip:
            return m.group(0)
        val = os.environ.get(name)
        return val if val is not None else m.group(0)

    content = re.sub(r"\$([A-Za-z_][A-Za-z0-9_]*)", replace_bare, content)
    return content


def envsubst_apply(template_path: Path) -> None:
    """
    Run envsubst on *template_path* and pipe the result to kubectl apply.
    Prefers the native envsubst binary; falls back to the pure-Python version.
    """
    log_info(f"Applying (envsubst): {template_path}")

    substituted = envsubst(template_path)

    proc = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=substituted,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    for line in proc.stdout.splitlines():
        log_debug(f"  OUT: {line}")
    if proc.returncode != 0:
        raise RuntimeError(
            f"kubectl apply failed for template: {template_path} "
            f"(exit {proc.returncode})\n{proc.stdout}"
        )


# ============================================================================
# GLOBAL STATE
# ============================================================================

_repo_root: Optional[Path] = None
_repo_url: str = ""
_target_revision: str = "main"

# Port-forward processes: name → subprocess.Popen
_port_forward_procs: dict[str, subprocess.Popen] = {}


# ============================================================================
# PHASE 2 — PREREQUISITE AND CLUSTER CHECKS
# ============================================================================

def check_prerequisites() -> None:
    """Verify kubectl and helm are in PATH; log their versions."""
    log_info("--- Checking prerequisites ---")

    # kubectl
    if not _which("kubectl"):
        raise RuntimeError(
            "kubectl not found in PATH. Install kubectl >= 1.29 before running this script."
        )
    kt_ver = run_command(["kubectl", "version", "--client", "--output=yaml"])
    match = re.search(r"gitVersion:\s*(\S+)", kt_ver)
    log_info(f"  kubectl : {match.group(1) if match else kt_ver.splitlines()[0]}")

    # helm
    if not _which("helm"):
        raise RuntimeError(
            "helm not found in PATH. Install helm >= 3.14 before running this script."
        )
    hm_ver = run_command(["helm", "version", "--short"])
    log_info(f"  helm    : {hm_ver}")

    log_info("--- Prerequisites OK ---")


def check_cluster_connectivity() -> None:
    """Verify the local Kubernetes cluster is reachable."""
    log_info("--- Checking cluster connectivity ---")
    try:
        log_debug("CMD: kubectl cluster-info")
        result = subprocess.run(
            ["kubectl", "cluster-info"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"kubectl cluster-info exited with code {result.returncode}.\n{result.stdout}"
            )
        for line in result.stdout.splitlines():
            if "control plane" in line.lower():
                log_info(f"  {line.strip()}")
                break

        nodes = run_command(["kubectl", "get", "nodes", "--no-headers"])
        node_count = len([l for l in nodes.splitlines() if l.strip()])
        log_info(f"  Nodes ready: {node_count}")
    except Exception as exc:
        log_error(f"Kubernetes cluster is not reachable: {exc}")
        log_error(
            "Ensure your local cluster (minikube/kind/k3s) is running "
            "and kubectl context is set correctly."
        )
        sys.exit(1)

    log_info("--- Cluster connectivity OK ---")


def check_gitops_path() -> None:
    """Confirm the resolved repo root contains the expected gitops directory structure."""
    log_info(f"--- Validating GitOps path: {_repo_root} ---")
    marker = _repo_root / "gitops" / "bootstrap" / "argocd" / "namespace.yaml"
    if not marker.exists():
        raise RuntimeError(
            f"GitopsPath '{_repo_root}' does not appear to be the repository root. "
            f"Expected to find: {marker}"
        )
    log_info("--- GitOps path OK ---")


# ============================================================================
# PHASE 3 — DEPLOYMENT FUNCTIONS (Steps 1–5)
# ============================================================================

def _clear_argocd_finalizers() -> None:
    """Remove finalizers from all ArgoCD ApplicationSets and Applications."""
    log_warn("Clearing ArgoCD finalizers to unblock stuck namespace...")

    for resource_type in ("applicationsets", "applications"):
        try:
            out = run_command(
                ["kubectl", "get", resource_type, "-n", ARGOCD_NAMESPACE, "-o", "name"],
                check=False,
            )
            for resource in out.splitlines():
                resource = resource.strip()
                if not resource:
                    continue
                log_debug(f"  Patching finalizer on {resource_type[:-1]}: {resource}")
                subprocess.run(
                    [
                        "kubectl", "patch", resource,
                        "-n", ARGOCD_NAMESPACE,
                        "--type=merge",
                        "-p", '{"metadata":{"finalizers":[]}}',
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
        except Exception as exc:
            log_debug(f"  No {resource_type} to patch (or already gone): {exc}")


def install_argocd() -> None:
    """Step 1 — Install ArgoCD via Helm."""
    log_info("====== Step 1/5: Install ArgoCD ======")

    ns_file     = _repo_root / "gitops" / "bootstrap" / "argocd" / "namespace.yaml"
    values_base = _repo_root / "gitops" / "bootstrap" / "argocd" / "values-base.yaml"
    values_local= _repo_root / "gitops" / "bootstrap" / "argocd" / "values-local.yaml"

    # Check for stuck Terminating namespace
    try:
        ns_status = run_command(
            [
                "kubectl", "get", "namespace", ARGOCD_NAMESPACE,
                "--no-headers", "-o", "custom-columns=STATUS:.status.phase",
            ]
        )
        if "Terminating" in ns_status:
            log_warn(
                f"Namespace '{ARGOCD_NAMESPACE}' is stuck in Terminating state. "
                "Attempting recovery..."
            )
            _clear_argocd_finalizers()
            wait_for_condition(
                description=f"namespace {ARGOCD_NAMESPACE} deleted",
                timeout_seconds=TIMEOUT_ARGOCD_NS_DEL,
                interval_seconds=5,
                condition=lambda: _namespace_gone(ARGOCD_NAMESPACE),
            )
            log_info(f"Namespace '{ARGOCD_NAMESPACE}' removed. Proceeding with fresh install.")
        else:
            log_debug(f"Namespace '{ARGOCD_NAMESPACE}' status: {ns_status}")
    except Exception:
        log_debug(f"Namespace '{ARGOCD_NAMESPACE}' does not exist yet — will be created.")

    # Apply namespace manifest
    log_info("  1a. Applying ArgoCD namespace manifest...")
    run_command(["kubectl", "apply", "-f", str(ns_file)])

    # Add / update Helm repo
    log_info("  1b. Adding Argo Helm repository...")
    run_command(["helm", "repo", "add", "argo", ARGOCD_HELM_REPO])
    run_command(["helm", "repo", "update", "argo"])

    # Install or upgrade ArgoCD
    log_info(f"  1c. Installing ArgoCD (chart version {ARGOCD_CHART_VERSION})...")
    run_command([
        "helm", "upgrade", "--install", "argocd", "argo/argo-cd",
        "--namespace", ARGOCD_NAMESPACE,
        "--version", ARGOCD_CHART_VERSION,
        "--values", str(values_base),
        "--values", str(values_local),
        "--wait",
        "--timeout", "10m",
    ])

    # Wait for all ArgoCD pods Running
    log_info("  1d. Waiting for ArgoCD pods to be Running...")
    wait_for_condition(
        description="ArgoCD pods Running",
        timeout_seconds=TIMEOUT_ARGOCD_INSTALL,
        interval_seconds=15,
        condition=lambda: _all_pods_running(ARGOCD_NAMESPACE),
    )

    log_info("====== Step 1/5 COMPLETE: ArgoCD installed ======")
    log_info(
        "  ArgoCD UI     : http://localhost:30080  "
        "(admin / run: kubectl get secret argocd-initial-admin-secret "
        "-n argocd -o jsonpath='{.data.password}' | base64 -d)"
    )
    log_info("  kind+WSL2     : kubectl port-forward svc/argocd-server -n argocd 30080:80")


def apply_app_projects() -> None:
    """Step 2 — Apply the three ArgoCD AppProject manifests."""
    log_info("====== Step 2/5: Apply ArgoCD AppProjects ======")

    projects_dir = _repo_root / "gitops" / "bootstrap" / "projects"
    run_command(["kubectl", "apply", "-f", str(projects_dir)])

    expected = {"infrastructure", "applications", "tenants"}

    def projects_created() -> bool:
        found = run_command(
            [
                "kubectl", "get", "appprojects",
                "-n", ARGOCD_NAMESPACE,
                "--no-headers", "-o", "custom-columns=NAME:.metadata.name",
            ]
        )
        return all(p in found for p in expected)

    wait_for_condition(
        description="AppProjects created",
        timeout_seconds=30,
        interval_seconds=5,
        condition=projects_created,
    )
    log_info("====== Step 2/5 COMPLETE: AppProjects applied ======")


def deploy_infrastructure() -> None:
    """Step 3 — Apply the local infrastructure App-of-Apps."""
    log_info("====== Step 3/5: Deploy Infrastructure App-of-Apps ======")

    template_file = _repo_root / "gitops" / "bootstrap" / "local" / "app-of-apps-infrastructure.yaml"

    os.environ["GIT_REPO_URL"]        = _repo_url
    os.environ["GIT_TARGET_REVISION"] = _target_revision

    log_info(f"  Repo URL      : {_repo_url}")
    log_info(f"  Target Rev    : {_target_revision}")

    envsubst_apply(template_file)

    log_info("  Waiting for app-of-apps-infrastructure-local Synced + Healthy...")
    wait_for_condition(
        description="app-of-apps-infrastructure-local Synced+Healthy",
        timeout_seconds=TIMEOUT_INFRA_SYNC,
        interval_seconds=20,
        condition=lambda: _app_synced_healthy("app-of-apps-infrastructure-local"),
    )

    log_info("  Infrastructure Applications deployed and syncing. Full stack rollout may take several minutes.")
    log_info(f"  Monitor: kubectl get pods -n {MONITORING_NAMESPACE} -w")
    log_info(f"  Monitor: kubectl get pods -n {LOGGING_NAMESPACE} -w")
    log_info("  kind+WSL2 — Grafana : kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 32300:80")
    log_info("  kind+WSL2 — Kibana  : kubectl port-forward -n logging svc/kibana-kb-http 32601:5601")
    log_info("====== Step 3/5 COMPLETE: Infrastructure App-of-Apps applied ======")


def deploy_awx_operator() -> None:
    """Deploy the AWX Operator ArgoCD Application directly."""
    log_info("====== Deploy AWX Operator App ======")

    # Preflight: ArgoCD CRDs must exist
    log_info("  Checking ArgoCD CRDs are installed...")
    result = subprocess.run(
        ["kubectl", "get", "crd", "applications.argoproj.io"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "ArgoCD CRDs not found (applications.argoproj.io). "
            "Install ArgoCD first (Step 1 / menu option 1) before deploying the AWX Operator."
        )
    log_info("  ArgoCD CRDs present — proceeding.")

    # Preflight: argocd namespace must exist
    ns_result = subprocess.run(
        ["kubectl", "get", "namespace", ARGOCD_NAMESPACE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if ns_result.returncode != 0:
        raise RuntimeError(
            f"Namespace '{ARGOCD_NAMESPACE}' not found. "
            "Install ArgoCD first (Step 1 / menu option 1) before deploying the AWX Operator."
        )

    awx_file = _repo_root / "gitops" / "application-plane" / "local" / "infrastructure" / "awx-operator.yaml"
    run_command(["kubectl", "apply", "-f", str(awx_file)])

    log_info("  Waiting for awx-operator-local Synced + Healthy...")
    wait_for_condition(
        description="awx-operator-local Synced+Healthy",
        timeout_seconds=TIMEOUT_AWX_DEPLOY,
        interval_seconds=30,
        condition=lambda: _app_synced_healthy("awx-operator-local"),
    )

    log_info("====== AWX Operator App COMPLETE ======")
    log_info("  AWX UI         : http://localhost:32080")
    log_info(
        f"  Admin password : kubectl get secret awx-admin-password -n {AWX_NAMESPACE} "
        "-o jsonpath='{.data.password}' | base64 -d"
    )
    log_info("  kind+WSL2      : kubectl port-forward -n awx svc/awx-service 32080:80")


def deploy_tenants() -> None:
    """Step 4 — Apply the tenant App-of-Apps."""
    log_info("====== Step 4/5: Deploy Tenant App-of-Apps ======")

    template_file = _repo_root / "gitops" / "bootstrap" / "app-of-apps.yaml"

    os.environ["GIT_REPO_URL"]        = _repo_url
    os.environ["GIT_TARGET_REVISION"] = _target_revision

    envsubst_apply(template_file)

    wait_for_condition(
        description="app-of-apps-local Synced+Healthy",
        timeout_seconds=TIMEOUT_TENANT_SYNC,
        interval_seconds=15,
        condition=lambda: _app_synced_healthy("app-of-apps-local"),
    )
    log_info("====== Step 4/5 COMPLETE: Tenant App-of-Apps applied ======")


def deploy_jenkins_pool() -> None:
    """Step 5 — Apply the Jenkins shared pool Application."""
    log_info("====== Step 5/5: Deploy Jenkins Shared Pool ======")

    pool_file = _repo_root / "gitops" / "application-plane" / "local" / "pooled-envs" / "pool-1.yaml"
    run_command(["kubectl", "apply", "-f", str(pool_file)])

    log_info("  Waiting for Jenkins pool controller pod to be Running...")
    wait_for_condition(
        description="Jenkins pool controller Running",
        timeout_seconds=TIMEOUT_JENKINS_POOL,
        interval_seconds=20,
        condition=lambda: _jenkins_pool_running(),
    )

    log_info("====== Step 5/5 COMPLETE: Jenkins Pool deployed ======")
    log_info("  Jenkins Pool-1 : http://localhost:32000")
    log_info("  Jenkins Basic  : http://localhost:32001")
    log_info("  kind+WSL2 — Pool-1: kubectl port-forward -n pool-1-local svc/jenkins-pool-1 32000:8080")
    log_info("  kind+WSL2 — Basic : kubectl port-forward -n pool-1-local svc/jenkins-basic-local 32001:8080")


def deploy_all_stacks() -> None:
    """Orchestrate the full deployment sequence: Steps 1–5 in order."""
    log_info("########## DEPLOY: Full GitOps Stack ##########")

    steps = [
        ("Install ArgoCD",        install_argocd),
        ("Apply AppProjects",     apply_app_projects),
        ("Deploy Infrastructure", deploy_infrastructure),
        ("Deploy Tenants",        deploy_tenants),
        ("Deploy Jenkins Pool",   deploy_jenkins_pool),
    ]

    for i, (name, fn) in enumerate(steps, start=1):
        log_info(f"--- Step {i}/{len(steps)}: {name} ---")
        try:
            fn()
            log_info(f"--- Step {i}/{len(steps)} COMPLETE: {name} ---")
        except Exception as exc:
            log_error(f"--- Step {i}/{len(steps)} FAILED: {name} ---")
            log_error(f"Error: {exc}")
            raise

    log_info("########## DEPLOY COMPLETE ##########")
    get_platform_status()
    log_info("Starting port-forwards for kind + WSL2 access...")
    start_all_port_forwards()


# ============================================================================
# PHASE 4 — STATUS AND CLEANUP FUNCTIONS
# ============================================================================

def get_platform_status() -> None:
    """Print and log the health of all platform components."""
    log_info("====== Platform Status ======")

    checks = [
        ("ArgoCD Applications",
         ["kubectl", "get", "applications", "-n", ARGOCD_NAMESPACE]),
        ("Namespaces (platform)",
         ["kubectl", "get", "namespaces"]),
        (f"Pods ({ARGOCD_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", ARGOCD_NAMESPACE]),
        (f"Pods ({MONITORING_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", MONITORING_NAMESPACE]),
        (f"Pods ({ELASTIC_SYSTEM_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", ELASTIC_SYSTEM_NAMESPACE]),
        (f"Pods ({LOGGING_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", LOGGING_NAMESPACE]),
        (f"Pods ({JENKINS_POOL_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", JENKINS_POOL_NAMESPACE]),
        ("Elasticsearch health",
         ["kubectl", "get", "elasticsearch", "-n", LOGGING_NAMESPACE]),
        (f"Pods ({AWX_NAMESPACE})",
         ["kubectl", "get", "pods", "-n", AWX_NAMESPACE]),
        ("AWX instances",
         ["kubectl", "get", "awx", "-n", AWX_NAMESPACE]),
    ]

    for label, cmd in checks:
        log_info(f"  -- {label} --")
        try:
            out = run_command(cmd)
            for line in out.splitlines():
                log_info(f"    {line}")
        except Exception as exc:
            log_warn(f"    Could not retrieve {label}: {exc}")

    log_info("====== Status check complete ======")


def _remove_app_with_finalizer(app_name: str) -> None:
    """Patch the resource-finalizer onto *app_name* then delete it."""
    try:
        run_command([
            "kubectl", "patch", "application", app_name,
            "-n", ARGOCD_NAMESPACE,
            "--type=merge",
            "-p", '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}',
        ])
        run_command([
            "kubectl", "delete", "application", app_name,
            "-n", ARGOCD_NAMESPACE,
        ])
    except Exception as exc:
        log_warn(f"  {app_name} Application may not exist: {exc}")


def remove_jenkins_pool() -> None:
    """Cleanup C1 — Remove Jenkins pool Application and namespace."""
    log_info("====== Cleanup C1: Remove Jenkins Pool ======")

    _remove_app_with_finalizer("jenkins-pool-1-local")

    log_info(f"  Waiting for ArgoCD cascade deletion to clear {JENKINS_POOL_NAMESPACE} pods (30s)...")
    time.sleep(30)

    _delete_pvcs(JENKINS_POOL_NAMESPACE)
    _delete_namespace(JENKINS_POOL_NAMESPACE, timeout=TIMEOUT_NAMESPACE_DEL)

    log_info("====== Cleanup C1 COMPLETE ======")


def remove_tenants_app() -> None:
    """Cleanup C2 — Remove tenant App-of-Apps and wait for child Applications."""
    log_info("====== Cleanup C2: Remove Tenant App-of-Apps ======")

    _remove_app_with_finalizer("app-of-apps-local")

    def jenkins_apps_gone() -> bool:
        apps = run_command([
            "kubectl", "get", "applications",
            "-n", ARGOCD_NAMESPACE,
            "--no-headers",
            "-o", "custom-columns=NAME:.metadata.name",
        ])
        remaining = [l for l in apps.splitlines() if re.search(r"jenkins-.*-local", l)]
        return len(remaining) == 0

    wait_for_condition(
        description="Jenkins tenant Applications removed",
        timeout_seconds=120,
        interval_seconds=10,
        condition=jenkins_apps_gone,
    )
    log_info("====== Cleanup C2 COMPLETE ======")


def remove_infrastructure_app() -> None:
    """Cleanup C3 — Remove infrastructure App-of-Apps and platform namespaces."""
    log_info("====== Cleanup C3: Remove Infrastructure App-of-Apps ======")

    _remove_app_with_finalizer("app-of-apps-infrastructure-local")

    log_info("  Waiting for ArgoCD cascade deletion to propagate (30s)...")
    time.sleep(30)

    for ns, timeout in [
        (MONITORING_NAMESPACE,     TIMEOUT_MONITORING_DEL),
        (LOGGING_NAMESPACE,        TIMEOUT_LOGGING_DEL),
        (ELASTIC_SYSTEM_NAMESPACE, TIMEOUT_ELASTIC_DEL),
    ]:
        log_info(f"  Cleaning up namespace: {ns}")
        _delete_pvcs(ns)
        _delete_namespace(ns, timeout=timeout)

    log_info("====== Cleanup C3 COMPLETE ======")


def remove_awx_app() -> None:
    """Cleanup C3b — Remove AWX Operator Application and awx namespace."""
    log_info("====== Cleanup C3b: Remove AWX Operator App ======")

    _remove_app_with_finalizer("awx-operator-local")

    log_info("  Waiting for ArgoCD cascade deletion to propagate (30s)...")
    time.sleep(30)

    _delete_pvcs(AWX_NAMESPACE)
    _delete_namespace(AWX_NAMESPACE, timeout=TIMEOUT_AWX_DEL)

    log_info("====== Cleanup C3b COMPLETE ======")


def remove_app_projects() -> None:
    """Cleanup C4 — Delete the three ArgoCD AppProject manifests."""
    log_info("====== Cleanup C4: Remove AppProjects ======")

    projects_dir = _repo_root / "gitops" / "bootstrap" / "projects"
    try:
        run_command(["kubectl", "delete", "-f", str(projects_dir)])
    except Exception as exc:
        log_warn(f"  AppProjects may already be absent: {exc}")

    def projects_gone() -> bool:
        out = run_command([
            "kubectl", "get", "appprojects",
            "-n", ARGOCD_NAMESPACE, "--no-headers",
        ])
        remaining = [l for l in out.splitlines() if l.strip() and "default" not in l]
        return len(remaining) == 0

    wait_for_condition(
        description="AppProjects removed",
        timeout_seconds=60,
        interval_seconds=5,
        condition=projects_gone,
    )
    log_info("====== Cleanup C4 COMPLETE ======")


def remove_argocd() -> None:
    """Cleanup C5 — Uninstall the ArgoCD Helm release and delete the namespace."""
    log_info("====== Cleanup C5: Uninstall ArgoCD ======")

    try:
        run_command(["helm", "uninstall", "argocd", "--namespace", ARGOCD_NAMESPACE])
    except Exception as exc:
        log_warn(f"  ArgoCD Helm release may not be installed: {exc}")

    _clear_argocd_finalizers()

    try:
        run_command(["kubectl", "delete", "namespace", ARGOCD_NAMESPACE, "--ignore-not-found"])
        wait_for_condition(
            description=f"namespace {ARGOCD_NAMESPACE} removed",
            timeout_seconds=TIMEOUT_ARGOCD_NS_DEL,
            interval_seconds=5,
            condition=lambda: _namespace_gone(ARGOCD_NAMESPACE),
        )
    except Exception as exc:
        log_warn(f"  Could not cleanly delete argocd namespace: {exc}")

    log_info("====== Cleanup C5 COMPLETE ======")


def remove_orphaned_resources() -> None:
    """Cleanup C6 — Interactively remove orphaned PVs and optional CRDs."""
    log_info("====== Cleanup C6: Orphaned Resources & Optional CRD Removal ======")

    # Orphaned PVs
    try:
        pv_out = run_command(["kubectl", "get", "pv", "--no-headers"])
        orphaned = [l for l in pv_out.splitlines() if re.search(r"Released|Failed", l)]
        if orphaned:
            log_warn(f"  Found {len(orphaned)} orphaned PersistentVolume(s):")
            for line in orphaned:
                log_warn(f"    {line}")
            if Confirm.ask("  Delete these PersistentVolumes?", default=False):
                for line in orphaned:
                    pv_name = line.split()[0]
                    log_info(f"  Deleting PV: {pv_name}")
                    subprocess.run(
                        ["kubectl", "delete", "pv", pv_name],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
            else:
                log_info("  Skipping PV deletion.")
        else:
            log_info("  No orphaned PersistentVolumes found.")
    except Exception as exc:
        log_warn(f"  Could not check PVs: {exc}")

    # Optional CRD removal
    crd_groups = [
        ("ArgoCD",  r"argoproj\.io"),
        ("ECK",     r"k8s\.elastic\.co"),
        ("AWX",     r"ansible\.com"),
    ]
    for label, pattern in crd_groups:
        try:
            crd_out = run_command([
                "kubectl", "get", "crd",
                "--no-headers", "-o", "custom-columns=NAME:.metadata.name",
            ])
            crds = [l for l in crd_out.splitlines() if re.search(pattern, l)]
            if crds:
                log_info(f"  {label} CRDs found: {', '.join(crds)}")
                if Confirm.ask(
                    f"  Remove {label} CRDs? (safe to leave if re-installing soon)",
                    default=False,
                ):
                    for crd in crds:
                        subprocess.run(
                            ["kubectl", "delete", "crd", crd],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        log_info(f"  Deleted CRD: {crd}")
                else:
                    log_info(f"  Skipping {label} CRD deletion.")
            else:
                log_info(f"  No {label} CRDs found.")
        except Exception as exc:
            log_warn(f"  Could not check {label} CRDs: {exc}")

    log_info("====== Cleanup C6 COMPLETE ======")


def full_cleanup() -> None:
    """Orchestrate the full teardown sequence: Cleanup C1–C6 in order."""
    console.print()
    console.print(Panel(
        Text.assemble(
            ("  This will permanently delete ALL platform resources:\n", "bold red"),
            ("    • Jenkins workloads and jobs\n", "red"),
            ("    • Prometheus metrics (all history)\n", "red"),
            ("    • Elasticsearch indexes (all logs)\n", "red"),
            ("    • AWX jobs, inventories, and credentials\n", "red"),
            ("    • ArgoCD Applications and configuration\n", "red"),
            ("    • All GitOps platform namespaces\n\n", "red"),
            ("  There is NO rollback.", "bold red"),
        ),
        title="[bold red]⚠  DESTRUCTIVE OPERATION WARNING  ⚠[/bold red]",
        border_style="red",
    ))

    answer = Prompt.ask(
        'Type "y" to proceed with full cleanup, or anything else to abort'
    )
    if answer.lower() != "y":
        log_info("Cleanup aborted by user.")
        return

    stop_all_port_forwards()

    log_info("########## CLEANUP: Full GitOps Stack Teardown ##########")

    steps = [
        ("Remove Jenkins Pool",        remove_jenkins_pool),
        ("Remove Tenant App-of-Apps",  remove_tenants_app),
        ("Remove Infrastructure App",  remove_infrastructure_app),
        ("Remove AWX App",             remove_awx_app),
        ("Remove AppProjects",         remove_app_projects),
        ("Uninstall ArgoCD",           remove_argocd),
        ("Remove Orphaned Resources",  remove_orphaned_resources),
    ]

    for i, (name, fn) in enumerate(steps, start=1):
        log_info(f"--- Cleanup {i}/{len(steps)}: {name} ---")
        try:
            fn()
            log_info(f"--- Cleanup {i}/{len(steps)} COMPLETE: {name} ---")
        except Exception as exc:
            log_error(f"--- Cleanup {i}/{len(steps)} FAILED: {name} ---")
            log_error(f"Error: {exc}")
            log_warn("Continuing with remaining cleanup steps...")

    log_info("########## CLEANUP COMPLETE ##########")

    # Final verification
    log_info("--- Final cleanup verification ---")
    for ns in [
        ARGOCD_NAMESPACE, MONITORING_NAMESPACE, ELASTIC_SYSTEM_NAMESPACE,
        LOGGING_NAMESPACE, JENKINS_POOL_NAMESPACE, AWX_NAMESPACE,
    ]:
        if _namespace_gone(ns):
            log_info(f"  [GONE] namespace/{ns}")
        else:
            log_warn(f"  [STILL EXISTS] namespace/{ns} — may need manual intervention")


# ============================================================================
# PHASE 5a — PORT-FORWARD MANAGEMENT
# ============================================================================

_PORT_FORWARDS = [
    {"name": "argocd",        "namespace": ARGOCD_NAMESPACE,      "service": "svc/argocd-server",                    "local": "30080", "remote": "80"},
    {"name": "grafana",       "namespace": MONITORING_NAMESPACE,   "service": "svc/kube-prometheus-stack-grafana",    "local": "32300", "remote": "80"},
    {"name": "prometheus",    "namespace": MONITORING_NAMESPACE,   "service": "svc/kube-prometheus-stack-prometheus", "local": "9090",  "remote": "9090"},
    {"name": "kibana",        "namespace": LOGGING_NAMESPACE,      "service": "svc/kibana-kb-http",                  "local": "32601", "remote": "5601"},
    {"name": "awx",           "namespace": AWX_NAMESPACE,          "service": "svc/awx-service",                     "local": "32080", "remote": "80"},
    {"name": "jenkins-pool",  "namespace": JENKINS_POOL_NAMESPACE, "service": "svc/jenkins-pool-1",                  "local": "32000", "remote": "8080"},
    {"name": "jenkins-basic", "namespace": JENKINS_POOL_NAMESPACE, "service": "svc/jenkins-basic-local",             "local": "32001", "remote": "8080"},
]


def _start_port_forward(name: str, namespace: str, service: str, local_port: str, remote_port: str) -> None:
    """Start a kubectl port-forward as a background subprocess."""
    # Stop existing if running
    if name in _port_forward_procs:
        try:
            _port_forward_procs[name].terminate()
        except Exception:
            pass
        del _port_forward_procs[name]

    log_info(f"  Starting port-forward: {service} -n {namespace}  {local_port}:{remote_port}")
    proc = subprocess.Popen(
        ["kubectl", "port-forward", "-n", namespace, service, f"{local_port}:{remote_port}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    _port_forward_procs[name] = proc


def start_all_port_forwards() -> None:
    """Start port-forward background processes for all deployed platform services."""
    log_info("====== Starting port-forwards for all platform services ======")
    started = 0

    for fwd in _PORT_FORWARDS:
        ns = fwd["namespace"]
        svc_name = fwd["service"].replace("svc/", "")

        # Skip if namespace absent
        result = subprocess.run(
            ["kubectl", "get", "namespace", ns],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            log_debug(f"  Skipping '{fwd['name']}' — namespace '{ns}' not found")
            continue

        # Skip if service absent
        svc_result = subprocess.run(
            ["kubectl", "get", "svc", svc_name, "-n", ns],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if svc_result.returncode != 0:
            log_debug(f"  Skipping '{fwd['name']}' — service '{fwd['service']}' not found in '{ns}'")
            continue

        _start_port_forward(
            fwd["name"], fwd["namespace"], fwd["service"],
            fwd["local"], fwd["remote"],
        )
        time.sleep(0.5)
        started += 1

    log_info(f"  Started {started} port-forward process(es).")
    log_info("  Service URLs (localhost):")
    log_info("    ArgoCD      : http://localhost:30080")
    log_info("    Grafana     : http://localhost:32300")
    log_info("    Prometheus  : http://localhost:9090")
    log_info("    Kibana      : https://localhost:32601")
    log_info("    AWX         : http://localhost:32080")
    log_info("    Jenkins P1  : http://localhost:32000")
    log_info("    Jenkins Bsc : http://localhost:32001")
    log_info("====== Port-forwards running ======")


def stop_all_port_forwards() -> None:
    """Terminate all tracked kubectl port-forward background processes."""
    log_info("====== Stopping port-forward processes ======")
    if not _port_forward_procs:
        log_info("  No port-forward processes tracked in this session.")
        return

    for name, proc in list(_port_forward_procs.items()):
        try:
            proc.terminate()
            log_info(f"  Stopped : {name} (PID {proc.pid})")
        except Exception as exc:
            log_warn(f"  Could not stop process '{name}': {exc}")
    _port_forward_procs.clear()

    log_info("====== Port-forward processes stopped ======")


def show_port_forward_status() -> None:
    """Display the current state of all tracked port-forward processes."""
    log_info("====== Port-forward process status ======")
    if not _port_forward_procs:
        log_info("  No port-forward processes active in this session.")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Name", style="cyan")
    table.add_column("PID", justify="right")
    table.add_column("State")

    for name, proc in _port_forward_procs.items():
        poll = proc.poll()
        state = "Running" if poll is None else f"Exited ({poll})"
        table.add_row(name, str(proc.pid), state)

    console.print(table)
    log_info("====== End port-forward status ======")


# ============================================================================
# PHASE 5b — INTERACTIVE MENUS
# ============================================================================

def _port_forward_menu() -> None:
    """Sub-menu for managing port-forward background processes."""
    while True:
        console.print()
        console.print(Panel(
            "\n".join([
                "  [1] Start all port-forwards   (skips services not yet deployed)",
                "  [2] Stop all port-forwards",
                "  [3] Show port-forward status",
                "  [0] Back to main menu",
            ]),
            title="[cyan]Port-Forward Management (kind + WSL2)[/cyan]",
            border_style="cyan",
        ))

        choice = Prompt.ask("  Select option")
        if   choice == "1": start_all_port_forwards()
        elif choice == "2": stop_all_port_forwards()
        elif choice == "3": show_port_forward_status()
        elif choice == "0": return
        else: log_warn(f"  Invalid selection: '{choice}'. Enter 0–3.")


def _step_menu() -> None:
    """Sub-menu for deploying individual apps in isolation."""
    while True:
        console.print()
        console.print(Panel(
            "\n".join([
                "  [1] Install ArgoCD          (prerequisite — deploy this first)",
                "  [2] Apply AppProjects",
                "  [3] Deploy Infrastructure   (kube-prometheus-stack + ELK + AWX)",
                "  [4] Deploy AWX Operator     (standalone — deploy ArgoCD first)",
                "  [5] Deploy Tenant App-of-Apps",
                "  [6] Deploy Jenkins Shared Pool",
                "  [0] Back to main menu",
            ]),
            title="[cyan]Individual App Deployment[/cyan]",
            border_style="cyan",
        ))

        choice = Prompt.ask("  Select app")
        if   choice == "1": install_argocd()
        elif choice == "2": apply_app_projects()
        elif choice == "3": deploy_infrastructure()
        elif choice == "4": deploy_awx_operator()
        elif choice == "5": deploy_tenants()
        elif choice == "6": deploy_jenkins_pool()
        elif choice == "0": return
        else: log_warn(f"  Invalid selection: '{choice}'. Enter 0–6.")


def show_main_menu() -> None:
    """Interactive numbered menu. Loops until the user selects Exit."""
    while True:
        menu_lines = [
            f"  Repo  : {_repo_url}",
            f"  Rev   : {_target_revision}",
            f"  Root  : {_repo_root}",
            "",
            "  [1] Deploy full stack",
            "  [2] Deploy individual app",
            "  [3] Check platform status",
            "  [4] Port-forward management",
            "  [5] Cleanup / Teardown",
            "  [6] Exit",
        ]
        console.print()
        console.print(Panel(
            "\n".join(menu_lines),
            title="[bold cyan]GitOps Local Stack — Deployment Manager[/bold cyan]",
            border_style="cyan",
        ))

        choice = Prompt.ask("Select option")
        if   choice == "1": deploy_all_stacks()
        elif choice == "2": _step_menu()
        elif choice == "3": get_platform_status()
        elif choice == "4": _port_forward_menu()
        elif choice == "5": full_cleanup()
        elif choice == "6":
            log_info(f"Exiting. Log file: {_log_file_path}")
            return
        else:
            log_warn(f"Invalid selection: '{choice}'. Enter 1–6.")


# ============================================================================
# HELPERS
# ============================================================================

def _which(executable: str) -> Optional[str]:
    """Return the path of *executable* if found in PATH, else None."""
    import shutil
    return shutil.which(executable)


def _namespace_gone(namespace: str) -> bool:
    result = subprocess.run(
        ["kubectl", "get", "namespace", namespace],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode != 0


def _all_pods_running(namespace: str) -> bool:
    result = subprocess.run(
        ["kubectl", "get", "pods", "-n", namespace, "--no-headers"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    if not lines:
        return False
    not_ready = [
        l for l in lines
        if not re.search(r"\s+Running\s+", l) and not re.search(r"\s+Completed\s+", l)
    ]
    return len(not_ready) == 0


def _app_synced_healthy(app_name: str) -> bool:
    result = subprocess.run(
        [
            "kubectl", "get", "application", app_name,
            "-n", ARGOCD_NAMESPACE,
            "-o", "custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status",
            "--no-headers",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    return bool(re.search(r"Synced\s+Healthy", result.stdout))


def _jenkins_pool_running() -> bool:
    result = subprocess.run(
        [
            "kubectl", "get", "pods",
            "-n", JENKINS_POOL_NAMESPACE,
            "-l", "app.kubernetes.io/component=jenkins-controller",
            "--no-headers",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    running = [l for l in lines if re.search(r"\s+Running\s+", l)]
    return len(running) > 0


def _delete_pvcs(namespace: str) -> None:
    try:
        result = subprocess.run(
            ["kubectl", "get", "pvc", "-n", namespace, "--no-headers"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        if result.stdout.strip() and "not found" not in result.stdout:
            log_warn(f"  Deleting orphaned PVCs in {namespace}...")
            subprocess.run(
                ["kubectl", "delete", "pvc", "--all", "-n", namespace],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except Exception as exc:
        log_debug(f"  No PVCs to clean in {namespace}: {exc}")


def _delete_namespace(namespace: str, timeout: int) -> None:
    log_info(f"  Deleting namespace: {namespace}")
    try:
        subprocess.run(
            ["kubectl", "delete", "namespace", namespace, "--ignore-not-found"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for_condition(
            description=f"namespace {namespace} removed",
            timeout_seconds=timeout,
            interval_seconds=10,
            condition=lambda: _namespace_gone(namespace),
        )
    except Exception as exc:
        log_warn(f"  Could not delete {namespace}: {exc}")


# ============================================================================
# CLI — ARGUMENT PARSING AND ENTRY POINT
# ============================================================================

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="deploy_gitops_stacks_local.py",
        description=(
            "Automates the full local GitOps platform lifecycle "
            "(ArgoCD, kube-prometheus-stack, ELK, Jenkins, AWX) "
            "on a local Kubernetes cluster."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--gitops-path",
        default="",
        metavar="PATH",
        help="Path to the repository root containing the gitops/ directory. "
             "Use '.' for the current working directory.",
    )
    parser.add_argument(
        "--repo-url",
        default="https://github.com/HuyNguyen260398/devops-engineer-profile",
        metavar="URL",
        help="Full HTTPS URL of the Git repository ArgoCD will track.",
    )
    parser.add_argument(
        "--target-revision",
        default="main",
        metavar="REV",
        help="Branch, tag, or commit SHA ArgoCD will track (default: main).",
    )
    parser.add_argument(
        "--log-path",
        default=".",
        metavar="DIR",
        help="Directory where the log file is written (default: current directory).",
    )
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["debug", "info", "warn", "error"],
        help="Minimum severity written to the console (default: info). "
             "The log file always captures all levels.",
    )
    parser.add_argument(
        "--action",
        default="menu",
        choices=["deploy", "status", "cleanup", "menu"],
        help="Operation to execute (default: menu).",
    )
    return parser.parse_args()


def _resolve_gitops_path(raw: str) -> Path:
    """Prompt if blank, resolve '.' to cwd, and validate the result exists."""
    if not raw.strip():
        raw = Prompt.ask(
            "Enter the path to the repository root (. for current directory)"
        )
    if raw == ".":
        raw = str(Path.cwd())
    path = Path(raw).resolve()
    if not path.is_dir():
        raise RuntimeError(f"GitopsPath does not exist or is not a directory: {path}")
    return path


def _validate_repo_url(url: str) -> str:
    if not url.strip():
        url = Prompt.ask(
            "Enter the Git repository URL (e.g. https://github.com/your-org/repo.git)"
        )
    if not url.strip():
        raise RuntimeError("RepoUrl is required and cannot be empty.")
    if not re.match(r"^(https?://|git@)", url):
        raise RuntimeError(f"RepoUrl does not look like a valid Git URL: '{url}'")
    return url


def main() -> None:
    global _repo_root, _repo_url, _target_revision, _log_file_path, _console_log_level

    args = _parse_args()

    # ── Resolve log path and initialise log file ─────────────────────────────
    _console_log_level = args.log_level
    log_path = Path(args.log_path).resolve()
    log_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    _log_file_path = log_path / f"deploy-gitops-{timestamp}.log"
    _log_file_path.touch()

    log_info("deploy_gitops_stacks_local.py — starting")
    log_info(f"Log file: {_log_file_path}")
    log_info(f"Python version: {sys.version.split()[0]}")
    log_info(f"Platform: {sys.platform}")

    # ── Validate user inputs ──────────────────────────────────────────────────
    try:
        _repo_root        = _resolve_gitops_path(args.gitops_path)
        _repo_url         = _validate_repo_url(args.repo_url)
        _target_revision  = args.target_revision or "main"
    except Exception as exc:
        log_error(str(exc))
        sys.exit(1)

    log_info(f"GitOps root  : {_repo_root}")
    log_info(f"Repo URL     : {_repo_url}")
    log_info(f"Revision     : {_target_revision}")
    log_info(f"Log level    : {args.log_level}")
    log_info(f"Action       : {args.action}")

    # ── Prerequisites ─────────────────────────────────────────────────────────
    try:
        check_prerequisites()
        check_cluster_connectivity()
        check_gitops_path()
    except SystemExit:
        raise
    except Exception as exc:
        log_error(str(exc))
        sys.exit(1)

    # ── Dispatch ──────────────────────────────────────────────────────────────
    try:
        if   args.action == "deploy":  deploy_all_stacks()
        elif args.action == "status":  get_platform_status()
        elif args.action == "cleanup": full_cleanup()
        elif args.action == "menu":    show_main_menu()
    except KeyboardInterrupt:
        log_warn("Interrupted by user (Ctrl+C).")
    except Exception as exc:
        log_error(f"Unhandled exception: {exc}")
        sys.exit(1)
    finally:
        stop_all_port_forwards()

    log_info(f"deploy_gitops_stacks_local.py — done. Log: {_log_file_path}")


if __name__ == "__main__":
    main()
