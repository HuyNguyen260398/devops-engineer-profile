# ============================================================================
# VPC — Dedicated ETL network with private subnets and VPC Endpoints
# No IGW, no NAT Gateway. All outbound traffic routed through VPC Endpoints.
# ============================================================================

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

resource "aws_vpc" "etl" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true  # Required for Interface Endpoint private DNS
  enable_dns_hostnames = true  # Required for Interface Endpoint private DNS

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

# ---------------------------------------------------------------------------
# Private Subnets
# ---------------------------------------------------------------------------

resource "aws_subnet" "etl_private_a" {
  vpc_id                  = aws_vpc.etl.id
  cidr_block              = var.private_subnet_cidrs[0]
  availability_zone       = var.availability_zones[0]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-a"
    Tier = "private"
  }
}

resource "aws_subnet" "etl_private_b" {
  vpc_id                  = aws_vpc.etl.id
  cidr_block              = var.private_subnet_cidrs[1]
  availability_zone       = var.availability_zones[1]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-b"
    Tier = "private"
  }
}

# ---------------------------------------------------------------------------
# Route Table (shared for both private subnets — Gateway Endpoints auto-add routes)
# ---------------------------------------------------------------------------

resource "aws_route_table" "etl_private" {
  vpc_id = aws_vpc.etl.id

  tags = {
    Name = "${local.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "etl_private_a" {
  subnet_id      = aws_subnet.etl_private_a.id
  route_table_id = aws_route_table.etl_private.id
}

resource "aws_route_table_association" "etl_private_b" {
  subnet_id      = aws_subnet.etl_private_b.id
  route_table_id = aws_route_table.etl_private.id
}

# ---------------------------------------------------------------------------
# Security Groups
# ---------------------------------------------------------------------------

# Lambda functions: allow egress TCP 443 to VPC Endpoint SG only; deny all inbound
resource "aws_security_group" "lambda_etl" {
  name        = "${local.name_prefix}-lambda-sg"
  description = "Security group for ETL Lambda functions — egress TCP 443 to VPC endpoints only"
  vpc_id      = aws_vpc.etl.id

  tags = {
    Name = "${local.name_prefix}-lambda-sg"
  }
}

resource "aws_security_group_rule" "lambda_egress_to_endpoints" {
  type                     = "egress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.lambda_etl.id
  source_security_group_id = aws_security_group.vpc_endpoints.id
  description              = "Allow HTTPS egress to VPC Endpoint interfaces"
}

# VPC Interface Endpoints: accept TCP 443 from Lambda SG
resource "aws_security_group" "vpc_endpoints" {
  name        = "${local.name_prefix}-vpce-sg"
  description = "Security group for VPC Interface Endpoints — ingress TCP 443 from Lambda SG"
  vpc_id      = aws_vpc.etl.id

  tags = {
    Name = "${local.name_prefix}-vpce-sg"
  }
}

resource "aws_security_group_rule" "vpce_ingress_from_lambda" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.vpc_endpoints.id
  source_security_group_id = aws_security_group.lambda_etl.id
  description              = "Allow HTTPS ingress from ETL Lambda functions"
}

# ---------------------------------------------------------------------------
# S3 Gateway Endpoint — free; routes S3 traffic over AWS backbone
# ---------------------------------------------------------------------------

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.etl.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.etl_private.id]

  tags = {
    Name = "${local.name_prefix}-s3-endpoint"
  }
}

# ---------------------------------------------------------------------------
# DynamoDB Gateway Endpoint — free
# ---------------------------------------------------------------------------

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.etl.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.etl_private.id]

  tags = {
    Name = "${local.name_prefix}-dynamodb-endpoint"
  }
}

# ---------------------------------------------------------------------------
# Interface Endpoints — single-AZ by default (staging); multi-AZ via variable (production)
# REC-022: toggle with var.interface_endpoint_multi_az
# ---------------------------------------------------------------------------

locals {
  endpoint_subnet_ids = var.interface_endpoint_multi_az ? [
    aws_subnet.etl_private_a.id,
    aws_subnet.etl_private_b.id,
    ] : [
    aws_subnet.etl_private_a.id,
  ]
}

# Bedrock Agent Runtime — required for InvokeAgent calls
# DEP-008: Verify availability: aws ec2 describe-vpc-endpoint-services --filters Name=service-name,Values=com.amazonaws.ap-southeast-1.bedrock-agent-runtime
resource "aws_vpc_endpoint" "bedrock_agent_runtime" {
  vpc_id              = aws_vpc.etl.id
  service_name        = "com.amazonaws.${var.aws_region}.bedrock-agent-runtime"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.endpoint_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-bedrock-agent-runtime-endpoint"
  }
}

# CloudWatch Logs — required for VPC-attached Lambda log delivery
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.etl.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.endpoint_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-logs-endpoint"
  }
}

# Lambda — required for orchestrator to invoke loader without internet
resource "aws_vpc_endpoint" "lambda_service" {
  vpc_id              = aws_vpc.etl.id
  service_name        = "com.amazonaws.${var.aws_region}.lambda"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.endpoint_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-lambda-endpoint"
  }
}

# ---------------------------------------------------------------------------
# VPC Flow Logs — 14-day retention for network audit (SEC-010)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flow-logs/${local.name_prefix}"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-flow-logs"
  }
}

resource "aws_flow_log" "etl_vpc" {
  vpc_id          = aws_vpc.etl.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.vpc_flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn

  tags = {
    Name = "${local.name_prefix}-flow-log"
  }
}
