#Requires -Version 7.0
<#
.SYNOPSIS
    Automates the full local GitOps platform lifecycle on a local Kubernetes cluster.

.DESCRIPTION
    deploy-gitops-stacks-local.ps1 bootstraps, deploys, reports status on, and tears
    down the full GitOps platform (ArgoCD, kube-prometheus-stack, ELK stack, Jenkins)
    on a local Kubernetes cluster (minikube / kind / k3s) following the sequence
    defined in doc/GITOPS_LOCAL_DEPLOYMENT_GUIDE.md.

    The script runs on PowerShell 7+ (pwsh) on both Windows and Linux. All kubectl
    and helm calls are wrapped, logged, and validated. An interactive menu is shown
    when no -Action flag is supplied.

.PARAMETER GitopsPath
    Path to the repository root that contains the gitops/ directory. Use "." for the
    current working directory. Required — the script prompts interactively if omitted.

.PARAMETER RepoUrl
    Full HTTPS URL of the Git repository that ArgoCD will track.
    Example: https://github.com/your-org/devops-engineer-profile.git
    Required — the script prompts interactively if omitted.

.PARAMETER TargetRevision
    Branch name, tag, or commit SHA that ArgoCD will track. Defaults to 'main'.

.PARAMETER LogPath
    Directory where the log file is written. Use "." for the current working directory.
    Defaults to the current working directory.

.PARAMETER LogLevel
    Minimum severity written to the console. Accepted values: debug, info, warn, error.
    The log file always captures all levels regardless of this setting. Defaults to 'info'.

.PARAMETER Action
    Operation to execute. Accepted values: deploy, status, cleanup, menu.
    'menu' shows the interactive numbered menu. Defaults to 'menu'.

.EXAMPLE
    # Interactive menu (default)
    ./deploy-gitops-stacks-local.ps1 -GitopsPath . -RepoUrl https://github.com/your-org/devops-engineer-profile.git

.EXAMPLE
    # Non-interactive full deploy
    ./deploy-gitops-stacks-local.ps1 -GitopsPath . -RepoUrl https://github.com/your-org/devops-engineer-profile.git -TargetRevision feature/my-branch -Action deploy

.EXAMPLE
    # Check platform status
    ./deploy-gitops-stacks-local.ps1 -GitopsPath . -RepoUrl https://github.com/your-org/devops-engineer-profile.git -Action status

.EXAMPLE
    # Full teardown with debug logging
    ./deploy-gitops-stacks-local.ps1 -GitopsPath . -RepoUrl https://github.com/your-org/devops-engineer-profile.git -Action cleanup -LogLevel debug

.NOTES
    ArgoCD Helm chart version pinned to: 9.4.7
    Plan: plan/feature-gitops-local-deploy-script-1.md
    Guide: doc/GITOPS_LOCAL_DEPLOYMENT_GUIDE.md
#>

[CmdletBinding()]
param(
    [string] $GitopsPath     = '',
    [string] $RepoUrl        = '',
    [string] $TargetRevision = 'main',
    [string] $LogPath        = '.',
    [ValidateSet('debug', 'info', 'warn', 'error')]
    [string] $LogLevel       = 'info',
    [ValidateSet('deploy', 'status', 'cleanup', 'menu')]
    [string] $Action         = 'menu'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================================
# Script-level constants  (override by assigning before calling Main)
# ============================================================================
$script:ArgoCDChartVersion          = '9.4.7'
$script:ArgoCDHelmRepo              = 'https://argoproj.github.io/argo-helm'
$script:ArgoCDNamespace             = 'argocd'
$script:MonitoringNamespace         = 'monitoring'
$script:LoggingNamespace            = 'logging'
$script:ElasticSystemNamespace      = 'elastic-system'
$script:JenkinsPoolNamespace        = 'pool-1-local'
$script:AWXNamespace                = 'awx'

# Timeout constants (seconds) — increase on under-resourced machines
$script:TimeoutArgoCDInstall        = 600
$script:TimeoutArgoCDNamespaceDel   = 60
$script:TimeoutInfraSync            = 600
$script:TimeoutTenantSync           = 300
$script:TimeoutJenkinsPool          = 300
$script:TimeoutNamespaceDel         = 120
$script:TimeoutMonitoringDel        = 120
$script:TimeoutLoggingDel           = 120
$script:TimeoutElasticDel           = 60
$script:TimeoutAWXDel               = 180

# Log level ordering
$script:LogLevelOrder = @{ debug = 0; info = 1; warn = 2; error = 3 }

# Will be set in Main after paths are resolved
$script:LogFile             = $null
$script:RepoRoot            = $null
$script:UseNativeEnvSubst   = $false

# ============================================================================
# PHASE 1 — UTILITY LAYER
# ============================================================================

function Write-Log {
    <#
    .SYNOPSIS
        Writes a timestamped, level-tagged message to the console and log file.
    .PARAMETER Level
        Severity: debug | info | warn | error
    .PARAMETER Message
        The message text to log.
    #>
    [CmdletBinding()]
    param(
        [ValidateSet('debug', 'info', 'warn', 'error')]
        [string] $Level   = 'info',
        [string] $Message = ''
    )

    $timestamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    $entry     = "[$timestamp] [$($Level.ToUpper().PadRight(5))] $Message"

    # Always write to log file (all levels)
    if ($script:LogFile) {
        Add-Content -Path $script:LogFile -Value $entry -Encoding UTF8
    }

    # Write to console only if level meets the threshold
    $threshold = $script:LogLevelOrder[$LogLevel]
    $current   = $script:LogLevelOrder[$Level]
    if ($current -ge $threshold) {
        $colour = switch ($Level) {
            'debug' { 'Gray'   }
            'info'  { 'Cyan'   }
            'warn'  { 'Yellow' }
            'error' { 'Red'    }
        }
        Write-Host $entry -ForegroundColor $colour
    }
}

function Invoke-CommandSafe {
    <#
    .SYNOPSIS
        Runs an external command, captures output, logs it, and throws on failure.
    .PARAMETER Arguments
        Array where index 0 is the executable and the remaining elements are arguments.
        All values are passed as PowerShell variables to prevent shell injection.
    .OUTPUTS
        [string] Combined stdout of the command.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string[]] $Arguments
    )

    if ($Arguments.Count -eq 0) {
        throw 'Invoke-CommandSafe: Arguments array must not be empty.'
    }

    $exe  = $Arguments[0]
    $rest = if ($Arguments.Count -gt 1) { $Arguments[1..($Arguments.Count - 1)] } else { @() }

    Write-Log debug "CMD: $exe $($rest -join ' ')"

    $output   = [System.Collections.Generic.List[string]]::new()
    $errLines = [System.Collections.Generic.List[string]]::new()

    try {
        # Use & operator — arguments are never interpolated into a shell string
        $output = & $exe @rest 2>&1 | ForEach-Object {
            $line = "$_"
            Write-Log debug "  OUT: $line"
            $line
        }

        if ($LASTEXITCODE -ne 0) {
            $detail = $output -join "`n"
            throw "Command '$exe' exited with code $LASTEXITCODE.`n$detail"
        }
    }
    catch [System.Management.Automation.CommandNotFoundException] {
        throw "Executable not found: '$exe'. Ensure it is installed and in PATH."
    }

    return ($output -join "`n")
}

