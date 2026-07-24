# Identity Center Management Account Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three IAM Identity Center principals — `main-admin`, `main-readonly`, `main-devops` — with Administrator, ReadOnly, and a new custom DevOpsAccess permission set respectively, all scoped to the AWS Organizations management account.

**Architecture:** The `aws-iam-identity-center` module already supports users, groups, permission sets with inline policies, and group-based account assignments. This work is therefore one code change (a new baseline permission set in `locals.tf`) plus configuration (`environments/prod.tfvars`). No new Terraform resources, variables, or files are introduced.

**Tech Stack:** Terraform >= 1.3, AWS provider ~> 5.0, tflint 0.30.0 aws ruleset, AWS CLI v2.

**Spec:** `docs/superpowers/specs/2026-07-19-identity-center-management-account-users-design.md`

## Global Constraints

- **Working directory for all terraform/tflint commands:** `inf/terraform/aws-iam-identity-center/`
- **Target account:** `010382427026` (Organizations management account, `o-970lqjhbo4`)
- **Identity Center instance:** `arn:aws:sso:::instance/ssoins-82102956e1ad3c22`
- **Identity Store ID:** `d-96675c542b`
- **Account alias used throughout:** `main` — never a raw 12-digit ID outside `var.accounts`
- **Required tags on every taggable resource:** `Environment`, `Project`, `ManagedBy` (enforced by `.tflint.hcl`)
- **All variables and outputs must carry `description` and `type`** (enforced by `.tflint.hcl`)
- **`environments/*.tfvars` is gitignored** (`.gitignore:113`). Only `*.tfvars.example` is tracked. Never `git add -f` a real tfvars file.
- **Commit after every completed task** — one commit per task, conventional-commit format, scope `identity-center`.
- **Branch:** `feat/identity-center-management-users` (already created; the spec commit `e1a7b4a` is its first commit)

## Verification model

Terraform has no red-green unit test cycle. The equivalent loop, used by every task below:

| Stage | Command | Meaning |
|---|---|---|
| Syntax | `terraform validate` | HCL parses, types unify |
| Lint | `tflint` | Repo conventions hold |
| Contract | `terraform plan` | Exact resource counts match the spec |
| Reality | `aws sso-admin` / `aws identitystore` | AWS agrees with state |

A task is done when its stage passes **and** the commit exists.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `inf/terraform/aws-iam-identity-center/locals.tf` | Modify (~line 100, inside `baseline_permission_sets`) | Add `DevOpsAccess` definition |
| `inf/terraform/aws-iam-identity-center/README.md` | Modify | Document `DevOpsAccess` and record applied state |
| `inf/terraform/aws-iam-identity-center/environments/prod.tfvars.example` | Rewrite | Tracked example matching real single-account shape |
| `inf/terraform/aws-iam-identity-center/environments/prod.tfvars` | Create (gitignored) | Real values: account ID, emails |

No file is created that did not already exist except the gitignored tfvars.

---

### Task 1: Add the DevOpsAccess permission set

**Files:**
- Modify: `inf/terraform/aws-iam-identity-center/locals.tf` — inside the `baseline_permission_sets` map, after the `SecurityAudit` entry
- Modify: `inf/terraform/aws-iam-identity-center/README.md` — permission set baseline documentation

**Interfaces:**
- Consumes: `data.aws_partition.current.partition` (already declared in `main.tf`)
- Produces: baseline permission set name `DevOpsAccess`, referenced by Task 2 and Task 3 in the `groups` access matrix

**Context the implementer needs:** `local.baseline_permission_sets` is a map of objects. Every entry MUST declare all seven keys (`description`, `session_duration`, `relay_state`, `managed_policy_arns`, `customer_managed_policy_names`, `inline_policy`, `permissions_boundary_policy_name`) in that order — Terraform unifies the object type across all map values, and a missing key produces an inconsistent-types error naming a different entry than the one at fault. Existing entries set `inline_policy = null`; this one is the first to set it non-null, which is why type unification matters here.

- [ ] **Step 1: Record the current resource contract**

Run:
```bash
cd inf/terraform/aws-iam-identity-center
grep -c '^    [A-Za-z]* = {' locals.tf
```
Expected: `5` — the five existing baseline sets. After this task it must be `6`.

