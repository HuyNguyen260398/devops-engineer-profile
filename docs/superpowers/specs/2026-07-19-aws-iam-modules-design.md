# AWS IAM Terraform Modules — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

The repository has no dedicated home for identity management. IAM resources are
scattered across root modules as a side effect of whatever that module needed:
`aws-etl-pipeline/iam.tf` holds Lambda execution roles, `aws-github-oidc/` owns
the GitHub OIDC trust relationships, and the EKS modules delegate IRSA to the
registry `iam-role-for-service-accounts-eks` module.

There is no place to define organization-wide human access, no reusable
definition of the standard role set, and no IAM Identity Center management in
code at all.

## Goals

Provide Terraform coverage for:

- IAM roles, customer-managed policies, groups, and users
- IAM Identity Center: Identity Store users/groups/memberships, permission sets,
  and account assignments
- Baseline account guardrails (permissions boundary, password policy)

## Non-Goals

- **GitHub OIDC roles.** `inf/terraform/aws-github-oidc/` already owns these.
  Duplicating them would create two competing sources of truth for the same
  trust relationships.
- **EKS IRSA roles.** `aws-eks/` and `aws-eks-argocd/` use the registry
  `terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks`
  module. Same reasoning.
- **IAM Access Analyzer.** Belongs in a security/audit stack, not an identity
  module.
- **OU-driven account assignment.** Deferred (YAGNI). Can be added later without
  breaking the `var.groups` interface.

## Architecture

Two independent root modules, each with its own state, matching the repo's flat
root-module convention. Neither has a `modules/` subdirectory; external modules
come from the registry.

| Module | Runs in | Scope |
|---|---|---|
| `inf/terraform/aws-iam/` | Any member account (per-account, per-env state) | Roles, customer-managed policies, groups, users, permissions boundary, password policy |
| `inf/terraform/aws-iam-identity-center/` | **Management account only** | Identity Store users/groups/memberships, permission sets, account assignments |

The modules share no state and no resources.

### The one coupling, and why it is not a Terraform dependency

A permission set may reference a **customer managed policy by name**, resolved at
assignment time in the *target* account. That policy is created by `aws-iam/`
running in that account.

This is a name-level contract, documented in both READMEs, deliberately *not*
expressed as a `terraform_remote_state` data source. The two modules run in
different AWS accounts with different credentials; a state dependency across that
boundary would make the management-account apply require read access to every
member account's state bucket.

The failure mode is understood and accepted: if the named policy does not exist
in the target account, the *assignment* fails at apply time with an AWS error,
not at plan time. The READMEs state the required apply order: `aws-iam/` in a
member account before any Identity Center assignment targeting that account.

## Module 1: `aws-iam/`

```
aws-iam/
├── backend.tf, provider.tf, variables.tf, locals.tf, outputs.tf
├── boundary.tf              # permissions boundary policy (created first)
├── policies.tf              # customer-managed policies, data-driven map
├── roles_service.tf         # data-driven: service principal -> role
├── roles_cross_account.tf   # explicit HCL, ExternalId + MFA conditions
├── role_break_glass.tf      # explicit HCL, root trust + MFA + boundary
├── groups.tf                # groups + policy attachments + memberships
├── users.tf                 # for_each, defaults {}, no access keys
├── account.tf               # password policy, gated
├── environments/{dev,prod}.tfvars.example
└── README.md
```

Files are split by **concern, not by resource type**, so a reviewer reading
`roles_cross_account.tf` sees the entire trust story for that pattern in one
file.

### Hybrid interface

Data-driven maps for repetitive resources (users, groups, memberships,
customer-managed policies, service roles). Explicit HCL for roles whose **trust
policy** carries security weight (cross-account, break-glass).

Rationale: trust policies are where IAM mistakes become incidents. Burying them
inside a generic `map(object)` makes them substantially harder to review in a PR
diff. Bulk identity churn stays in `.tfvars`; trust relationships stay in
reviewed code.

### Role patterns shipped

| Pattern | Form | Trust |
|---|---|---|
| Service roles | Data-driven map | `Service` principal (ec2, lambda, ecs-tasks, …) |
| Cross-account roles | Explicit HCL | `AWS` principal + optional `sts:ExternalId` + MFA condition |
| Break-glass admin | Explicit HCL | Account root + mandatory MFA + permissions boundary |

### IAM users are second-class

`var.users` defaults to `{}`. The module creates **no access keys** — key
material in Terraform state is a credential leak. Console login profiles are
optional and require a `pgp_key`.

The README states plainly: Identity Center for humans, IRSA/instance roles for
workloads, IAM users only for break-glass and legacy service accounts.

### Policy documents

All policy documents use `data "aws_iam_policy_document"` rather than heredoc
JSON — this gives compile-time validation and renders readably in `plan` output.

## Module 2: `aws-iam-identity-center/`

```
aws-iam-identity-center/
├── backend.tf, provider.tf, variables.tf, locals.tf, outputs.tf
├── identity_store.tf        # users, groups, memberships
├── permission_sets.tf       # baseline merged with overrides
├── assignments.tf           # flattened access matrix
├── environments/*.tfvars.example
└── README.md
```

**Identity source is the built-in Identity Center directory**, so this module
owns the full user and group lifecycle. (If the org later migrates to an
external IdP via SCIM, user/group *creation* must be removed from this module —
Terraform-created principals would collide with SCIM-provisioned ones and drift
continuously.)

### Permission sets

`merge(local.baseline_permission_sets, var.permission_sets)` — a user-supplied
key of the same name wins outright, so nothing is unavoidably imposed.

