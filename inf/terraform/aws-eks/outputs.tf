# VPC Outputs
output "vpc_id" {
  description = "VPC ID where EKS cluster is deployed"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

# EKS Cluster Outputs
output "cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_version" {
  description = "Kubernetes version running on the cluster"
  value       = module.eks.cluster_version
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_oidc_provider_arn" {
  description = "ARN of the OIDC provider for IRSA"
  value       = var.enable_irsa ? module.eks.oidc_provider_arn : null
}

# Node Group Outputs
output "node_groups" {
  description = "EKS managed node groups"
  value       = module.eks.eks_managed_node_groups
}

# IAM Outputs
output "cluster_iam_role_arn" {
  description = "IAM role ARN for the EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "ebs_csi_driver_role_arn" {
  description = "IAM role ARN for EBS CSI driver"
  value       = var.enable_ebs_csi_driver ? module.ebs_csi_irsa[0].iam_role_arn : null
}

output "cluster_autoscaler_role_arn" {
  description = "IAM role ARN for Cluster Autoscaler"
  value       = var.enable_cluster_autoscaler ? module.cluster_autoscaler_irsa[0].iam_role_arn : null
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for EKS cluster logs"
  value       = "/aws/eks/${local.cluster_name}/cluster"
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN for EKS cluster logs"
  value       = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/eks/${local.cluster_name}/cluster"
}

# Configuration Outputs
output "kubeconfig_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}
