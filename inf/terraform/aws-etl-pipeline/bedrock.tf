# ============================================================================
# Amazon Bedrock Agent — content-extractor
# Uses Claude Haiku 3.5 for cost-efficient Markdown cleaning.
# No action groups — agent returns cleaned content directly as completion text.
# REC-007: prepare_agent = true ensures the agent is PREPARED (not DRAFT) before alias.
# DEP-001: Bedrock model access must be enabled in the AWS Console before apply.
# ============================================================================

resource "aws_bedrockagent_agent" "content_extractor" {
  agent_name              = "${local.name_prefix}-content-extractor"
  description             = "Extracts clean main-body Markdown from raw web-scraped .md files"
  agent_resource_role_arn = aws_iam_role.bedrock_agent_execution.arn
  foundation_model        = var.bedrock_model_id
  idle_session_ttl_in_seconds = 600

  # REC-007: prepare agent during apply so the alias can reference a stable version
  prepare_agent = true

  instruction = <<-INSTRUCTION
    You are a content extraction specialist. When given raw Markdown scraped from a website,
    extract ONLY the main article body.

    Remove ALL of the following:
    - Navigation menus and breadcrumbs
    - Comment sections and user-generated replies
    - Author bios and avatar image references
    - Related posts and "You may also like" sections
    - Advertisement blocks and sponsored content
    - Social share buttons (Twitter, Facebook, LinkedIn, etc.)
    - Footer content, cookie notices, and legal boilerplate
    - Sidebar widgets, newsletter sign-up forms
    - Site headers and tag/category navigation

    Preserve ALL of the following from the main content:
    - Article headings (H1 through H6) and their hierarchy
    - Body paragraphs with full text
    - Code blocks and inline code
    - Ordered and unordered lists
    - Blockquotes
    - Inline links within the article body
    - Images that are part of the article content (not decorative UI images)
    - Tables

    Return the cleaned content as valid Markdown. Do not add any explanation, preamble, or
    commentary — return only the clean Markdown content.
  INSTRUCTION

  depends_on = [aws_iam_role_policy.bedrock_agent_policy]

  tags = {
    Name = "${local.name_prefix}-content-extractor"
  }
}

# Agent alias "live" — points to DRAFT version (stable after prepare_agent = true)
# REC-007: To promote to an immutable numbered version, run:
#   aws bedrock-agent create-agent-version --agent-id <id>
# then update routing_configuration.agent_version to the new version number.
resource "aws_bedrockagent_agent_alias" "live" {
  agent_id         = aws_bedrockagent_agent.content_extractor.agent_id
  agent_alias_name = "live"
  description      = "Live alias — routes to DRAFT for staging; pin to a numbered version for production"

  routing_configuration {
    agent_version = "DRAFT"
  }

  tags = {
    Name = "${local.name_prefix}-content-extractor-live"
  }
}