Baseline set: `AdministratorAccess`, `PowerUserAccess`, `ReadOnlyAccess`,
`BillingAccess`, `SecurityAudit`.

`session_duration` defaults to `PT1H`, matching the AWS default. Longer sessions
are an explicit opt-in.

Inline policies are supported but discouraged in documentation — they are
invisible in the IAM console of member accounts.

### Access matrix and flattening

`var.groups` expresses access group-centrically, mirroring how the question
"what can this team do?" is actually answered:

```hcl
groups = {
  platform-admins = {
    permission_sets = {
      AdministratorAccess = ["prod", "staging"]
    }
  }
}
```

`var.accounts` maps friendly alias → 12-digit account ID. The access matrix is
written in aliases and never in raw account IDs, which are unreviewable when
scattered through `.tfvars`.

Transformation in `locals.tf`:

```
var.groups
  └─ flatten() ────────► local.assignments
                           key:   "<group>/<permission_set>/<account_alias>"
                           value: { group_id, permission_set_arn, account_id }
```

The composite `for_each` key is **stable under reordering** — adding a group
never re-creates unrelated assignments. This is the specific reason for a map
keyed by composite string rather than a list with positional indices.

## Guardrails

| Guardrail | Behavior |
|---|---|
| Permissions boundary | Module creates a boundary policy; opt-in per role via `permissions_boundary_arn`; **mandatory** for break-glass |
| Account password policy | `aws_iam_account_password_policy`, gated behind `manage_account_password_policy` (default `false` — it is an account singleton and will fight other stacks) |
| Wildcard rejection | `validation` blocks reject inline policy statements with `Action = ["*"]` **and** `Resource = ["*"]` together |

## Remote state backend

Both modules ship `backend.tf` in the initial file set, following the live
pattern in `aws-github-oidc/backend.tf`: S3 with `encrypt = true` plus a
DynamoDB lock table, region `ap-southeast-1`.

| Module | key | bucket / lock table |
|---|---|---|
| `aws-iam/` | `aws-iam/terraform.tfstate` | `aws-iam-tfstate-<account-id>` / `aws-iam-tfstate-lock` |
| `aws-iam-identity-center/` | `aws-iam-identity-center/terraform.tfstate` | `aws-iam-identity-center-tfstate-<mgmt-account-id>` / `…-lock` |

The Identity Center bucket lives in the **management account**, necessarily a
different bucket from the member-account one.

Both `backend.tf` files ship with **placeholder bucket names in a commented-out
backend block**, following the `aws-eks/backend.tf` pattern, along with the
one-time AWS CLI bootstrap commands. Account IDs were not available at design
time. Buckets and lock tables are bootstrapped via CLI, not Terraform, to avoid
the chicken-and-egg problem.

## Error handling

- `data "aws_ssoadmin_instances"` guarded by a `precondition` asserting exactly
  one instance — fails fast with a clear message if Identity Center is not
  enabled or the credentials point at the wrong account.
- `validation` blocks: account IDs match `^\d{12}$`; `session_duration` matches
  an ISO-8601 duration.
- Every account alias referenced in `var.groups` is asserted to exist in
  `var.accounts` via a `precondition`. Without this the failure surfaces as an
  opaque map-lookup error.
- Break-glass role carries `lifecycle { prevent_destroy = true }`.

## Conventions

Enforced by the existing `.tflint.hcl`:

- `snake_case` for all resources, variables, outputs, modules, data sources
- Required tags on every AWS resource: `Environment`, `Project`, `ManagedBy`
- All variables and outputs carry descriptions and types

## Verification

No unit-test framework applies to this code. Verification is:

1. `terraform fmt -check` and `terraform validate` in both directories
2. `tflint --recursive` from repo root — must pass snake_case and required-tags rules
3. `terraform plan` against the real org for the Identity Center module, and
   against a member account for `aws-iam/`
4. `.github/workflows/terraform-plan.yml` auto-discovers changed directories, so
   both are planned on the PR automatically

`terraform apply` is deliberately **not** part of automated verification. This
module class can lock principals out of accounts; plan output should be read by
a human before the first apply.

## Known limitations

- Placeholder account IDs in `backend.tf` and `.tfvars.example` must be filled in
  before `terraform init` will succeed.
- The Identity Center instance and account layout were not verified at design
  time.
- Cross-account customer-managed-policy references fail at apply time rather than
  plan time (see "The one coupling" above).

## Follow-up, out of scope

`inf/terraform/aws-github-oidc/terraform.tfstate` and `.tfstate.backup` are
committed to git. That module already has a live S3 backend, so these are almost
certainly stale pre-migration leftovers rather than current state — dead weight
leaking old resource metadata, not an actively-written secret. They should be
removed and gitignored. `aws-eks/backend.tf` already documents this exact
deletion step as part of its migration instructions.

## Decisions and rationale

| Decision | Alternative rejected | Why |
|---|---|---|
| Two root modules | One module with `enable_identity_center` flag | Separate blast radius; the two subsystems run in different accounts with different credentials |
| Hybrid interface | Fully data-driven maps | Trust policies must stay reviewable in PR diffs |
| Group-centric access matrix | Flat list of triples; OU-driven | Reads like an access matrix; OU-driven grants access implicitly to new accounts |
| Curated permission set baseline | Pure data-driven | Batteries included, still fully overridable |
| No access keys in Terraform | Full user lifecycle with outputs | Key material in state is a credential leak |
| Account aliases, not raw IDs | Raw 12-digit IDs in tfvars | Raw account IDs in an access matrix are unreviewable |
