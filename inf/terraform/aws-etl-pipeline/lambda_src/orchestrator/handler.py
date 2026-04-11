"""
ETL Orchestrator Lambda
-----------------------
Triggered by EventBridge on S3 raw-bucket PutObject events (.md files).

Flow:
  1. Validate file size (reject > MAX_FILE_BYTES to guard Bedrock cost — REC-006)
  2. Read raw Markdown from S3
  3. Call Bedrock Agent (InvokeAgent) with retry/backoff (REC-015)
  4. Invoke the loader Lambda asynchronously with the extracted clean content
"""

import hashlib
import json
import logging
import os
import random
import time

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# REC-006: reject files above this threshold before calling Bedrock
MAX_FILE_BYTES = int(os.environ.get("MAX_FILE_BYTES", str(200 * 1024)))  # 200 KB

s3_client = boto3.client("s3")
bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")
lambda_client = boto3.client("lambda")


def handler(event: dict, context) -> dict:
    # Use EventBridge event ID as correlation ID for end-to-end tracing (REC-013)
    correlation_id = event.get("id", context.aws_request_id)

    def log(msg: str, **kwargs):
        logger.info(json.dumps({"correlation_id": correlation_id, "msg": msg, **kwargs}))

    detail = event.get("detail", {})
    source_bucket = detail["bucket"]["name"]
    source_key = detail["object"]["key"]

    log("Orchestrator started", source_bucket=source_bucket, source_key=source_key)

    # ── 1. Guard: validate file size ──────────────────────────────────────────
    head = s3_client.head_object(Bucket=source_bucket, Key=source_key)
    file_size = head["ContentLength"]

    if file_size > MAX_FILE_BYTES:
        # Let the error propagate to the DLQ for inspection
        raise ValueError(
            f"File too large: {file_size} bytes (max {MAX_FILE_BYTES}). "
            "Rejecting to prevent runaway Bedrock cost. Key: {source_key}"
        )

    log("File size OK", size_bytes=file_size)

    # ── 2. Read raw Markdown ──────────────────────────────────────────────────
    obj = s3_client.get_object(Bucket=source_bucket, Key=source_key)
    raw_markdown = obj["Body"].read().decode("utf-8")

    log("Raw Markdown read", chars=len(raw_markdown))

    # ── 3. Bedrock Agent extraction ───────────────────────────────────────────
    start_ms = int(time.time() * 1000)
    clean_content = _invoke_agent_with_retry(raw_markdown, correlation_id, log)
    extraction_ms = int(time.time() * 1000) - start_ms

    log(
        "Bedrock extraction complete",
        output_chars=len(clean_content),
        extraction_ms=extraction_ms,
    )

    # ── 4. Invoke loader asynchronously ───────────────────────────────────────
    payload = {
        "schema_version": "1.0",
        "source_bucket": source_bucket,
        "source_key": source_key,
        "clean_content": clean_content,
        "correlation_id": correlation_id,
        "extraction_model": os.environ["BEDROCK_MODEL_ID"],
        "extraction_ms": extraction_ms,
    }

    lambda_client.invoke(
        FunctionName=os.environ["LOADER_FUNCTION_NAME"],
        InvocationType="Event",  # fire-and-forget; loader has its own DLQ
        Payload=json.dumps(payload),
    )

    log("Loader Lambda invoked asynchronously")
    return {"status": "ok", "source_key": source_key, "correlation_id": correlation_id}


def _invoke_agent_with_retry(raw_markdown: str, correlation_id: str, log, max_retries: int = 3) -> str:
    """Call InvokeAgent with full-jitter exponential backoff on throttling (REC-015)."""
    agent_id = os.environ["BEDROCK_AGENT_ID"]
    agent_alias_id = os.environ["BEDROCK_AGENT_ALIAS_ID"]

    # Deterministic session ID per source correlation so re-runs reuse the same session
    session_id = hashlib.sha256(correlation_id.encode()).hexdigest()[:32]

    retryable_codes = {"ThrottlingException", "ServiceUnavailableException", "ModelNotReadyException"}

    for attempt in range(max_retries):
        try:
            response = bedrock_agent_runtime.invoke_agent(
                agentId=agent_id,
                agentAliasId=agent_alias_id,
                sessionId=session_id,
                inputText=raw_markdown,
                enableTrace=False,
            )

            # Collect completion chunks from the streaming response
            completion_parts = []
            for evt in response["completion"]:
                if "chunk" in evt:
                    completion_parts.append(evt["chunk"]["bytes"].decode("utf-8"))

            return "".join(completion_parts)

        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in retryable_codes and attempt < max_retries - 1:
                # Full-jitter: sleep between 0 and (2^attempt) seconds
                sleep_s = random.uniform(0, 2 ** attempt)
                log(
                    "Bedrock throttled — retrying",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    error_code=code,
                    sleep_s=round(sleep_s, 2),
                )
                time.sleep(sleep_s)
            else:
                raise
