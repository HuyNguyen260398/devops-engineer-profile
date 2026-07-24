# aws-iam-identity-center

IAM Identity Center for the AWS Organization: Identity Store users, groups and
memberships; permission sets; and account assignments.

Companion module: `../aws-iam/` manages per-account IAM.

## Prerequisites

1. **An AWS Organization**, with this module's credentials resolving to the
   **management account**. Identity Center resources are unavailable from
   member accounts.
2. **IAM Identity Center enabled** in the console. No Terraform resource can
   enable it. `main.tf` carries a postcondition that fails with a clear
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
`PowerUserAccess`, `ReadOnlyAccess`, `BillingAccess`, `SecurityAudit`,
`DevOpsAccess`.

`var.permission_sets` is merged **over** the baseline, so a key of the same
name replaces the baseline entry entirely. Nothing is unavoidably imposed.

### `DevOpsAccess`

`PT4H`. `PowerUserAccess` plus IAM role management, for engineers who run
Terraform and maintain EKS and CI roles.

`PowerUserAccess` is `NotAction [iam:*, organizations:*, account:*]` on `*` —
it already grants EKS, ECR, SSM, CloudWatch Logs and CloudFormation in full.
IAM is the only capability it withholds, so the inline `Allow` grants role,
policy, instance profile and OIDC provider management, and nothing else.

Three `Deny` statements fence it in: organization and billing control;
long-lived credential creation (IAM users, access keys, login profiles); and
`sso:*`/`identitystore:*`. That last one is load-bearing rather than
decorative — this set is assigned in the **management account**, where a
principal able to call the Identity Center APIs could otherwise assign itself
`AdministratorAccess`.

**Known gap:** `iam:PassRole` on `*` alongside `iam:CreateRole` remains a
privilege-escalation path for a determined holder. Scoping it properly needs a
role-naming convention this estate does not yet have. Tracked in
`docs/superpowers/specs/2026-07-19-identity-center-management-account-users-design.md`.

`AdministratorAccess` uses `session_duration = "PT1H"`, matching the AWS
default. Lower-privilege sets get longer sessions — the cost of a long-lived
read-only session is far lower than a long-lived admin session.

Inline policies are supported but discouraged — they are invisible in the
member account's IAM console, which makes them hard to audit during an
incident. `DevOpsAccess` is the one baseline set that uses one, because its
`Deny` statements must apply to that set alone; a customer-managed policy
would have to exist in every target account before any assignment referencing
it could succeed (see "Apply order" below), which is a heavier dependency than
this single set justifies.

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

The state bucket and lock table are already provisioned in the management
account and the backend block is live — see `backend.tf`. A plain
`terraform init` picks them up; no bootstrap step is needed.

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

## Applied state

Applied to the management account `010382427026` (organization `o-970lqjhbo4`,
Identity Center instance `ssoins-82102956e1ad3c22`, identity store
`d-96675c542b`) on 2026-07-19.

| Group | Member | Permission set | Account |
|---|---|---|---|
| `main-admins` | `main-admin` | `AdministratorAccess` | `main` |
| `main-readonly` | `main-readonly` | `ReadOnlyAccess` | `main` |
| `main-devops` | `main-devops` | `DevOpsAccess` | `main` |

25 resources. All six baseline permission sets exist in the instance — the
module instantiates every entry in `local.permission_sets` whether or not an
assignment references it — but only the three above are bound to a group.

The three addresses are plus-addressed variants of a single inbox — AWS
compares the literal string, Gmail routes them all to one place.

### Activating users — manual, console-only

**Terraform does not send invitation emails, and neither does the API.** A user
created via `aws_identitystore_user` has no password and no way to set one.
Only the console's "Add user" wizard sends an invitation, and Terraform never
uses that path. Neither `aws identitystore` nor `aws sso-admin` exposes any
password or invitation operation, so this cannot be scripted.

For each user, in IAM Identity Center → **Users** → *user* → **Reset password**:

- **"Send an email…"** — mails a reset link to the user's address, or
- **"Generate a one-time password…"** — displays a password on screen, no mail

Until this is done the user exists and holds assignments but cannot sign in.
`terraform plan` stays clean either way; password state is not in Terraform's
model, so doing this creates no drift.

### Known conditions

**State is remote.** Migrated from local state into S3 on 2026-07-20 —
`s3://aws-iam-identity-center-tfstate-010382427026/aws-iam-identity-center/terraform.tfstate`,
versioned and SSE-S3 encrypted, with DynamoDB locking via
`aws-iam-identity-center-tfstate-lock`. A `terraform plan` immediately after
migration reported no changes, confirming all 27 state entries survived.

`backend.tf` still uses the `dynamodb_table` parameter, which Terraform now
reports as deprecated in favour of S3-native locking (`use_lockfile`). It
remains functional, and it matches the sibling `aws-github-oidc` module. The
two modules should move together rather than diverge.

**Remote state alone does not make this module CI-plannable.** Two independent
gaps remain, and neither is caused by the backend:

- `terraform-plan.yml` builds its matrix from `environments/*.tfvars`. The only
  real tfvars here is `prod.tfvars`, which is gitignored — the repo ships only
  `prod.tfvars.example`, which does not match that glob. The setup job logs
  `⚠️ No tfvars files found for aws-iam-identity-center, skipping` and drops the
  directory from the matrix. Supplying the tfvars from a GitHub secret at plan
  time would fix this without committing addresses and account IDs.
- The GitHub OIDC role's access to the new bucket and lock table is **untested**.
  `terraform-validation.yml` runs `terraform init -backend=false`, so no CI job
  has ever authenticated against this backend. Expect to grant
  `s3:GetObject`/`s3:PutObject` on the bucket and
  `dynamodb:GetItem`/`PutItem`/`DeleteItem` on the lock table before the first
  CI plan succeeds.

**Three SCPs exist in the organization and are unattached** —
`AllowOnlyS3_ExceptDeleteBucket`, `RequiredT2Micro`, `DenyModifyIAMRole`. All
three report zero targets, so they do not currently constrain these permission
sets. They are not managed by Terraform. `DenyModifyIAMRole` would negate most
of `DevOpsAccess` if it were ever attached, since an SCP denial overrides any
permission set.

**Group and user names collide by design of the current naming**, e.g. group
`main-readonly` holds user `main-readonly`. Identity Store namespaces the two
separately so this is valid, but membership keys read as
`main-readonly/main-readonly`. Renaming requires destroying and recreating the
affected groups and assignments.

**Deferred: environment separation** into dedicated dev/staging/prod accounts.
Two of the organization's four accounts are SUSPENDED and cannot be reused;
their email addresses are permanently consumed. See
`docs/superpowers/specs/2026-07-19-identity-center-management-account-users-design.md`.