function Wait-ForCondition {
    <#
    .SYNOPSIS
        Polls a script block until it returns $true or the timeout is reached.
    .PARAMETER Condition
        Script block that returns $true when the desired state is reached.
    .PARAMETER TimeoutSeconds
        Maximum seconds to wait before throwing a timeout error.
    .PARAMETER IntervalSeconds
        Seconds between each poll attempt. Defaults to 10.
    .PARAMETER Description
        Human-readable label used in log messages.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Condition,
        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,
        [int]    $IntervalSeconds = 10,
        [string] $Description     = 'condition'
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $attempt  = 0

    Write-Log info "Waiting for: $Description (timeout ${TimeoutSeconds}s)"

    while ((Get-Date) -lt $deadline) {
        $attempt++
        try {
            $result = & $Condition
            if ($result) {
                Write-Log info "  [OK] $Description — satisfied after attempt $attempt"
                return
            }
        }
        catch {
            Write-Log debug "  [POLL $attempt] $Description — error: $_"
        }
        Write-Log debug "  [POLL $attempt] $Description — not yet satisfied, retrying in ${IntervalSeconds}s"
        Start-Sleep -Seconds $IntervalSeconds
    }

    throw "Timeout waiting for: $Description (${TimeoutSeconds}s elapsed)"
}

function Invoke-EnvSubst {
    <#
    .SYNOPSIS
        Pure-PowerShell envsubst fallback. Replaces ${VAR} and $VAR tokens in a
        template file with values from the current process environment.
    .PARAMETER TemplatePath
        Absolute path to the template file to process.
    .OUTPUTS
        [string] The template content with all recognised variables substituted.
    .NOTES
        Only simple $VAR and ${VAR} forms are supported. Bash parameter expansion
        (e.g. ${VAR:-default}) is NOT supported — the guide templates do not use it.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $TemplatePath
    )

    $content = Get-Content -Path $TemplatePath -Raw -Encoding UTF8

    # Replace ${VAR} form first, then bare $VAR form
    # Uses [System.Environment]::GetEnvironmentVariable to avoid arbitrary code eval
    $content = [regex]::Replace($content, '\$\{([A-Za-z_][A-Za-z0-9_]*)\}', {
        param($m)
        $val = [System.Environment]::GetEnvironmentVariable($m.Groups[1].Value)
        if ($null -ne $val) { $val } else { $m.Value }
    })

    $content = [regex]::Replace($content, '\$([A-Za-z_][A-Za-z0-9_]*)', {
        param($m)
        $varName = $m.Groups[1].Value
        # Skip PowerShell automatic variables that should remain literal
        $skipVars = @('true', 'false', 'null', 'PSScriptRoot', 'PSCommandPath', 'MyInvocation', 'Error', 'LastExitCode')
        if ($skipVars -contains $varName) { return $m.Value }
        $val = [System.Environment]::GetEnvironmentVariable($varName)
        if ($null -ne $val) { $val } else { $m.Value }
    })

    return $content
}

function Invoke-EnvSubstApply {
    <#
    .SYNOPSIS
        Runs envsubst on a template file and pipes the result to kubectl apply.
        Uses native envsubst if available, otherwise falls back to Invoke-EnvSubst.
    .PARAMETER TemplatePath
        Absolute path to the template YAML file.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $TemplatePath
    )

    Write-Log info "Applying (envsubst): $TemplatePath"

    if ($script:UseNativeEnvSubst) {
        # Pass through native binary — no user data is shell-interpolated
        # Get-Content pipes lines; envsubst reads stdin and substitutes env vars
        $substituted = Get-Content -Path $TemplatePath -Raw | & envsubst
        $substituted | & kubectl apply -f -
        if ($LASTEXITCODE -ne 0) {
            throw "kubectl apply failed for template: $TemplatePath (exit $LASTEXITCODE)"
        }
    }
    else {
        $substituted = Invoke-EnvSubst -TemplatePath $TemplatePath
        $substituted | & kubectl apply -f -
        if ($LASTEXITCODE -ne 0) {
            throw "kubectl apply failed for template: $TemplatePath (exit $LASTEXITCODE)"
        }
    }
}

function Confirm-UserInput {
    <#
    .SYNOPSIS
        Validates all required parameters and prompts interactively for any that
        are blank. Resolves "." paths to the current working directory. Validates
        enum values for LogLevel and Action.
    #>

    # Resolve GitopsPath
    if ([string]::IsNullOrWhiteSpace($script:ParamGitopsPath)) {
        $script:ParamGitopsPath = Read-Host 'Enter the path to the repository root (. for current directory)'
    }
    if ($script:ParamGitopsPath -eq '.') {
        $script:ParamGitopsPath = (Get-Location).Path
    }
    $script:ParamGitopsPath = (Resolve-Path $script:ParamGitopsPath -ErrorAction Stop).Path

    # Resolve RepoUrl
    if ([string]::IsNullOrWhiteSpace($script:ParamRepoUrl)) {
        $script:ParamRepoUrl = Read-Host 'Enter the Git repository URL (e.g. https://github.com/your-org/repo.git)'
    }
    if ([string]::IsNullOrWhiteSpace($script:ParamRepoUrl)) {
        throw 'RepoUrl is required and cannot be empty.'
    }
    # Basic URL safety check — must start with https:// or http:// or git@
    if ($script:ParamRepoUrl -notmatch '^(https?://|git@)') {
        throw "RepoUrl does not look like a valid Git URL: '$($script:ParamRepoUrl)'"
    }

    # Resolve TargetRevision
    if ([string]::IsNullOrWhiteSpace($script:ParamTargetRevision)) {
        $script:ParamTargetRevision = 'main'
    }

    # Resolve LogPath
    if ([string]::IsNullOrWhiteSpace($script:ParamLogPath) -or $script:ParamLogPath -eq '.') {
        $script:ParamLogPath = (Get-Location).Path
    }
    if (-not (Test-Path $script:ParamLogPath -PathType Container)) {
        New-Item -ItemType Directory -Path $script:ParamLogPath -Force | Out-Null
    }
    $script:ParamLogPath = (Resolve-Path $script:ParamLogPath).Path
}

# ============================================================================
# PHASE 2 — PREREQUISITE AND CLUSTER CHECKS
# ============================================================================

function Test-Prerequisites {
    <#
    .SYNOPSIS
        Verifies kubectl and helm are in PATH. Checks for envsubst and sets the
        fallback flag if not found. Logs tool versions.
    #>

    Write-Log info '--- Checking prerequisites ---'

    # kubectl
    $kt = Get-Command kubectl -ErrorAction SilentlyContinue
    if (-not $kt) {
        throw 'kubectl not found in PATH. Install kubectl >= 1.29 before running this script.'
    }
    $ktVer = (& kubectl version --client --output=yaml 2>&1 | Select-String 'gitVersion') -replace '.*gitVersion:\s*', ''
    Write-Log info "  kubectl : $ktVer"

    # helm
    $hm = Get-Command helm -ErrorAction SilentlyContinue
    if (-not $hm) {
        throw 'helm not found in PATH. Install helm >= 3.14 before running this script.'
    }
    $hmVer = (& helm version --short 2>&1)
    Write-Log info "  helm    : $hmVer"

    # envsubst (optional — fallback is built-in)
    $es = Get-Command envsubst -ErrorAction SilentlyContinue
    if ($es) {
        $script:UseNativeEnvSubst = $true
        Write-Log info '  envsubst: found (native binary will be used)'
    }
    else {
        $script:UseNativeEnvSubst = $false
        Write-Log warn '  envsubst: not found — using built-in PowerShell fallback (Invoke-EnvSubst)'
    }

    Write-Log info '--- Prerequisites OK ---'
}

