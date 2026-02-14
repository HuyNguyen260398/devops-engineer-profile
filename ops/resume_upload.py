#!/usr/bin/env python3
"""
Resume PDF Upload and Management Script

This script provides utilities for uploading, updating, and managing
resume PDF files in S3 with CloudFront cache invalidation.

Author: Nguyen Gia Huy
Date: February 2026
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ResumeManager:
    """Manages resume PDF uploads to S3 and CloudFront invalidations."""

    def __init__(
        self,
        bucket_name: str,
        cloudfront_distribution_id: Optional[str] = None,
        region: str = "ap-southeast-1",
    ):
        """
        Initialize ResumeManager.

        Args:
            bucket_name: S3 bucket name
            cloudfront_distribution_id: CloudFront distribution ID for cache invalidation
            region: AWS region
        """
        self.bucket_name = bucket_name
        self.cloudfront_distribution_id = cloudfront_distribution_id
        self.region = region

        try:
            self.s3_client = boto3.client("s3", region_name=region)
            self.cloudfront_client = boto3.client(
                "cloudfront", region_name="ap-southeast-1"
            )
            logger.info(f"Initialized AWS clients for region: {region}")
        except NoCredentialsError:
            logger.error("AWS credentials not found. Please configure AWS CLI.")
            sys.exit(1)

    def upload_resume(
        self,
        local_file_path: str,
        s3_key: str = "resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf",
        content_type: str = "application/pdf",
    ) -> bool:
        """
        Upload resume PDF to S3.

        Args:
            local_file_path: Path to local PDF file
            s3_key: S3 object key
            content_type: MIME type

        Returns:
            True if successful, False otherwise
        """
        if not Path(local_file_path).exists():
            logger.error(f"File not found: {local_file_path}")
            return False

        try:
            # Upload with metadata
            self.s3_client.upload_file(
                local_file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    "ContentType": content_type,
                    "ContentDisposition": 'attachment; filename="Nguyen-Gia-Huy-DevOps-Engineer.pdf"',
                    "CacheControl": "max-age=86400",  # 1 day
                    "Metadata": {
                        "uploaded-by": "resume_upload_script",
                        "upload-timestamp": str(Path(local_file_path).stat().st_mtime),
                    },
                },
            )
            logger.info(
                f"Successfully uploaded {local_file_path} to s3://{self.bucket_name}/{s3_key}"
            )
            return True

        except ClientError as e:
            logger.error(f"Failed to upload file: {e}")
            return False

    def invalidate_cloudfront(self, paths: list[str] = None) -> Optional[str]:
        """
        Invalidate CloudFront cache.

        Args:
            paths: List of paths to invalidate (default: resume PDF)

        Returns:
            Invalidation ID if successful, None otherwise
        """
        if not self.cloudfront_distribution_id:
            logger.warning(
                "CloudFront distribution ID not provided. Skipping invalidation."
            )
            return None

        if paths is None:
            paths = ["/Nguyen-Gia-Huy-DevOps-Engineer.pdf"]

        try:
            response = self.cloudfront_client.create_invalidation(
                DistributionId=self.cloudfront_distribution_id,
                InvalidationBatch={
                    "Paths": {"Quantity": len(paths), "Items": paths},
                    "CallerReference": str(hash(tuple(paths))),
                },
            )
            invalidation_id = response["Invalidation"]["Id"]
            logger.info(f"Created CloudFront invalidation: {invalidation_id}")
            return invalidation_id

        except ClientError as e:
            logger.error(f"Failed to create CloudFront invalidation: {e}")
            return None

    def check_invalidation_status(self, invalidation_id: str) -> Optional[str]:
        """
        Check CloudFront invalidation status.

        Args:
            invalidation_id: Invalidation ID

        Returns:
            Status string if successful, None otherwise
        """
        if not self.cloudfront_distribution_id:
            return None

        try:
            response = self.cloudfront_client.get_invalidation(
                DistributionId=self.cloudfront_distribution_id, Id=invalidation_id
            )
            status = response["Invalidation"]["Status"]
            logger.info(f"Invalidation {invalidation_id} status: {status}")
            return status

        except ClientError as e:
            logger.error(f"Failed to check invalidation status: {e}")
            return None

    def list_versions(
        self, s3_key: str = "resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
    ) -> list:
        """
        List all versions of the resume PDF.

        Args:
            s3_key: S3 object key

        Returns:
            List of version metadata
        """
        try:
            response = self.s3_client.list_object_versions(
                Bucket=self.bucket_name, Prefix=s3_key
            )

            versions = []
            for version in response.get("Versions", []):
                versions.append(
                    {
                        "VersionId": version["VersionId"],
                        "LastModified": version["LastModified"].isoformat(),
                        "Size": version["Size"],
                        "IsLatest": version["IsLatest"],
                    }
                )

            logger.info(f"Found {len(versions)} versions of {s3_key}")
            return versions

        except ClientError as e:
            logger.error(f"Failed to list versions: {e}")
            return []

    def get_download_url(
        self, s3_key: str = "resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
    ) -> Optional[str]:
        """
        Get CloudFront download URL.

        Args:
            s3_key: S3 object key

        Returns:
            Download URL if available
        """
        if self.cloudfront_distribution_id:
            try:
                response = self.cloudfront_client.get_distribution(
                    Id=self.cloudfront_distribution_id
                )
                domain_name = response["Distribution"]["DomainName"]
                filename = s3_key.split("/")[-1]
                url = f"https://{domain_name}/{filename}"
                logger.info(f"Download URL: {url}")
                return url
            except ClientError as e:
                logger.error(f"Failed to get CloudFront URL: {e}")

        return None


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Upload and manage resume PDF files in S3 with CloudFront"
    )

    parser.add_argument(
        "action",
        choices=["upload", "invalidate", "list-versions", "get-url"],
        help="Action to perform",
    )
    parser.add_argument("--file", type=str, help="Path to local PDF file (for upload)")
    parser.add_argument("--bucket", type=str, required=True, help="S3 bucket name")
    parser.add_argument(
        "--distribution-id", type=str, help="CloudFront distribution ID"
    )
    parser.add_argument(
        "--region",
        type=str,
        default="ap-southeast-1",
        help="AWS region (default: ap-southeast-1)",
    )
    parser.add_argument(
        "--s3-key",
        type=str,
        default="resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf",
        help="S3 object key",
    )

    args = parser.parse_args()

    # Initialize manager
    manager = ResumeManager(
        bucket_name=args.bucket,
        cloudfront_distribution_id=args.distribution_id,
        region=args.region,
    )

    # Execute action
    if args.action == "upload":
        if not args.file:
            logger.error("--file is required for upload action")
            sys.exit(1)

        success = manager.upload_resume(args.file, args.s3_key)
        if success and args.distribution_id:
            logger.info("Invalidating CloudFront cache...")
            manager.invalidate_cloudfront()
        sys.exit(0 if success else 1)

    elif args.action == "invalidate":
        if not args.distribution_id:
            logger.error("--distribution-id is required for invalidate action")
            sys.exit(1)

        invalidation_id = manager.invalidate_cloudfront(
            [f'/{args.s3_key.split("/")[-1]}']
        )
        sys.exit(0 if invalidation_id else 1)

    elif args.action == "list-versions":
        versions = manager.list_versions(args.s3_key)
        print(json.dumps(versions, indent=2))

    elif args.action == "get-url":
        url = manager.get_download_url(args.s3_key)
        if url:
            print(url)
        else:
            sys.exit(1)


if __name__ == "__main__":
    main()
