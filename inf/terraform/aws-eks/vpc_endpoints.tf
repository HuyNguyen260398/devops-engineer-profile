# ============================================================================
# VPC Endpoints – Private AWS API Connectivity
# ============================================================================
# Keeps AWS API traffic from nodes and pods (ECR image pulls, STS for IRSA,
# CloudWatch logs, Secrets Manager for ESO, etc.) inside the AWS backbone
# via PrivateLink instead of routing through the NAT gateway over the
# public internet. S3 uses a free gateway endpoint (ECR image layers).
#
# Ref: https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html
# ============================================================================

resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_vpc_endpoints ? 1 : 0

  name_prefix = "${local.cluster_name}-vpce-"
  description = "Allow HTTPS to interface VPC endpoints from inside the VPC"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from VPC CIDR"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-vpc-endpoints"
  })

  lifecycle {
    create_before_destroy = true
  }
}

module "vpc_endpoints" {
  #checkov:skip=CKV_TF_1: Terraform Registry with exact version pin is the accepted supply-chain control for this project; git-URL + commit-hash migration is tracked separately.
  count   = var.enable_vpc_endpoints ? 1 : 0
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.6.0"

  vpc_id             = module.vpc.vpc_id
  security_group_ids = [aws_security_group.vpc_endpoints[0].id]

  endpoints = merge(
    {
      s3 = {
        service         = "s3"
        service_type    = "Gateway"
        route_table_ids = concat(module.vpc.private_route_table_ids, module.vpc.public_route_table_ids)
        tags            = { Name = "${local.cluster_name}-s3-gateway" }
      }
    },
    {
      for svc in var.vpc_interface_endpoint_services :
      replace(svc, ".", "_") => {
        service             = svc
        service_type        = "Interface"
        subnet_ids          = module.vpc.private_subnets
        private_dns_enabled = true
        tags                = { Name = "${local.cluster_name}-${svc}" }
      }
    }
  )

  tags = local.common_tags
}
