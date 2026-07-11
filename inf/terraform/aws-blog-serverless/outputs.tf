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
