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
  # NOTE: timestamp() is intentionally excluded from CreatedAt — using it causes
  # Terraform to show a perpetual diff on every plan, triggering needless resource
  # updates. Track resource age via CloudTrail or AWS Config instead.
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.additional_tags
  )
}
