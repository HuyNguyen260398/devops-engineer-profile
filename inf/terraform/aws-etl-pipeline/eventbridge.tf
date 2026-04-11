# ============================================================================
# EventBridge — S3 raw-bucket upload trigger
# Filters ObjectCreated events for .md suffix on the raw bucket.
# DLQ captures events that couldn't be delivered to the orchestrator (REC-002).
# ============================================================================

resource "aws_cloudwatch_event_rule" "s3_raw_upload" {
  name        = "${local.name_prefix}-s3-raw-upload"
  description = "Fires when a .md file is uploaded to the ETL raw S3 bucket"

  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = {
        name = [var.raw_bucket_name]
      }
      object = {
        key = [{ suffix = ".md" }]
      }
    }
  })

  tags = {
    Name = "${local.name_prefix}-s3-raw-upload"
  }
}

resource "aws_cloudwatch_event_target" "orchestrator_lambda" {
  rule = aws_cloudwatch_event_rule.s3_raw_upload.name
  arn  = aws_lambda_function.etl_orchestrator.arn

  # EventBridge DLQ for events that cannot reach the orchestrator Lambda (REC-002)
  dead_letter_config {
    arn = aws_sqs_queue.orchestrator_dlq.arn
  }
}

# Grant EventBridge permission to invoke the orchestrator Lambda
resource "aws_lambda_permission" "eventbridge_invoke_orchestrator" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.etl_orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.s3_raw_upload.arn
}
