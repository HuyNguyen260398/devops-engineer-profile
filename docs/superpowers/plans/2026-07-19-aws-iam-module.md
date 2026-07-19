# AWS IAM Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `inf/terraform/aws-iam/`, a per-account Terraform root module managing IAM roles, customer-managed policies, groups, users, a permissions boundary, and the account password policy.

**Architecture:** A flat root module matching repo convention (no `modules/` subdirectory). Hybrid interface: data-driven `map(object)` variables for repetitive resources (policies, service roles, groups, users), explicit HCL for roles whose trust policy carries security weight (cross-account, break-glass). All policy documents built with `data "aws_iam_policy_document"`, never heredoc JSON.

**Tech Stack:** Terraform ≥ 1.3, `hashicorp/aws ~> 5.0`, tflint with the AWS ruleset.

**Spec:** `docs/superpowers/specs/2026-07-19-aws-iam-modules-design.md`

**Companion plan:** `2026-07-19-aws-iam-identity-center-module.md` — independent, no ordering dependency during implementation.

## Global Constraints

- `terraform { required_version = ">= 1.3" }`. This **diverges from the `>= 1.0`** used by every other module in this repo. Required because `optional()` in object type constraints is Terraform 1.3+ and `lifecycle { precondition }` is 1.2+. Do not lower it.
- `hashicorp/aws` pinned `~> 5.0`, matching `aws-github-oidc/provider.tf`.
- **snake_case** for every resource, variable, output, and data source name (enforced by `.tflint.hcl` terraform ruleset `recommended` preset).
- Every taggable AWS resource carries `Environment`, `Project`, `ManagedBy` (enforced by `.tflint.hcl` rule `aws_resource_missing_tags`). Supplied via provider `default_tags` **and** `local.common_tags`.
- Every variable and output has an explicit `type` and `description`.
- **No `aws_iam_access_key` resources anywhere in this module.** Key material in state is a credential leak. This is non-negotiable.
- Policy documents use `data "aws_iam_policy_document"`. No heredoc JSON.
- Region `ap-southeast-1`, matching existing modules.

---

## File Structure

| File | Responsibility |
|---|---|
| `provider.tf` | `required_version`, `required_providers`, `provider "aws"` with `default_tags` |
| `backend.tf` | S3 + DynamoDB backend, commented out with placeholders + CLI bootstrap instructions |
| `variables.tf` | All input variables with types, descriptions, validation blocks |
| `locals.tf` | `common_tags`, `data "aws_caller_identity"`, `data "aws_partition"` |
| `boundary.tf` | The permissions boundary policy |
| `policies.tf` | Customer-managed policies from `var.policies` |
| `roles_service.tf` | Service-principal roles from `var.service_roles` |
| `roles_cross_account.tf` | Explicit cross-account roles with ExternalId + MFA |
| `role_break_glass.tf` | Explicit break-glass admin role |
| `groups.tf` | Groups, group policy attachments, memberships |
| `users.tf` | IAM users (default none), optional login profiles |
| `account.tf` | Account password policy, gated |
| `outputs.tf` | Role ARNs, policy ARNs, group names, boundary ARN |
| `environments/dev.tfvars.example`, `environments/prod.tfvars.example` | Worked examples |
| `README.md` | Usage, apply order, the "users are second-class" policy |

---

### Task 1: Module scaffold

**Files:**
- Create: `inf/terraform/aws-iam/provider.tf`
- Create: `inf/terraform/aws-iam/backend.tf`
- Create: `inf/terraform/aws-iam/variables.tf`
- Create: `inf/terraform/aws-iam/locals.tf`
- Test: `terraform init -backend=false && terraform validate` in `inf/terraform/aws-iam/`

**Interfaces:**
- Consumes: nothing
- Produces: `local.common_tags` (map of string), `data.aws_caller_identity.current.account_id` (string), `data.aws_partition.current.partition` (string), and base variables `var.aws_region`, `var.environment`, `var.project_name`, `var.tags`

- [ ] **Step 1: Create `provider.tf`**

```hcl
terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}
```

- [ ] **Step 2: Create `backend.tf`**

Placeholders are intentional — account IDs were not available at design time. Do not invent bucket names.

```hcl
# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: Terraform state for an IAM module contains role ARNs, policy documents,
# and principal identifiers. Storing it in git is a security anti-pattern.
# A remote backend provides:
#   - Encryption at rest (S3 SSE) and in transit (HTTPS)
#   - Locking via DynamoDB to prevent concurrent apply conflicts
#   - Shared access for team members and CI/CD runners
#   - Audit trail via S3 versioning
#
# SETUP (run once, before the first `terraform init`). The bucket and lock
# table are bootstrapped via AWS CLI rather than Terraform to avoid the
# chicken-and-egg problem of storing a backend's state in itself.
#
#   ACCOUNT_ID=<THIS_ACCOUNT_ID>
#
#   aws s3api create-bucket \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --region ap-southeast-1 \
#     --create-bucket-configuration LocationConstraint=ap-southeast-1
#
#   aws s3api put-bucket-versioning \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws s3api put-public-access-block \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --public-access-block-configuration \
#       "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
#   aws dynamodb create-table \
#     --table-name aws-iam-tfstate-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region ap-southeast-1
#
# Then uncomment the block below, substitute the account ID, and run
# `terraform init`.
# ===========================================================================

terraform {
  # backend "s3" {
  #   bucket         = "aws-iam-tfstate-<ACCOUNT_ID>"
  #   key            = "aws-iam/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "aws-iam-tfstate-lock"
  #   # Authenticate via GitHub OIDC / IAM role assumption in CI.
  #   # Never store AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in this repo.
  # }
}
```

- [ ] **Step 3: Create `variables.tf` with the base variables only**

Later tasks append to this file. Do not add `policies`, `service_roles`, etc. yet.

```hcl
variable "aws_region" {
  description = "AWS region for provider configuration. IAM is global, but the provider and remote state still require a region."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name, applied as the Environment tag on every resource."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project identifier, applied as the Project tag and used as a name prefix for created resources."
  type        = string
}

variable "tags" {
  description = "Additional tags merged into every resource on top of the required Environment, Project, and ManagedBy tags."
  type        = map(string)
  default     = {}
}
```

- [ ] **Step 4: Create `locals.tf`**

```hcl
locals {
  # Merge caller-supplied tags with the three tags required by .tflint.hcl.
  # The required tags are listed last so they cannot be overridden by var.tags.
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )

  name_prefix = "${var.project_name}-${var.environment}"
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}
```

- [ ] **Step 5: Verify it validates**

```bash
cd inf/terraform/aws-iam
terraform init -backend=false
terraform fmt -check
terraform validate
```

