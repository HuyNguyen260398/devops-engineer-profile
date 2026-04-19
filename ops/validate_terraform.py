#!/usr/bin/env python3
"""
validate_terraform.py

Runs a full local Terraform validation suite against a project directory:
  Step 1 — terraform fmt      (format check)
  Step 2 — tflint             (linting)
  Step 3 — tfsec              (security scan)
  Step 4 — terraform validate (configuration validation)
  Step 5 — terraform plan     (dry-run plan)

Each step streams live output to the console and a timestamped log file.

Usage:
    python ops/validate_terraform.py --dir inf/terraform/aws-eks
    python ops/validate_terraform.py --dir inf/terraform/aws-eks --var-file terraform.tfvars
    python ops/validate_terraform.py --dir inf/terraform/aws-eks --skip-plan
    python ops/validate_terraform.py --dir inf/terraform/aws-eks --skip-plan --log-dir ./logs

Dependencies:
    pip install rich
    External tools (must be on PATH): terraform, tflint, tfsec
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ── Rich dependency check ─────────────────────────────────────────────────────
try:
    from rich import box
    from rich.console import Console
    from rich.panel import Panel
    from rich.rule import Rule
    from rich.table import Table
except ImportError:
    print(
        "[ERROR] The 'rich' library is required for the CLI interface.\n"
        "Install it with:  pip install rich",
        file=sys.stderr,
    )
    sys.exit(1)

# =============================================================================
# CONSTANTS
# =============================================================================

STEP_REGISTRY: list[tuple[str, str]] = [
    ("fmt",      "Terraform Format"),
    ("tflint",   "TFLint"),
    ("tfsec",    "tfsec Security Scan"),
    ("validate", "Terraform Validate"),
    ("plan",     "Terraform Plan"),
]

STATUS_MARKUP: dict[str, str] = {
    "pass":  "[bold green]✓  PASS[/bold green]",
    "fail":  "[bold red]✗  FAIL[/bold red]",
    "skip":  "[bold yellow]⊘  SKIP[/bold yellow]",
    "error": "[bold red]!  ERROR[/bold red]",
}

# =============================================================================
# DATA TYPES
# =============================================================================

@dataclass
class StepResult:
    key:       str
    label:     str
    status:    str = "pending"   # pending | pass | fail | skip | error
    exit_code: int = -1
    duration:  float = 0.0
    output:    list[str] = field(default_factory=list)
    note:      str = ""


# =============================================================================
# LOGGING
# =============================================================================

console = Console()
_log_path: Optional[Path] = None


def _file_log(level: str, message: str) -> None:
    if _log_path is None:
        return
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    try:
        with _log_path.open("a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] [{level.upper():<5}] {message}\n")
    except OSError:
        pass


def _log(level: str, message: str) -> None:
    _file_log(level, message)
    color_map = {"info": "cyan", "warn": "yellow", "error": "bold red", "debug": "dim white"}
    color = color_map.get(level, "white")
    ts = datetime.now().strftime("%H:%M:%S")
    console.print(f"[dim]{ts}[/dim] [[{color}]{level.upper():<5}[/{color}]] {message}")


def log_info(msg: str) -> None:  _log("info",  msg)
def log_warn(msg: str) -> None:  _log("warn",  msg)
def log_error(msg: str) -> None: _log("error", msg)


def log_output_line(line: str) -> None:
    stripped = line.rstrip()
    _file_log("out", stripped)
    console.print(f"  [dim]{stripped}[/dim]")


# =============================================================================
# TOOL CHECK
# =============================================================================

def check_required_tools(skip_plan: bool) -> list[str]:
    tools = ["terraform", "tflint", "tfsec"]
    return [t for t in tools if shutil.which(t) is None]


# =============================================================================
# SUBPROCESS RUNNER
# =============================================================================

def run_command(cmd: list[str], cwd: Path, result: StepResult) -> int:
    """
    Run a command, stream stdout+stderr to console and log file, return exit code.
    """
    log_info(f"$ {' '.join(cmd)}")
    _file_log("cmd", f"$ {' '.join(cmd)}")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=os.environ.copy(),
        )
        for line in proc.stdout:  # type: ignore[union-attr]
            result.output.append(line.rstrip())
            log_output_line(line)
        proc.wait()
        return proc.returncode

    except FileNotFoundError:
        msg = f"Command not found on PATH: {cmd[0]}"
        result.note = msg
        log_error(msg)
        return 127


# =============================================================================
# INDIVIDUAL STEPS
# =============================================================================

def step_fmt(project_dir: Path, result: StepResult) -> None:
    rc = run_command(
        ["terraform", "fmt", "-check", "-recursive", "-diff"],
        project_dir, result,
    )
    result.exit_code = rc
    if rc == 0:
        result.status = "pass"
    else:
        result.status = "fail"
        result.note = "Run 'terraform fmt -recursive' to auto-fix formatting."


def step_tflint(project_dir: Path, result: StepResult) -> None:
    # Initialise plugins before linting
    init = StepResult(key="tflint-init", label="TFLint Init")
    rc_init = run_command(["tflint", "--init"], project_dir, init)
    if rc_init != 0:
        result.exit_code = rc_init
        result.status = "fail"
        result.note = "tflint --init failed; cannot continue linting."
        return

    rc = run_command(["tflint", "--format=compact", "--recursive"], project_dir, result)
    result.exit_code = rc
    result.status = "pass" if rc == 0 else "fail"


def step_tfsec(project_dir: Path, result: StepResult) -> None:
    rc = run_command(
        ["tfsec", ".", "--minimum-severity", "MEDIUM", "--no-color"],
        project_dir, result,
    )
    result.exit_code = rc
    result.status = "pass" if rc == 0 else "fail"
    if rc != 0:
        result.note = "Security issues found at MEDIUM severity or above."


def step_validate(project_dir: Path, result: StepResult) -> None:
    # Backend-less init so validate works without real credentials
    init = StepResult(key="tf-init", label="Terraform Init")
    rc_init = run_command(
        ["terraform", "init", "-backend=false", "-input=false"],
        project_dir, init,
    )
    if rc_init != 0:
        result.exit_code = rc_init
        result.status = "fail"
        result.note = "terraform init failed; cannot validate."
        return

    rc = run_command(["terraform", "validate", "-no-color"], project_dir, result)
    result.exit_code = rc
    result.status = "pass" if rc == 0 else "fail"


def step_plan(project_dir: Path, var_file: Optional[str], result: StepResult) -> None:
    cmd = ["terraform", "plan", "-input=false", "-no-color"]
    if var_file:
        cmd.append(f"-var-file={var_file}")
    rc = run_command(cmd, project_dir, result)
    result.exit_code = rc
    result.status = "pass" if rc == 0 else "fail"
    if rc != 0:
        result.note = "Plan failed — check credentials and variable values."


# =============================================================================
# SUMMARY
# =============================================================================

def print_summary(results: list[StepResult], total_seconds: float) -> bool:
    console.print()
    console.print(Rule("[bold white]Validation Summary[/bold white]", style="white"))

    table = Table(
        box=box.ROUNDED,
        show_header=True,
        header_style="bold white on dark_blue",
        expand=False,
    )
    table.add_column("Step",     style="bold white", width=26)
    table.add_column("Status",   justify="center",   width=14)
    table.add_column("Duration", justify="right",    width=10)
    table.add_column("Notes",    width=44)

    all_pass = True
    for r in results:
        if r.status not in ("pass", "skip"):
            all_pass = False
        dur = f"{r.duration:.1f}s" if r.duration > 0 else "—"
        note = r.note or ("All checks passed." if r.status == "pass" else "")
        table.add_row(r.label, STATUS_MARKUP.get(r.status, r.status), dur, note)

    console.print(table)
    console.print()

    if all_pass:
        panel_text  = "[bold green]✓  All checks passed — Terraform configuration is valid.[/bold green]"
        border_color = "green"
    else:
        panel_text  = "[bold red]✗  One or more checks failed — review the output above.[/bold red]"
        border_color = "red"

    console.print(Panel(
        f"{panel_text}\n[dim]Total time: {total_seconds:.1f}s[/dim]",
        title="[bold white]Overall Result[/bold white]",
        border_style=border_color,
        expand=False,
    ))

    if _log_path:
        console.print(f"\n[dim]Full log written to: {_log_path}[/dim]")

    _file_log("summary", f"Overall: {'PASSED' if all_pass else 'FAILED'} in {total_seconds:.1f}s")
    return all_pass


# =============================================================================
# ORCHESTRATION
# =============================================================================

def _setup_log(log_dir: Optional[str], project_name: str) -> None:
    global _log_path
    if not log_dir:
        _log_path = None
        return
    directory = Path(log_dir)
    directory.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    _log_path = directory / f"tf_validate_{project_name}_{ts}.log"
    _file_log("info", f"Validation log for project: {project_name}")


def run_suite(
    project_dir: Path,
    var_file: Optional[str],
    skip_plan: bool,
    log_dir: Optional[str],
) -> bool:
    project_name = project_dir.name
    _setup_log(log_dir, project_name)

    # ── Header banner ─────────────────────────────────────────────────────────
    detail_lines = [
        f"[white]Project :[/white] [green]{project_dir.resolve()}[/green]",
        f"[white]Started :[/white] [dim]{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
    ]
    if var_file:
        detail_lines.append(f"[white]Var file:[/white] [dim]{var_file}[/dim]")
    if skip_plan:
        detail_lines.append("[yellow]Plan step is skipped (--skip-plan)[/yellow]")

    console.print()
    console.print(Panel(
        "[bold cyan]Terraform Validation Suite[/bold cyan]\n"
        + "\n".join(detail_lines),
        title="[bold white] DevOps Terraform Validator [/bold white]",
        border_style="cyan",
        expand=False,
    ))

    # ── Tool availability check ───────────────────────────────────────────────
    missing = check_required_tools(skip_plan)
    if missing:
        console.print(Panel(
            f"[bold red]Missing required tools: {', '.join(missing)}[/bold red]\n"
            "Please install them and ensure they are available on PATH.",
            title="[red]Prerequisite Check Failed[/red]",
            border_style="red",
        ))
        sys.exit(1)

    # ── Build step list ───────────────────────────────────────────────────────
    active_steps = [(k, l) for k, l in STEP_REGISTRY if k != "plan" or not skip_plan]
    results: list[StepResult] = [StepResult(key=k, label=l) for k, l in active_steps]
    total = len(results)

    suite_start = time.monotonic()

    for idx, result in enumerate(results, start=1):
        console.print()
        console.print(Rule(
            f"[bold cyan]Step {idx}/{total} — {result.label}[/bold cyan]",
            style="cyan",
        ))
        _file_log("step", f"=== Step {idx}/{total}: {result.label} ===")

        t0 = time.monotonic()

        if result.key == "fmt":
            step_fmt(project_dir, result)
        elif result.key == "tflint":
            step_tflint(project_dir, result)
        elif result.key == "tfsec":
            step_tfsec(project_dir, result)
        elif result.key == "validate":
            step_validate(project_dir, result)
        elif result.key == "plan":
            step_plan(project_dir, var_file, result)

        result.duration = time.monotonic() - t0
        status_markup = STATUS_MARKUP.get(result.status, result.status)
        log_info(f"{result.label} finished: {result.status.upper()} ({result.duration:.1f}s)")
        console.print(f"\n  {status_markup}  [dim]{result.label}[/dim] completed in [cyan]{result.duration:.1f}s[/cyan]")

    return print_summary(results, time.monotonic() - suite_start)


# =============================================================================
# CLI
# =============================================================================

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the full Terraform validation suite locally.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
steps (in order):
  1. terraform fmt      — check formatting
  2. tflint             — lint rules and best practices
  3. tfsec              — security scanning (MEDIUM+ severity)
  4. terraform validate — validate HCL configuration
  5. terraform plan     — dry-run plan (requires real credentials)

examples:
  python ops/validate_terraform.py --dir inf/terraform/aws-eks
  python ops/validate_terraform.py --dir inf/terraform/aws-eks --var-file terraform.tfvars
  python ops/validate_terraform.py --dir inf/terraform/aws-eks --skip-plan --log-dir ./logs
        """,
    )
    parser.add_argument(
        "--dir",
        required=True,
        metavar="PATH",
        help="Path to the Terraform project directory (e.g. inf/terraform/aws-eks)",
    )
    parser.add_argument(
        "--var-file",
        default=None,
        metavar="FILE",
        help="Path to a .tfvars file passed to 'terraform plan'",
    )
    parser.add_argument(
        "--skip-plan",
        action="store_true",
        help="Skip the terraform plan step (useful without live AWS credentials)",
    )
    parser.add_argument(
        "--log-dir",
        default="logs",
        metavar="DIR",
        help="Directory where the log file is written (default: ./logs)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    project_dir = Path(args.dir).resolve()
    if not project_dir.exists():
        console.print(f"[bold red]ERROR:[/bold red] Directory not found: {project_dir}")
        sys.exit(1)
    if not project_dir.is_dir():
        console.print(f"[bold red]ERROR:[/bold red] Not a directory: {project_dir}")
        sys.exit(1)

    success = run_suite(
        project_dir=project_dir,
        var_file=args.var_file,
        skip_plan=args.skip_plan,
        log_dir=args.log_dir,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
