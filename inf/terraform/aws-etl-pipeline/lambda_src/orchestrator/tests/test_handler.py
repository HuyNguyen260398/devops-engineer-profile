"""
Unit tests for the ETL orchestrator Lambda handler.
Uses moto to mock AWS services — no real AWS calls.
"""

import hashlib
import json
import os
import unittest
from io import BytesIO
from unittest.mock import MagicMock, patch

import boto3
import pytest
from moto import mock_aws

# Configure environment before importing handler
os.environ.setdefault("BEDROCK_AGENT_ID", "test-agent-id")
os.environ.setdefault("BEDROCK_AGENT_ALIAS_ID", "test-alias-id")
os.environ.setdefault("BEDROCK_MODEL_ID", "anthropic.claude-haiku-3-5-v1:0")
os.environ.setdefault("LOADER_FUNCTION_NAME", "test-loader")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-1")
os.environ.setdefault("MAX_FILE_BYTES", "204800")

from handler import handler, MAX_FILE_BYTES  # noqa: E402  (after env setup)

REGION = "ap-southeast-1"
RAW_BUCKET = "test-raw-bucket"
TEST_KEY = "example_com_20240401T120000.md"
RAW_MARKDOWN = "# Hello\n\nThis is test content.\n\n[nav menu](/) Home | About"


def _make_event(bucket: str, key: str) -> dict:
    return {
        "id": "evt-123",
        "detail": {
            "bucket": {"name": bucket},
            "object": {"key": key},
        },
    }


def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = "req-abc"
    return ctx


# ---------------------------------------------------------------------------
# File size guard tests (REC-006)
# ---------------------------------------------------------------------------

class TestFileSizeGuard(unittest.TestCase):

    @mock_aws
    def test_rejects_oversized_file(self):
        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=RAW_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        large_content = b"x" * (MAX_FILE_BYTES + 1)
        s3.put_object(Bucket=RAW_BUCKET, Key=TEST_KEY, Body=large_content)

        with pytest.raises(ValueError, match="File too large"):
            handler(_make_event(RAW_BUCKET, TEST_KEY), _make_context())

    @mock_aws
    def test_accepts_file_at_size_limit(self):
        """File at exactly MAX_FILE_BYTES should proceed past the size check."""
        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=RAW_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        exact_content = b"a" * MAX_FILE_BYTES
        s3.put_object(Bucket=RAW_BUCKET, Key=TEST_KEY, Body=exact_content)

        # We expect the Bedrock call to fail since it's mocked at service level
        with patch("handler.bedrock_agent_runtime") as mock_bedrock, \
             patch("handler.lambda_client") as mock_lambda:
            mock_bedrock.invoke_agent.return_value = {
                "completion": [{"chunk": {"bytes": b"# Clean content"}}]
            }
            mock_lambda.invoke.return_value = {"StatusCode": 202}

            result = handler(_make_event(RAW_BUCKET, TEST_KEY), _make_context())
            assert result["status"] == "ok"


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestHappyPath(unittest.TestCase):

    @mock_aws
    def test_happy_path_invokes_loader(self):
        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=RAW_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        s3.put_object(Bucket=RAW_BUCKET, Key=TEST_KEY, Body=RAW_MARKDOWN.encode())

        with patch("handler.bedrock_agent_runtime") as mock_bedrock, \
             patch("handler.lambda_client") as mock_lambda:
            clean = "# Hello\n\nThis is test content."
            mock_bedrock.invoke_agent.return_value = {
                "completion": [{"chunk": {"bytes": clean.encode()}}]
            }
            mock_lambda.invoke.return_value = {"StatusCode": 202}

            result = handler(_make_event(RAW_BUCKET, TEST_KEY), _make_context())

        assert result["status"] == "ok"
        assert result["source_key"] == TEST_KEY

        # Verify loader was invoked with correct payload shape
        call_args = mock_lambda.invoke.call_args
        payload = json.loads(call_args.kwargs["Payload"])
        assert payload["schema_version"] == "1.0"
        assert payload["source_bucket"] == RAW_BUCKET
        assert payload["source_key"] == TEST_KEY
        assert payload["clean_content"] == clean


# ---------------------------------------------------------------------------
# Bedrock retry tests (REC-015)
# ---------------------------------------------------------------------------

class TestBedrockRetry(unittest.TestCase):

    @mock_aws
    def test_retries_on_throttling(self):
        from botocore.exceptions import ClientError

        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=RAW_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        s3.put_object(Bucket=RAW_BUCKET, Key=TEST_KEY, Body=RAW_MARKDOWN.encode())

        throttle_error = ClientError(
            {"Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}},
            "InvokeAgent",
        )
        clean = "# Hello\n\nClean."

        with patch("handler.bedrock_agent_runtime") as mock_bedrock, \
             patch("handler.lambda_client") as mock_lambda, \
             patch("handler.time.sleep"):  # skip real sleeps in tests
            mock_bedrock.invoke_agent.side_effect = [
                throttle_error,
                {"completion": [{"chunk": {"bytes": clean.encode()}}]},
            ]
            mock_lambda.invoke.return_value = {"StatusCode": 202}

            result = handler(_make_event(RAW_BUCKET, TEST_KEY), _make_context())

        assert result["status"] == "ok"
        assert mock_bedrock.invoke_agent.call_count == 2

    @mock_aws
    def test_raises_after_max_retries(self):
        from botocore.exceptions import ClientError

        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=RAW_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        s3.put_object(Bucket=RAW_BUCKET, Key=TEST_KEY, Body=RAW_MARKDOWN.encode())

        throttle_error = ClientError(
            {"Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}},
            "InvokeAgent",
        )

        with patch("handler.bedrock_agent_runtime") as mock_bedrock, \
             patch("handler.time.sleep"):
            mock_bedrock.invoke_agent.side_effect = throttle_error

            with pytest.raises(ClientError):
                handler(_make_event(RAW_BUCKET, TEST_KEY), _make_context())

        assert mock_bedrock.invoke_agent.call_count == 3  # max_retries
