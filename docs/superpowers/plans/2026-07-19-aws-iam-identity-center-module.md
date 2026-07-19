# AWS IAM Identity Center Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `inf/terraform/aws-iam-identity-center/`, a management-account Terraform root module managing Identity Store users, groups, and memberships; permission sets; and account assignments.

**Architecture:** A flat root module matching repo convention. Permission sets come from a curated baseline merged with user overrides. Access is expressed group-centrically as an access matrix (group → permission set → account aliases) and flattened in `locals.tf` into a map keyed by a stable composite string.

**Tech Stack:** Terraform ≥ 1.3, `hashicorp/aws ~> 5.0`, tflint with the AWS ruleset.

**Spec:** `docs/superpowers/specs/2026-07-19-aws-iam-modules-design.md`

**Companion plan:** `2026-07-19-aws-iam-module.md` — independent, no ordering dependency during implementation.

## Global Constraints

- `terraform { required_version = ">= 1.3" }`. Diverges from the `>= 1.0` used elsewhere in this repo, because `optional()` in object types is 1.3+ and `lifecycle { precondition }` is 1.2+.
- `hashicorp/aws` pinned `~> 5.0`.
- **This module runs in the AWS Organizations MANAGEMENT account only.** `aws_ssoadmin_*` and `aws_identitystore_*` resources are not available from member accounts.
- **Prerequisite that Terraform cannot satisfy:** IAM Identity Center must already be enabled in the organization via the console. There is no Terraform resource that enables it. Task 1 adds a precondition that fails with a clear message if it is not.
- Identity source is the **built-in Identity Center directory**. This module owns the full user and group lifecycle. If the org ever migrates to an external IdP via SCIM, user and group *creation* must be removed from this module — Terraform-created principals would collide with SCIM-provisioned ones and drift continuously.
- **snake_case** for every resource, variable, output, and data source name.
- Every taggable resource carries `Environment`, `Project`, `ManagedBy`. Note that `aws_identitystore_user`, `aws_identitystore_group`, `aws_identitystore_group_membership`, and `aws_ssoadmin_account_assignment` are **not** taggable; `aws_ssoadmin_permission_set` is.
- Every variable and output has an explicit `type` and `description`.
- `session_duration` defaults to `PT1H`, matching the AWS default. Longer is an explicit opt-in.
- Region `ap-southeast-1`.

---

## File Structure

| File | Responsibility |
|---|---|
| `provider.tf` | `required_version`, `required_providers`, `provider "aws"` with `default_tags` |
| `backend.tf` | S3 + DynamoDB backend, commented out with placeholders + CLI bootstrap instructions |
| `variables.tf` | All input variables with types, descriptions, validation blocks |
| `locals.tf` | SSO instance data source + precondition, `common_tags`, the access-matrix flattening |
| `permission_sets.tf` | Baseline merged with overrides; managed / customer-managed / inline / boundary attachments |
| `identity_store.tf` | Users, groups, memberships |
| `assignments.tf` | Account assignments from the flattened matrix |
| `outputs.tf` | Permission set ARNs, group IDs, assignment keys |
| `environments/prod.tfvars.example` | Worked example |
| `README.md` | Usage, prerequisites, apply order, SCIM warning |

---

### Task 1: Scaffold and Identity Center instance discovery

**Files:**
- Create: `inf/terraform/aws-iam-identity-center/provider.tf`
- Create: `inf/terraform/aws-iam-identity-center/backend.tf`
- Create: `inf/terraform/aws-iam-identity-center/variables.tf`
- Create: `inf/terraform/aws-iam-identity-center/locals.tf`
- Test: `terraform validate`, then `terraform plan` against the real management account

**Interfaces:**
- Consumes: nothing
- Produces: `local.sso_instance_arn` (string), `local.identity_store_id` (string), `local.common_tags` (map of string), and base variables `var.aws_region`, `var.environment`, `var.project_name`, `var.tags`, `var.accounts`

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

# NOTE: these credentials must resolve to the AWS Organizations MANAGEMENT
# account. Identity Center resources are not available from member accounts.
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

Note this bucket lives in the **management account** — necessarily a different bucket from the `aws-iam` module's. Placeholders are intentional; do not invent an account ID.

```hcl
# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: this state maps every human principal to every permission they hold
# across the organization. It is among the most sensitive state in the estate
# and must never live in git.
#
# The bucket lives in the MANAGEMENT account — a different account, and
# therefore a different bucket, from the aws-iam module's state.
#
# SETUP (run once in the management account, before the first
# `terraform init`). Bootstrapped via AWS CLI rather than Terraform to avoid
# the chicken-and-egg problem.
#
#   MGMT_ACCOUNT_ID=<MANAGEMENT_ACCOUNT_ID>
#
#   aws s3api create-bucket \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --region ap-southeast-1 \
#     --create-bucket-configuration LocationConstraint=ap-southeast-1
#
#   aws s3api put-bucket-versioning \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws s3api put-public-access-block \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --public-access-block-configuration \
#       "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
#   aws dynamodb create-table \
#     --table-name aws-iam-identity-center-tfstate-lock \
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
  #   bucket         = "aws-iam-identity-center-tfstate-<MANAGEMENT_ACCOUNT_ID>"
  #   key            = "aws-iam-identity-center/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "aws-iam-identity-center-tfstate-lock"
  #   # Authenticate via GitHub OIDC / IAM role assumption in CI.
  #   # Never store AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in this repo.
  # }
}
```

