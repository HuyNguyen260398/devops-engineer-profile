# Jenkins Deployment Helper Script
# PowerShell script for common Jenkins deployment tasks

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'staging', 'production')]
    [string]$Environment = 'local',
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('install', 'upgrade', 'uninstall', 'status', 'test', 'port-forward')]
    [string]$Action = 'status'
)

# Configuration
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HelmDir = Join-Path $ScriptDir "helm"
$ValuesFile = Join-Path $HelmDir "values" "values-$Environment.yaml"
$NamespaceMap = @{
    'local' = 'jenkins'
    'staging' = 'jenkins-staging'
    'production' = 'jenkins-production'
}
$Namespace = $NamespaceMap[$Environment]

# Helper functions
function Write-ColorOutput {
    param([string]$Message, [string]$Color = 'White')
    Write-Host $Message -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorOutput "🔍 Checking prerequisites..." "Cyan"
    
    # Check kubectl
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "❌ kubectl not found. Please install kubectl." "Red"
        exit 1
    }
    
    # Check helm
    if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "❌ helm not found. Please install Helm 3." "Red"
        exit 1
    }
    
    # Check cluster connectivity
    try {
        kubectl cluster-info | Out-Null
        Write-ColorOutput "✅ Connected to Kubernetes cluster" "Green"
    }
    catch {
        Write-ColorOutput "❌ Cannot connect to Kubernetes cluster" "Red"
        exit 1
    }
    
    # Check if values file exists
    if (-not (Test-Path $ValuesFile)) {
        Write-ColorOutput "❌ Values file not found: $ValuesFile" "Red"
        exit 1
    }
    
    Write-ColorOutput "✅ All prerequisites met" "Green"
}

function Install-Jenkins {
    Write-ColorOutput "🚀 Installing Jenkins for $Environment environment..." "Cyan"
    
    # Update Helm dependencies
    Write-ColorOutput "📦 Updating Helm dependencies..." "Yellow"
    Push-Location $HelmDir
    helm dependency update
    Pop-Location
    
    # Create namespace
    Write-ColorOutput "📝 Creating namespace: $Namespace" "Yellow"
    kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Jenkins
    Write-ColorOutput "⚙️  Installing Jenkins Helm chart..." "Yellow"
    $timeout = if ($Environment -eq 'production') { '15m' } else { '10m' }
    
    helm install jenkins $HelmDir `
        --values $ValuesFile `
        --namespace $Namespace `
        --timeout $timeout `
        --wait
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Jenkins installed successfully!" "Green"
        Get-JenkinsStatus
    }
    else {
        Write-ColorOutput "❌ Jenkins installation failed" "Red"
        exit 1
    }
}

function Upgrade-Jenkins {
    Write-ColorOutput "🔄 Upgrading Jenkins for $Environment environment..." "Cyan"
    
    # Update Helm dependencies
    Write-ColorOutput "📦 Updating Helm dependencies..." "Yellow"
    Push-Location $HelmDir
    helm dependency update
    Pop-Location
    
    # Upgrade Jenkins
    Write-ColorOutput "⚙️  Upgrading Jenkins Helm chart..." "Yellow"
    $timeout = if ($Environment -eq 'production') { '15m' } else { '10m' }
    
    helm upgrade jenkins $HelmDir `
        --values $ValuesFile `
        --namespace $Namespace `
        --timeout $timeout `
        --wait
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Jenkins upgraded successfully!" "Green"
        Get-JenkinsStatus
    }
    else {
        Write-ColorOutput "❌ Jenkins upgrade failed" "Red"
        exit 1
    }
}

function Uninstall-Jenkins {
    Write-ColorOutput "🗑️  Uninstalling Jenkins from $Environment environment..." "Yellow"
    
    $confirmation = Read-Host "Are you sure you want to uninstall Jenkins from $Namespace? (yes/no)"
    if ($confirmation -ne 'yes') {
        Write-ColorOutput "❌ Uninstall cancelled" "Yellow"
        return
    }
    
    helm uninstall jenkins --namespace $Namespace
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Jenkins uninstalled successfully" "Green"
        Write-ColorOutput "Note: PVCs are not deleted automatically. Remove manually if needed." "Yellow"
    }
    else {
        Write-ColorOutput "❌ Jenkins uninstall failed" "Red"
    }
}

