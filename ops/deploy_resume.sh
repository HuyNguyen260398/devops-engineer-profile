#!/bin/bash
# ============================================================================
# Resume PDF Deployment Script
# ============================================================================
# This script deploys the Terraform infrastructure and uploads the resume PDF
# Usage: ./deploy_resume.sh [init|plan|apply|upload|destroy]
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../inf/terraform/aws-s3-resume"
OPS_DIR="${SCRIPT_DIR}/../ops"
TFVARS_FILE="${TERRAFORM_DIR}/environments/production.tfvars"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install Terraform."
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log_success "All dependencies are installed."
}

terraform_init() {
    log_info "Initializing Terraform..."
    cd "${TERRAFORM_DIR}"
    terraform init
    log_success "Terraform initialized."
}

terraform_plan() {
    log_info "Planning Terraform changes..."
    cd "${TERRAFORM_DIR}"
    terraform plan -var-file="${TFVARS_FILE}" -out=tfplan
    log_success "Terraform plan complete. Review the changes above."
}

terraform_apply() {
    log_info "Applying Terraform configuration..."
    cd "${TERRAFORM_DIR}"
    
    if [ ! -f "tfplan" ]; then
        log_warning "No plan file found. Running plan first..."
        terraform_plan
    fi
    
    terraform apply tfplan
    rm -f tfplan
    log_success "Terraform apply complete!"
    
    # Extract outputs
    log_info "Extracting CloudFront information..."
    CLOUDFRONT_URL=$(terraform output -raw cloudfront_url 2>/dev/null || echo "")
    BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
    DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
    
    if [ -n "${CLOUDFRONT_URL}" ]; then
        log_success "CloudFront URL: ${CLOUDFRONT_URL}"
        log_info "Update your HTML with: ${CLOUDFRONT_URL}/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
    fi
    
    # Save to file for upload script
    cat > "${OPS_DIR}/.resume_config" <<EOF
BUCKET_NAME=${BUCKET_NAME}
DISTRIBUTION_ID=${DISTRIBUTION_ID}
CLOUDFRONT_URL=${CLOUDFRONT_URL}
EOF
    
    log_success "Configuration saved to ${OPS_DIR}/.resume_config"
}

upload_resume() {
    log_info "Uploading resume PDF..."
    
    # Load configuration
    if [ ! -f "${OPS_DIR}/.resume_config" ]; then
        log_error "Configuration file not found. Please run 'apply' first."
        exit 1
    fi
    
    source "${OPS_DIR}/.resume_config"
    
    # Check for resume file
    read -p "Enter path to your resume PDF: " RESUME_PATH
    
    if [ ! -f "${RESUME_PATH}" ]; then
        log_error "File not found: ${RESUME_PATH}"
        exit 1
    fi
    
    # Upload using Python script
    log_info "Uploading to S3: ${BUCKET_NAME}..."
    python3 "${OPS_DIR}/resume_upload.py" upload \
        --file "${RESUME_PATH}" \
        --bucket "${BUCKET_NAME}" \
        --distribution-id "${DISTRIBUTION_ID}"
    
    log_success "Resume uploaded successfully!"
    log_info "Download URL: ${CLOUDFRONT_URL}/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
}

terraform_destroy() {
    log_warning "This will destroy all resources created by Terraform."
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "${confirm}" != "yes" ]; then
        log_info "Destroy cancelled."
        exit 0
    fi
    
    cd "${TERRAFORM_DIR}"
    
    # Load configuration
    if [ -f "${OPS_DIR}/.resume_config" ]; then
        source "${OPS_DIR}/.resume_config"
        
        # Delete S3 objects first
        log_info "Deleting S3 objects from ${BUCKET_NAME}..."
        aws s3 rm "s3://${BUCKET_NAME}/resume/" --recursive || true
    fi
    
    log_info "Destroying Terraform resources..."
    terraform destroy -var-file="${TFVARS_FILE}" -auto-approve
    
    # Clean up config file
    rm -f "${OPS_DIR}/.resume_config"
    
    log_success "Resources destroyed."
}

show_usage() {
    cat << EOF
Usage: $0 [command]

Commands:
    init      Initialize Terraform
    plan      Plan Terraform changes
    apply     Apply Terraform configuration
    upload    Upload resume PDF to S3
    destroy   Destroy all Terraform resources
    help      Show this help message

Examples:
    $0 init
    $0 apply
    $0 upload

EOF
}

# Main
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    check_dependencies
    
    case "$1" in
        init)
            terraform_init
            ;;
        plan)
            terraform_plan
            ;;
        apply)
            terraform_apply
            ;;
        upload)
            upload_resume
            ;;
        destroy)
            terraform_destroy
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
