# ============================================================================
# Lambda Functions — ETL Orchestrator and Loader
# Both functions run in the ETL VPC private subnets.
# DLQs capture failures for replay and audit (REC-002).
# Orchestrator has reserved concurrency to cap Bedrock cost spikes (REC-006).
# ============================================================================

# ---------------------------------------------------------------------------
# Dead-Letter Queues (REC-002)
# ---------------------------------------------------------------------------

resource "aws_sqs_queue" "orchestrator_dlq" {
  name                      = "${local.name_prefix}-orchestrator-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true    # SSE with SQS-managed keys (SEC-DLQ-001)

  tags = {
    Name = "${local.name_prefix}-orchestrator-dlq"
  }
}

resource "aws_sqs_queue" "loader_dlq" {
  name                      = "${local.name_prefix}-loader-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true    # SSE with SQS-managed keys (SEC-DLQ-001)

  tags = {
    Name = "${local.name_prefix}-loader-dlq"
  }
}

# Allow EventBridge to send to orchestrator DLQ when delivery fails
resource "aws_sqs_queue_policy" "orchestrator_dlq_policy" {
  queue_url = aws_sqs_queue.orchestrator_dlq.url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.orchestrator_dlq.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.s3_raw_upload.arn
        }
      }
    }]
  })
}

# ---------------------------------------------------------------------------
# ZIP archives (Terraform archives the lambda_src directories at plan time)
# ---------------------------------------------------------------------------

data "archive_file" "orchestrator_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src/orchestrator"
  output_path = "${path.module}/.terraform/lambda_zips/orchestrator.zip"

  excludes = ["tests", "__pycache__", "*.pyc"]
}

data "archive_file" "loader_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src/loader"
  output_path = "${path.module}/.terraform/lambda_zips/loader.zip"

  excludes = ["tests", "__pycache__", "*.pyc"]
}

# ---------------------------------------------------------------------------
# CloudWatch Log Groups (7-day retention)
# ---------------------------------------------------------------------------

#tfsec:ignore:AVD-AWS-0017 -- CMK for CWL requires a dedicated KMS key with an explicit CloudWatch Logs service principal in the key policy; AWS default encryption is sufficient for this 7-day retention window.
resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/aws/lambda/${local.name_prefix}-orchestrator"
  retention_in_days = 7

  tags = {
    Name = "${local.name_prefix}-orchestrator-logs"
  }
}

#tfsec:ignore:AVD-AWS-0017 -- see note on orchestrator log group above.
resource "aws_cloudwatch_log_group" "loader" {
  name              = "/aws/lambda/${local.name_prefix}-loader"
  retention_in_days = 7

  tags = {
    Name = "${local.name_prefix}-loader-logs"
  }
}

