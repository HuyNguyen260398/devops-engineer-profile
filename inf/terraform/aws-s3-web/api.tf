resource "aws_api_gateway_rest_api" "blog" {
  name = "${local.name_prefix}-api"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-api" })
}

resource "aws_api_gateway_authorizer" "cognito" {
  name            = "${local.name_prefix}-cognito"
  type            = "COGNITO_USER_POOLS"
  rest_api_id     = aws_api_gateway_rest_api.blog.id
  provider_arns   = [aws_cognito_user_pool.blog.arn]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "posts" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_rest_api.blog.root_resource_id
  path_part   = "posts"
}

resource "aws_api_gateway_resource" "post_key" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_resource.posts.id
  path_part   = "{key}"
}

resource "aws_api_gateway_resource" "uploads" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_rest_api.blog.root_resource_id
  path_part   = "uploads"
}

# GET /posts must stay public (auth = false) because the homepage and /blogs list
# fetch it anonymously from the browser. A Cognito authorizer is binary — it either
# rejects anonymous requests or never validates the token — so it can't
# conditionally reveal drafts on that same method. Drafts therefore live behind a
# dedicated Cognito-required route.
resource "aws_api_gateway_resource" "drafts" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_rest_api.blog.root_resource_id
  path_part   = "drafts"
}

# Authenticated single-post read for the editor. GET /posts/{key} is public and
# only returns published posts, so the editor cannot load a draft through it;
# this route returns a post of any status to an authenticated caller.
resource "aws_api_gateway_resource" "draft_key" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_resource.drafts.id
  path_part   = "{key}"
}

locals {
  # method key -> { resource_id, http verb, auth (true = Cognito required) }
  methods = {
    list_posts  = { resource = aws_api_gateway_resource.posts.id, http = "GET", auth = false }
    list_drafts = { resource = aws_api_gateway_resource.drafts.id, http = "GET", auth = true }
    get_draft   = { resource = aws_api_gateway_resource.draft_key.id, http = "GET", auth = true }
    create_post = { resource = aws_api_gateway_resource.posts.id, http = "POST", auth = true }
    get_post    = { resource = aws_api_gateway_resource.post_key.id, http = "GET", auth = false }
    update_post = { resource = aws_api_gateway_resource.post_key.id, http = "PUT", auth = true }
    delete_post = { resource = aws_api_gateway_resource.post_key.id, http = "DELETE", auth = true }
    presign     = { resource = aws_api_gateway_resource.uploads.id, http = "POST", auth = true }
  }
}

resource "aws_api_gateway_method" "m" {
  for_each      = local.methods
  rest_api_id   = aws_api_gateway_rest_api.blog.id
  resource_id   = each.value.resource
  http_method   = each.value.http
  authorization = each.value.auth ? "COGNITO_USER_POOLS" : "NONE"
  authorizer_id = each.value.auth ? aws_api_gateway_authorizer.cognito.id : null
}

resource "aws_api_gateway_integration" "m" {
  for_each                = local.methods
  rest_api_id             = aws_api_gateway_rest_api.blog.id
  resource_id             = each.value.resource
  http_method             = aws_api_gateway_method.m[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.blog.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "blog" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  triggers = {
    redeploy = sha1(jsonencode([local.methods, aws_lambda_function.api.source_code_hash]))
  }
  lifecycle {
    create_before_destroy = true
  }
  depends_on = [aws_api_gateway_integration.m]
}

resource "aws_api_gateway_stage" "blog" {
  rest_api_id   = aws_api_gateway_rest_api.blog.id
  deployment_id = aws_api_gateway_deployment.blog.id
  stage_name    = "v1"
  tags          = local.common_tags
}