- [ ] **Step 2: Add the DevOpsAccess entry**

In `locals.tf`, inside the `baseline_permission_sets` block, immediately after the closing `}` of the `SecurityAudit` entry, insert:

```hcl
    # Platform engineering. PowerUserAccess withholds exactly one capability
    # that day-to-day devops work needs — IAM role management — so the inline
    # Allow grants that and nothing else. Re-listing eks/ecr/ssm/logs/
    # cloudformation would be inert: PowerUserAccess is
    # NotAction [iam:*, organizations:*, account:*] on *, which already
    # covers them.
    #
    # The Deny on sso:*/identitystore:* is load-bearing. This permission set
    # is assigned in the MANAGEMENT account, where a principal that can call
    # the Identity Center APIs can assign itself AdministratorAccess. Deny
    # beats Allow unconditionally, so this closes that loop.
    #
    # Known gap: iam:PassRole on "*" combined with iam:CreateRole remains a
    # privilege-escalation path for a determined holder. Scoping it needs a
    # role-naming convention this estate does not yet have. See the spec's
    # "Accepted limitations".
    DevOpsAccess = {
      description                   = "Platform engineering: PowerUser plus IAM role management, minus organization, billing, and identity administration."
      session_duration              = "PT4H"
      relay_state                   = null
      managed_policy_arns           = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/PowerUserAccess"]
      customer_managed_policy_names = []

      inline_policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Sid    = "ManageRolesPoliciesAndProviders"
            Effect = "Allow"
            Action = [
              "iam:CreateRole",
              "iam:DeleteRole",
              "iam:UpdateRole",
              "iam:UpdateRoleDescription",
              "iam:GetRole",
              "iam:ListRoles",
              "iam:TagRole",
              "iam:UntagRole",
              "iam:ListRoleTags",
              "iam:UpdateAssumeRolePolicy",
              "iam:AttachRolePolicy",
              "iam:DetachRolePolicy",
              "iam:PutRolePolicy",
              "iam:DeleteRolePolicy",
              "iam:GetRolePolicy",
              "iam:ListRolePolicies",
              "iam:ListAttachedRolePolicies",
              "iam:CreatePolicy",
              "iam:DeletePolicy",
              "iam:CreatePolicyVersion",
              "iam:DeletePolicyVersion",
              "iam:SetDefaultPolicyVersion",
              "iam:GetPolicy",
              "iam:GetPolicyVersion",
              "iam:ListPolicies",
              "iam:ListPolicyVersions",
              "iam:ListEntitiesForPolicy",
              "iam:TagPolicy",
              "iam:UntagPolicy",
              "iam:CreateInstanceProfile",
              "iam:DeleteInstanceProfile",
              "iam:GetInstanceProfile",
              "iam:ListInstanceProfiles",
              "iam:ListInstanceProfilesForRole",
              "iam:AddRoleToInstanceProfile",
              "iam:RemoveRoleFromInstanceProfile",
              "iam:CreateOpenIDConnectProvider",
              "iam:DeleteOpenIDConnectProvider",
              "iam:GetOpenIDConnectProvider",
              "iam:ListOpenIDConnectProviders",
              "iam:TagOpenIDConnectProvider",
              "iam:UpdateOpenIDConnectProviderThumbprint",
              "iam:PassRole",
            ]
            Resource = "*"
          },
          {
            Sid    = "DenyOrganizationAndBillingControl"
            Effect = "Deny"
            Action = [
              "organizations:*",
              "account:*",
              "aws-portal:*",
              "ce:*",
              "budgets:*",
              "cur:*",
            ]
            Resource = "*"
          },
          {
            Sid    = "DenyLongLivedCredentialCreation"
            Effect = "Deny"
            Action = [
              "iam:CreateUser",
              "iam:DeleteUser",
              "iam:UpdateUser",
              "iam:TagUser",
              "iam:AddUserToGroup",
              "iam:AttachUserPolicy",
              "iam:DetachUserPolicy",
              "iam:PutUserPolicy",
              "iam:DeleteUserPolicy",
              "iam:CreateAccessKey",
              "iam:UpdateAccessKey",
              "iam:DeleteAccessKey",
              "iam:CreateLoginProfile",
              "iam:UpdateLoginProfile",
              "iam:DeleteLoginProfile",
              "iam:CreateSAMLProvider",
              "iam:UpdateSAMLProvider",
              "iam:DeleteSAMLProvider",
              "iam:UpdateAccountPasswordPolicy",
              "iam:DeleteAccountPasswordPolicy",
            ]
            Resource = "*"
          },
          {
            Sid    = "DenyIdentityCenterSelfEscalation"
            Effect = "Deny"
            Action = [
              "sso:*",
              "sso-directory:*",
              "identitystore:*",
            ]
            Resource = "*"
          },
        ]
      })

      permissions_boundary_policy_name = null
    }
```

