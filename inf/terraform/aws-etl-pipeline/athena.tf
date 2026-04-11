# ============================================================================
# Athena + Glue Data Catalog — serverless analytics over clean S3 bucket
#
# REC-003: JsonSerDe replaces LazySimpleSerDe (which is CSV, not JSON).
# REC-004: Loader writes sidecar metadata JSON at metadata/{year}/{month}/{id}.json.
# REC-005: Partition projection enabled — no MSCK REPAIR TABLE needed on new uploads.
# ============================================================================

# ---------------------------------------------------------------------------
# Glue Data Catalog
# ---------------------------------------------------------------------------

resource "aws_glue_catalog_database" "etl_articles" {
  name        = "${replace(local.name_prefix, "-", "_")}_articles"
  description = "Glue database for ETL pipeline article metadata"
}

resource "aws_glue_catalog_table" "clean_articles" {
  name          = "clean_articles"
  database_name = aws_glue_catalog_database.etl_articles.name
  description   = "Article metadata JSON files written by the ETL loader — partitioned by year/month"
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    # REC-005: Partition projection — Athena auto-discovers partitions without MSCK REPAIR
    "projection.enabled"       = "true"
    "projection.year.type"     = "integer"
    "projection.year.range"    = "2025,2099"
    "projection.year.digits"   = "4"
    "projection.month.type"    = "integer"
    "projection.month.range"   = "01,12"
    "projection.month.digits"  = "2"
    "storage.location.template" = "s3://${var.clean_bucket_name}/metadata/$${year}/$${month}"
    "classification"           = "json"
  }

  storage_descriptor {
    location      = "s3://${var.clean_bucket_name}/metadata/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      # REC-003: JsonSerDe for line-delimited JSON objects (one article per file)
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "serialization.format" = "1"
        "ignore.malformed.json" = "FALSE"
      }
    }

    columns {
      name    = "article_id"
      type    = "string"
      comment = "Deterministic sha256 hash of source_bucket/source_key (first 16 hex chars)"
    }

    columns {
      name    = "title"
      type    = "string"
      comment = "First H1 heading extracted from the clean Markdown"
    }

    columns {
      name    = "word_count"
      type    = "bigint"
      comment = "Approximate word count of the clean article body"
    }

    columns {
      name    = "s3_key"
      type    = "string"
      comment = "S3 key of the clean .md file in the clean bucket"
    }

    columns {
      name    = "source_url"
      type    = "string"
      comment = "Derived source domain from the original filename convention"
    }

    columns {
      name    = "created_at"
      type    = "string"
      comment = "ISO8601 timestamp when the article was processed"
    }

    columns {
      name    = "status"
      type    = "string"
      comment = "Publication status (PUBLISHED)"
    }

    columns {
      name    = "extraction_model"
      type    = "string"
      comment = "Bedrock model ID used for content extraction"
    }
  }

  # Partition columns for projection (year, month)
  partition_keys {
    name    = "year"
    type    = "string"
    comment = "Year partition derived from created_at (e.g. 2025)"
  }

  partition_keys {
    name    = "month"
    type    = "string"
    comment = "Month partition derived from created_at (e.g. 04)"
  }
}

# ---------------------------------------------------------------------------
# Athena Workgroup
# ---------------------------------------------------------------------------

resource "aws_athena_workgroup" "etl" {
  name        = "${local.name_prefix}-workgroup"
  description = "Athena workgroup for ETL pipeline analytics queries"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${var.clean_bucket_name}/athena-results/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }

  tags = {
    Name = "${local.name_prefix}-workgroup"
  }
}
