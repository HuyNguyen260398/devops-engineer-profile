# ============================================================================
# Environment
# ============================================================================

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "devops-engineer-profile"
}

# ============================================================================
# AWS
# ============================================================================

variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "ap-southeast-1"
}

# ============================================================================
# EKS Cluster
# ============================================================================

variable "cluster_name" {
  description = "EKS cluster name that ArgoCD is deployed to (e.g. dep-staging-eks). Used to look up the OIDC provider for IRSA."
  type        = string
}

# ============================================================================
# ArgoCD
# ============================================================================

variable "argocd_namespace" {
  description = "Kubernetes namespace where ArgoCD service accounts reside"
  type        = string
  default     = "argocd"
}

variable "enable_aws_lb_controller" {
  description = "Enable AWS Load Balancer Controller for ALB/NLB Ingress"
  type        = bool
  default     = true
}

variable "aws_lb_controller_version" {
  description = "AWS Load Balancer Controller application version (used to fetch IAM policy)"
  type        = string
  default     = "2.11.0"
}

variable "aws_lb_controller_chart_version" {
  description = "AWS Load Balancer Controller Helm chart version"
  type        = string
  default     = "1.11.0"
}

# ============================================================================
# Tags
# ============================================================================

variable "vpc_id" {
  description = "VPC ID where the EKS cluster is deployed. Required by the AWS Load Balancer Controller."
  type        = string
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
