# ============================================================================
# Outputs — AWS ETL Pipeline
# ============================================================================

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------

output "raw_bucket_name" {
  description = "Name of the raw S3 bucket (upload target for html-to-md app)"
  value       = aws_s3_bucket.etl_raw.id
}

output "raw_bucket_arn" {
  description = "ARN of the raw S3 bucket"
  value       = aws_s3_bucket.etl_raw.arn
}

output "clean_bucket_name" {
  description = "Name of the clean S3 bucket (stores extracted Markdown + metadata)"
  value       = aws_s3_bucket.etl_clean.id
}

output "clean_bucket_arn" {
  description = "ARN of the clean S3 bucket"
  value       = aws_s3_bucket.etl_clean.arn
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------

output "orchestrator_lambda_arn" {
  description = "ARN of the ETL orchestrator Lambda function"
  value       = aws_lambda_function.etl_orchestrator.arn
}

output "loader_lambda_arn" {
  description = "ARN of the ETL loader Lambda function"
  value       = aws_lambda_function.etl_loader.arn
}

output "orchestrator_dlq_url" {
  description = "SQS DLQ URL for failed orchestrator invocations"
  value       = aws_sqs_queue.orchestrator_dlq.url
}

output "loader_dlq_url" {
  description = "SQS DLQ URL for failed loader invocations"
  value       = aws_sqs_queue.loader_dlq.url
}

# ---------------------------------------------------------------------------
# DynamoDB
# ---------------------------------------------------------------------------

output "dynamodb_table_name" {
  description = "Name of the DynamoDB article-metadata table"
  value       = aws_dynamodb_table.article_metadata.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB article-metadata table"
  value       = aws_dynamodb_table.article_metadata.arn
}

# ---------------------------------------------------------------------------
# Bedrock
# ---------------------------------------------------------------------------

output "bedrock_agent_id" {
  description = "Bedrock Agent ID for the content extractor"
  value       = aws_bedrockagent_agent.content_extractor.agent_id
}

output "bedrock_agent_alias_id" {
  description = "Bedrock Agent alias ID ('live')"
  value       = aws_bedrockagent_agent_alias.live.agent_alias_id
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the dedicated ETL VPC"
  value       = aws_vpc.etl.id
}

output "private_subnet_ids" {
  description = "IDs of the two private subnets"
  value       = [aws_subnet.etl_private_a.id, aws_subnet.etl_private_b.id]
}

output "s3_vpc_endpoint_id" {
  description = "ID of the S3 Gateway VPC Endpoint"
  value       = aws_vpc_endpoint.s3.id
}

output "dynamodb_vpc_endpoint_id" {
  description = "ID of the DynamoDB Gateway VPC Endpoint"
  value       = aws_vpc_endpoint.dynamodb.id
}

output "bedrock_agent_runtime_endpoint_id" {
  description = "ID of the Bedrock Agent Runtime Interface Endpoint"
  value       = aws_vpc_endpoint.bedrock_agent_runtime.id
}