function Test-ClusterConnectivity {
    <#
    .SYNOPSIS
        Verifies the local Kubernetes cluster is reachable. Exits the script with
        code 1 if the cluster cannot be contacted.
    #>

    Write-Log info '--- Checking cluster connectivity ---'

    try {
        # Use direct invocation (same pattern as Test-Prerequisites) — avoids a
        # PowerShell argument-passing edge case with hyphenated kubectl subcommands
        # where array splatting via Invoke-CommandSafe truncates 'cluster-info' to 'c'.
        Write-Log debug 'CMD: kubectl cluster-info'
        $rawInfo = & kubectl cluster-info 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "kubectl cluster-info exited with code $LASTEXITCODE.`n$(($rawInfo) -join "`n")"
        }
        $serverLine = ($rawInfo | Select-String 'Kubernetes control plane') | Select-Object -First 1
        Write-Log info "  $serverLine"

        $nodes = Invoke-CommandSafe kubectl, 'get', 'nodes', '--no-headers'
        $nodeCount = @($nodes -split "`n" | Where-Object { $_ -match '\S' }).Count
        Write-Log info "  Nodes ready: $nodeCount"
    }
    catch {
        Write-Log error "Kubernetes cluster is not reachable: $_"
        Write-Log error "Ensure your local cluster (minikube/kind/k3s) is running and kubectl context is set correctly."
        exit 1
    }

    Write-Log info '--- Cluster connectivity OK ---'
}

function Test-GitopsPath {
    <#
    .SYNOPSIS
        Confirms the resolved GitopsPath contains the expected gitops directory structure.
    #>

    Write-Log info "--- Validating GitOps path: $script:RepoRoot ---"

    $markerFile = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'argocd' 'namespace.yaml'
    if (-not (Test-Path $markerFile)) {
        throw "GitopsPath '$script:RepoRoot' does not appear to be the repository root. Expected to find: $markerFile"
    }

    Write-Log info '--- GitOps path OK ---'
}

# ============================================================================
# PHASE 3 — DEPLOYMENT FUNCTIONS (Steps 1–5)
# ============================================================================

function Clear-ArgoCDFinalizers {
    <#
    .SYNOPSIS
        Removes finalizers from all ArgoCD ApplicationSets and Applications in the
        argocd namespace. Used when the namespace is stuck in Terminating.
    #>
    Write-Log warn 'Clearing ArgoCD finalizers to unblock stuck namespace...'

    try {
        $appsets = (Invoke-CommandSafe kubectl, 'get', 'applicationsets', '-n', $script:ArgoCDNamespace, '-o', 'name' -ErrorAction SilentlyContinue) -split "`n" | Where-Object { $_ -match '\S' }
        foreach ($as in $appsets) {
            Write-Log debug "  Patching finalizer on ApplicationSet: $as"
            & kubectl patch $as -n $script:ArgoCDNamespace --type=merge -p '{"metadata":{"finalizers":[]}}' 2>&1 | Out-Null
        }
    }
    catch { Write-Log debug "  No ApplicationSets to patch (or already gone): $_" }

    try {
        $apps = (Invoke-CommandSafe kubectl, 'get', 'applications', '-n', $script:ArgoCDNamespace, '-o', 'name' -ErrorAction SilentlyContinue) -split "`n" | Where-Object { $_ -match '\S' }
        foreach ($app in $apps) {
            Write-Log debug "  Patching finalizer on Application: $app"
            & kubectl patch $app -n $script:ArgoCDNamespace --type=merge -p '{"metadata":{"finalizers":[]}}' 2>&1 | Out-Null
        }
    }
    catch { Write-Log debug "  No Applications to patch (or already gone): $_" }
}

function Install-ArgoCD {
    <#
    .SYNOPSIS
        Step 1 — Installs ArgoCD via Helm. Handles stuck Terminating namespace,
        applies the namespace manifest, adds the Argo Helm repo, and runs
        helm upgrade --install. Waits for all ArgoCD pods to reach Running state.
    #>
    Write-Log info '====== Step 1/5: Install ArgoCD ======'

    $nsFile       = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'argocd' 'namespace.yaml'
    $valuesBase   = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'argocd' 'values-base.yaml'
    $valuesLocal  = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'argocd' 'values-local.yaml'

    # Check for stuck Terminating namespace
    try {
        $nsStatus = (Invoke-CommandSafe kubectl, 'get', 'namespace', $script:ArgoCDNamespace, '--no-headers', '-o', 'custom-columns=STATUS:.status.phase' 2>&1)
        if ($nsStatus -match 'Terminating') {
            Write-Log warn "Namespace '$($script:ArgoCDNamespace)' is stuck in Terminating state. Attempting recovery..."
            Clear-ArgoCDFinalizers
            Wait-ForCondition -Description "namespace $($script:ArgoCDNamespace) deleted" -TimeoutSeconds $script:TimeoutArgoCDNamespaceDel -IntervalSeconds 5 -Condition {
                $out = & kubectl get namespace $script:ArgoCDNamespace 2>&1
                $LASTEXITCODE -ne 0 -or $out -match 'not found'
            }
            Write-Log info "Namespace '$($script:ArgoCDNamespace)' removed. Proceeding with fresh install."
        }
        else {
            Write-Log debug "Namespace '$($script:ArgoCDNamespace)' status: $nsStatus"
        }
    }
    catch {
        Write-Log debug "Namespace '$($script:ArgoCDNamespace)' does not exist yet — will be created."
    }

    # Apply namespace manifest
    Write-Log info '  1a. Applying ArgoCD namespace manifest...'
    Invoke-CommandSafe kubectl, 'apply', '-f', $nsFile | Out-Null

    # Add / update Helm repo
    Write-Log info '  1b. Adding Argo Helm repository...'
    Invoke-CommandSafe helm, 'repo', 'add', 'argo', $script:ArgoCDHelmRepo | Out-Null
    Invoke-CommandSafe helm, 'repo', 'update', 'argo' | Out-Null

    # Install or upgrade ArgoCD
    Write-Log info "  1c. Installing ArgoCD (chart version $($script:ArgoCDChartVersion))..."
    Invoke-CommandSafe helm, 'upgrade', '--install', 'argocd', 'argo/argo-cd',
        '--namespace', $script:ArgoCDNamespace,
        '--version', $script:ArgoCDChartVersion,
        '--values', $valuesBase,
        '--values', $valuesLocal,
        '--wait',
        '--timeout', '10m' | Out-Null

    # Wait for all ArgoCD pods Running
    Write-Log info '  1d. Waiting for ArgoCD pods to be Running...'
    Wait-ForCondition -Description 'ArgoCD pods Running' -TimeoutSeconds $script:TimeoutArgoCDInstall -IntervalSeconds 15 -Condition {
        $pods = & kubectl get pods -n $script:ArgoCDNamespace --no-headers 2>&1
        $lines = @(($pods -split "`n") | Where-Object { $_ -match '\S' })
        if ($lines.Count -eq 0) { return $false }
        $notReady = @($lines | Where-Object { $_ -notmatch '\s+Running\s+' -and $_ -notmatch '\s+Completed\s+' })
        return $notReady.Count -eq 0
    }

    Write-Log info '====== Step 1/5 COMPLETE: ArgoCD installed ======'

    $adminPwdCmd = 'kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath=''{.data.password}'' | base64 -d'
    Write-Log info "  ArgoCD UI: http://localhost:30080  (admin / run: $adminPwdCmd)"
}

