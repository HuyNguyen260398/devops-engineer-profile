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
