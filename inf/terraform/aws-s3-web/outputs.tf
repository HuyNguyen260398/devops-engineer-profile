# Output values for the S3 static website

output "bucket_id" {
  description = "The ID (name) of the S3 bucket"
  value       = aws_s3_bucket.website.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.website.arn
}

output "bucket_domain_name" {
  description = "The bucket domain name"
  value       = aws_s3_bucket.website.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "The bucket regional domain name"
  value       = aws_s3_bucket.website.bucket_regional_domain_name
}

output "website_endpoint" {
  description = "The website endpoint URL"
  value       = aws_s3_bucket_website_configuration.website.website_endpoint
}

output "website_domain" {
  description = "The domain of the website endpoint"
  value       = aws_s3_bucket_website_configuration.website.website_domain
}

output "website_url" {
  description = "The full HTTP URL of the website"
  value       = "http://${aws_s3_bucket_website_configuration.website.website_endpoint}"
}

output "bucket_region" {
  description = "The AWS region where the bucket is located"
  value       = aws_s3_bucket.website.region
}

# ---------------------------------------------------------------------------
# Serverless blog outputs (wire these into the frontend sync workflow).
# ---------------------------------------------------------------------------

output "distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = aws_cloudfront_distribution.blog.id
}

output "distribution_domain" {
  description = "CloudFront domain name."
  value       = aws_cloudfront_distribution.blog.domain_name
}

output "blog_url" {
  description = "Public blog URL."
  value       = "https://${local.domain}/blogs"
}

output "user_pool_id" {
  description = "Cognito user pool ID."
  value       = aws_cognito_user_pool.blog.id
}

output "user_pool_client_id" {
  description = "Cognito app client ID."
  value       = aws_cognito_user_pool_client.blog.id
}

output "api_id" {
  description = "API Gateway REST API ID."
  value       = aws_api_gateway_rest_api.blog.id
}