function Apply-AppProjects {
    <#
    .SYNOPSIS
        Step 2 — Applies the three ArgoCD AppProject manifests (infrastructure,
        applications, tenants) and verifies they exist.
    #>
    Write-Log info '====== Step 2/5: Apply ArgoCD AppProjects ======'

    $projectsDir = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'projects'
    Invoke-CommandSafe kubectl, 'apply', '-f', $projectsDir | Out-Null

    # Verify all three projects are present
    $expected = @('infrastructure', 'applications', 'tenants')
    Wait-ForCondition -Description 'AppProjects created' -TimeoutSeconds 30 -IntervalSeconds 5 -Condition {
        $found = Invoke-CommandSafe kubectl, 'get', 'appprojects', '-n', $script:ArgoCDNamespace, '--no-headers', '-o', 'custom-columns=NAME:.metadata.name'
        $missing = @($expected | Where-Object { $found -notmatch $_ })
        return $missing.Count -eq 0
    }

    Write-Log info '====== Step 2/5 COMPLETE: AppProjects applied ======'
}

function Deploy-Infrastructure {
    <#
    .SYNOPSIS
        Step 3 — Applies the local infrastructure App-of-Apps (kube-prometheus-stack,
        ECK Operator, eck-stack, Fluent Bit) and waits for the root Application to
        reach Synced + Healthy.
    #>
    Write-Log info '====== Step 3/5: Deploy Infrastructure App-of-Apps ======'

    $templateFile = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'local' 'app-of-apps-infrastructure.yaml'

    # Set environment variables used by the template
    $env:GIT_REPO_URL        = $script:ParamRepoUrl
    $env:GIT_TARGET_REVISION = $script:ParamTargetRevision

    Write-Log info "  Repo URL      : $($env:GIT_REPO_URL)"
    Write-Log info "  Target Rev    : $($env:GIT_TARGET_REVISION)"

    Invoke-EnvSubstApply -TemplatePath $templateFile

    # Wait for root Application
    Write-Log info '  Waiting for app-of-apps-infrastructure-local Synced + Healthy...'
    Wait-ForCondition -Description 'app-of-apps-infrastructure-local Synced+Healthy' -TimeoutSeconds $script:TimeoutInfraSync -IntervalSeconds 20 -Condition {
        $out = & kubectl get application app-of-apps-infrastructure-local -n $script:ArgoCDNamespace -o 'custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status' --no-headers 2>&1
        $out -match 'Synced\s+Healthy'
    }

    Write-Log info '  Infrastructure Applications deployed and syncing. Full stack rollout may take several minutes.'
    Write-Log info "  Monitor: kubectl get pods -n $($script:MonitoringNamespace) -w"
    Write-Log info "  Monitor: kubectl get pods -n $($script:LoggingNamespace) -w"
    Write-Log info '====== Step 3/5 COMPLETE: Infrastructure App-of-Apps applied ======'
}

function Deploy-Tenants {
    <#
    .SYNOPSIS
        Step 4 — Applies the tenant App-of-Apps and waits for the root
        Application (app-of-apps-local) to reach Synced + Healthy.
    #>
    Write-Log info '====== Step 4/5: Deploy Tenant App-of-Apps ======'

    $templateFile = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'app-of-apps.yaml'

    # Ensure environment variables are still set (could be called independently)
    $env:GIT_REPO_URL        = $script:ParamRepoUrl
    $env:GIT_TARGET_REVISION = $script:ParamTargetRevision

    Invoke-EnvSubstApply -TemplatePath $templateFile

    # Wait for root tenant Application
    Wait-ForCondition -Description 'app-of-apps-local Synced+Healthy' -TimeoutSeconds $script:TimeoutTenantSync -IntervalSeconds 15 -Condition {
        $out = & kubectl get application app-of-apps-local -n $script:ArgoCDNamespace -o 'custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status' --no-headers 2>&1
        $out -match 'Synced\s+Healthy'
    }

    Write-Log info '====== Step 4/5 COMPLETE: Tenant App-of-Apps applied ======'
}

function Deploy-JenkinsPool {
    <#
    .SYNOPSIS
        Step 5 — Manually applies the Jenkins shared pool Application (lives outside
        the app-of-apps watch path). Waits for the Jenkins controller pod to be Running.
    #>
    Write-Log info '====== Step 5/5: Deploy Jenkins Shared Pool ======'

    $poolFile = Join-Path $script:RepoRoot 'gitops' 'application-plane' 'local' 'pooled-envs' 'pool-1.yaml'
    Invoke-CommandSafe kubectl, 'apply', '-f', $poolFile | Out-Null

    Write-Log info '  Waiting for Jenkins pool controller pod to be Running...'
    Wait-ForCondition -Description 'Jenkins pool controller Running' -TimeoutSeconds $script:TimeoutJenkinsPool -IntervalSeconds 20 -Condition {
        $pods = & kubectl get pods -n $script:JenkinsPoolNamespace -l 'app.kubernetes.io/component=jenkins-controller' --no-headers 2>&1
        $lines = @(($pods -split "`n") | Where-Object { $_ -match '\S' })
        $running = @($lines | Where-Object { $_ -match '\s+Running\s+' })
        return $running.Count -gt 0
    }

    Write-Log info '====== Step 5/5 COMPLETE: Jenkins Pool deployed ======'
    Write-Log info '  Jenkins Pool-1 : http://localhost:32000'
    Write-Log info '  Jenkins Basic  : http://localhost:32001'
}

function Deploy-AllStacks {
    <#
    .SYNOPSIS
        Orchestrates the full deployment sequence: Steps 1–5 in order.
        Logs progress and rethrows on failure.
    #>
    Write-Log info '########## DEPLOY: Full GitOps Stack ##########'

    $steps = @(
        @{ Name = 'Install ArgoCD';              Fn = { Install-ArgoCD } },
        @{ Name = 'Apply AppProjects';           Fn = { Apply-AppProjects } },
        @{ Name = 'Deploy Infrastructure';       Fn = { Deploy-Infrastructure } },
        @{ Name = 'Deploy Tenants';              Fn = { Deploy-Tenants } },
        @{ Name = 'Deploy Jenkins Pool';         Fn = { Deploy-JenkinsPool } }
    )

    for ($i = 0; $i -lt $steps.Count; $i++) {
        $step = $steps[$i]
        Write-Log info "--- Step $($i+1)/$($steps.Count): $($step.Name) ---"
        try {
            & $step.Fn
            Write-Log info "--- Step $($i+1)/$($steps.Count) COMPLETE: $($step.Name) ---"
        }
        catch {
            Write-Log error "--- Step $($i+1)/$($steps.Count) FAILED: $($step.Name) ---"
            Write-Log error "Error: $_"
            throw
        }
    }

    Write-Log info '########## DEPLOY COMPLETE ##########'
    Get-PlatformStatus
}