Expected: `terraform validate` prints `Success! The configuration is valid.`
`terraform fmt -check` exits 0 with no output. If it lists files, run `terraform fmt` and re-check.

- [ ] **Step 6: Commit**

```bash
git add inf/terraform/aws-iam/
git commit -m "feat(aws-iam): scaffold module with provider, backend, and base variables"
```

---

### Task 2: Permissions boundary policy

**Files:**
- Create: `inf/terraform/aws-iam/boundary.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`, `data.aws_partition.current.partition`
- Produces: `aws_iam_policy.permissions_boundary.arn` (string) — consumed by Tasks 4, 5, 6, 7

- [ ] **Step 1: Append the boundary variable to `variables.tf`**

```hcl
variable "boundary_denied_actions" {
  description = "Actions explicitly denied by the permissions boundary policy. Any principal carrying the boundary can never perform these, regardless of its own policies."
  type        = list(string)
  default = [
    "organizations:*",
    "account:*",
    "iam:CreateUser",
    "iam:CreateAccessKey",
    "iam:DeleteAccountPasswordPolicy",
  ]
}

variable "boundary_allowed_regions" {
  description = "Regions in which boundary-carrying principals may operate. Empty list disables the region restriction. Global services (IAM, CloudFront, Route53) are exempted automatically."
  type        = list(string)
  default     = []
}
```

- [ ] **Step 2: Create `boundary.tf`**

The boundary is a ceiling, not a grant: it allows broadly, then denies the sensitive set. A principal's effective permissions are the intersection of its own policies and this boundary.

```hcl
# ===========================================================================
# Permissions Boundary
# ===========================================================================
# A permissions boundary caps the maximum permissions a principal can have.
# It grants nothing on its own — effective permissions are the intersection
# of the principal's identity policies and this boundary.
#
# Attach via the permissions_boundary argument on aws_iam_role / aws_iam_user.
# ===========================================================================

data "aws_iam_policy_document" "permissions_boundary" {
  # Broad allow — the boundary caps, it does not grant.
  statement {
    sid       = "AllowAllByDefault"
    effect    = "Allow"
    actions   = ["*"]
    resources = ["*"]
  }

  statement {
    sid       = "DenySensitiveActions"
    effect    = "Deny"
    actions   = var.boundary_denied_actions
    resources = ["*"]
  }

  # Prevent a boundary-carrying principal from detaching its own boundary
  # or escalating by creating an unbounded role.
  statement {
    sid    = "DenyBoundaryEscape"
    effect = "Deny"
    actions = [
      "iam:DeleteRolePermissionsBoundary",
      "iam:DeleteUserPermissionsBoundary",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyRoleCreationWithoutBoundary"
    effect = "Deny"
    actions = [
      "iam:CreateRole",
      "iam:PutRolePermissionsBoundary",
    ]
    resources = ["*"]

    condition {
      test     = "StringNotEquals"
      variable = "iam:PermissionsBoundary"
      values   = [aws_iam_policy.permissions_boundary.arn]
    }
  }

  dynamic "statement" {
    for_each = length(var.boundary_allowed_regions) > 0 ? [1] : []

    content {
      sid       = "DenyOutsideAllowedRegions"
      effect    = "Deny"
      actions   = ["*"]
      resources = ["*"]

      condition {
        test     = "StringNotEquals"
        variable = "aws:RequestedRegion"
        values   = var.boundary_allowed_regions
      }

      # Global services have no meaningful region and would otherwise be
      # blocked outright by the condition above.
      condition {
        test     = "ForAllValues:StringNotEquals"
        variable = "aws:PrincipalServiceName"
        values   = ["iam.amazonaws.com", "cloudfront.amazonaws.com", "route53.amazonaws.com"]
      }
    }
  }
}

resource "aws_iam_policy" "permissions_boundary" {
  name        = "${local.name_prefix}-permissions-boundary"
  path        = "/"
  description = "Permissions boundary capping the maximum permissions of roles and users created by the aws-iam module."
  policy      = data.aws_iam_policy_document.permissions_boundary.json

  tags = local.common_tags
}
```

Note the self-reference: `data.aws_iam_policy_document.permissions_boundary` references `aws_iam_policy.permissions_boundary.arn`. Terraform resolves this because the ARN is known at plan time from the name. If this produces a cycle error, replace the reference with the constructed ARN string:
`"arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/${local.name_prefix}-permissions-boundary"`

- [ ] **Step 2b: Run validate specifically to check for the cycle**

```bash
cd inf/terraform/aws-iam
terraform validate
```

Expected: `Success!` If instead you see `Error: Cycle:`, apply the ARN-string substitution described above, then re-run. This is the one place in this module where a cycle is plausible — do not skip this check.

- [ ] **Step 3: Plan against a real account to confirm the policy renders**

```bash
cd inf/terraform/aws-iam
terraform plan -var="environment=dev" -var="project_name=dep"
```

Expected: plan shows `1 to add` — `aws_iam_policy.permissions_boundary`. Read the rendered `policy` JSON in the output and confirm the Deny statements are present.

- [ ] **Step 4: Commit**

```bash
git add inf/terraform/aws-iam/boundary.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add permissions boundary policy"
```

---

### Task 3: Customer-managed policies

**Files:**
- Create: `inf/terraform/aws-iam/policies.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + a deliberate validation-failure check

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`
- Produces: `aws_iam_policy.custom` (map keyed by policy key) — `.arn` consumed by Tasks 4, 5, 7

- [ ] **Step 1: Append `var.policies` to `variables.tf`**

The wildcard validation here is the guardrail from the spec. It rejects `Action: "*"` combined with `Resource: "*"` in the same statement.

```hcl
variable "policies" {
  description = "Customer-managed IAM policies to create, keyed by policy name suffix. Each statement is rendered into an aws_iam_policy_document."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    path        = optional(string, "/")
    statements = list(object({
      sid       = optional(string, null)
      effect    = optional(string, "Allow")
      actions   = list(string)
      resources = list(string)
      condition = optional(list(object({
        test     = string
        variable = string
        values   = list(string)
      })), [])
    }))
  }))
  default = {}

  validation {
    condition = alltrue([
      for policy_key, policy in var.policies : alltrue([
        for statement in policy.statements :
        !(contains(statement.actions, "*") && contains(statement.resources, "*"))
      ])
    ])
    error_message = "A policy statement must not combine Action \"*\" with Resource \"*\". Scope at least one of them. This is the single most common IAM misconfiguration."
  }

  validation {
    condition = alltrue([
      for policy_key, policy in var.policies : alltrue([
        for statement in policy.statements :
        contains(["Allow", "Deny"], statement.effect)
      ])
    ])
    error_message = "Policy statement effect must be exactly \"Allow\" or \"Deny\" (case-sensitive)."
  }
}
```