- [ ] **Step 3: Verify the entry count went 5 → 6**

Run:
```bash
grep -c '^    [A-Za-z]* = {' locals.tf
```
Expected: `6`

- [ ] **Step 4: Validate**

Run:
```bash
terraform init -backend=false
terraform validate
```
Expected: `Success! The configuration is valid.`

If instead you get `Inconsistent conditional result types` or an error naming `baseline_permission_sets`, a key is missing from the new entry — compare it key-by-key against the `SecurityAudit` entry above it.

- [ ] **Step 5: Verify the rendered policy is valid JSON**

Run:
```bash
terraform console <<'EOF'
jsondecode(local.baseline_permission_sets.DevOpsAccess.inline_policy).Statement[*].Sid
EOF
```
Expected:
```
tolist([
  "ManageRolesPoliciesAndProviders",
  "DenyOrganizationAndBillingControl",
  "DenyLongLivedCredentialCreation",
  "DenyIdentityCenterSelfEscalation",
])
```

- [ ] **Step 6: Lint**

Run:
```bash
cd ../../.. && tflint --chdir=inf/terraform/aws-iam-identity-center
```
Expected: no output, exit code 0. `locals` blocks carry no tags and are exempt from `aws_resource_missing_tags`.

If tflint reports a missing plugin, run `tflint --init` from the repo root first — `.tflint.hcl` pins the aws (0.30.0) and terraform (0.5.0) rulesets, which must be downloaded once. Verified working against tflint 0.58.0.

- [ ] **Step 7: Document it in the README**

In `inf/terraform/aws-iam-identity-center/README.md`, find the section listing the baseline permission sets and add a row/entry for `DevOpsAccess`:

```markdown
| `DevOpsAccess` | PT4H | PowerUserAccess + IAM role management. Denies organization, billing, IAM user/credential, and Identity Center administration. Intended for engineers who run Terraform and manage EKS/CI roles. |
```

If the README presents the baseline as a bulleted list rather than a table, match the existing formatting instead of introducing a table.

- [ ] **Step 8: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/locals.tf \
        inf/terraform/aws-iam-identity-center/README.md
git commit -m "feat(identity-center): add DevOpsAccess permission set

PowerUserAccess plus the IAM role management it withholds, with explicit
denies on organization control, billing, long-lived credentials, and
Identity Center itself. The last of these prevents a holder in the
management account from assigning itself AdministratorAccess.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite the tracked tfvars example

**Files:**
- Rewrite: `inf/terraform/aws-iam-identity-center/environments/prod.tfvars.example`

**Interfaces:**
- Consumes: permission set name `DevOpsAccess` from Task 1
- Produces: the exact structure Task 3 copies into a real `prod.tfvars`

**Context the implementer needs:** The current example describes four accounts (`management`, `prod`, `staging`, `sandbox`) that do not exist in this organization, and a `DeveloperAccess` permission set that nothing uses. It is a fictional template. Replace it wholesale — do not merge. Because the real `prod.tfvars` is gitignored, this file is the only tracked record of the access matrix, so it must be complete and accurate rather than illustrative.

- [ ] **Step 1: Replace the file contents entirely**

Write `environments/prod.tfvars.example`:

