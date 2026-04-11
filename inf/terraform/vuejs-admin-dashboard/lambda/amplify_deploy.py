"""
Lambda handler — Amplify Deploy Trigger

Called by CodePipeline as a Lambda invoke action.
Workflow:
  1. Extract the build artifact location from the CodePipeline job.
  2. Call amplify.create_deployment() to register a new deployment and get an
     upload URL for the zip artifact.
  3. Upload the zip from S3 to Amplify's pre-signed URL.
  4. Call amplify.start_deployment() to start the deployment.
  5. Signal success/failure back to CodePipeline.

Environment variables (set by Terraform):
  AMPLIFY_APP_ID  — Amplify application ID
  AMPLIFY_BRANCH  — Branch name to deploy to (default: main)
"""

import json
import os
import traceback
import urllib.request

import boto3

codepipeline = boto3.client("codepipeline")
amplify = boto3.client("amplify")
s3 = boto3.client("s3")


def handler(event, context):
    job = event["CodePipeline.job"]
    job_id = job["id"]

    try:
        user_params = _get_user_params(job)
        app_id = user_params.get("app_id") or os.environ["AMPLIFY_APP_ID"]
        branch = user_params.get("branch") or os.environ.get("AMPLIFY_BRANCH", "main")

        artifact = _get_artifact(job)
        bucket = artifact["location"]["s3Location"]["bucketName"]
        key = artifact["location"]["s3Location"]["objectKey"]

        print(f"Deploying artifact s3://{bucket}/{key} to Amplify app {app_id} branch {branch}")

        # Step 1: Create a deployment to obtain a pre-signed upload URL
        create_resp = amplify.create_deployment(appId=app_id, branchName=branch)
        job_token = create_resp["jobId"]
        zip_upload_url = create_resp["zipUploadUrl"]

        # Step 2: Stream the artifact zip from S3 to Amplify's pre-signed URL
        s3_object = s3.get_object(Bucket=bucket, Key=key)
        zip_bytes = s3_object["Body"].read()

        req = urllib.request.Request(
            zip_upload_url,
            data=zip_bytes,
            method="PUT",
            headers={"Content-Type": "application/zip"},
        )
        with urllib.request.urlopen(req) as resp:
            if resp.status not in (200, 201):
                raise RuntimeError(f"Failed to upload artifact to Amplify: HTTP {resp.status}")

        # Step 3: Start the deployment
        amplify.start_deployment(appId=app_id, branchName=branch, jobId=job_token)
        print(f"Amplify deployment started — job ID: {job_token}")

        codepipeline.put_job_success_result(jobId=job_id)

    except Exception as exc:
        print(traceback.format_exc())
        codepipeline.put_job_failure_result(
            jobId=job_id,
            failureDetails={
                "type": "JobFailed",
                "message": str(exc)[:2048],
                "externalExecutionId": context.aws_request_id,
            },
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_params(job: dict) -> dict:
    """Parse optional user parameters passed from the CodePipeline action."""
    raw = (
        job.get("data", {})
        .get("actionConfiguration", {})
        .get("configuration", {})
        .get("UserParameters", "{}")
    )
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _get_artifact(job: dict) -> dict:
    """Return the first input artifact from the CodePipeline job."""
    artifacts = job.get("data", {}).get("inputArtifacts", [])
    if not artifacts:
        raise ValueError("No input artifacts found in the CodePipeline job")
    return artifacts[0]
