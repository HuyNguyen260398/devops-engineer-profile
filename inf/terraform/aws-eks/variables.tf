# Environment Configuration
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

# AWS Configuration
variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "ap-southeast-1"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones for high availability"
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = []
}

# EKS Cluster Configuration
variable "cluster_version" {
  description = "Kubernetes version for EKS cluster. Keep within 2 minor versions of latest to stay in AWS support window."
  type        = string
  default     = "1.32"
}

variable "cluster_endpoint_public_access" {
  description = "Enable public access to cluster API endpoint. Disabled by default; enable only for staging with a restricted CIDR."
  type        = bool
  default     = false
}

variable "cluster_endpoint_private_access" {
  description = "Enable private access to cluster API endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to access the public cluster endpoint. Must be set to specific IP ranges — never '0.0.0.0/0' in production."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for cidr in var.cluster_endpoint_public_access_cidrs :
      cidr != "0.0.0.0/0" && cidr != "::/0"
    ])
    error_message = "cluster_endpoint_public_access_cidrs must not contain '0.0.0.0/0' or '::/0'. Restrict to your organisation's IP ranges."
  }

  validation {
    condition = alltrue([
      for cidr in var.cluster_endpoint_public_access_cidrs :
      !can(regex("^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.)", cidr))
    ])
    error_message = "cluster_endpoint_public_access_cidrs must not contain RFC-1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). AWS EKS only accepts public IPs for the public endpoint access list."
  }
}

# Node Group Configuration
variable "node_groups" {
  description = "Map of node group configurations"
  type = map(object({
    desired_size   = number
    max_size       = number
    min_size       = number
    instance_types = list(string)
    capacity_type  = string
    disk_size      = number
    # Optional: Kubernetes node labels applied to every node in the group.
    # Useful for node affinity / workload segregation (e.g. { "role" = "worker" }).
    labels = optional(map(string), {})
    # Optional: Kubernetes taints applied to every node in the group.
    # Useful for dedicated node groups (e.g. GPU or spot-only workloads).
  }))
  default = {}
}

# Monitoring Configuration
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs for EKS control plane"
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 7
}

# Auto-scaling Configuration
variable "enable_cluster_autoscaler" {
  description = "Enable Kubernetes Cluster Autoscaler"
  type        = bool
  default     = true
}

# Metrics Server Configuration
variable "enable_metrics_server" {
  description = "Deploy metrics-server into kube-system. Required for Horizontal Pod Autoscaler (HPA) and `kubectl top` to function."
  type        = bool
  default     = true
}

# Security Configuration
variable "enable_irsa" {
  description = "Enable IAM Roles for Service Accounts (IRSA)"
  type        = bool
  default     = true
}

# Additional Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# EBS CSI Driver Configuration
variable "enable_ebs_csi_driver" {
  description = "Enable EBS CSI driver for persistent volumes"
  type        = bool
  default     = true
}

# Secret Encryption Configuration
variable "enable_secret_encryption" {
  description = "Enable envelope encryption of Kubernetes Secrets at rest using a customer-managed KMS key. Recommended for all environments."
  type        = bool
  default     = true
}