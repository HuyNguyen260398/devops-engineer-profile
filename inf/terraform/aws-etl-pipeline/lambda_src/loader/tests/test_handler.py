"""
Unit tests for the ETL loader Lambda handler.
Uses moto to mock S3 and DynamoDB — no real AWS calls.
"""

import hashlib
import json
import os
import unittest

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("CLEAN_BUCKET_NAME", "test-clean-bucket")
os.environ.setdefault("DYNAMODB_TABLE_NAME", "test-article-metadata")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-1")

from handler import handler, _extract_title, _derive_source_url  # noqa: E402

REGION = "ap-southeast-1"
CLEAN_BUCKET = "test-clean-bucket"
DYNAMO_TABLE = "test-article-metadata"
SOURCE_BUCKET = "test-raw-bucket"
SOURCE_KEY = "example_com_20240401T120000.md"
CLEAN_CONTENT = "# Hello World\n\nThis is the main article body."


def _base_event(**overrides) -> dict:
    ev = {
        "schema_version": "1.0",
        "source_bucket": SOURCE_BUCKET,
        "source_key": SOURCE_KEY,
        "clean_content": CLEAN_CONTENT,
        "correlation_id": "corr-xyz",
        "extraction_model": "anthropic.claude-haiku-3-5-v1:0",
    }
    ev.update(overrides)
    return ev


def _make_context():
    from unittest.mock import MagicMock
    ctx = MagicMock()
    ctx.aws_request_id = "req-abc"
    return ctx


def _setup_aws():
    """Create the mocked S3 bucket and DynamoDB table."""
    s3 = boto3.client("s3", region_name=REGION)
    s3.create_bucket(
        Bucket=CLEAN_BUCKET,
        CreateBucketConfiguration={"LocationConstraint": REGION},
    )

    dynamodb = boto3.client("dynamodb", region_name=REGION)
    dynamodb.create_table(
        TableName=DYNAMO_TABLE,
        AttributeDefinitions=[{"AttributeName": "article_id", "AttributeType": "S"}],
        KeySchema=[{"AttributeName": "article_id", "KeyType": "HASH"}],
        BillingMode="PAY_PER_REQUEST",
    )
    return s3, dynamodb


# ---------------------------------------------------------------------------
# Schema validation (REC-016)
# ---------------------------------------------------------------------------

class TestSchemaValidation(unittest.TestCase):

    @mock_aws
    def test_rejects_unknown_schema_version(self):
        _setup_aws()
        with pytest.raises(ValueError, match="Unsupported schema_version"):
            handler(_base_event(schema_version="2.0"), _make_context())

    @mock_aws
    def test_rejects_missing_schema_version(self):
        _setup_aws()
        ev = _base_event()
        del ev["schema_version"]
        with pytest.raises(ValueError, match="Unsupported schema_version"):
            handler(ev, _make_context())


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestHappyPath(unittest.TestCase):

    @mock_aws
    def test_writes_clean_markdown_to_s3(self):
        s3, _ = _setup_aws()
        handler(_base_event(), _make_context())

        # Verify clean .md was written to year/month/filename
        objects = s3.list_objects_v2(Bucket=CLEAN_BUCKET, Prefix="20")
        keys = [obj["Key"] for obj in objects.get("Contents", [])]
        md_keys = [k for k in keys if k.endswith(".md")]
        assert len(md_keys) == 1
        assert md_keys[0].endswith(os.path.basename(SOURCE_KEY))

    @mock_aws
    def test_writes_metadata_sidecar_json(self):
        s3, _ = _setup_aws()
        handler(_base_event(), _make_context())

        objects = s3.list_objects_v2(Bucket=CLEAN_BUCKET, Prefix="metadata/")
        json_keys = [
            obj["Key"]
            for obj in objects.get("Contents", [])
            if obj["Key"].endswith(".json")
        ]
        assert len(json_keys) == 1

        obj = s3.get_object(Bucket=CLEAN_BUCKET, Key=json_keys[0])
        metadata = json.loads(obj["Body"].read())
        assert metadata["title"] == "Hello World"
        assert metadata["status"] == "PUBLISHED"
        assert "article_id" in metadata

    @mock_aws
    def test_writes_dynamodb_item(self):
        _, dynamodb = _setup_aws()
        result = handler(_base_event(), _make_context())

        article_id = result["article_id"]
        resp = dynamodb.get_item(
            TableName=DYNAMO_TABLE,
            Key={"article_id": {"S": article_id}},
        )
        item = resp.get("Item", {})
        assert item["title"]["S"] == "Hello World"
        assert item["status"]["S"] == "PUBLISHED"

    @mock_aws
    def test_returns_ok_with_article_id(self):
        _setup_aws()
        result = handler(_base_event(), _make_context())
        assert result["status"] == "ok"
        assert "article_id" in result
        assert "clean_key" in result


# ---------------------------------------------------------------------------
# Idempotency (REC-001)
# ---------------------------------------------------------------------------

class TestIdempotency(unittest.TestCase):

    @mock_aws
    def test_same_source_produces_same_article_id(self):
        _setup_aws()
        r1 = handler(_base_event(), _make_context())
        r2 = handler(_base_event(), _make_context())
        assert r1["article_id"] == r2["article_id"]

    @mock_aws
    def test_different_sources_produce_different_article_ids(self):
        _setup_aws()
        r1 = handler(_base_event(source_key="a_20240401T120000.md"), _make_context())
        r2 = handler(_base_event(source_key="b_20240401T120000.md"), _make_context())
        assert r1["article_id"] != r2["article_id"]


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------

class TestExtractTitle(unittest.TestCase):

    def test_extracts_first_h1(self):
        assert _extract_title("# My Title\n\nBody text.") == "My Title"

    def test_falls_back_to_untitled(self):
        assert _extract_title("No headings here.") == "Untitled"

    def test_strips_whitespace(self):
        assert _extract_title("#   Padded Title  \nBody.") == "Padded Title"

    def test_ignores_h2_and_below(self):
        assert _extract_title("## Sub\n# Main\nBody.") == "Main"


class TestDeriveSourceUrl(unittest.TestCase):

    def test_standard_convention(self):
        assert _derive_source_url("example_com_20240401T120000.md") == "example.com"

    def test_no_timestamp_suffix(self):
        assert _derive_source_url("example_com.md") == "example.com"

    def test_with_full_path(self):
        assert _derive_source_url("raw/2024/example_com_20240401.md") == "example.com"