# ---------------------------------------------------------------------------
# Orchestrator Lambda
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "etl_orchestrator" {
  function_name    = "${local.name_prefix}-orchestrator"
  description      = "ETL orchestrator: validates raw .md, calls Bedrock Agent, invokes loader"
  role             = aws_iam_role.lambda_etl_orchestrator.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.orchestrator_zip.output_path
  source_code_hash = data.archive_file.orchestrator_zip.output_base64sha256
  timeout          = var.orchestrator_timeout_seconds
  memory_size      = 256

  # REC-006: cap concurrent Bedrock invocations to control cost and throttle risk
  reserved_concurrent_executions = var.orchestrator_reserved_concurrency

  tracing_config {
    mode = "Active" # Active sampling for full X-Ray trace visibility (SEC-TRACE-001)
  }

  vpc_config {
    subnet_ids         = [aws_subnet.etl_private_a.id, aws_subnet.etl_private_b.id]
    security_group_ids = [aws_security_group.lambda_etl.id]
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.orchestrator_dlq.arn
  }

  environment {
    variables = {
      BEDROCK_AGENT_ID       = aws_bedrockagent_agent.content_extractor.agent_id
      BEDROCK_AGENT_ALIAS_ID = aws_bedrockagent_agent_alias.live.agent_alias_id
      BEDROCK_MODEL_ID       = var.bedrock_model_id
      LOADER_FUNCTION_NAME   = aws_lambda_function.etl_loader.function_name
      MAX_FILE_BYTES         = "204800" # 200 KB
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.orchestrator,
    aws_iam_role_policy.orchestrator_policy,
  ]

  tags = {
    Name = "${local.name_prefix}-orchestrator"
  }
}

# Prevent double-processing on async retry (TASK-022)
resource "aws_lambda_function_event_invoke_config" "orchestrator" {
  function_name          = aws_lambda_function.etl_orchestrator.function_name
  maximum_retry_attempts = 0
}

# ---------------------------------------------------------------------------
# Loader Lambda
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "etl_loader" {
  function_name    = "${local.name_prefix}-loader"
  description      = "ETL loader: writes clean .md to S3, metadata JSON sidecar, and DynamoDB item"
  role             = aws_iam_role.lambda_etl_loader.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.loader_zip.output_path
  source_code_hash = data.archive_file.loader_zip.output_base64sha256
  timeout          = var.loader_timeout_seconds # 15s — fails fast on silent hangs (REC-018)
  memory_size      = 256

  tracing_config {
    mode = "Active" # Active sampling for full X-Ray trace visibility (SEC-TRACE-001)
  }

  vpc_config {
    subnet_ids         = [aws_subnet.etl_private_a.id, aws_subnet.etl_private_b.id]
    security_group_ids = [aws_security_group.lambda_etl.id]
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.loader_dlq.arn
  }

  environment {
    variables = {
      CLEAN_BUCKET_NAME   = aws_s3_bucket.etl_clean.id
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.article_metadata.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.loader,
    aws_iam_role_policy.loader_policy,
  ]

  tags = {
    Name = "${local.name_prefix}-loader"
  }
}

# Loader operations are idempotent (deterministic PK) — allow retries for transient failures
resource "aws_lambda_function_event_invoke_config" "loader" {
  function_name          = aws_lambda_function.etl_loader.function_name
  maximum_retry_attempts = 2
}

# ---------------------------------------------------------------------------
# CloudWatch Alarms (REC-014)
# ---------------------------------------------------------------------------

#tfsec:ignore:AVD-AWS-0136 -- alias/aws/sns (AWS-managed SNS key) provides SSE; a CMK would require cross-service key policy grants for CloudWatch Alarms and adds rotation overhead for a portfolio pipeline.
resource "aws_sns_topic" "etl_alerts" {
  name              = "${local.name_prefix}-alerts"
  kms_master_key_id = "alias/aws/sns" # SSE using AWS-managed SNS key (SEC-SNS-001)

  tags = {
    Name = "${local.name_prefix}-alerts"
  }
}

resource "aws_cloudwatch_metric_alarm" "orchestrator_errors" {
  alarm_name          = "${local.name_prefix}-orchestrator-errors"
  alarm_description   = "ETL orchestrator Lambda has errors — check CloudWatch Logs and DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.etl_orchestrator.function_name
  }

  alarm_actions = [aws_sns_topic.etl_alerts.arn]
  ok_actions    = [aws_sns_topic.etl_alerts.arn]

  tags = {
    Name = "${local.name_prefix}-orchestrator-errors"
  }
}

resource "aws_cloudwatch_metric_alarm" "loader_errors" {
  alarm_name          = "${local.name_prefix}-loader-errors"
  alarm_description   = "ETL loader Lambda has errors — check CloudWatch Logs and DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.etl_loader.function_name
  }

  alarm_actions = [aws_sns_topic.etl_alerts.arn]
  ok_actions    = [aws_sns_topic.etl_alerts.arn]

  tags = {
    Name = "${local.name_prefix}-loader-errors"
  }
}

resource "aws_cloudwatch_metric_alarm" "orchestrator_duration_p99" {
  alarm_name          = "${local.name_prefix}-orchestrator-duration-p99"
  alarm_description   = "Orchestrator p99 duration approaching timeout — risk of silent truncation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  extended_statistic  = "p99"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  threshold           = (var.orchestrator_timeout_seconds - 60) * 1000 # 60s headroom
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.etl_orchestrator.function_name
  }

  alarm_actions = [aws_sns_topic.etl_alerts.arn]

  tags = {
    Name = "${local.name_prefix}-orchestrator-duration-p99"
  }
}

resource "aws_cloudwatch_metric_alarm" "orchestrator_dlq_messages" {
  alarm_name          = "${local.name_prefix}-orchestrator-dlq-messages"
  alarm_description   = "Orchestrator DLQ has messages — a pipeline execution failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.orchestrator_dlq.name
  }

  alarm_actions = [aws_sns_topic.etl_alerts.arn]

  tags = {
    Name = "${local.name_prefix}-orchestrator-dlq-messages"
  }
}

resource "aws_cloudwatch_metric_alarm" "loader_dlq_messages" {
  alarm_name          = "${local.name_prefix}-loader-dlq-messages"
  alarm_description   = "Loader DLQ has messages — an article failed to persist after retries"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.loader_dlq.name
  }

  alarm_actions = [aws_sns_topic.etl_alerts.arn]

  tags = {
    Name = "${local.name_prefix}-loader-dlq-messages"
  }
}