# ============================================================================
# PHASE 4 — STATUS AND CLEANUP FUNCTIONS
# ============================================================================

function Get-PlatformStatus {
    <#
    .SYNOPSIS
        Prints and logs the health of all platform components: ArgoCD Applications,
        namespaces, pods, and Elasticsearch cluster health.
    #>
    Write-Log info '====== Platform Status ======'

    $checks = @(
        @{ Label = 'ArgoCD Applications';         Args = @('kubectl','get','applications','-n',$script:ArgoCDNamespace) },
        @{ Label = 'Namespaces (platform)';       Args = @('kubectl','get','namespaces') },
        @{ Label = "Pods (argocd)";               Args = @('kubectl','get','pods','-n',$script:ArgoCDNamespace) },
        @{ Label = "Pods (monitoring)";           Args = @('kubectl','get','pods','-n',$script:MonitoringNamespace) },
        @{ Label = "Pods (elastic-system)";       Args = @('kubectl','get','pods','-n',$script:ElasticSystemNamespace) },
        @{ Label = "Pods (logging)";              Args = @('kubectl','get','pods','-n',$script:LoggingNamespace) },
        @{ Label = "Pods ($($script:JenkinsPoolNamespace))";  Args = @('kubectl','get','pods','-n',$script:JenkinsPoolNamespace) },
        @{ Label = 'Elasticsearch health';        Args = @('kubectl','get','elasticsearch','-n',$script:LoggingNamespace) },
        @{ Label = "Pods (awx)";                  Args = @('kubectl','get','pods','-n',$script:AWXNamespace) },
        @{ Label = 'AWX instances';               Args = @('kubectl','get','awx','-n',$script:AWXNamespace) }
    )

    foreach ($check in $checks) {
        Write-Log info "  -- $($check.Label) --"
        try {
            $out = Invoke-CommandSafe @($check.Args)
            foreach ($line in ($out -split "`n")) {
                Write-Log info "    $line"
            }
        }
        catch {
            Write-Log warn "    Could not retrieve $($check.Label): $_"
        }
    }

    Write-Log info '====== Status check complete ======'
}

function Remove-JenkinsPool {
    <#
    .SYNOPSIS
        Cleanup C1 — Patches finalizer on the Jenkins pool Application, deletes it,
        waits for ArgoCD cascade to remove workloads, explicitly deletes the namespace,
        and cleans up orphaned PVCs.
    #>
    Write-Log info '====== Cleanup C1: Remove Jenkins Pool ======'

    try {
        Invoke-CommandSafe kubectl, 'patch', 'application', 'jenkins-pool-1-local',
            '-n', $script:ArgoCDNamespace, '--type=merge',
            '-p', '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}' | Out-Null
        Invoke-CommandSafe kubectl, 'delete', 'application', 'jenkins-pool-1-local',
            '-n', $script:ArgoCDNamespace | Out-Null
    }
    catch {
        Write-Log warn "  jenkins-pool-1-local Application may not exist: $_"
    }

    # Wait for ArgoCD cascade to remove all pods from the namespace (but not the namespace itself)
    Write-Log info "  Waiting for ArgoCD cascade deletion to clear $($script:JenkinsPoolNamespace) pods (30s)..."
    Start-Sleep -Seconds 30

    # Clean orphaned PVCs before namespace deletion (PVCs can block namespace termination)
    try {
        $pvcs = (& kubectl get pvc -n $script:JenkinsPoolNamespace --no-headers 2>&1)
        if ($pvcs -match '\S' -and $pvcs -notmatch 'not found') {
            Write-Log warn "  Deleting orphaned PVCs in $($script:JenkinsPoolNamespace)..."
            & kubectl delete pvc --all -n $script:JenkinsPoolNamespace 2>&1 | Out-Null
        }
    }
    catch { Write-Log debug "  No PVCs to clean in $($script:JenkinsPoolNamespace): $_" }

    # Explicitly delete the namespace — ArgoCD cascade removes resources but never deletes the namespace itself
    Write-Log info "  Deleting namespace: $($script:JenkinsPoolNamespace)"
    try {
        & kubectl delete namespace $script:JenkinsPoolNamespace --ignore-not-found 2>&1 | Out-Null
    }
    catch { Write-Log warn "  Could not issue namespace delete for $($script:JenkinsPoolNamespace): $_" }

    # Wait for namespace termination
    Wait-ForCondition -Description "namespace $($script:JenkinsPoolNamespace) removed" -TimeoutSeconds $script:TimeoutNamespaceDel -IntervalSeconds 10 -Condition {
        $out = & kubectl get namespace $script:JenkinsPoolNamespace 2>&1
        $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
    }

    Write-Log info '====== Cleanup C1 COMPLETE ======'
}

function Remove-TenantsApp {
    <#
    .SYNOPSIS
        Cleanup C2 — Patches finalizer on the tenant App-of-Apps, deletes it, and
        waits for all Jenkins tenant child Applications to be removed.
    #>
    Write-Log info '====== Cleanup C2: Remove Tenant App-of-Apps ======'

    try {
        Invoke-CommandSafe kubectl, 'patch', 'application', 'app-of-apps-local',
            '-n', $script:ArgoCDNamespace, '--type=merge',
            '-p', '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}' | Out-Null
        Invoke-CommandSafe kubectl, 'delete', 'application', 'app-of-apps-local',
            '-n', $script:ArgoCDNamespace | Out-Null
    }
    catch {
        Write-Log warn "  app-of-apps-local Application may not exist: $_"
    }

    # Wait for child Jenkins Applications to be removed
    Wait-ForCondition -Description 'Jenkins tenant Applications removed' -TimeoutSeconds 120 -IntervalSeconds 10 -Condition {
        $apps = & kubectl get applications -n $script:ArgoCDNamespace --no-headers -o custom-columns=NAME:.metadata.name 2>&1
        $remaining = @(($apps -split "`n") | Where-Object { $_ -match 'jenkins-.*-local' })
        return $remaining.Count -eq 0
    }

    Write-Log info '====== Cleanup C2 COMPLETE ======'
}

