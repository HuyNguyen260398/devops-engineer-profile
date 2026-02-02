# Local values for derived and computed configurations
locals {
  # Cluster naming (shortened to avoid AWS IAM role name prefix 38-char limit)
  cluster_name = "dep-${var.environment}-eks"

  # Availability zones (use defaults if not provided)
  azs = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)

  # Subnet CIDRs (compute defaults if not provided)
  public_subnet_cidrs = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : [
    cidrsubnet(var.vpc_cidr, 8, 1),
    cidrsubnet(var.vpc_cidr, 8, 2),
    cidrsubnet(var.vpc_cidr, 8, 3)
  ]

  private_subnet_cidrs = length(var.private_subnet_cidrs) > 0 ? var.private_subnet_cidrs : [
    cidrsubnet(var.vpc_cidr, 8, 11),
    cidrsubnet(var.vpc_cidr, 8, 12),
    cidrsubnet(var.vpc_cidr, 8, 13)
  ]

  # Common tags
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      CreatedAt   = formatdate("YYYY-MM-DD", timestamp())
    },
    var.additional_tags
  )

  # CloudWatch log group name
  # cloudwatch_log_group = "/aws/eks/${local.cluster_name}/cluster"

  # Monitoring configuration
  # monitoring_config = {
  #   namespace          = var.prometheus_namespace
  #   prometheus_enabled = var.enable_prometheus
  #   grafana_enabled    = var.enable_grafana
  #   cloudwatch_enabled = var.enable_cloudwatch_logs
  # }

  # OIDC provider ARN for IRSA
  # oidc_provider_arn = var.enable_irsa ? module.eks.oidc_provider_arn : ""
}