```hcl
# Copy to prod.tfvars and fill in every <PLACEHOLDER>.
# prod.tfvars is gitignored (.gitignore:113) — never commit it.
#
# This module runs in the AWS Organizations MANAGEMENT account.

aws_region   = "ap-southeast-1"
environment  = "prod"
project_name = "dep"

tags = {
  Owner = "platform-team"
}

# Friendly alias -> 12-digit account ID. The access matrix below references
# aliases only; raw IDs scattered through an access matrix are unreviewable.
#
# Only the management account is managed today. Environment separation into
# dedicated dev/staging/prod accounts is deferred — see
# docs/superpowers/specs/2026-07-19-identity-center-management-account-users-design.md
accounts = {
  main = "<MANAGEMENT_ACCOUNT_ID>"
}

# No extra permission sets. All three used below come from the baseline in
# locals.tf: AdministratorAccess, ReadOnlyAccess, DevOpsAccess.
permission_sets = {}

# Identity Store users. Each address must be unique and deliverable.
# Plus-addressing (user+tag@gmail.com) yields distinct addresses on a single
# inbox: AWS compares the literal string, Gmail routes them all to one place.
#
# NOTE: creating a user through this API does NOT send an invitation email.
# Only the console's "Add user" wizard does. Each user is created with no
# password and no way to set one until an administrator triggers it from
# IAM Identity Center -> Users -> <user> -> Reset password. There is no CLI
# or API equivalent — `aws identitystore` and `aws sso-admin` expose no
# password or invitation operation at all.
users = {
  "main-admin" = {
    display_name = "Main Admin"
    given_name   = "Main"
    family_name  = "Admin"
    email        = "<ADMIN_EMAIL>"
  }

  "main-readonly" = {
    display_name = "Main ReadOnly"
    given_name   = "Main"
    family_name  = "ReadOnly"
    email        = "<READONLY_EMAIL>"
  }

  "main-devops" = {
    display_name = "Main DevOps"
    given_name   = "Main"
    family_name  = "DevOps"
    email        = "<DEVOPS_EMAIL>"
  }
}

# The access matrix. Read each entry as: this group holds this permission set
# in these accounts.
#
# One group per user is not redundancy — assignments.tf accepts only GROUP
# principals and deliberately rejects per-user grants, so a group is the
# only way to grant access. Groups also absorb a second person joining a
# role without a matrix change.
groups = {
  "main-admins" = {
    description = "Full administrative access to the management account"
    members     = ["main-admin"]
    permission_sets = {
      AdministratorAccess = ["main"]
    }
  }

  "main-readonly" = {
    description = "Read-only access to the management account"
    members     = ["main-readonly"]
    permission_sets = {
      ReadOnlyAccess = ["main"]
    }
  }

  "main-devops" = {
    description = "Platform engineering access to the management account"
    members     = ["main-devops"]
    permission_sets = {
      DevOpsAccess = ["main"]
    }
  }
}
```

- [ ] **Step 2: Confirm the example is not accidentally tracked as a real tfvars**

Run:
```bash
cd /Users/huyng/ws/devops-engineer-profile
git check-ignore -v inf/terraform/aws-iam-identity-center/environments/prod.tfvars.example
```
Expected: **no output, exit code 1** — meaning the file is NOT ignored and will be committed. If it prints an ignore rule, the negation on `.gitignore:114` is broken; stop and fix that first.

- [ ] **Step 3: Confirm a real tfvars WOULD be ignored**

Run:
```bash
touch inf/terraform/aws-iam-identity-center/environments/prod.tfvars
git check-ignore -v inf/terraform/aws-iam-identity-center/environments/prod.tfvars
rm inf/terraform/aws-iam-identity-center/environments/prod.tfvars
```
Expected: prints `.gitignore:113:inf/terraform/**/environments/*.tfvars`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/environments/prod.tfvars.example
git commit -m "docs(identity-center): replace tfvars example with real account shape

The previous example described four accounts that do not exist in this
organization. Replaced with the single management-account configuration
and the three main-admin/main-readonly/main-devops principals.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Plan, apply, and verify against AWS

**Files:**
- Create (gitignored): `inf/terraform/aws-iam-identity-center/environments/prod.tfvars`
- Modify: `inf/terraform/aws-iam-identity-center/README.md` — applied-state record

**Interfaces:**
- Consumes: `DevOpsAccess` (Task 1), the example structure (Task 2)
- Produces: 25 live AWS resources. **No invitation emails** — see Step 11.

**Context the implementer needs:** `backend.tf` ships with the S3 backend block **commented out**, so this applies to *local* state. `terraform.tfstate` will be written to the module directory. That file maps every principal to every permission they hold and is gitignored (`.gitignore:2`) — verify that, never force-add it. Migrating to the S3 backend is a separate change and is out of scope here.