function Get-JenkinsStatus {
    Write-ColorOutput "`n📊 Jenkins Status for $Environment environment:" "Cyan"
    
    # Helm release status
    Write-ColorOutput "`n🎯 Helm Release:" "Yellow"
    helm list --namespace $Namespace
    
    # Pods
    Write-ColorOutput "`n🔹 Pods:" "Yellow"
    kubectl get pods --namespace $Namespace -l app.kubernetes.io/name=jenkins
    
    # Services
    Write-ColorOutput "`n🌐 Services:" "Yellow"
    kubectl get svc --namespace $Namespace -l app.kubernetes.io/name=jenkins
    
    # PVC
    Write-ColorOutput "`n💾 Persistent Volumes:" "Yellow"
    kubectl get pvc --namespace $Namespace
    
    # Ingress (if exists)
    $ingress = kubectl get ingress --namespace $Namespace 2>$null
    if ($ingress) {
        Write-ColorOutput "`n🔗 Ingress:" "Yellow"
        kubectl get ingress --namespace $Namespace
    }
    
    # Get admin password
    Write-ColorOutput "`n🔑 Admin Credentials:" "Yellow"
    try {
        $secretName = if ($Environment -eq 'local') { 'jenkins' } else { 'jenkins-admin-credentials' }
        $password = kubectl get secret $secretName -n $Namespace -o jsonpath="{.data.jenkins-admin-password}" 2>$null
        if ($password) {
            $decodedPassword = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($password))
            Write-ColorOutput "Username: admin" "White"
            Write-ColorOutput "Password: $decodedPassword" "White"
        }
    }
    catch {
        Write-ColorOutput "Could not retrieve admin password" "Red"
    }
}

function Test-Jenkins {
    Write-ColorOutput "🧪 Running tests for Jenkins deployment..." "Cyan"
    
    # Test Helm chart
    Write-ColorOutput "`n📝 Validating Helm chart..." "Yellow"
    Push-Location $HelmDir
    helm dependency update
    Pop-Location
    
    helm lint $HelmDir --values $ValuesFile
    
    # Dry run
    Write-ColorOutput "`n🔍 Performing dry-run..." "Yellow"
    helm install jenkins-test $HelmDir `
        --values $ValuesFile `
        --namespace $Namespace `
        --dry-run --debug
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "`n✅ All tests passed!" "Green"
    }
    else {
        Write-ColorOutput "`n❌ Tests failed" "Red"
    }
}

function Start-PortForward {
    Write-ColorOutput "🔌 Setting up port-forward to Jenkins..." "Cyan"
    
    $localPort = switch ($Environment) {
        'local' { 8080 }
        'staging' { 8081 }
        'production' { 8082 }
    }
    
    Write-ColorOutput "Forwarding localhost:$localPort -> jenkins:8080 in namespace $Namespace" "Yellow"
    Write-ColorOutput "Press Ctrl+C to stop port-forwarding`n" "Yellow"
    
    kubectl port-forward svc/jenkins $localPort:8080 --namespace $Namespace
}

# Main execution
Write-ColorOutput "╔═══════════════════════════════════════════════╗" "Cyan"
Write-ColorOutput "║     Jenkins Deployment Helper Script         ║" "Cyan"
Write-ColorOutput "╚═══════════════════════════════════════════════╝" "Cyan"
Write-ColorOutput "Environment: $Environment" "White"
Write-ColorOutput "Action: $Action" "White"
Write-ColorOutput "Namespace: $Namespace`n" "White"

Test-Prerequisites

switch ($Action) {
    'install' { Install-Jenkins }
    'upgrade' { Upgrade-Jenkins }
    'uninstall' { Uninstall-Jenkins }
    'status' { Get-JenkinsStatus }
    'test' { Test-Jenkins }
    'port-forward' { Start-PortForward }
}

Write-ColorOutput "`n✨ Done!" "Green"