- [ ] **Step 2: Create `policies.tf`**

```hcl
# ===========================================================================
# Customer-Managed Policies
# ===========================================================================
# Policies defined data-driven via var.policies. Rendered through
# aws_iam_policy_document rather than heredoc JSON so that syntax errors
# surface at plan time and the document renders readably in plan output.
#
# NOTE: policies created here can be referenced by name from IAM Identity
# Center permission sets (see the aws-iam-identity-center module) as
# customer managed policy references. That is a name-level contract — the
# name must match exactly, and this module must be applied in the target
# account BEFORE the assignment referencing it.
# ===========================================================================

data "aws_iam_policy_document" "custom" {
  for_each = var.policies

  dynamic "statement" {
    for_each = each.value.statements

    content {
      sid       = statement.value.sid
      effect    = statement.value.effect
      actions   = statement.value.actions
      resources = statement.value.resources

      dynamic "condition" {
        for_each = statement.value.condition

        content {
          test     = condition.value.test
          variable = condition.value.variable
          values   = condition.value.values
        }
      }
    }
  }
}

resource "aws_iam_policy" "custom" {
  for_each = var.policies

  name        = "${local.name_prefix}-${each.key}"
  path        = each.value.path
  description = each.value.description
  policy      = data.aws_iam_policy_document.custom[each.key].json

  tags = local.common_tags
}
```

- [ ] **Step 3: Verify the wildcard guardrail actually fires**

This is the closest thing to a failing test in this plan. Create a throwaway tfvars file:

```bash
cd inf/terraform/aws-iam
cat > /tmp/bad.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
policies = {
  too-broad = {
    statements = [{
      actions   = ["*"]
      resources = ["*"]
    }]
  }
}
EOF
terraform plan -var-file=/tmp/bad.tfvars
```

Expected: **FAILS** with `Invalid value for variable` and the message
`A policy statement must not combine Action "*" with Resource "*"...`

If it succeeds, the validation block is wrong — fix it before continuing.

- [ ] **Step 4: Verify a well-formed policy plans cleanly**

```bash
cd inf/terraform/aws-iam
cat > /tmp/good.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
policies = {
  s3-read = {
    description = "Read-only access to the artifacts bucket"
    statements = [{
      sid       = "ReadArtifacts"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = ["arn:aws:s3:::dep-artifacts", "arn:aws:s3:::dep-artifacts/*"]
    }]
  }
}
EOF
terraform plan -var-file=/tmp/good.tfvars
rm /tmp/bad.tfvars /tmp/good.tfvars
```

Expected: plan succeeds, showing `aws_iam_policy.custom["s3-read"]` to add.

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam/policies.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add data-driven customer-managed policies with wildcard guardrail"
```

---

### Task 4: Service roles

**Files:**
- Create: `inf/terraform/aws-iam/roles_service.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`, `aws_iam_policy.custom` (from Task 3), `aws_iam_policy.permissions_boundary.arn` (from Task 2)
- Produces: `aws_iam_role.service` (map keyed by role key) — `.arn` consumed by `outputs.tf` in Task 9

- [ ] **Step 1: Append `var.service_roles` to `variables.tf`**

```hcl
variable "service_roles" {
  description = "IAM roles assumed by AWS services, keyed by role name suffix. Trust is a simple Service principal — for roles needing conditional trust (OIDC, cross-account), use explicit HCL instead."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # Service principals permitted to assume the role, e.g. ["lambda.amazonaws.com"].
    service_principals = list(string)
    # ARNs of AWS-managed policies, e.g. ["arn:aws:iam::aws:policy/ReadOnlyAccess"].
    managed_policy_arns = optional(list(string), [])
    # Keys into var.policies for customer-managed policies created by this module.
    custom_policy_keys = optional(list(string), [])
    max_session_duration = optional(number, 3600)
    attach_boundary      = optional(bool, false)
  }))
  default = {}

  validation {
    condition = alltrue([
      for role_key, role in var.service_roles :
      role.max_session_duration >= 3600 && role.max_session_duration <= 43200
    ])
    error_message = "max_session_duration must be between 3600 and 43200 seconds (AWS limit)."
  }

  validation {
    condition = alltrue([
      for role_key, role in var.service_roles : alltrue([
        for principal in role.service_principals :
        endswith(principal, ".amazonaws.com")
      ])
    ])
    error_message = "service_principals must be AWS service principals ending in .amazonaws.com (e.g. lambda.amazonaws.com)."
  }
}
```

- [ ] **Step 2: Create `roles_service.tf`**

```hcl
# ===========================================================================
# Service Roles
# ===========================================================================
# Roles assumed by AWS services. Trust here is intentionally simple — a bare
# Service principal. Any role needing conditional trust (ExternalId, MFA,
# OIDC subject claims) belongs in explicit HCL where the condition is
# visible in a PR diff, not buried in a tfvars map.
# ===========================================================================

data "aws_iam_policy_document" "service_role_trust" {
  for_each = var.service_roles

  statement {
    sid     = "AllowServiceAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = each.value.service_principals
    }
  }
}

resource "aws_iam_role" "service" {
  for_each = var.service_roles

  name                 = "${local.name_prefix}-${each.key}"
  description          = each.value.description
  assume_role_policy   = data.aws_iam_policy_document.service_role_trust[each.key].json
  max_session_duration = each.value.max_session_duration
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  tags = local.common_tags
}