**STOP CONDITION:** Step 5 creates real AWS resources and sends real email. Do not run it without explicit confirmation from the user.

- [ ] **Step 1: Create the real tfvars**

Copy the example and substitute the four placeholders:

```bash
cd inf/terraform/aws-iam-identity-center
cp environments/prod.tfvars.example environments/prod.tfvars
```

Then edit `environments/prod.tfvars`, replacing:

| Placeholder | Value |
|---|---|
| `<MANAGEMENT_ACCOUNT_ID>` | `010382427026` |
| `<ADMIN_EMAIL>` | `huynguyen260398+admin@gmail.com` |
| `<READONLY_EMAIL>` | `huynguyen260398+readonly@gmail.com` |
| `<DEVOPS_EMAIL>` | `huynguyen260398+devops@gmail.com` |

- [ ] **Step 2: Confirm no placeholders survive**

Run:
```bash
grep -c '<[A-Z_]*>' environments/prod.tfvars
```
Expected: `0`

- [ ] **Step 3: Confirm the caller is the management account**

Run:
```bash
aws sts get-caller-identity --query Account --output text
```
Expected: `010382427026`

If this returns anything else, the `aws_ssoadmin_instances` postcondition in `main.tf` will fail during plan with a message about member accounts. Fix credentials before continuing.

- [ ] **Step 4: Plan and assert the exact resource contract**

Run:
```bash
terraform init
terraform plan -var-file=environments/prod.tfvars -out=tfplan
```

Expected summary line: `Plan: 25 to add, 0 to change, 0 to destroy.`

Assert the breakdown:
```bash
terraform show -json tfplan \
  | jq -r '.resource_changes[] | select(.change.actions[0]=="create") | .type' \
  | sort | uniq -c
```
Expected exactly:
```
   3 aws_identitystore_group
   3 aws_identitystore_group_membership
   3 aws_identitystore_user
   3 aws_ssoadmin_account_assignment
   6 aws_ssoadmin_managed_policy_attachment
   1 aws_ssoadmin_permission_set_inline_policy
   6 aws_ssoadmin_permission_set
```

Six permission sets — not three — is correct. The module instantiates every entry in `local.permission_sets` whether or not an assignment references it, so all five baseline sets plus `DevOpsAccess` are created. Only three are bound to a group.

If the count is 13 rather than 25, an earlier reader of this plan assumed only assigned sets get created; the 25 figure is authoritative.

- [ ] **Step 5: Apply — REQUIRES USER CONFIRMATION**

Ask the user to confirm before running. This creates real principals in a live account.

Note: this sends **no** email. Users are created without passwords and cannot sign in until manually activated — see Step 11.

Run:
```bash
terraform apply tfplan
```
Expected: `Apply complete! Resources: 25 added, 0 changed, 0 destroyed.`

- [ ] **Step 6: Verify idempotency**

Run:
```bash
terraform plan -var-file=environments/prod.tfvars
```
Expected: `No changes. Your infrastructure matches the configuration.`

A non-empty diff here means something drifted immediately — most likely `session_duration` formatting or inline policy whitespace. Investigate rather than re-applying.

- [ ] **Step 7: Verify against AWS out-of-band**

Run:
```bash
aws identitystore list-users \
  --identity-store-id d-96675c542b \
  --query 'sort_by(Users, &UserName)[].{User:UserName,Email:Emails[0].Value}' \
  --output table
```
Expected: three rows — `main-admin`, `main-devops`, `main-readonly` with the plus-addressed emails.

```bash
aws sso-admin list-permission-sets \
  --instance-arn arn:aws:sso:::instance/ssoins-82102956e1ad3c22 \
  --query 'length(PermissionSets)'
```
Expected: `6`

```bash
aws sso-admin list-account-assignments \
  --instance-arn arn:aws:sso:::instance/ssoins-82102956e1ad3c22 \
  --account-id 010382427026 \
  --permission-set-arn "$(terraform output -json permission_set_arns | jq -r .DevOpsAccess)" \
  --query 'AccountAssignments[].PrincipalType' --output text
```
Expected: `GROUP`

