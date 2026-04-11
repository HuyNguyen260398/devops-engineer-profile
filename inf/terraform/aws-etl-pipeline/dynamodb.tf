# ============================================================================
# DynamoDB — article-metadata table
# PK-only design (REC-011): article_id is a deterministic sha256 hash per source file.
# No sort key — articles are uniquely identified by source path; no versioning needed.
# GSI with INCLUDE projection avoids N+1 on Blog list page (REC-012).
# ============================================================================

#tfsec:ignore:AVD-AWS-0025 -- AWS-owned KMS key (no extra cost) provides encryption at rest; a CMK adds key management overhead disproportionate to a portfolio project (SEC-004).
resource "aws_dynamodb_table" "article_metadata" {
  name         = "${local.name_prefix}-article-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "article_id"

  attribute {
    name = "article_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI: query articles by status (e.g. PUBLISHED) sorted by creation date
  # INCLUDE projection carries all fields needed by the Blog list view — avoids N+1 (REC-012)
  global_secondary_index {
    name            = "status-created_at-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "INCLUDE"
    non_key_attributes = [
      "title",
      "word_count",
      "s3_key",
      "source_url",
    ]
  }

  # TTL for future archival — not active by default
  ttl {
    attribute_name = "expires_at"
    enabled        = false
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
    # Uses AWS_OWNED_KMS key (no extra cost, still encrypted at rest — SEC-004)
  }

  tags = {
    Name = "${local.name_prefix}-article-metadata"
  }
}