# Flatten role -> managed policy ARN pairs into a map with a stable composite
# key, so adding one attachment never re-creates the others.
locals {
  service_role_managed_attachments = {
    for pair in flatten([
      for role_key, role in var.service_roles : [
        for policy_arn in role.managed_policy_arns : {
          key        = "${role_key}/${policy_arn}"
          role_key   = role_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  service_role_custom_attachments = {
    for pair in flatten([
      for role_key, role in var.service_roles : [
        for policy_key in role.custom_policy_keys : {
          key        = "${role_key}/${policy_key}"
          role_key   = role_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_role_policy_attachment" "service_managed" {
  for_each = local.service_role_managed_attachments

  role       = aws_iam_role.service[each.value.role_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_role_policy_attachment" "service_custom" {
  for_each = local.service_role_custom_attachments

  role       = aws_iam_role.service[each.value.role_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn

  lifecycle {
    precondition {
      condition     = contains(keys(var.policies), each.value.policy_key)
      error_message = "service_roles references custom_policy_keys entry '${each.value.policy_key}', which is not defined in var.policies."
    }
  }
}
```

- [ ] **Step 3: Plan with a service role defined**

```bash
cd inf/terraform/aws-iam
cat > /tmp/svc.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
policies = {
  s3-read = {
    statements = [{
      actions   = ["s3:GetObject"]
      resources = ["arn:aws:s3:::dep-artifacts/*"]
    }]
  }
}
service_roles = {
  lambda-etl = {
    description         = "Execution role for the ETL Lambda"
    service_principals  = ["lambda.amazonaws.com"]
    managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
    custom_policy_keys  = ["s3-read"]
    attach_boundary     = true
  }
}
EOF
terraform plan -var-file=/tmp/svc.tfvars
```

Expected: plan adds `aws_iam_role.service["lambda-etl"]`, `aws_iam_role_policy_attachment.service_managed[...]`, and `aws_iam_role_policy_attachment.service_custom["lambda-etl/s3-read"]`. Confirm the role shows a non-null `permissions_boundary`.

- [ ] **Step 4: Verify the bad-key precondition fires**

```bash
cd inf/terraform/aws-iam
sed 's/custom_policy_keys  = \["s3-read"\]/custom_policy_keys  = ["does-not-exist"]/' /tmp/svc.tfvars > /tmp/svc-bad.tfvars
terraform plan -var-file=/tmp/svc-bad.tfvars
rm /tmp/svc.tfvars /tmp/svc-bad.tfvars
```

Expected: **FAILS.** Note the failure may surface as a map-lookup error rather than the precondition message, because Terraform evaluates the `policy_arn` expression before the precondition. Either failure is acceptable — the point is that it fails at plan time, not apply time. If it *succeeds*, that is a bug: fix it before continuing.

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam/roles_service.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add data-driven service roles with policy attachments"
```

---

### Task 5: Cross-account roles

**Files:**
- Create: `inf/terraform/aws-iam/roles_cross_account.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`, `aws_iam_policy.custom`, `aws_iam_policy.permissions_boundary.arn`
- Produces: `aws_iam_role.cross_account` (map) — `.arn` consumed by `outputs.tf` in Task 9

- [ ] **Step 1: Append `var.cross_account_roles` to `variables.tf`**

The trust *conditions* are hardcoded in HCL (Task 5 Step 2); only the principals and toggles are data-driven. That is the hybrid split from the spec.

```hcl
variable "cross_account_roles" {
  description = "Roles assumable from other AWS accounts. Trust conditions (ExternalId, MFA) are enforced in HCL, not configurable per-role, so they remain visible in review."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # 12-digit account IDs permitted to assume this role.
    trusted_account_ids = list(string)
    # Specific role/user ARNs in those accounts. If empty, the whole account root is trusted.
    trusted_principal_arns = optional(list(string), [])
    # sts:ExternalId value. Strongly recommended for third-party access (confused deputy).
    external_id = optional(string, null)
    # Require MFA on the assuming session.
    require_mfa          = optional(bool, true)
    managed_policy_arns  = optional(list(string), [])
    custom_policy_keys   = optional(list(string), [])
    max_session_duration = optional(number, 3600)
    attach_boundary      = optional(bool, true)
  }))
  default = {}

  validation {
    condition = alltrue([
      for role_key, role in var.cross_account_roles : alltrue([
        for account_id in role.trusted_account_ids :
        can(regex("^\\d{12}$", account_id))
      ])
    ])
    error_message = "trusted_account_ids entries must be exactly 12 digits."
  }

  validation {
    condition = alltrue([
      for role_key, role in var.cross_account_roles :
      length(role.trusted_account_ids) > 0
    ])
    error_message = "Each cross-account role must trust at least one account ID."
  }
}
```

- [ ] **Step 2: Create `roles_cross_account.tf`**

```hcl
# ===========================================================================
# Cross-Account Roles
# ===========================================================================
# Trust policies live in explicit HCL because this is where IAM mistakes
# become incidents. A missing ExternalId on a third-party role is the classic
# confused-deputy vulnerability; a missing MFA condition turns a leaked
# long-lived credential into full account access.
#
# Both conditions are enforced here rather than exposed as free-form tfvars
# so that changing them requires a code diff a reviewer will actually see.
# ===========================================================================

data "aws_iam_policy_document" "cross_account_trust" {
  for_each = var.cross_account_roles

  statement {
    sid     = "AllowCrossAccountAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "AWS"
      # Prefer specific principal ARNs when supplied; fall back to account root.
      identifiers = length(each.value.trusted_principal_arns) > 0 ? each.value.trusted_principal_arns : [
        for account_id in each.value.trusted_account_ids :
        "arn:${data.aws_partition.current.partition}:iam::${account_id}:root"
      ]
    }

    # Confused-deputy protection for third-party access.
    dynamic "condition" {
      for_each = each.value.external_id != null ? [1] : []

      content {
        test     = "StringEquals"
        variable = "sts:ExternalId"
        values   = [each.value.external_id]
      }
    }

    dynamic "condition" {
      for_each = each.value.require_mfa ? [1] : []

      content {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }
}

resource "aws_iam_role" "cross_account" {
  for_each = var.cross_account_roles

  name                 = "${local.name_prefix}-${each.key}"
  description          = each.value.description
  assume_role_policy   = data.aws_iam_policy_document.cross_account_trust[each.key].json
  max_session_duration = each.value.max_session_duration
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  tags = local.common_tags
}

locals {
  cross_account_managed_attachments = {
    for pair in flatten([
      for role_key, role in var.cross_account_roles : [
        for policy_arn in role.managed_policy_arns : {
          key        = "${role_key}/${policy_arn}"
          role_key   = role_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  cross_account_custom_attachments = {
    for pair in flatten([
      for role_key, role in var.cross_account_roles : [
        for policy_key in role.custom_policy_keys : {
          key        = "${role_key}/${policy_key}"
          role_key   = role_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_role_policy_attachment" "cross_account_managed" {
  for_each = local.cross_account_managed_attachments

  role       = aws_iam_role.cross_account[each.value.role_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_role_policy_attachment" "cross_account_custom" {
  for_each = local.cross_account_custom_attachments

  role       = aws_iam_role.cross_account[each.value.role_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn
}
```

- [ ] **Step 3: Plan and read the rendered trust policy**

```bash
cd inf/terraform/aws-iam
cat > /tmp/xacct.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
cross_account_roles = {
  auditor = {
    description         = "Read-only access for the external audit vendor"
    trusted_account_ids = ["123456789012"]
    external_id         = "audit-vendor-shared-secret"
    require_mfa         = true
    managed_policy_arns = ["arn:aws:iam::aws:policy/SecurityAudit"]
  }
}
EOF
terraform plan -var-file=/tmp/xacct.tfvars
rm /tmp/xacct.tfvars
```

Expected: plan adds `aws_iam_role.cross_account["auditor"]`. **Read the rendered `assume_role_policy` JSON** and confirm it contains both `sts:ExternalId` and `aws:MultiFactorAuthPresent` conditions. This visual confirmation is the point of the task — do not skip it.

- [ ] **Step 4: Verify the account-ID validation fires**

```bash
cd inf/terraform/aws-iam
cat > /tmp/xacct-bad.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
cross_account_roles = {
  auditor = {
    trusted_account_ids = ["12345"]
  }
}
EOF
terraform plan -var-file=/tmp/xacct-bad.tfvars
rm /tmp/xacct-bad.tfvars
```

Expected: **FAILS** with `trusted_account_ids entries must be exactly 12 digits.`

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam/roles_cross_account.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add cross-account roles with ExternalId and MFA trust conditions"
```

---

### Task 6: Break-glass admin role

**Files:**
- Create: `inf/terraform/aws-iam/role_break_glass.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`, `aws_iam_policy.permissions_boundary.arn`, `data.aws_caller_identity.current.account_id`, `data.aws_partition.current.partition`
- Produces: `aws_iam_role.break_glass` (count-indexed, 0 or 1) — `.arn` consumed by `outputs.tf` in Task 9

- [ ] **Step 1: Append break-glass variables to `variables.tf`**

```hcl
variable "enable_break_glass_role" {
  description = "Create the break-glass admin role. This role grants AdministratorAccess and should exist in production accounts as a last-resort access path when Identity Center is unavailable."
  type        = bool
  default     = false
}

variable "break_glass_max_session_duration" {
  description = "Maximum session duration in seconds for the break-glass role. Kept short deliberately — this is an emergency path, not a working session."
  type        = number
  default     = 3600

  validation {
    condition     = var.break_glass_max_session_duration >= 3600 && var.break_glass_max_session_duration <= 14400
    error_message = "break_glass_max_session_duration must be between 3600 and 14400 seconds. Longer emergency sessions are not justifiable."
  }
}
```

- [ ] **Step 2: Create `role_break_glass.tf`**

```hcl
# ===========================================================================
# Break-Glass Admin Role
# ===========================================================================
# Last-resort access path for when IAM Identity Center is unavailable
# (SSO outage, IdP misconfiguration, expired certificate).
#
# Deliberate design choices:
#   - Trusted by the account root, so it survives deletion of every other
#     principal in the account.
#   - MFA is mandatory and NOT configurable. A break-glass role without MFA
#     is a standing backdoor.
#   - Carries the permissions boundary. Even in an emergency, the denied
#     action set (organizations:*, account:*) stays denied.
#   - prevent_destroy — a terraform destroy that removes the emergency access
#     path during an incident is precisely the wrong outcome.
#
# OPERATIONAL NOTE: assumption of this role should raise a CloudTrail alarm.
# Wiring that alarm is out of scope for this module — it belongs in the
# monitoring stack — but it is a required follow-up before relying on this.
# ===========================================================================

data "aws_iam_policy_document" "break_glass_trust" {
  count = var.enable_break_glass_role ? 1 : 0

  statement {
    sid     = "AllowRootAccountAssumeRoleWithMFA"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }

    # Reject sessions where MFA was satisfied long ago.
    condition {
      test     = "NumericLessThan"
      variable = "aws:MultiFactorAuthAge"
      values   = ["3600"]
    }
  }
}

resource "aws_iam_role" "break_glass" {
  count = var.enable_break_glass_role ? 1 : 0

  name                 = "${local.name_prefix}-break-glass"
  description          = "Emergency administrator access. Assumption must be alarmed and reviewed."
  assume_role_policy   = data.aws_iam_policy_document.break_glass_trust[0].json
  max_session_duration = var.break_glass_max_session_duration
  permissions_boundary = aws_iam_policy.permissions_boundary.arn

  tags = merge(local.common_tags, {
    Purpose = "break-glass"
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy_attachment" "break_glass_admin" {
  count = var.enable_break_glass_role ? 1 : 0

  role       = aws_iam_role.break_glass[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AdministratorAccess"
}
```

- [ ] **Step 3: Plan with the role enabled**

```bash
cd inf/terraform/aws-iam
terraform plan -var="environment=dev" -var="project_name=dep" -var="enable_break_glass_role=true"
```

Expected: plan adds `aws_iam_role.break_glass[0]` and its attachment. Confirm in the rendered trust JSON that **both** `aws:MultiFactorAuthPresent` and `aws:MultiFactorAuthAge` conditions are present, and that `permissions_boundary` is set.

- [ ] **Step 4: Confirm the default is off**

```bash
cd inf/terraform/aws-iam
terraform plan -var="environment=dev" -var="project_name=dep" | grep -c "break_glass" || true
```

Expected: `0` — the role must not appear when `enable_break_glass_role` is left at its default.

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam/role_break_glass.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add break-glass admin role with mandatory MFA and boundary"
```

---

### Task 7: Groups, memberships, and users

**Files:**
- Create: `inf/terraform/aws-iam/groups.tf`
- Create: `inf/terraform/aws-iam/users.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform validate` + `terraform plan` + a grep asserting no access keys

**Interfaces:**
- Consumes: `local.common_tags`, `local.name_prefix`, `aws_iam_policy.custom`, `aws_iam_policy.permissions_boundary.arn`
- Produces: `aws_iam_group.this` (map), `aws_iam_user.this` (map) — names consumed by `outputs.tf` in Task 9

- [ ] **Step 1: Append group and user variables to `variables.tf`**

```hcl
variable "groups" {
  description = "IAM groups to create, keyed by group name suffix, with the policies attached to each."
  type = map(object({
    path                = optional(string, "/")
    managed_policy_arns = optional(list(string), [])
    custom_policy_keys  = optional(list(string), [])
  }))
  default = {}
}

variable "users" {
  description = "IAM users to create, keyed by user name. Defaults to none by design — use Identity Center for humans and roles for workloads. Reserve IAM users for break-glass and legacy service accounts that cannot assume a role."
  type = map(object({
    path   = optional(string, "/")
    groups = optional(list(string), [])
    # Base64-encoded PGP public key, or a keybase:username reference. Required
    # to create a console login profile — the encrypted password appears in
    # state and is only decryptable by this key's holder.
    pgp_key         = optional(string, null)
    attach_boundary = optional(bool, true)
  }))
  default = {}

  validation {
    condition = alltrue([
      for user_key, user in var.users :
      can(regex("^[a-zA-Z0-9._+=,@-]{1,64}$", user_key))
    ])
    error_message = "User names must match AWS's allowed pattern: alphanumerics and the characters _+=,.@- , max 64 characters."
  }
}

variable "manage_account_password_policy" {
  description = "Manage the account-wide IAM password policy. Defaults to false because this is an account singleton — if two Terraform stacks both manage it, they will fight on every apply."
  type        = bool
  default     = false
}
```

- [ ] **Step 2: Create `groups.tf`**

```hcl
# ===========================================================================
# IAM Groups
# ===========================================================================
# Groups exist to carry policies for IAM users. With Identity Center handling
# human access, groups here are mainly for legacy service accounts.
#
# Note: aws_iam_group is not a taggable resource — the .tflint.hcl
# required-tags rule does not apply to it.
# ===========================================================================

resource "aws_iam_group" "this" {
  for_each = var.groups

  name = "${local.name_prefix}-${each.key}"
  path = each.value.path
}

locals {
  group_managed_attachments = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for policy_arn in group.managed_policy_arns : {
          key        = "${group_key}/${policy_arn}"
          group_key  = group_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  group_custom_attachments = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for policy_key in group.custom_policy_keys : {
          key        = "${group_key}/${policy_key}"
          group_key  = group_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }

  # user -> group pairs, derived from each user's group list.
  user_group_memberships = {
    for pair in flatten([
      for user_key, user in var.users : [
        for group_key in user.groups : {
          key       = "${user_key}/${group_key}"
          user_key  = user_key
          group_key = group_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_group_policy_attachment" "managed" {
  for_each = local.group_managed_attachments

  group      = aws_iam_group.this[each.value.group_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_group_policy_attachment" "custom" {
  for_each = local.group_custom_attachments

  group      = aws_iam_group.this[each.value.group_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn
}

# aws_iam_user_group_membership is used rather than aws_iam_group_membership
# because the latter takes exclusive ownership of a group's entire member
# list and will remove members added by any other process.
resource "aws_iam_user_group_membership" "this" {
  for_each = local.user_group_memberships

  user   = aws_iam_user.this[each.value.user_key].name
  groups = [aws_iam_group.this[each.value.group_key].name]
}
```

- [ ] **Step 3: Create `users.tf`**

```hcl
# ===========================================================================
# IAM Users
# ===========================================================================
# var.users defaults to {} deliberately.
#
# Use instead:
#   - Humans          -> IAM Identity Center (see aws-iam-identity-center)
#   - EKS workloads   -> IRSA (see aws-eks / aws-eks-argocd)
#   - EC2 / Lambda    -> service roles (roles_service.tf)
#   - CI/CD           -> GitHub OIDC (see aws-github-oidc)
#
# IAM users are appropriate only for break-glass and legacy service accounts
# that genuinely cannot assume a role.
#
# THIS MODULE CREATES NO ACCESS KEYS. aws_iam_access_key writes the secret
# into Terraform state in plaintext. Create keys out-of-band via the console
# or CLI, and rotate them on a schedule.
# ===========================================================================

resource "aws_iam_user" "this" {
  for_each = var.users

  name                 = each.key
  path                 = each.value.path
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  # force_destroy removes the user's non-Terraform-managed attachments
  # (access keys, MFA devices) on destroy. Left false so that destroying a
  # user with live credentials fails loudly rather than silently.
  force_destroy = false

  tags = local.common_tags
}

# Console login profile. The generated password is PGP-encrypted with the
# supplied key; the encrypted value lands in state and can only be decrypted
# by that key's holder. Without a pgp_key, no login profile is created.
resource "aws_iam_user_login_profile" "this" {
  for_each = {
    for user_key, user in var.users : user_key => user
    if user.pgp_key != null
  }

  user                    = aws_iam_user.this[each.key].name
  pgp_key                 = each.value.pgp_key
  password_reset_required = true

  lifecycle {
    # Terraform cannot read the current password back, so it would otherwise
    # propose a replacement on every plan.
    ignore_changes = [password_length, password_reset_required, pgp_key]
  }
}
```

- [ ] **Step 4: Assert no access-key resource exists anywhere in the module**

```bash
cd inf/terraform/aws-iam
grep -rn "aws_iam_access_key" . && echo "FAIL: access key resource found" || echo "PASS: no access key resources"
```

Expected: `PASS: no access key resources`

- [ ] **Step 5: Plan with a group and a user**

```bash
cd inf/terraform/aws-iam
cat > /tmp/users.tfvars <<'EOF'
environment  = "dev"
project_name = "dep"
groups = {
  legacy-svc = {
    managed_policy_arns = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
  }
}
users = {
  legacy-backup-agent = {
    groups = ["legacy-svc"]
  }
}
EOF
terraform plan -var-file=/tmp/users.tfvars
rm /tmp/users.tfvars
```

Expected: plan adds `aws_iam_group.this["legacy-svc"]`, `aws_iam_user.this["legacy-backup-agent"]`, one group policy attachment, and `aws_iam_user_group_membership.this["legacy-backup-agent/legacy-svc"]`. No login profile (no `pgp_key` given). Confirm the user shows a non-null `permissions_boundary`.

- [ ] **Step 6: Commit**

```bash
git add inf/terraform/aws-iam/groups.tf inf/terraform/aws-iam/users.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add groups, memberships, and users without access keys"
```

---

### Task 8: Account password policy

**Files:**
- Create: `inf/terraform/aws-iam/account.tf`
- Modify: `inf/terraform/aws-iam/variables.tf` (append)
- Test: `terraform plan` with the flag on and off

**Interfaces:**
- Consumes: `var.manage_account_password_policy` (already defined in Task 7 Step 1)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Append password policy variables to `variables.tf`**

```hcl
variable "password_policy" {
  description = "Account-wide IAM password policy settings. Only applied when manage_account_password_policy is true."
  type = object({
    minimum_password_length        = optional(number, 14)
    require_lowercase_characters   = optional(bool, true)
    require_uppercase_characters   = optional(bool, true)
    require_numbers                = optional(bool, true)
    require_symbols                = optional(bool, true)
    allow_users_to_change_password = optional(bool, true)
    max_password_age               = optional(number, 90)
    password_reuse_prevention      = optional(number, 24)
    hard_expiry                    = optional(bool, false)
  })
  default = {}

  validation {
    condition     = var.password_policy.minimum_password_length >= 14
    error_message = "minimum_password_length must be at least 14, per CIS AWS Foundations Benchmark."
  }

  validation {
    condition     = var.password_policy.password_reuse_prevention >= 1 && var.password_policy.password_reuse_prevention <= 24
    error_message = "password_reuse_prevention must be between 1 and 24 (AWS limit)."
  }
}
```

- [ ] **Step 2: Create `account.tf`**

```hcl
# ===========================================================================
# Account Password Policy
# ===========================================================================
# aws_iam_account_password_policy is an ACCOUNT SINGLETON — there is exactly
# one per AWS account. If two Terraform stacks both declare it, each apply
# will revert the other's settings, producing permanent drift.
#
# Gated behind manage_account_password_policy (default false). Enable it in
# exactly one stack per account.
#
# hard_expiry deserves a warning: when true, users whose password expires are
# locked out entirely and require an administrator to reset them. In an
# account where the administrator's own password expires, this locks everyone
# out. Left false by default for that reason.
#
# This resource is not taggable, so the .tflint.hcl required-tags rule does
# not apply.
# ===========================================================================

resource "aws_iam_account_password_policy" "this" {
  count = var.manage_account_password_policy ? 1 : 0

  minimum_password_length        = var.password_policy.minimum_password_length
  require_lowercase_characters   = var.password_policy.require_lowercase_characters
  require_uppercase_characters   = var.password_policy.require_uppercase_characters
  require_numbers                = var.password_policy.require_numbers
  require_symbols                = var.password_policy.require_symbols
  allow_users_to_change_password = var.password_policy.allow_users_to_change_password
  max_password_age               = var.password_policy.max_password_age
  password_reuse_prevention      = var.password_policy.password_reuse_prevention
  hard_expiry                    = var.password_policy.hard_expiry
}
```

- [ ] **Step 3: Confirm the default is off**

```bash
cd inf/terraform/aws-iam
terraform plan -var="environment=dev" -var="project_name=dep" | grep -c "aws_iam_account_password_policy" || true
```

Expected: `0`

- [ ] **Step 4: Confirm it appears when enabled, and the length floor holds**

```bash
cd inf/terraform/aws-iam
terraform plan -var="environment=dev" -var="project_name=dep" \
  -var="manage_account_password_policy=true"

terraform plan -var="environment=dev" -var="project_name=dep" \
  -var="manage_account_password_policy=true" \
  -var='password_policy={minimum_password_length=8}'
```

Expected: the first plan adds `aws_iam_account_password_policy.this[0]`.
The second **FAILS** with `minimum_password_length must be at least 14, per CIS AWS Foundations Benchmark.`

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam/account.tf inf/terraform/aws-iam/variables.tf
git commit -m "feat(aws-iam): add gated account password policy"
```

---

### Task 9: Outputs, examples, README, and full lint

**Files:**
- Create: `inf/terraform/aws-iam/outputs.tf`
- Create: `inf/terraform/aws-iam/environments/dev.tfvars.example`
- Create: `inf/terraform/aws-iam/environments/prod.tfvars.example`
- Create: `inf/terraform/aws-iam/README.md`
- Test: `terraform fmt -check`, `terraform validate`, `tflint --recursive`

**Interfaces:**
- Consumes: every resource from Tasks 2–8
- Produces: the module's public output surface

- [ ] **Step 1: Create `outputs.tf`**

```hcl
output "permissions_boundary_arn" {
  description = "ARN of the permissions boundary policy. Pass this to other stacks that create roles which must be capped by the same boundary."
  value       = aws_iam_policy.permissions_boundary.arn
}

output "custom_policy_arns" {
  description = "Map of policy key to ARN for every customer-managed policy created by this module."
  value       = { for policy_key, policy in aws_iam_policy.custom : policy_key => policy.arn }
}

output "custom_policy_names" {
  description = "Map of policy key to policy name. Identity Center permission sets reference customer-managed policies by NAME, not ARN — use this output when wiring the aws-iam-identity-center module."
  value       = { for policy_key, policy in aws_iam_policy.custom : policy_key => policy.name }
}

output "service_role_arns" {
  description = "Map of role key to ARN for every service role."
  value       = { for role_key, role in aws_iam_role.service : role_key => role.arn }
}

output "cross_account_role_arns" {
  description = "Map of role key to ARN for every cross-account role."
  value       = { for role_key, role in aws_iam_role.cross_account : role_key => role.arn }
}

output "break_glass_role_arn" {
  description = "ARN of the break-glass admin role, or null when disabled."
  value       = var.enable_break_glass_role ? aws_iam_role.break_glass[0].arn : null
}

output "group_names" {
  description = "Map of group key to the created IAM group name."
  value       = { for group_key, group in aws_iam_group.this : group_key => group.name }
}

output "user_names" {
  description = "Map of user key to the created IAM user name."
  value       = { for user_key, user in aws_iam_user.this : user_key => user.name }
}
```

- [ ] **Step 2: Create `environments/dev.tfvars.example`**

```hcl
# Copy to dev.tfvars and fill in. dev.tfvars is gitignored.
aws_region   = "ap-southeast-1"
environment  = "dev"
project_name = "dep"

tags = {
  Owner = "platform-team"
}

# Break-glass is off in dev — Identity Center is sufficient here.
enable_break_glass_role = false

# Password policy is managed in exactly one stack per account.
manage_account_password_policy = false

policies = {
  artifacts-read = {
    description = "Read-only access to the build artifacts bucket"
    statements = [{
      sid       = "ReadArtifacts"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [
        "arn:aws:s3:::dep-artifacts-dev",
        "arn:aws:s3:::dep-artifacts-dev/*",
      ]
    }]
  }
}

service_roles = {
  lambda-etl = {
    description         = "Execution role for the ETL Lambda"
    service_principals  = ["lambda.amazonaws.com"]
    managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
    custom_policy_keys  = ["artifacts-read"]
    attach_boundary     = true
  }
}

cross_account_roles = {}
groups              = {}
users               = {}
```

- [ ] **Step 3: Create `environments/prod.tfvars.example`**

```hcl
# Copy to prod.tfvars and fill in. prod.tfvars is gitignored.
# REPLACE every <PLACEHOLDER> before applying.
aws_region   = "ap-southeast-1"
environment  = "prod"
project_name = "dep"

tags = {
  Owner      = "platform-team"
  CostCenter = "<COST_CENTER>"
}

# Break-glass exists in prod as the last-resort path if Identity Center fails.
enable_break_glass_role = true

# Enable in exactly ONE stack per account, or stacks will fight on every apply.
manage_account_password_policy = true

password_policy = {
  minimum_password_length   = 16
  max_password_age          = 90
  password_reuse_prevention = 24
  # hard_expiry stays false — true locks out users whose password expires,
  # including administrators.
  hard_expiry = false
}

# Restrict boundary-carrying principals to the regions actually in use.
boundary_allowed_regions = ["ap-southeast-1", "us-east-1"]

policies = {
  artifacts-read = {
    description = "Read-only access to the build artifacts bucket"
    statements = [{
      sid       = "ReadArtifacts"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [
        "arn:aws:s3:::dep-artifacts-prod",
        "arn:aws:s3:::dep-artifacts-prod/*",
      ]
    }]
  }
}

service_roles = {}

cross_account_roles = {
  auditor = {
    description         = "Read-only access for the external audit vendor"
    trusted_account_ids = ["<AUDIT_VENDOR_ACCOUNT_ID>"]
    # Must be a high-entropy value supplied by the vendor. Without it this
    # role is vulnerable to the confused-deputy attack.
    external_id         = "<EXTERNAL_ID_FROM_VENDOR>"
    require_mfa         = true
    managed_policy_arns = ["arn:aws:iam::aws:policy/SecurityAudit"]
    attach_boundary     = true
  }
}

groups = {}
users  = {}
```

- [ ] **Step 4: Create `README.md`**

````markdown
# aws-iam

Per-account IAM: roles, customer-managed policies, groups, users, a permissions
boundary, and the account password policy.

Companion module: `../aws-iam-identity-center/` manages IAM Identity Center from
the organization's management account.

## Access model

| Principal type | Use this |
|---|---|
| Humans | IAM Identity Center (`../aws-iam-identity-center/`) |
| EKS workloads | IRSA (`../aws-eks/`, `../aws-eks-argocd/`) |
| EC2 / Lambda / ECS | Service roles — `service_roles` in this module |
| CI/CD pipelines | GitHub OIDC (`../aws-github-oidc/`) |
| Emergency access | Break-glass role — `enable_break_glass_role` |
| Legacy service accounts | IAM users — last resort only |

This module **creates no access keys**. `aws_iam_access_key` writes the secret
into Terraform state in plaintext. Create keys out-of-band and rotate them.

## Usage

```bash
cd inf/terraform/aws-iam
cp environments/dev.tfvars.example environments/dev.tfvars
# edit environments/dev.tfvars

terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

Before the first `terraform init`, provision the state bucket and lock table —
see the setup commands in `backend.tf`, then uncomment the backend block.

## Interface split

Data-driven `map(object)` variables cover repetitive resources: `policies`,
`service_roles`, `groups`, `users`.

Trust policies for `cross_account_roles` and the break-glass role are written in
HCL, and their security conditions (`sts:ExternalId`, MFA) are **not**
configurable per-role. Changing them requires a code diff a reviewer will see.
That asymmetry is intentional: trust policies are where IAM mistakes become
incidents.

## Guardrails

- **Permissions boundary** — created by this module, opt-in per role via
  `attach_boundary`, mandatory on the break-glass role. It caps permissions; it
  grants nothing.
- **Wildcard rejection** — `var.policies` rejects any statement combining
  `Action: "*"` with `Resource: "*"`.
- **Password policy** — gated behind `manage_account_password_policy`
  (default `false`). It is an account singleton; enable it in exactly one stack
  per account or stacks will fight on every apply.

## Contract with the Identity Center module

An Identity Center permission set can reference a customer-managed policy **by
name**, resolved in the target account at assignment time. Those policies are
created here.

This is a name-level contract, not a Terraform dependency — the two modules run
in different accounts. Consequences:

1. Apply this module in a member account **before** any Identity Center
   assignment that references one of its policies.
2. A missing policy fails at **apply** time with an AWS error, not at plan time.
3. Use the `custom_policy_names` output to get the exact names to reference.

## Verification

```bash
terraform fmt -check
terraform validate
tflint --recursive   # from repo root
terraform plan -var-file=environments/dev.tfvars
```

`terraform apply` is deliberately excluded from CI. This module can lock
principals out of an account; a human should read the plan before the first
apply.

## Follow-up, not handled here

Assumption of the break-glass role should raise a CloudTrail alarm. That belongs
in the monitoring stack, but it is a prerequisite for relying on the role.
````

- [ ] **Step 5: Run the full verification suite**

```bash
cd inf/terraform/aws-iam
terraform fmt -check
terraform validate
terraform plan -var-file=environments/dev.tfvars.example
```

Expected: `fmt -check` exits 0 silently; `validate` prints `Success!`; the plan
completes without error.

- [ ] **Step 6: Run tflint from the repo root**

```bash
cd "$(git rev-parse --show-toplevel)"
tflint --init
tflint --recursive
```

Expected: no findings for `inf/terraform/aws-iam/`.

Two likely findings and how to handle them:
- **Missing tags on `aws_iam_group`, `aws_iam_group_policy_attachment`, `aws_iam_role_policy_attachment`, `aws_iam_account_password_policy`** — these resources are not taggable. If tflint flags them anyway, that is a tflint bug; add a targeted `rule` exclusion in `.tflint.hcl` with a comment, do not add fake tags.
- **`terraform_unused_declarations`** — if a variable is flagged unused, it means a task was skipped. Go back and find it rather than deleting the variable.

- [ ] **Step 7: Add tfvars to gitignore**

```bash
cd "$(git rev-parse --show-toplevel)"
grep -q "inf/terraform/\*\*/environments/\*.tfvars$" .gitignore || \
  printf '\n# Terraform variable files (may contain account IDs and external IDs)\ninf/terraform/**/environments/*.tfvars\n!inf/terraform/**/environments/*.tfvars.example\n' >> .gitignore
```

Verify the real tfvars are ignored but examples are not:

```bash
git check-ignore -v inf/terraform/aws-iam/environments/dev.tfvars
git check-ignore -v inf/terraform/aws-iam/environments/dev.tfvars.example || echo "example correctly NOT ignored"
```

Expected: the first prints a matching gitignore rule; the second prints
`example correctly NOT ignored`.

- [ ] **Step 8: Commit**

```bash
git add inf/terraform/aws-iam/ .gitignore
git commit -m "feat(aws-iam): add outputs, tfvars examples, and README"
```

---

## Self-Review Notes

**Spec coverage:** roles (Tasks 4–6), policies (Task 3), users and groups
(Task 7), permissions boundary (Task 2), password policy (Task 8), wildcard
rejection (Task 3), S3 backend (Task 1), file structure (all tasks), tflint
conventions (Task 9). The excluded items — GitHub OIDC, IRSA, Access Analyzer,
OU-driven assignment — have no tasks, correctly.

**Known weakness:** Terraform has no unit-test framework in this repo, so no
task follows a true red-green cycle. The closest approximations are the
deliberate-failure checks in Task 3 Step 3, Task 4 Step 4, Task 5 Step 4, and
Task 8 Step 4, which assert that guardrails actually reject bad input rather
than merely existing. Those steps are the highest-value verification in this
plan and should not be skipped.

**Deferred to the Identity Center plan:** everything under
`aws-iam-identity-center/`. The two modules share no state and no resources;
either can be implemented first.