function Remove-InfrastructureApp {
    <#
    .SYNOPSIS
        Cleanup C3 — Patches finalizer on the infrastructure App-of-Apps, deletes it,
        waits for cascade, then manually removes the monitoring, logging, and
        elastic-system namespaces along with any orphaned PVCs.
    #>
    Write-Log info '====== Cleanup C3: Remove Infrastructure App-of-Apps ======'

    try {
        Invoke-CommandSafe kubectl, 'patch', 'application', 'app-of-apps-infrastructure-local',
            '-n', $script:ArgoCDNamespace, '--type=merge',
            '-p', '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}' | Out-Null
        Invoke-CommandSafe kubectl, 'delete', 'application', 'app-of-apps-infrastructure-local',
            '-n', $script:ArgoCDNamespace | Out-Null
    }
    catch {
        Write-Log warn "  app-of-apps-infrastructure-local may not exist: $_"
    }

    # Wait briefly for cascade to start
    Write-Log info '  Waiting for ArgoCD cascade deletion to propagate (30s)...'
    Start-Sleep -Seconds 30

    # monitoring namespace
    Write-Log info "  Cleaning up namespace: $($script:MonitoringNamespace)"
    try {
        & kubectl delete pvc --all -n $script:MonitoringNamespace 2>&1 | Out-Null
    }
    catch { Write-Log debug "  No PVCs in $($script:MonitoringNamespace)" }
    try {
        & kubectl delete namespace $script:MonitoringNamespace --ignore-not-found 2>&1 | Out-Null
        Wait-ForCondition -Description "namespace $($script:MonitoringNamespace) removed" -TimeoutSeconds $script:TimeoutMonitoringDel -IntervalSeconds 10 -Condition {
            $out = & kubectl get namespace $script:MonitoringNamespace 2>&1
            $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
        }
    }
    catch { Write-Log warn "  Could not delete $($script:MonitoringNamespace): $_" }

    # logging namespace
    Write-Log info "  Cleaning up namespace: $($script:LoggingNamespace)"
    try {
        & kubectl delete pvc --all -n $script:LoggingNamespace 2>&1 | Out-Null
    }
    catch { Write-Log debug "  No PVCs in $($script:LoggingNamespace)" }
    try {
        & kubectl delete namespace $script:LoggingNamespace --ignore-not-found 2>&1 | Out-Null
        Wait-ForCondition -Description "namespace $($script:LoggingNamespace) removed" -TimeoutSeconds $script:TimeoutLoggingDel -IntervalSeconds 10 -Condition {
            $out = & kubectl get namespace $script:LoggingNamespace 2>&1
            $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
        }
    }
    catch { Write-Log warn "  Could not delete $($script:LoggingNamespace): $_" }

    # elastic-system namespace
    Write-Log info "  Cleaning up namespace: $($script:ElasticSystemNamespace)"
    try {
        & kubectl delete namespace $script:ElasticSystemNamespace --ignore-not-found 2>&1 | Out-Null
        Wait-ForCondition -Description "namespace $($script:ElasticSystemNamespace) removed" -TimeoutSeconds $script:TimeoutElasticDel -IntervalSeconds 10 -Condition {
            $out = & kubectl get namespace $script:ElasticSystemNamespace 2>&1
            $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
        }
    }
    catch { Write-Log warn "  Could not delete $($script:ElasticSystemNamespace): $_" }

    Write-Log info '====== Cleanup C3 COMPLETE ======'
}

function Remove-AWXApp {
    <#
    .SYNOPSIS
        Cleanup C3b — Patches finalizer on the AWX Operator Application, deletes it,
        waits for ArgoCD cascade to remove AWX workloads, and explicitly removes the
        awx namespace along with any orphaned PVCs (PostgreSQL data).
    #>
    Write-Log info '====== Cleanup C3b: Remove AWX Operator App ======'

    try {
        Invoke-CommandSafe kubectl, 'patch', 'application', 'awx-operator-local',
            '-n', $script:ArgoCDNamespace, '--type=merge',
            '-p', '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}' | Out-Null
        Invoke-CommandSafe kubectl, 'delete', 'application', 'awx-operator-local',
            '-n', $script:ArgoCDNamespace | Out-Null
    }
    catch {
        Write-Log warn "  awx-operator-local Application may not exist: $_"
    }

    # Wait for ArgoCD cascade to start removing AWX resources
    Write-Log info "  Waiting for ArgoCD cascade deletion to propagate (30s)..."
    Start-Sleep -Seconds 30

    # Clean orphaned PVCs (PostgreSQL data) before namespace deletion
    try {
        $pvcs = (& kubectl get pvc -n $script:AWXNamespace --no-headers 2>&1)
        if ($pvcs -match '\S' -and $pvcs -notmatch 'not found') {
            Write-Log warn "  Deleting orphaned PVCs in $($script:AWXNamespace)..."
            & kubectl delete pvc --all -n $script:AWXNamespace 2>&1 | Out-Null
        }
    }
    catch { Write-Log debug "  No PVCs to clean in $($script:AWXNamespace): $_" }

    # Explicitly delete the awx namespace
    Write-Log info "  Deleting namespace: $($script:AWXNamespace)"
    try {
        & kubectl delete namespace $script:AWXNamespace --ignore-not-found 2>&1 | Out-Null
        Wait-ForCondition -Description "namespace $($script:AWXNamespace) removed" -TimeoutSeconds $script:TimeoutAWXDel -IntervalSeconds 10 -Condition {
            $out = & kubectl get namespace $script:AWXNamespace 2>&1
            $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
        }
    }
    catch { Write-Log warn "  Could not delete $($script:AWXNamespace): $_" }

    Write-Log info '====== Cleanup C3b COMPLETE ======'
}

function Remove-AppProjects {
    <#
    .SYNOPSIS
        Cleanup C4 — Deletes the three ArgoCD AppProject manifests and verifies
        they are gone.
    #>
    Write-Log info '====== Cleanup C4: Remove AppProjects ======'

    $projectsDir = Join-Path $script:RepoRoot 'gitops' 'bootstrap' 'projects'
    try {
        Invoke-CommandSafe kubectl, 'delete', '-f', $projectsDir | Out-Null
    }
    catch {
        Write-Log warn "  AppProjects may already be absent: $_"
    }

    Wait-ForCondition -Description 'AppProjects removed' -TimeoutSeconds 60 -IntervalSeconds 5 -Condition {
        $out = & kubectl get appprojects -n $script:ArgoCDNamespace --no-headers 2>&1
        $remaining = @(($out -split "`n") | Where-Object { $_ -match '\S' -and $_ -notmatch 'default' })
        return $remaining.Count -eq 0
    }

    Write-Log info '====== Cleanup C4 COMPLETE ======'
}

function Remove-ArgoCD {
    <#
    .SYNOPSIS
        Cleanup C5 — Uninstalls the ArgoCD Helm release, clears any lingering
        finalizers, and deletes the argocd namespace.
    #>
    Write-Log info '====== Cleanup C5: Uninstall ArgoCD ======'

    try {
        Invoke-CommandSafe helm, 'uninstall', 'argocd', '--namespace', $script:ArgoCDNamespace | Out-Null
    }
    catch {
        Write-Log warn "  ArgoCD Helm release may not be installed: $_"
    }

    # Clear any remaining finalizers
    Clear-ArgoCDFinalizers

    # Delete the namespace
    try {
        Invoke-CommandSafe kubectl, 'delete', 'namespace', $script:ArgoCDNamespace, '--ignore-not-found' | Out-Null
        Wait-ForCondition -Description "namespace $($script:ArgoCDNamespace) removed" -TimeoutSeconds $script:TimeoutArgoCDNamespaceDel -IntervalSeconds 5 -Condition {
            $out = & kubectl get namespace $script:ArgoCDNamespace 2>&1
            $LASTEXITCODE -ne 0 -or "$out" -match 'not found'
        }
    }
    catch { Write-Log warn "  Could not cleanly delete argocd namespace: $_" }

    Write-Log info '====== Cleanup C5 COMPLETE ======'
}