- [ ] **Step 3: Create `variables.tf` with base variables and the account map**

`var.accounts` is the alias→ID map that keeps raw 12-digit IDs out of the access matrix.

```hcl
variable "aws_region" {
  description = "AWS region for provider configuration and remote state."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name, applied as the Environment tag. Identity Center is organization-wide, so this is normally 'prod'."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project identifier, applied as the Project tag and used as a name prefix."
  type        = string
}

variable "tags" {
  description = "Additional tags merged into every taggable resource on top of the required Environment, Project, and ManagedBy tags."
  type        = map(string)
  default     = {}
}

variable "accounts" {
  description = "Map of friendly account alias to 12-digit AWS account ID. The access matrix in var.groups references accounts by alias, never by raw ID — raw account IDs scattered through an access matrix are unreviewable."
  type        = map(string)

  validation {
    condition = alltrue([
      for alias, account_id in var.accounts :
      can(regex("^\\d{12}$", account_id))
    ])
    error_message = "Every account ID must be exactly 12 digits."
  }

  validation {
    condition     = length(var.accounts) > 0
    error_message = "At least one account must be defined, otherwise no assignment can target anything."
  }
}
```

- [ ] **Step 4: Create `locals.tf` with the instance data source and its precondition**

The precondition is the single most valuable line in this module: without it, a wrong-account or Identity-Center-not-enabled run fails with an opaque index-out-of-range error.

```hcl
# ===========================================================================
# Identity Center Instance Discovery
# ===========================================================================
# IAM Identity Center must be enabled manually in the AWS console before this
# module can run. There is no Terraform resource that enables it.
#
# This data source returns empty lists rather than an error when Identity
# Center is not enabled, or when credentials point at a member account
# instead of the management account. Without the precondition below, the
# failure surfaces as an opaque "index 0 out of range" much later in the run.
# ===========================================================================

data "aws_ssoadmin_instances" "this" {
  lifecycle {
    postcondition {
      condition     = length(self.arns) == 1
      error_message = "Expected exactly one IAM Identity Center instance, found ${length(self.arns)}. Confirm that (a) Identity Center is enabled in the AWS console, and (b) these credentials resolve to the Organizations MANAGEMENT account, not a member account."
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  sso_instance_arn   = one(data.aws_ssoadmin_instances.this.arns)
  identity_store_id  = one(data.aws_ssoadmin_instances.this.identity_store_ids)

  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}
```

- [ ] **Step 5: Validate**

```bash
cd inf/terraform/aws-iam-identity-center
terraform init -backend=false
terraform fmt -check
terraform validate
```

Expected: `validate` prints `Success! The configuration is valid.`

- [ ] **Step 6: Plan against the real management account to prove the precondition passes**

```bash
cd inf/terraform/aws-iam-identity-center
terraform plan -var="project_name=dep" -var='accounts={prod="<PROD_ACCOUNT_ID>"}'
```

Expected: plan completes with `No changes` (no resources defined yet), and **no postcondition error**.

If you see `Expected exactly one IAM Identity Center instance, found 0`, stop.
Either Identity Center is not enabled, or the credentials are pointed at a
member account. Resolve that before continuing — every later task depends on
this.

- [ ] **Step 7: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/
git commit -m "feat(identity-center): scaffold module with instance discovery precondition"
```

---

### Task 2: Permission sets

**Files:**
- Create: `inf/terraform/aws-iam-identity-center/permission_sets.tf`
- Modify: `inf/terraform/aws-iam-identity-center/variables.tf` (append)
- Modify: `inf/terraform/aws-iam-identity-center/locals.tf` (append the baseline + merge)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.sso_instance_arn`, `local.common_tags`
- Produces: `local.permission_sets` (map of object — the merged set), `aws_ssoadmin_permission_set.this` (map keyed by permission set name) — `.arn` consumed by Task 4

- [ ] **Step 1: Append `var.permission_sets` to `variables.tf`**

