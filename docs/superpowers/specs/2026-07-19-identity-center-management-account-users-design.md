# Identity Center — Management Account Users

**Date:** 2026-07-19
**Module:** `inf/terraform/aws-iam-identity-center/`
**Status:** Approved

## Goal

Create three Identity Center principals with distinct privilege levels in the
AWS Organizations management account (`010382427026`): an administrator, a
read-only user, and a devops user.

## Background: discovered account state

The original request asked to "manage 3 AWS organizations representing 3
environments". This is not expressible in AWS — a management account has
exactly one organization. Three environments are modeled as three member
accounts, normally grouped into OUs.

A live inspection of the account established:

| Fact | Value |
|---|---|
| Organization | `o-970lqjhbo4`, FeatureSet `ALL` |
| Management account | `010382427026` (huynguyen260398@gmail.com) |
| Root | `r-qfcf`, SCP + RCP enabled |
| OUs | none — all accounts flat under root |
| Identity Center | `ssoins-82102956e1ad3c22`, store `d-96675c542b`, **empty** |

Accounts:

| Account | ID | Status |
|---|---|---|
| Huy Nguyen (management) | 010382427026 | ACTIVE |
| Huy Nguyen | 697767917392 | ACTIVE |
| SAA_C03_Lab | 381492071715 | SUSPENDED |
| Dev | 347936089612 | SUSPENDED |

Two accounts are suspended and cannot be revived; their emails are
permanently consumed. Building three environment accounts would therefore
require creating at least one new account.

**Scope decision:** environment separation is deferred. This spec covers only
the management account. No `aws_organizations_*` resources are introduced.

Because Identity Center is empty, this applies cleanly with no import step.

## Design

### 1. `DevOpsAccess` permission set — `locals.tf`

Added to `local.baseline_permission_sets` alongside the existing five, **not**
to a tfvars file. `.gitignore:113` excludes `environments/*.tfvars`, so a
policy document defined there would be absent from version control. A
security-relevant policy belongs in git.

```
DevOpsAccess
  session_duration:    PT4H
  managed_policy_arns: [PowerUserAccess]
  inline_policy:
    Allow  iam:  role management (Create/Delete/Update/Get/List/Tag)
                 role policy management (Attach/Detach/Put/Delete/Get/List)
                 UpdateAssumeRolePolicy
                 customer-managed policy CRUD
                 instance profile management
                 OIDC provider management
                 PassRole
    Deny         organizations:*, account:*
                 aws-portal:*, ce:*, budgets:*, cur:*
                 iam:*User*, iam:*AccessKey*, iam:*LoginProfile*
                 iam:*SAMLProvider*
                 sso:*, sso-directory:*, identitystore:*
```

**Why the Allow covers only IAM.** `PowerUserAccess` is
`NotAction: [iam:*, organizations:*, account:*]` on `*` — it already grants
EKS, ECR, SSM, CloudWatch Logs, and CloudFormation in full. Re-listing those
services would be inert and would falsely imply the set is service-scoped.
IAM is the only capability PowerUser actually withholds.

**Why `sso:*` is denied.** In the management account, a principal able to call
the Identity Center APIs can assign itself `AdministratorAccess`. Denying
`sso:*`, `sso-directory:*`, and `identitystore:*` closes that loop.

### 2. `environments/prod.tfvars.example` — rewrite

The current example describes four fictional accounts
(`management`/`prod`/`staging`/`sandbox`) that do not exist. Replaced with the
real single-account configuration.

### 3. `environments/prod.tfvars` — create locally (gitignored)

```hcl
accounts = { main = "010382427026" }

users:   main-admin      huynguyen260398+admin@gmail.com
         main-readonly   huynguyen260398+readonly@gmail.com
         main-devops     huynguyen260398+devops@gmail.com

groups:  main-admins    [main-admin]     -> AdministratorAccess @ main
         main-readonly  [main-readonly]  -> ReadOnlyAccess      @ main
         main-devops    [main-devops]    -> DevOpsAccess        @ main
```

Plus-addressing gives three unique, deliverable addresses on one inbox.

**Correction (2026-07-19, post-apply):** an earlier revision of this spec
claimed each user receives an AWS invitation email. That is false. Creating a
user through the Identity Store API sends nothing — only the console's
"Add user" wizard sends an invitation, and Terraform does not use that path.
Activating each user is a manual, console-only step
(Users → *user* → Reset password); no CLI or API equivalent exists.
The users are therefore created but unusable until an administrator acts.

One group per user: `assignments.tf` accepts only `GROUP` principals and
deliberately rejects per-user grants, so groups are structural, not optional.

## Accepted limitations

**`iam:PassRole` on `*`.** Combined with `iam:CreateRole` and PowerUser-level
compute access, this is a viable privilege-escalation path for a determined
holder of `DevOpsAccess`. The Deny statements stop casual escalation, not
deliberate escalation. Correctly scoping `PassRole` requires a role-naming
convention that does not yet exist in this estate. Deferred until workload
accounts are split out, at which point it matters materially more.

**Assignments target the management account.** AWS guidance is to keep the
management account thin and free of standing workload access. This is
accepted here because it is currently the only usable account. When real
environment accounts exist, these assignments should move off the management
account.

## Out of scope

- Creating AWS accounts or OUs
- Managing the three pre-existing lab SCPs
  (`AllowOnlyS3_ExceptDeleteBucket`, `RequiredT2Micro`, `DenyModifyIAMRole`)
- Changes to the `aws-iam` module — no customer-managed policy or permissions
  boundary is referenced by this design
- External IdP / SCIM provisioning

## Verification

1. `terraform validate` and `tflint` pass
2. `terraform plan` shows **25 resources to add**:

   | Resource | Count | Note |
   |---|---|---|
   | `aws_ssoadmin_permission_set` | 6 | 5 baseline + DevOpsAccess |
   | `aws_ssoadmin_managed_policy_attachment` | 6 | one per set |
   | `aws_ssoadmin_permission_set_inline_policy` | 1 | DevOpsAccess only |
   | `aws_identitystore_user` | 3 | |
   | `aws_identitystore_group` | 3 | |
   | `aws_identitystore_group_membership` | 3 | |
   | `aws_ssoadmin_account_assignment` | 3 | |

   The module instantiates every entry in `local.permission_sets`, whether or
   not it is assigned. All five baseline sets are therefore created even
   though only three are used by an assignment — expected, not drift.

3. After apply, `aws sso-admin list-permission-sets` returns 6 ARNs, and
   `aws identitystore list-users --identity-store-id d-96675c542b` returns the
   three users
4. `terraform plan` a second time reports no changes
5. Each user is activated manually (console → Users → *user* → Reset password)
   and can then sign in to the access portal. **Terraform sends no invitation
   email; this step is not automatable.**
6. Signing in as `main-readonly` confirms read-only behaviour in practice —
   existence of a permission set is not evidence that it works