function Remove-OrphanedResources {
    <#
    .SYNOPSIS
        Cleanup C6 — Lists orphaned PersistentVolumes in Released/Failed state and
        optionally removes ArgoCD and ECK CRDs. Prompts the user before each category.
    #>
    Write-Log info '====== Cleanup C6: Orphaned Resources & Optional CRD Removal ======'

    # Check for orphaned PVs
    $pvLines = @((& kubectl get pv --no-headers 2>&1) -split "`n" | Where-Object { $_ -match 'Released|Failed' })
    if ($pvLines.Count -gt 0) {
        Write-Log warn "  Found $($pvLines.Count) orphaned PersistentVolume(s):"
        $pvLines | ForEach-Object { Write-Log warn "    $_" }
        $answer = Read-Host '  Delete these PersistentVolumes? (y/N)'
        if ($answer -match '^[Yy]$') {
            foreach ($pv in $pvLines) {
                $pvName = ($pv -split '\s+')[0]
                Write-Log info "  Deleting PV: $pvName"
                & kubectl delete pv $pvName 2>&1 | Out-Null
            }
        }
        else {
            Write-Log info '  Skipping PV deletion.'
        }
    }
    else {
        Write-Log info '  No orphaned PersistentVolumes found.'
    }

    # Optional ArgoCD CRD removal
    $argocrds = @((& kubectl get crd --no-headers -o custom-columns=NAME:.metadata.name 2>&1) -split "`n" | Where-Object { $_ -match 'argoproj\.io' })
    if ($argocrds.Count -gt 0) {
        Write-Log info "  ArgoCD CRDs found: $($argocrds -join ', ')"
        $answer = Read-Host '  Remove ArgoCD CRDs? (y/N — safe to leave if re-installing soon)'
        if ($answer -match '^[Yy]$') {
            foreach ($crd in $argocrds) {
                & kubectl delete crd $crd 2>&1 | Out-Null
                Write-Log info "  Deleted CRD: $crd"
            }
        }
        else {
            Write-Log info '  Skipping ArgoCD CRD deletion.'
        }
    }
    else {
        Write-Log info '  No ArgoCD CRDs found.'
    }

    # Optional ECK CRD removal
    $eckcrds = @((& kubectl get crd --no-headers -o custom-columns=NAME:.metadata.name 2>&1) -split "`n" | Where-Object { $_ -match 'k8s\.elastic\.co' })
    if ($eckcrds.Count -gt 0) {
        Write-Log info "  ECK CRDs found: $($eckcrds -join ', ')"
        $answer = Read-Host '  Remove ECK CRDs? (y/N — safe to leave if re-installing soon)'
        if ($answer -match '^[Yy]$') {
            foreach ($crd in $eckcrds) {
                & kubectl delete crd $crd 2>&1 | Out-Null
                Write-Log info "  Deleted CRD: $crd"
            }
        }
        else {
            Write-Log info '  Skipping ECK CRD deletion.'
        }
    }
    else {
        Write-Log info '  No ECK CRDs found.'
    }

    # Optional AWX CRD removal
    $awxcrds = @((& kubectl get crd --no-headers -o custom-columns=NAME:.metadata.name 2>&1) -split "`n" | Where-Object { $_ -match 'ansible\.com' })
    if ($awxcrds.Count -gt 0) {
        Write-Log info "  AWX CRDs found: $($awxcrds -join ', ')"
        $answer = Read-Host '  Remove AWX CRDs? (y/N — safe to leave if re-installing soon)'
        if ($answer -match '^[Yy]$') {
            foreach ($crd in $awxcrds) {
                & kubectl delete crd $crd 2>&1 | Out-Null
                Write-Log info "  Deleted CRD: $crd"
            }
        }
        else {
            Write-Log info '  Skipping AWX CRD deletion.'
        }
    }
    else {
        Write-Log info '  No AWX CRDs found.'
    }

    Write-Log info '====== Cleanup C6 COMPLETE ======'
}

function Invoke-FullCleanup {
    <#
    .SYNOPSIS
        Orchestrates the full teardown sequence: Cleanup C1–C6 in order.
        Displays a destructive-action warning and requires explicit 'y' confirmation.
    #>

    Write-Host ''
    Write-Host '╔══════════════════════════════════════════════════════════════╗' -ForegroundColor Red
    Write-Host '║              ⚠  DESTRUCTIVE OPERATION WARNING  ⚠             ║' -ForegroundColor Red
    Write-Host '╠══════════════════════════════════════════════════════════════╣' -ForegroundColor Red
    Write-Host '║  This will permanently delete ALL platform resources:        ║' -ForegroundColor Red
    Write-Host '║    • Jenkins workloads and jobs                               ║' -ForegroundColor Red
    Write-Host '║    • Prometheus metrics (all history)                         ║' -ForegroundColor Red
    Write-Host '║    • Elasticsearch indexes (all logs)                         ║' -ForegroundColor Red
    Write-Host '║    • AWX jobs, inventories, and credentials                   ║' -ForegroundColor Red
    Write-Host '║    • ArgoCD Applications and configuration                    ║' -ForegroundColor Red
    Write-Host '║    • All GitOps platform namespaces                           ║' -ForegroundColor Red
    Write-Host '║                                                               ║' -ForegroundColor Red
    Write-Host '║  There is NO rollback.                                        ║' -ForegroundColor Red
    Write-Host '╚══════════════════════════════════════════════════════════════╝' -ForegroundColor Red
    Write-Host ''

    $answer = Read-Host 'Type "y" to proceed with full cleanup, or anything else to abort'
    if ($answer -notmatch '^[Yy]$') {
        Write-Log info 'Cleanup aborted by user.'
        return
    }

    Write-Log info '########## CLEANUP: Full GitOps Stack Teardown ##########'

    $steps = @(
        @{ Name = 'Remove Jenkins Pool';         Fn = { Remove-JenkinsPool } },
        @{ Name = 'Remove Tenant App-of-Apps';   Fn = { Remove-TenantsApp } },
        @{ Name = 'Remove Infrastructure App';   Fn = { Remove-InfrastructureApp } },
        @{ Name = 'Remove AWX App';              Fn = { Remove-AWXApp } },
        @{ Name = 'Remove AppProjects';          Fn = { Remove-AppProjects } },
        @{ Name = 'Uninstall ArgoCD';            Fn = { Remove-ArgoCD } },
        @{ Name = 'Remove Orphaned Resources';   Fn = { Remove-OrphanedResources } }
    )

    for ($i = 0; $i -lt $steps.Count; $i++) {
        $step = $steps[$i]
        Write-Log info "--- Cleanup $($i+1)/$($steps.Count): $($step.Name) ---"
        try {
            & $step.Fn
            Write-Log info "--- Cleanup $($i+1)/$($steps.Count) COMPLETE: $($step.Name) ---"
        }
        catch {
            Write-Log error "--- Cleanup $($i+1)/$($steps.Count) FAILED: $($step.Name) ---"
            Write-Log error "Error: $_"
            Write-Log warn 'Continuing with remaining cleanup steps...'
        }
    }

    Write-Log info '########## CLEANUP COMPLETE ##########'

    # Final verification
    Write-Log info '--- Final cleanup verification ---'
    $checkNs = @($script:ArgoCDNamespace, $script:MonitoringNamespace, $script:ElasticSystemNamespace, $script:LoggingNamespace, $script:JenkinsPoolNamespace, $script:AWXNamespace)
    foreach ($ns in $checkNs) {
        $out = & kubectl get namespace $ns 2>&1
        if ($LASTEXITCODE -ne 0 -or "$out" -match 'not found') {
            Write-Log info "  [GONE] namespace/$ns"
        }
        else {
            Write-Log warn "  [STILL EXISTS] namespace/$ns — may need manual intervention"
        }
    }
}