```hcl
variable "permission_sets" {
  description = "Permission sets to create, merged over the built-in baseline. A key matching a baseline name replaces that baseline entry entirely."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # ISO-8601 duration. Defaults to PT1H, matching the AWS default.
    session_duration = optional(string, "PT1H")
    # URL the user lands on after assuming this permission set.
    relay_state = optional(string, null)
    # ARNs of AWS-managed policies.
    managed_policy_arns = optional(list(string), [])
    # Customer-managed policies referenced BY NAME, resolved in each TARGET
    # account at assignment time. The policy must already exist there —
    # typically created by the aws-iam module.
    customer_managed_policy_names = optional(list(string), [])
    # Inline policy JSON. Supported but discouraged: inline policies are
    # invisible in the IAM console of member accounts.
    inline_policy = optional(string, null)
    # Name of a customer-managed policy in the target account to use as the
    # permissions boundary.
    permissions_boundary_policy_name = optional(string, null)
  }))
  default = {}

  validation {
    condition = alltrue([
      for ps_name, ps in var.permission_sets :
      can(regex("^PT([0-9]+H)?([0-9]+M)?$", ps.session_duration))
    ])
    error_message = "session_duration must be an ISO-8601 duration of the form PT<hours>H, PT<minutes>M, or PT<hours>H<minutes>M — e.g. PT1H, PT30M, PT2H30M."
  }

  validation {
    condition = alltrue([
      for ps_name, ps in var.permission_sets :
      can(regex("^[\\w+=,.@-]{1,32}$", ps_name))
    ])
    error_message = "Permission set names must be 1-32 characters of alphanumerics and _+=,.@- (AWS limit)."
  }
}
```

- [ ] **Step 2: Append the baseline and merge to `locals.tf`**

```hcl
# ===========================================================================
# Permission Set Baseline
# ===========================================================================
# A curated starting set. var.permission_sets is merged OVER this map, so a
# user-supplied key of the same name replaces the baseline entry entirely —
# nothing here is unavoidably imposed.
#
# session_duration is PT1H throughout, matching the AWS default. Longer
# sessions are an explicit per-set opt-in.
# ===========================================================================

locals {
  baseline_permission_sets = {
    AdministratorAccess = {
      description                      = "Full administrative access. Assign sparingly and prefer time-bound assignment."
      session_duration                 = "PT1H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/AdministratorAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    PowerUserAccess = {
      description                      = "Full access except IAM and Organizations management."
      session_duration                 = "PT4H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/PowerUserAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    ReadOnlyAccess = {
      description                      = "Read-only access to all services."
      session_duration                 = "PT8H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/ReadOnlyAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    BillingAccess = {
      description                      = "Billing and cost management access."
      session_duration                 = "PT4H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/job-function/Billing"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    SecurityAudit = {
      description                      = "Read-only access for security auditing and configuration review."
      session_duration                 = "PT8H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/SecurityAudit"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }
  }

  # User-supplied sets win outright on key collision.
  permission_sets = merge(local.baseline_permission_sets, var.permission_sets)
}
```

- [ ] **Step 3: Create `permission_sets.tf`**

```hcl
# ===========================================================================
# Permission Sets
# ===========================================================================
# A permission set is a template. It becomes a real IAM role in a member
# account only when assigned to a principal for that account (see
# assignments.tf).
#
# Attachments are split across four resource types because AWS models them
# separately. Each is flattened into a map with a stable composite key so
# that adding one attachment never re-creates the others.
# ===========================================================================

resource "aws_ssoadmin_permission_set" "this" {
  for_each = local.permission_sets

  name             = each.key
  description      = each.value.description
  instance_arn     = local.sso_instance_arn
  session_duration = each.value.session_duration
  relay_state      = each.value.relay_state

  tags = local.common_tags
}

locals {
  permission_set_managed_attachments = {
    for pair in flatten([
      for ps_name, ps in local.permission_sets : [
        for policy_arn in ps.managed_policy_arns : {
          key        = "${ps_name}/${policy_arn}"
          ps_name    = ps_name
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  permission_set_customer_attachments = {
    for pair in flatten([
      for ps_name, ps in local.permission_sets : [
        for policy_name in ps.customer_managed_policy_names : {
          key         = "${ps_name}/${policy_name}"
          ps_name     = ps_name
          policy_name = policy_name
        }
      ]
    ]) : pair.key => pair
  }

  permission_sets_with_inline = {
    for ps_name, ps in local.permission_sets : ps_name => ps
    if ps.inline_policy != null
  }

  permission_sets_with_boundary = {
    for ps_name, ps in local.permission_sets : ps_name => ps
    if ps.permissions_boundary_policy_name != null
  }
}

resource "aws_ssoadmin_managed_policy_attachment" "this" {
  for_each = local.permission_set_managed_attachments

  instance_arn       = local.sso_instance_arn
  managed_policy_arn = each.value.policy_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.ps_name].arn
}

# Resolved by NAME in each TARGET account at assignment time. If the named
# policy does not exist in a target account, the ASSIGNMENT fails at apply
# time — not here, and not at plan time. See README "Apply order".
resource "aws_ssoadmin_customer_managed_policy_attachment" "this" {
  for_each = local.permission_set_customer_attachments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.ps_name].arn

  customer_managed_policy_reference {
    name = each.value.policy_name
    path = "/"
  }
}

# Discouraged — inline policies are invisible in the member account's IAM
# console, which makes them hard to audit during an incident.
resource "aws_ssoadmin_permission_set_inline_policy" "this" {
  for_each = local.permission_sets_with_inline

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.key].arn
  inline_policy      = each.value.inline_policy
}

resource "aws_ssoadmin_permissions_boundary_attachment" "this" {
  for_each = local.permission_sets_with_boundary

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.key].arn

  permissions_boundary {
    customer_managed_policy_reference {
      name = each.value.permissions_boundary_policy_name
      path = "/"
    }
  }
}
```