- [ ] **Step 8: Confirm state did not leak into git**

Run:
```bash
cd /Users/huyng/ws/devops-engineer-profile
git status --porcelain inf/terraform/aws-iam-identity-center/
```
Expected: only `README.md` shows as modified. Neither `terraform.tfstate` nor `environments/prod.tfvars` may appear. If either does, stop — the gitignore rules are not working as expected.

- [ ] **Step 9: Record applied state in the README**

Add to `inf/terraform/aws-iam-identity-center/README.md`:

```markdown
## Applied state

Applied to the management account `010382427026` (organization `o-970lqjhbo4`,
Identity Center instance `ssoins-82102956e1ad3c22`) on 2026-07-19.

| Group | Member | Permission set | Account |
|---|---|---|---|
| `main-admins` | `main-admin` | `AdministratorAccess` | `main` |
| `main-readonly` | `main-readonly` | `ReadOnlyAccess` | `main` |
| `main-devops` | `main-devops` | `DevOpsAccess` | `main` |

All six baseline permission sets exist in the instance; the three above are
the only ones bound to a group.

**State is local.** The S3 backend in `backend.tf` is still commented out —
`terraform.tfstate` lives in this directory and is gitignored. Migrate before
this module is applied from CI.

**Deferred:** environment separation into dedicated dev/staging/prod accounts.
Two of the organization's four accounts are SUSPENDED and cannot be reused.
```

- [ ] **Step 10: Commit**

```bash
git add inf/terraform/aws-iam-identity-center/README.md
git commit -m "docs(identity-center): record applied state for management account

Three principals live in 010382427026: main-admin (AdministratorAccess),
main-readonly (ReadOnlyAccess), main-devops (DevOpsAccess). State remains
local pending S3 backend migration.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 11: Activate each user and verify one can actually sign in**

**This step was missing from the plan's first revision.** Steps 1–10 verify
that the users *exist*. Existence is not usability, and reporting success on
existence alone is how a broken deliverable gets signed off.

Terraform sends no invitation email. Users are created without a password and
cannot sign in until an administrator acts. There is no CLI path — confirmed:

```bash
aws identitystore help | grep -iE "password|verif|invit"   # no matches
aws sso-admin help    | grep -iE "password|verif|invit"    # no matches
```

For each of `main-admin`, `main-readonly`, `main-devops`, in the console at
IAM Identity Center → **Users** → *user* → **Reset password**:

- **"Send an email…"** — mails a reset link, or
- **"Generate a one-time password…"** — shows a password immediately

The one-time password option is faster here because all three mailboxes belong
to the same person.

Then verify behaviour, not just existence:

1. Sign in to the access portal as `main-readonly`
2. Confirm `main` appears with the `ReadOnlyAccess` role
3. Open the console and attempt any write — e.g. create an S3 bucket
4. Expected: **AccessDenied**

A permission set that exists but denies nothing is indistinguishable from a
correct one until someone tries to use it. The access portal keeps one session
per browser, so use a private window to test a second user.

This step produces no commit — it changes no tracked file.

---

## Follow-up work (not in this plan)

Recorded so it is not silently lost:

1. ~~**Migrate to the S3 backend.** `backend.tf` is commented out; state is local.~~ — **Done 2026-07-20.** State lives in `s3://aws-iam-identity-center-tfstate-010382427026`, DynamoDB locking via `aws-iam-identity-center-tfstate-lock`. See the module README's "Known conditions".

   **CI is still not unblocked**, contrary to the original wording of this item. Two separate gaps remain: `terraform-plan.yml` skips this directory because it has no committed `*.tfvars` to build a matrix from, and the GitHub OIDC role has never been granted (or tested against) access to the new bucket and lock table. Both are tracked in the module README.
2. **Scope `iam:PassRole`.** Needs a role-naming convention. See spec "Accepted limitations".
3. **Audit the three pre-existing lab SCPs** — `AllowOnlyS3_ExceptDeleteBucket`, `RequiredT2Micro`, `DenyModifyIAMRole`. These are attached somewhere in the org and may restrict what these users can actually do once they log in. Unmanaged by Terraform.
4. **Environment separation.** Requires creating at least one new AWS account; two existing accounts are permanently suspended.
5. **Move assignments off the management account** once workload accounts exist.