# ============================================================================
# PHASE 5 — ORCHESTRATION AND ENTRY POINT
# ============================================================================

function Show-StepMenu {
    <#
    .SYNOPSIS
        Sub-menu for running individual deployment steps in isolation.
    #>
    do {
        Write-Host ''
        Write-Host '  --- Individual Deployment Steps ---' -ForegroundColor Cyan
        Write-Host '  [1] Step 1: Install ArgoCD'
        Write-Host '  [2] Step 2: Apply AppProjects'
        Write-Host '  [3] Step 3: Deploy Infrastructure (kube-prometheus-stack + ELK)'
        Write-Host '  [4] Step 4: Deploy Tenant App-of-Apps (Jenkins)'
        Write-Host '  [5] Step 5: Deploy Jenkins Shared Pool'
        Write-Host '  [0] Back to main menu'
        Write-Host ''

        $choice = Read-Host '  Select step'
        switch ($choice) {
            '1' { Install-ArgoCD }
            '2' { Apply-AppProjects }
            '3' { Deploy-Infrastructure }
            '4' { Deploy-Tenants }
            '5' { Deploy-JenkinsPool }
            '0' { return }
            default { Write-Log warn "  Invalid selection: '$choice'" }
        }
    } while ($true)
}

function Show-MainMenu {
    <#
    .SYNOPSIS
        Interactive numbered menu. Loops until the user selects Exit.
    #>
    do {
        # Compute dynamic box width so the frame always fits the longest line
        $title     = '  GitOps Local Stack — Deployment Manager'
        $infoLines = @(
            "  Repo  : $($script:ParamRepoUrl)",
            "  Rev   : $($script:ParamTargetRevision)",
            "  Root  : $($script:RepoRoot)"
        )
        $menuLines = @(
            '  [1] Deploy full stack',
            '  [2] Deploy individual step',
            '  [3] Check platform status',
            '  [4] Cleanup / Teardown',
            '  [5] Exit'
        )

        # Inner width = longest content + 2 (right-side padding), minimum 56
        $maxLen  = (@($title) + $infoLines + $menuLines |
                    Measure-Object -Property Length -Maximum).Maximum
        $innerW  = [Math]::Max($maxLen + 2, 56)

        $hBorder = '═' * $innerW
        $top     = "╔$hBorder╗"
        $sep     = "╠$hBorder╣"
        $bot     = "╚$hBorder╝"

        Write-Host ''
        Write-Host $top -ForegroundColor Cyan
        Write-Host "║$($title.PadRight($innerW))║" -ForegroundColor Cyan
        Write-Host $sep -ForegroundColor Cyan
        foreach ($line in $infoLines) {
            Write-Host "║$($line.PadRight($innerW))║" -ForegroundColor Cyan
        }
        Write-Host $sep -ForegroundColor Cyan
        foreach ($line in $menuLines) {
            Write-Host "║$($line.PadRight($innerW))║"
        }
        Write-Host $bot -ForegroundColor Cyan
        Write-Host ''

        $choice = Read-Host 'Select option'
        switch ($choice) {
            '1' {
                Deploy-AllStacks
            }
            '2' {
                Show-StepMenu
            }
            '3' {
                Get-PlatformStatus
            }
            '4' {
                Invoke-FullCleanup
            }
            '5' {
                Write-Log info "Exiting. Log file: $script:LogFile"
                return
            }
            default {
                Write-Log warn "Invalid selection: '$choice'. Enter 1–5."
            }
        }
    } while ($true)
}

function Main {
    <#
    .SYNOPSIS
        Script entry point. Initialises logging, validates inputs, runs prerequisite
        and cluster checks, then dispatches to the requested action.
    #>

    # ── Transfer parameters to script-scoped variables ──────────────────────
    # (allows functions to access them without passing as arguments)
    $script:ParamGitopsPath     = $GitopsPath
    $script:ParamRepoUrl        = $RepoUrl
    $script:ParamTargetRevision = $TargetRevision
    $script:ParamLogPath        = $LogPath

    # ── Resolve LogPath and initialise log file ──────────────────────────────
    if ([string]::IsNullOrWhiteSpace($script:ParamLogPath) -or $script:ParamLogPath -eq '.') {
        $script:ParamLogPath = (Get-Location).Path
    }
    if (-not (Test-Path $script:ParamLogPath -PathType Container)) {
        New-Item -ItemType Directory -Path $script:ParamLogPath -Force | Out-Null
    }
    $timestamp          = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $script:LogFile     = Join-Path $script:ParamLogPath "deploy-gitops-$timestamp.log"
    # Create the log file
    $null = New-Item -ItemType File -Path $script:LogFile -Force

    Write-Log info "deploy-gitops-stacks-local.ps1 — starting"
    Write-Log info "Log file: $script:LogFile"
    Write-Log info "PowerShell version: $($PSVersionTable.PSVersion)"
    Write-Log info "OS: $($PSVersionTable.OS)"

    # ── Validate user inputs ─────────────────────────────────────────────────
    Confirm-UserInput

    # After Confirm-UserInput, GitopsPath is fully resolved
    $script:RepoRoot = $script:ParamGitopsPath

    Write-Log info "GitOps root  : $script:RepoRoot"
    Write-Log info "Repo URL     : $script:ParamRepoUrl"
    Write-Log info "Revision     : $script:ParamTargetRevision"
    Write-Log info "Log level    : $LogLevel"
    Write-Log info "Action       : $Action"

    # ── Prerequisites ────────────────────────────────────────────────────────
    Test-Prerequisites

    # ── Cluster connectivity ─────────────────────────────────────────────────
    Test-ClusterConnectivity

    # ── GitOps path validation ──────────────────────────────────────────────
    Test-GitopsPath

    # ── Dispatch ─────────────────────────────────────────────────────────────
    switch ($Action) {
        'deploy'  { Deploy-AllStacks }
        'status'  { Get-PlatformStatus }
        'cleanup' { Invoke-FullCleanup }
        'menu'    { Show-MainMenu }
    }

    Write-Log info "deploy-gitops-stacks-local.ps1 — done. Log: $script:LogFile"
}

# ============================================================================
# Global error trap — catches unhandled exceptions and exits cleanly
# ============================================================================
trap {
    $msg = $_.Exception.Message
    if ($script:LogFile) {
        $ts = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
        Add-Content -Path $script:LogFile -Value "[$ts] [ERROR] Unhandled exception: $msg" -Encoding UTF8
    }
    Write-Host "[ERROR] Unhandled exception: $msg" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Entry point
# ============================================================================
Main