- [ ] **Step 4: Plan and confirm the baseline appears**

```bash
cd inf/terraform/aws-iam-identity-center
terraform plan -var="project_name=dep" -var='accounts={prod="<PROD_ACCOUNT_ID>"}'
```

Expected: plan adds 5 `aws_ssoadmin_permission_set.this[...]` resources —
`AdministratorAccess`, `PowerUserAccess`, `ReadOnlyAccess`, `BillingAccess`,
`SecurityAudit` — plus one managed policy attachment each.

- [ ] **Step 5: Confirm an override replaces the baseline rather than adding to it**

```bash
cd inf/terraform/aws-iam-identity-center
cat > /tmp/override.tfvars <<'EOF'
project_name = "dep"
accounts     = { prod = "<PROD_ACCOUNT_ID>" }
permission_sets = {
  ReadOnlyAccess = {
    description         = "Read-only, shortened session"
    session_duration    = "PT2H"
    managed_policy_arns = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
  }
}
EOF
terraform plan -var-file=/tmp/override.tfvars
```

Expected: still exactly 5 permission sets, with `ReadOnlyAccess` showing
`session_duration = "PT2H"` and the overridden description. If you see 6, the
merge is wrong.

- [ ] **Step 6: Confirm the session_duration validation fires**

```bash
cd inf/terraform/aws-iam-identity-center
sed 's/session_duration    = "PT2H"/session_duration    = "2 hours"/' /tmp/override.tfvars > /tmp/override-bad.tfvars
terraform plan -var-file=/tmp/override-bad.tfvars
rm /tmp/override.tfvars /tmp/override-bad.tfvars
```

Expected: **FAILS** with `session_duration must be an ISO-8601 duration...`

- [ ] **Step 7: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/permission_sets.tf \
        inf/terraform/aws-iam-identity-center/variables.tf \
        inf/terraform/aws-iam-identity-center/locals.tf
git commit -m "feat(identity-center): add permission sets with curated baseline and overrides"
```

---

### Task 3: Identity Store users, groups, and memberships

**Files:**
- Create: `inf/terraform/aws-iam-identity-center/identity_store.tf`
- Modify: `inf/terraform/aws-iam-identity-center/variables.tf` (append)
- Test: `terraform validate` + `terraform plan`

**Interfaces:**
- Consumes: `local.identity_store_id`
- Produces: `aws_identitystore_group.this` (map keyed by group key) — `.group_id` consumed by Task 4; `aws_identitystore_user.this` (map keyed by user key)

- [ ] **Step 1: Append `var.users` and `var.groups` to `variables.tf`**

`var.groups` carries the access matrix. The `permission_sets` field maps a
permission set name to the list of account **aliases** where the group holds it.

```hcl
variable "users" {
  description = "Identity Store users to create, keyed by username. Only valid when the identity source is the built-in Identity Center directory — if the org migrates to an external IdP with SCIM, this must be emptied and the resources removed from state."
  type = map(object({
    display_name = string
    given_name   = string
    family_name  = string
    email        = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for user_key, user in var.users :
      can(regex("^[^@]+@[^@]+\\.[^@]+$", user.email))
    ])
    error_message = "Each user's email must be a valid address."
  }
}

variable "groups" {
  description = "Identity Store groups and their access. The permission_sets field is the access matrix: permission set name -> list of account ALIASES (keys of var.accounts) where this group holds it."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # Keys into var.users.
    members = optional(list(string), [])
    # Permission set name -> list of account aliases.
    permission_sets = optional(map(list(string)), {})
  }))
  default = {}

  validation {
    condition = alltrue([
      for group_key, group in var.groups :
      can(regex("^[\\w+=,.@ -]{1,128}$", group_key))
    ])
    error_message = "Group names must be 1-128 characters of alphanumerics, spaces, and _+=,.@- (AWS limit)."
  }
}
```

- [ ] **Step 2: Create `identity_store.tf`**

```hcl
# ===========================================================================
# Identity Store Users and Groups
# ===========================================================================
# Valid ONLY because the identity source is the built-in Identity Center
# directory.
#
# WARNING: if this organization ever switches its identity source to an
# external IdP with SCIM provisioning (Entra ID, Okta, Google Workspace),
# these resources MUST be removed. SCIM would provision the same principals
# independently, producing duplicates and permanent drift. In that scenario,
# replace these resources with data sources that look principals up by name.
# ===========================================================================

resource "aws_identitystore_user" "this" {
  for_each = var.users

  identity_store_id = local.identity_store_id

  user_name    = each.key
  display_name = each.value.display_name

  name {
    given_name  = each.value.given_name
    family_name = each.value.family_name
  }

  emails {
    value   = each.value.email
    primary = true
  }
}

