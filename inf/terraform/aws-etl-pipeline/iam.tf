# ============================================================================
# IAM Roles and Policies — Least-privilege for all pipeline components
# ============================================================================

# ---------------------------------------------------------------------------
# Lambda — Orchestrator Role
# Permissions: read raw S3, invoke Bedrock Agent, invoke loader Lambda, VPC ENI, DLQ
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_etl_orchestrator" {
  name        = "${local.name_prefix}-orchestrator-role"
  description = "Execution role for the ETL orchestrator Lambda — reads raw S3 and invokes Bedrock Agent"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "orchestrator_policy" {
  name = "orchestrator-policy"
  role = aws_iam_role.lambda_etl_orchestrator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadRawBucket"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:HeadObject"]
        Resource = "${aws_s3_bucket.etl_raw.arn}/*"
      },
      {
        Sid    = "InvokeBedrockAgent"
        Effect = "Allow"
        Action = ["bedrock:InvokeAgent"]
        Resource = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent-alias/*"
      },
      {
        Sid      = "InvokeLoaderLambda"
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.etl_loader.arn
      },
      {
        Sid    = "VPCNetworkInterfaces"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses",
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-orchestrator:*"
      },
      {
        Sid      = "SendToDLQ"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.orchestrator_dlq.arn
      },
    ]
  })

  depends_on = [aws_lambda_function.etl_loader]
}

# ---------------------------------------------------------------------------
# Lambda — Loader Role
# Permissions: write clean S3, DynamoDB PutItem/UpdateItem, VPC ENI, DLQ
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_etl_loader" {
  name        = "${local.name_prefix}-loader-role"
  description = "Execution role for the ETL loader Lambda — writes clean S3 and DynamoDB"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "loader_policy" {
  name = "loader-policy"
  role = aws_iam_role.lambda_etl_loader.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteCleanBucket"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.etl_clean.arn}/*"
      },
      {
        Sid    = "DynamoDBWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
        ]
        Resource = aws_dynamodb_table.article_metadata.arn
      },
      {
        Sid    = "VPCNetworkInterfaces"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses",
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-loader:*"
      },
      {
        Sid      = "SendToDLQ"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.loader_dlq.arn
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# Bedrock Agent Execution Role
# Trusts bedrock.amazonaws.com; can invoke the foundation model
# ---------------------------------------------------------------------------

resource "aws_iam_role" "bedrock_agent_execution" {
  name        = "${local.name_prefix}-bedrock-agent-role"
  description = "Execution role for the Bedrock content-extractor agent"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "bedrock_agent_policy" {
  name = "bedrock-agent-policy"
  role = aws_iam_role.bedrock_agent_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "InvokeFoundationModel"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = local.bedrock_model_arn
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# VPC Flow Logs Role
# ---------------------------------------------------------------------------

resource "aws_iam_role" "vpc_flow_log" {
  name        = "${local.name_prefix}-flow-log-role"
  description = "IAM role for VPC Flow Logs delivery to CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_log_policy" {
  name = "vpc-flow-log-policy"
  role = aws_iam_role.vpc_flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ]
      Resource = "${aws_cloudwatch_log_group.vpc_flow_logs.arn}:*"
    }]
  })
}

# ---------------------------------------------------------------------------
# VPC Endpoint Policies (applied after Lambda ARNs are known — REC review TASK-065)
# ---------------------------------------------------------------------------

# S3 Gateway Endpoint — restrict to orchestrator + loader principals only
resource "aws_vpc_endpoint_policy" "s3" {
  vpc_endpoint_id = aws_vpc_endpoint.s3.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowETLLambdaS3Access"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.lambda_etl_orchestrator.arn,
            aws_iam_role.lambda_etl_loader.arn,
          ]
        }
        Action   = ["s3:GetObject", "s3:PutObject", "s3:HeadObject"]
        Resource = ["${aws_s3_bucket.etl_raw.arn}/*", "${aws_s3_bucket.etl_clean.arn}/*"]
      },
      # Terraform state bucket access still allowed (manages different bucket, not the raw/clean ones)
      {
        Sid       = "AllowAllS3ManagementActions"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:*"
        Resource  = "*"
      },
    ]
  })
}

# DynamoDB Gateway Endpoint — restrict to loader only
resource "aws_vpc_endpoint_policy" "dynamodb" {
  vpc_endpoint_id = aws_vpc_endpoint.dynamodb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowLoaderDynamoDBAccess"
      Effect = "Allow"
      Principal = {
        AWS = aws_iam_role.lambda_etl_loader.arn
      }
      Action = [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
      ]
      Resource = aws_dynamodb_table.article_metadata.arn
    }]
  })
}