resource "aws_identitystore_group" "this" {
  for_each = var.groups

  identity_store_id = local.identity_store_id
  display_name      = each.key
  description       = each.value.description
}

locals {
  # user -> group pairs, keyed on a stable composite string so that adding
  # one membership never re-creates the others.
  group_memberships = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for user_key in group.members : {
          key       = "${group_key}/${user_key}"
          group_key = group_key
          user_key  = user_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_identitystore_group_membership" "this" {
  for_each = local.group_memberships

  identity_store_id = local.identity_store_id
  group_id          = aws_identitystore_group.this[each.value.group_key].group_id
  member_id         = aws_identitystore_user.this[each.value.user_key].user_id

  lifecycle {
    precondition {
      condition     = contains(keys(var.users), each.value.user_key)
      error_message = "Group '${each.value.group_key}' lists member '${each.value.user_key}', which is not defined in var.users."
    }
  }
}
```

- [ ] **Step 3: Plan with a user and group**

```bash
cd inf/terraform/aws-iam-identity-center
cat > /tmp/idstore.tfvars <<'EOF'
project_name = "dep"
accounts     = { prod = "<PROD_ACCOUNT_ID>" }
users = {
  "huy.nguyen" = {
    display_name = "Huy Nguyen"
    given_name   = "Huy"
    family_name  = "Nguyen"
    email        = "huynguyen260398@gmail.com"
  }
}
groups = {
  "platform-admins" = {
    description = "Platform engineering administrators"
    members     = ["huy.nguyen"]
  }
}
EOF
terraform plan -var-file=/tmp/idstore.tfvars
```

Expected: plan adds `aws_identitystore_user.this["huy.nguyen"]`,
`aws_identitystore_group.this["platform-admins"]`, and
`aws_identitystore_group_membership.this["platform-admins/huy.nguyen"]`.

- [ ] **Step 4: Confirm the dangling-member precondition fires**

```bash
cd inf/terraform/aws-iam-identity-center
sed 's/members     = \["huy.nguyen"\]/members     = ["nobody"]/' /tmp/idstore.tfvars > /tmp/idstore-bad.tfvars
terraform plan -var-file=/tmp/idstore-bad.tfvars
rm /tmp/idstore.tfvars /tmp/idstore-bad.tfvars
```

Expected: **FAILS** at plan time. The message may be the precondition text or a
map-lookup error, depending on evaluation order — either is acceptable. A
*successful* plan is a bug; fix it before continuing.

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/identity_store.tf \
        inf/terraform/aws-iam-identity-center/variables.tf
git commit -m "feat(identity-center): add identity store users, groups, and memberships"
```

---

### Task 4: Account assignments

**Files:**
- Create: `inf/terraform/aws-iam-identity-center/assignments.tf`
- Modify: `inf/terraform/aws-iam-identity-center/locals.tf` (append the flattening)
- Test: `terraform validate` + `terraform plan` + two deliberate-failure checks

**Interfaces:**
- Consumes: `local.sso_instance_arn`, `var.accounts`, `var.groups`, `aws_identitystore_group.this[*].group_id`, `aws_ssoadmin_permission_set.this[*].arn`, `local.permission_sets`
- Produces: `local.assignments` (map keyed by `"<group>/<permission_set>/<account_alias>"`), `aws_ssoadmin_account_assignment.this` (map on the same key) — consumed by `outputs.tf` in Task 5

- [ ] **Step 1: Append the flattening to `locals.tf`**

This is the core transformation described in the spec. The composite key is a
string rather than a list index specifically so that adding a group never
re-creates unrelated assignments.

```hcl
# ===========================================================================
# Access Matrix Flattening
# ===========================================================================
# Turns the group-centric matrix in var.groups:
#
#   groups = {
#     platform-admins = {
#       permission_sets = { AdministratorAccess = ["prod", "staging"] }
#     }
#   }
#
# into one entry per (group, permission set, account) triple, keyed
# "<group>/<permission_set>/<account_alias>".
#
# The key is a stable composite STRING, not a positional index. Reordering
# var.groups, or adding a new group, therefore never re-creates existing
# assignments — which would briefly revoke live access on apply.
# ===========================================================================

locals {
  assignments = {
    for triple in flatten([
      for group_key, group in var.groups : [
        for ps_name, account_aliases in group.permission_sets : [
          for account_alias in account_aliases : {
            key            = "${group_key}/${ps_name}/${account_alias}"
            group_key      = group_key
            permission_set = ps_name
            account_alias  = account_alias
          }
        ]
      ]
    ]) : triple.key => triple
  }
}
```

- [ ] **Step 2: Create `assignments.tf`**

```hcl
# ===========================================================================
# Account Assignments
# ===========================================================================
# An assignment binds (permission set, principal, target account). This is
# the point at which a permission set materializes as a real IAM role in the
# member account.
#
# Only GROUP principals are supported. Assigning permission sets to
# individual users is possible in the AWS API but deliberately unsupported
# here — per-user grants are how access matrices become unauditable.
# ===========================================================================

resource "aws_ssoadmin_account_assignment" "this" {
  for_each = local.assignments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.permission_set].arn

  principal_type = "GROUP"
  principal_id   = aws_identitystore_group.this[each.value.group_key].group_id

  target_type = "AWS_ACCOUNT"
  target_id   = var.accounts[each.value.account_alias]

  lifecycle {
    precondition {
      condition     = contains(keys(var.accounts), each.value.account_alias)
      error_message = "Group '${each.value.group_key}' grants '${each.value.permission_set}' in account alias '${each.value.account_alias}', which is not defined in var.accounts. Add it there, or fix the typo."
    }

    precondition {
      condition     = contains(keys(local.permission_sets), each.value.permission_set)
      error_message = "Group '${each.value.group_key}' references permission set '${each.value.permission_set}', which exists neither in the baseline nor in var.permission_sets."
    }
  }
}
```

- [ ] **Step 3: Plan the full access matrix**

```bash
cd inf/terraform/aws-iam-identity-center
cat > /tmp/matrix.tfvars <<'EOF'
project_name = "dep"
accounts = {
  prod    = "<PROD_ACCOUNT_ID>"
  staging = "<STAGING_ACCOUNT_ID>"
}
users = {
  "huy.nguyen" = {
    display_name = "Huy Nguyen"
    given_name   = "Huy"
    family_name  = "Nguyen"
    email        = "huynguyen260398@gmail.com"
  }
}
groups = {
  "platform-admins" = {
    description     = "Platform engineering administrators"
    members         = ["huy.nguyen"]
    permission_sets = {
      AdministratorAccess = ["staging"]
      ReadOnlyAccess      = ["prod", "staging"]
    }
  }
}
EOF
terraform plan -var-file=/tmp/matrix.tfvars
```

Expected: exactly **3** `aws_ssoadmin_account_assignment.this` resources, with
these keys:
- `platform-admins/AdministratorAccess/staging`
- `platform-admins/ReadOnlyAccess/prod`
- `platform-admins/ReadOnlyAccess/staging`

Read the keys in the plan output and confirm they match exactly. This verifies
the flattening produced the intended cartesian expansion and nothing more.

- [ ] **Step 4: Confirm an unknown account alias fails at plan time**

```bash
cd inf/terraform/aws-iam-identity-center
sed 's/ReadOnlyAccess      = \["prod", "staging"\]/ReadOnlyAccess      = ["prod", "typo-account"]/' /tmp/matrix.tfvars > /tmp/matrix-bad-account.tfvars
terraform plan -var-file=/tmp/matrix-bad-account.tfvars
```

Expected: **FAILS** at plan time. Without this guard the error would be an
opaque map-lookup failure, so confirm it fails rather than silently planning.

- [ ] **Step 5: Confirm an unknown permission set fails at plan time**

```bash
cd inf/terraform/aws-iam-identity-center
sed 's/AdministratorAccess = \["staging"\]/NotARealPermissionSet = ["staging"]/' /tmp/matrix.tfvars > /tmp/matrix-bad-ps.tfvars
terraform plan -var-file=/tmp/matrix-bad-ps.tfvars
rm /tmp/matrix.tfvars /tmp/matrix-bad-account.tfvars /tmp/matrix-bad-ps.tfvars
```

Expected: **FAILS** at plan time.

- [ ] **Step 6: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/assignments.tf \
        inf/terraform/aws-iam-identity-center/locals.tf
git commit -m "feat(identity-center): add account assignments from flattened access matrix"
```

---

### Task 5: Outputs, example, README, and full lint

**Files:**
- Create: `inf/terraform/aws-iam-identity-center/outputs.tf`
- Create: `inf/terraform/aws-iam-identity-center/environments/prod.tfvars.example`
- Create: `inf/terraform/aws-iam-identity-center/README.md`
- Test: `terraform fmt -check`, `terraform validate`, `tflint --recursive`

**Interfaces:**
- Consumes: every resource from Tasks 2–4
- Produces: the module's public output surface

- [ ] **Step 1: Create `outputs.tf`**

```hcl
output "sso_instance_arn" {
  description = "ARN of the IAM Identity Center instance this module manages."
  value       = local.sso_instance_arn
}

output "identity_store_id" {
  description = "ID of the Identity Store backing the Identity Center instance."
  value       = local.identity_store_id
}

output "permission_set_arns" {
  description = "Map of permission set name to ARN, covering both baseline and user-supplied sets."
  value       = { for ps_name, ps in aws_ssoadmin_permission_set.this : ps_name => ps.arn }
}

output "group_ids" {
  description = "Map of group name to Identity Store group ID."
  value       = { for group_key, group in aws_identitystore_group.this : group_key => group.group_id }
}

output "user_ids" {
  description = "Map of username to Identity Store user ID."
  value       = { for user_key, user in aws_identitystore_user.this : user_key => user.user_id }
}

output "assignment_keys" {
  description = "Sorted list of every (group/permission_set/account_alias) assignment. Useful as a reviewable access-matrix summary in plan output and PR diffs."
  value       = sort(keys(local.assignments))
}
```

- [ ] **Step 2: Create `environments/prod.tfvars.example`**

```hcl
# Copy to prod.tfvars and fill in. prod.tfvars is gitignored.
# REPLACE every <PLACEHOLDER> before applying.
#
# This module runs in the AWS Organizations MANAGEMENT account.

aws_region   = "ap-southeast-1"
environment  = "prod"
project_name = "dep"

tags = {
  Owner = "platform-team"
}

# Friendly alias -> 12-digit account ID. The access matrix below references
# these aliases, never raw IDs.
accounts = {
  management = "<MANAGEMENT_ACCOUNT_ID>"
  prod       = "<PROD_ACCOUNT_ID>"
  staging    = "<STAGING_ACCOUNT_ID>"
  sandbox    = "<SANDBOX_ACCOUNT_ID>"
}

# Extra permission sets on top of the baseline (AdministratorAccess,
# PowerUserAccess, ReadOnlyAccess, BillingAccess, SecurityAudit).
permission_sets = {
  DeveloperAccess = {
    description      = "Day-to-day developer access to workload accounts"
    session_duration = "PT8H"
    managed_policy_arns = [
      "arn:aws:iam::aws:policy/PowerUserAccess",
    ]
    # Resolved BY NAME in each target account. Must already exist there —
    # create it with the aws-iam module first. See README "Apply order".
    customer_managed_policy_names = []
  }
}

users = {
  "huy.nguyen" = {
    display_name = "Huy Nguyen"
    given_name   = "Huy"
    family_name  = "Nguyen"
    email        = "huynguyen260398@gmail.com"
  }
}

# The access matrix. Read it as: this group holds this permission set in
# these accounts.
groups = {
  "platform-admins" = {
    description = "Platform engineering administrators"
    members     = ["huy.nguyen"]
    permission_sets = {
      AdministratorAccess = ["staging", "sandbox"]
      PowerUserAccess     = ["prod"]
      ReadOnlyAccess      = ["management"]
    }
  }

  "developers" = {
    description = "Application developers"
    members     = []
    permission_sets = {
      DeveloperAccess = ["staging", "sandbox"]
      ReadOnlyAccess  = ["prod"]
    }
  }

  "finance" = {
    description = "Finance and cost management"
    members     = []
    permission_sets = {
      BillingAccess = ["management"]
    }
  }
}
```

- [ ] **Step 3: Create `README.md`**

````markdown
# aws-iam-identity-center

IAM Identity Center for the AWS Organization: Identity Store users, groups and
memberships; permission sets; and account assignments.

Companion module: `../aws-iam/` manages per-account IAM.

## Prerequisites

1. **An AWS Organization**, with this module's credentials resolving to the
   **management account**. Identity Center resources are unavailable from
   member accounts.
2. **IAM Identity Center enabled** in the console. No Terraform resource can
   enable it. `locals.tf` carries a postcondition that fails with a clear
   message if it is not.
3. **Identity source set to the built-in Identity Center directory** — see the
   SCIM warning below.

## SCIM warning

This module **creates** Identity Store users and groups, which is correct only
for the built-in directory.

If the organization ever switches its identity source to an external IdP
(Entra ID, Okta, Google Workspace) with SCIM provisioning, these resources must
be removed from this module and from state. SCIM would provision the same
principals independently, producing duplicate principals and permanent drift.
In that scenario, replace `aws_identitystore_user` / `aws_identitystore_group`
with `data` sources that look principals up by name, and keep only the
permission sets and assignments here.

## The access matrix

Access is expressed group-centrically, so the file answers "what can this team
do?" directly:

```hcl
accounts = {
  prod    = "111111111111"
  staging = "222222222222"
}

groups = {
  "platform-admins" = {
    members = ["huy.nguyen"]
    permission_sets = {
      AdministratorAccess = ["staging"]
      ReadOnlyAccess      = ["prod", "staging"]
    }
  }
}
```

Accounts are referenced by **alias**, never by raw 12-digit ID — raw IDs
scattered through an access matrix are unreviewable.

`locals.tf` flattens this into one assignment per
(group, permission set, account) triple, keyed
`"<group>/<permission_set>/<account_alias>"`. The key is a stable composite
string rather than a positional index, so adding or reordering groups never
re-creates existing assignments — a re-creation would briefly revoke live
access on apply.

Only **group** principals are supported. Per-user assignment is possible in the
AWS API but deliberately unsupported: per-user grants are how access matrices
become unauditable.

## Permission sets

A curated baseline ships in `locals.tf`: `AdministratorAccess`,
`PowerUserAccess`, `ReadOnlyAccess`, `BillingAccess`, `SecurityAudit`.

`var.permission_sets` is merged **over** the baseline, so a key of the same
name replaces the baseline entry entirely. Nothing is unavoidably imposed.

`session_duration` defaults to `PT1H`, matching the AWS default. Longer
sessions are an explicit per-set opt-in.

Inline policies are supported but discouraged — they are invisible in the
member account's IAM console, which makes them hard to audit during an
incident.

## Apply order

A permission set may reference a customer-managed policy **by name**, resolved
in the **target** account at assignment time. Those policies are created by the
`../aws-iam/` module running in that account.

This is a name-level contract, not a Terraform dependency — the two modules run
in different accounts, and a state dependency would require the
management-account apply to read every member account's state bucket.

Consequences:

1. Apply `../aws-iam/` in a member account **before** any assignment here that
   references one of its policies.
2. A missing policy fails at **apply** time with an AWS error, not at plan time.
   This is the module's main sharp edge.
3. Use the `custom_policy_names` output of `../aws-iam/` for exact names.

## Usage

```bash
cd inf/terraform/aws-iam-identity-center
cp environments/prod.tfvars.example environments/prod.tfvars
# edit environments/prod.tfvars

terraform init
terraform plan -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars
```

Before the first `terraform init`, provision the state bucket and lock table in
the management account — see the setup commands in `backend.tf`, then uncomment
the backend block.

## Verification

```bash
terraform fmt -check
terraform validate
tflint --recursive   # from repo root
terraform plan -var-file=environments/prod.tfvars
```

`terraform apply` is deliberately excluded from CI. Revoking an assignment
removes live human access; a human should read the plan first.

The `assignment_keys` output is a sorted list of every grant, which makes the
effective access matrix reviewable as a diff in plan output.
````

- [ ] **Step 4: Run the full verification suite**

```bash
cd inf/terraform/aws-iam-identity-center
terraform fmt -check
terraform validate
```

Expected: `fmt -check` exits 0 silently; `validate` prints `Success!`.

- [ ] **Step 5: Plan against the real management account**

Fill in real account IDs first — the example file's `<PLACEHOLDER>` values will
fail the 12-digit validation, which is intended.

```bash
cd inf/terraform/aws-iam-identity-center
cp environments/prod.tfvars.example environments/prod.tfvars
# edit environments/prod.tfvars: replace every <PLACEHOLDER>
terraform plan -var-file=environments/prod.tfvars
```

Expected: a plan listing permission sets, users, groups, memberships, and
assignments. **Read the `assignment_keys` output** in the plan and confirm the
grants match intent before anyone applies.

- [ ] **Step 6: Run tflint from the repo root**

```bash
cd "$(git rev-parse --show-toplevel)"
tflint --init
tflint --recursive
```

Expected: no findings for `inf/terraform/aws-iam-identity-center/`.

Likely finding and how to handle it: **missing tags** on
`aws_identitystore_user`, `aws_identitystore_group`,
`aws_identitystore_group_membership`, `aws_ssoadmin_account_assignment`, and the
attachment resources. None of these are taggable. If tflint flags them, add a
targeted exclusion in `.tflint.hcl` with an explanatory comment — do not
attempt to add tags that the provider does not support.

- [ ] **Step 7: Verify tfvars are gitignored**

The gitignore rule was added by the `aws-iam` plan (Task 9 Step 7). If that plan
has not been run yet, add it now:

```bash
cd "$(git rev-parse --show-toplevel)"
grep -q "inf/terraform/\*\*/environments/\*.tfvars$" .gitignore || \
  printf '\n# Terraform variable files (may contain account IDs and external IDs)\ninf/terraform/**/environments/*.tfvars\n!inf/terraform/**/environments/*.tfvars.example\n' >> .gitignore

git check-ignore -v inf/terraform/aws-iam-identity-center/environments/prod.tfvars
```

Expected: prints a matching gitignore rule. **This matters more here than in the
`aws-iam` module** — this tfvars file contains every account ID in the
organization alongside the full access matrix.

- [ ] **Step 8: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/ .gitignore
git commit -m "feat(identity-center): add outputs, tfvars example, and README"
```

---

## Self-Review Notes

**Spec coverage:** Identity Store users/groups/memberships (Task 3), permission
sets with curated baseline merged over overrides (Task 2), group-centric access
matrix with alias indirection and stable composite keys (Task 4), instance
precondition (Task 1), S3 backend in the management account (Task 1),
`session_duration` ISO-8601 validation (Task 2), account-ID 12-digit validation
(Task 1), alias-exists and permission-set-exists preconditions (Task 4),
`PT1H` default (Task 2), inline policies supported but discouraged (Task 2),
tflint conventions (Task 5).

**Deliberately excluded per spec:** OU-driven assignment, external IdP / SCIM
data-source mode, per-user assignments.

**Known weakness:** no true red-green cycle is possible — Terraform has no unit
test framework in this repo, and `apply` is excluded from automated
verification. The deliberate-failure checks (Task 2 Step 6, Task 3 Step 4,
Task 4 Steps 4–5) are the highest-value verification here, because they prove
the guardrails reject bad input rather than merely existing. Do not skip them.

**Unverifiable until first apply:** the customer-managed-policy-by-name contract
with the `aws-iam` module. By design it fails at apply time, not plan time. The
first apply of any permission set using `customer_managed_policy_names` should
target a single non-production account.
