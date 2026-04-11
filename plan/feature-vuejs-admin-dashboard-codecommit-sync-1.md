---
goal: "Automate synchronisation of Vue.js Admin Dashboard source changes from GitHub to the AWS CodeCommit repository via a dedicated GitHub Actions workflow triggered on PR merge to main"
version: "1.0"
date_created: "2026-04-11"
last_updated: "2026-04-11"
owner: "DevOps Engineer"
status: "Planned"
tags: ["feature", "ci", "github-actions", "aws", "codecommit", "vuejs", "automation"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan introduces a new GitHub Actions workflow `vuejs-admin-dashboard-codecommit-sync.yml` that automatically mirrors the contents of `src/vuejs-admin-dashboard/` to the AWS CodeCommit repository `vuejs-admin-dashboard` in region `ap-southeast-1` whenever a pull request touching that directory is merged into `main`.

The workflow replaces the manual `git remote add codecommit … && git push codecommit main` procedure currently documented in `inf/terraform/vuejs-admin-dashboard/README.md`. Pushing to CodeCommit is what triggers the existing EventBridge → CodePipeline → CodeBuild → Amplify deployment chain, so this automation closes the loop between GitHub (developer-facing) and CodeCommit (AWS-managed CI/CD source).

Authentication to AWS uses **GitHub OIDC → IAM role assumption** (no long-lived credentials), consistent with the existing `vuejs-admin-dashboard-deploy.yml` workflow.

---

## 1. Requirements & Constraints

- **REQ-001**: A new GitHub Actions workflow file must be created at `.github/workflows/vuejs-admin-dashboard-codecommit-sync.yml`.
- **REQ-002**: The workflow must trigger **only** when a pull request is **merged** (not merely closed) into the `main` branch AND the PR's changed files include at least one path under `src/vuejs-admin-dashboard/**` or the workflow file itself.
- **REQ-003**: The workflow must push the **contents of `src/vuejs-admin-dashboard/`** (subtree) to the `main` branch of the CodeCommit repo `vuejs-admin-dashboard` in region `ap-southeast-1`.
- **REQ-004**: The commit pushed to CodeCommit must preserve traceability to the originating GitHub merge commit (reference SHA, PR number, and author in the commit message).
- **REQ-005**: The workflow must authenticate to AWS CodeCommit using **GitHub OIDC** via `aws-actions/configure-aws-credentials@v4` assuming an IAM role — no static IAM user credentials may be used.
- **REQ-006**: The IAM role assumed must have the minimum CodeCommit permissions required to push to the `vuejs-admin-dashboard` repo: `codecommit:GitPush`, `codecommit:GitPull`, `codecommit:GetRepository`, `codecommit:GetBranch`.
- **REQ-007**: The workflow must use the AWS CLI CodeCommit credential helper (`git config credential.helper '!aws codecommit credential-helper $@'` + `git config credential.UseHttpPath true`) so Git authenticates via the assumed role's temporary credentials.
- **REQ-008**: The workflow must be **idempotent** — if the CodeCommit `main` branch already matches the content being pushed (no diff), the workflow must exit successfully without creating an empty commit.
- **REQ-009**: The workflow must use concurrency control with `group: vuejs-admin-dashboard-codecommit-sync` and `cancel-in-progress: false` to prevent two sync jobs racing on the same remote branch.
- **REQ-010**: The workflow must write a GitHub Step Summary including: PR number, source SHA, CodeCommit commit SHA (if any), push result, and a link to the AWS CodeCommit console URL.
- **SEC-001**: No long-lived AWS access keys may be stored as GitHub secrets. The only AWS-related secret is the IAM role ARN.
- **SEC-002**: The IAM role trust policy must be scoped to `repo:HuyNguyen260398/devops-engineer-profile:ref:refs/heads/main` (or equivalent GitHub OIDC claim) — reuse the existing OIDC provider if one already exists for this repo.
- **SEC-003**: The IAM role must **not** grant `codecommit:*`; it must be limited to the four actions listed in REQ-006 and scoped to the single repo ARN `arn:aws:codecommit:ap-southeast-1:<account-id>:vuejs-admin-dashboard`.
- **CON-001**: The workflow must not require a full monorepo push to CodeCommit — CodeCommit must only ever contain the contents of `src/vuejs-admin-dashboard/`, not the rest of the devops-engineer-profile repo.
- **CON-002**: The CodeCommit `main` branch history is **not** required to be a fast-forward of prior history. The workflow may force-push, rebase, or replace history as long as the resulting tree matches `src/vuejs-admin-dashboard/` on the GitHub merge commit. Force-push is the simplest reliable approach.
- **CON-003**: The workflow must run on `ubuntu-latest` with Git and AWS CLI v2 pre-installed (default runner image satisfies this).
- **CON-004**: The workflow must not run on direct pushes to `main` that were not created via a merged PR — use `pull_request` with `types: [closed]` and an `if: github.event.pull_request.merged == true` guard.
- **GUD-001**: Reuse the existing `.github/workflows/vuejs-admin-dashboard-deploy.yml` as the structural template (checkout → OIDC auth → action → summary).
- **GUD-002**: Follow commit message format `feat|fix|docs|chore: <description>` for the CodeCommit commit body.
- **PAT-001**: Use `dorny/paths-filter@v3` or the PR's changed-files list to detect whether the app was touched, rather than re-running for PRs that only touched unrelated paths.

---

## 2. Implementation Steps

### Implementation Phase 1 — AWS IAM Role Provisioning (Terraform)

- **GOAL-001**: Provision the IAM role that the GitHub Actions workflow will assume via OIDC to push to CodeCommit, scoped to least privilege.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Inspect `inf/terraform/vuejs-admin-dashboard/iam.tf` to locate the existing GitHub OIDC provider data source or resource. If no OIDC provider exists for `token.actions.githubusercontent.com`, create it or reuse the one in a shared IAM module. | | |
| TASK-002 | Add a new IAM role `vuejs-admin-dashboard-codecommit-sync-role` in `inf/terraform/vuejs-admin-dashboard/iam.tf` with an assume-role policy that trusts the GitHub OIDC provider and is conditioned on `token.actions.githubusercontent.com:sub = repo:HuyNguyen260398/devops-engineer-profile:ref:refs/heads/main`. | | |
| TASK-003 | Attach an inline policy `vuejs-admin-dashboard-codecommit-sync-policy` granting `codecommit:GitPush`, `codecommit:GitPull`, `codecommit:GetRepository`, `codecommit:GetBranch`, `codecommit:BatchGet*` scoped to resource ARN `arn:aws:codecommit:ap-southeast-1:${data.aws_caller_identity.current.account_id}:vuejs-admin-dashboard`. | | |
| TASK-004 | Add a Terraform output `codecommit_sync_role_arn` in `inf/terraform/vuejs-admin-dashboard/outputs.tf` exposing the role ARN. | | |
| TASK-005 | Run `terraform fmt`, `tflint --recursive`, `terraform validate`, and `terraform plan -var-file=environments/production/terraform.tfvars` from `inf/terraform/vuejs-admin-dashboard/` to verify the new role planned clean. | | |
| TASK-006 | Apply the Terraform change in the production workspace and capture the output `codecommit_sync_role_arn`. Record the ARN for use in Phase 3. | | |

### Implementation Phase 2 — GitHub Actions Workflow Implementation

- **GOAL-002**: Implement the `vuejs-admin-dashboard-codecommit-sync.yml` workflow end-to-end, including trigger, auth, subtree extraction, push, and summary.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create `.github/workflows/vuejs-admin-dashboard-codecommit-sync.yml` with header comments describing purpose, required secret `VUEJS_ADMIN_DASHBOARD_CODECOMMIT_SYNC_ROLE_ARN`, trigger semantics, and target CodeCommit repo URL `https://git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/vuejs-admin-dashboard`. | | |
| TASK-008 | Define the `on:` trigger as `pull_request: types: [closed]` with `branches: [main]` and `paths: ["src/vuejs-admin-dashboard/**", ".github/workflows/vuejs-admin-dashboard-codecommit-sync.yml"]`. | | |
| TASK-009 | Add top-level guard `if: github.event.pull_request.merged == true` on the `sync` job to ensure closed-without-merge PRs do not trigger a sync. | | |
| TASK-010 | Set `permissions: { contents: read, id-token: write }` and `concurrency: { group: vuejs-admin-dashboard-codecommit-sync, cancel-in-progress: false }` at the workflow level. | | |
| TASK-011 | Define env vars: `AWS_REGION=ap-southeast-1`, `WORKING_DIR=src/vuejs-admin-dashboard`, `CODECOMMIT_REPO_NAME=vuejs-admin-dashboard`, `CODECOMMIT_BRANCH=main`. | | |
| TASK-012 | Step 1 — `actions/checkout@v6` with `fetch-depth: 0` on the monorepo (full history needed to produce a clean subtree snapshot and to reference the merge commit SHA). | | |
| TASK-013 | Step 2 — `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.VUEJS_ADMIN_DASHBOARD_CODECOMMIT_SYNC_ROLE_ARN }}` and `aws-region: ${{ env.AWS_REGION }}`. | | |
| TASK-014 | Step 3 — Configure Git identity: `git config --global user.name "github-actions[bot]"`, `git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"`, and CodeCommit credential helper: `git config --global credential.helper '!aws codecommit credential-helper $@'`, `git config --global credential.UseHttpPath true`. | | |
| TASK-015 | Step 4 — Create an isolated working directory `/tmp/codecommit-sync`. Copy the contents of `src/vuejs-admin-dashboard/` into it using `rsync -a --delete --exclude '.git' --exclude 'node_modules' --exclude 'dist' src/vuejs-admin-dashboard/ /tmp/codecommit-sync/`. | | |
| TASK-016 | Step 5 — In `/tmp/codecommit-sync`, initialise a fresh git repo: `git init -b main`, stage all files, and create a commit with message body `chore: sync from GitHub PR #<PR_NUMBER>\n\nSource-Repo: HuyNguyen260398/devops-engineer-profile\nSource-SHA: <GITHUB_SHA>\nSource-PR: #<PR_NUMBER>\nSource-Author: @<PR_AUTHOR>\nMerged-By: @<MERGED_BY>`. Populate fields from `${{ github.event.pull_request.number }}`, `${{ github.event.pull_request.merge_commit_sha }}`, `${{ github.event.pull_request.user.login }}`, `${{ github.event.pull_request.merged_by.login }}`. | | |
| TASK-017 | Step 6 — Add the CodeCommit remote: `git remote add codecommit https://git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/vuejs-admin-dashboard`. | | |
| TASK-018 | Step 7 — Determine idempotency: fetch the remote `main` tip into a temp ref, then compare the local tree hash (`git write-tree` on the local commit) against the remote tree hash (`git ls-tree <remote-ref>^{tree}`). If they match, set `SKIP_PUSH=true` in `$GITHUB_ENV` and exit the step with a message. Handle the "remote branch does not yet exist" case (first-ever sync) by proceeding with the push. | | |
| TASK-019 | Step 8 — Push to CodeCommit with `git push --force codecommit main` (force is required because each run starts from a fresh orphan history). Gate this step on `if: env.SKIP_PUSH != 'true'`. Capture the remote commit SHA from `git rev-parse HEAD` into output `codecommit_sha`. | | |
| TASK-020 | Step 9 — Emit a GitHub Step Summary using `>> $GITHUB_STEP_SUMMARY` containing: PR number (linked), GitHub merge SHA, CodeCommit commit SHA (if pushed) or "No changes — already in sync", workflow run link, and CodeCommit console URL `https://ap-southeast-1.console.aws.amazon.com/codesuite/codecommit/repositories/vuejs-admin-dashboard/browse?region=ap-southeast-1`. Run with `if: always()`. | | |
| TASK-021 | Step 10 — On failure, add a final diagnostic step that prints `aws sts get-caller-identity` and `aws codecommit get-repository --repository-name vuejs-admin-dashboard` to help distinguish between auth failures and repo-access failures. Gate with `if: failure()`. | | |

### Implementation Phase 3 — Secret Registration and Validation

- **GOAL-003**: Register the role ARN as a GitHub repository secret and validate the workflow end-to-end with a controlled test merge.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | In GitHub repo settings → Secrets and variables → Actions, add a new repository secret `VUEJS_ADMIN_DASHBOARD_CODECOMMIT_SYNC_ROLE_ARN` with the value captured in TASK-006. | | |
| TASK-023 | Create a throwaway feature branch `test/codecommit-sync-smoke` with a trivial no-op change inside `src/vuejs-admin-dashboard/` (e.g., whitespace in a comment) and open a PR against `main`. | | |
| TASK-024 | Merge the test PR and observe that the `vuejs-admin-dashboard-codecommit-sync` workflow triggers, authenticates, and force-pushes to CodeCommit. Verify via the AWS Console that the commit message contains the PR number and source SHA. | | |
| TASK-025 | Verify that the push into CodeCommit triggers the existing EventBridge → CodePipeline pipeline (`vuejs-admin-dashboard-production-pipeline`) via `aws codepipeline list-pipeline-executions --pipeline-name vuejs-admin-dashboard-production-pipeline --max-items 1`. Confirm pipeline reached the Deploy stage. | | |
| TASK-026 | Merge a second, no-op PR (revert the whitespace change) and verify the idempotency branch of the workflow: it should exit with "No changes — already in sync" and skip the push. | | |
| TASK-027 | Update `inf/terraform/vuejs-admin-dashboard/README.md` to document that CodeCommit mirroring is now automated, and that manual `git push codecommit main` is only needed in break-glass scenarios. | | |

---

## 3. Alternatives

- **ALT-001**: **AWS CodeStar Connections (GitHub App) as CodePipeline source.** Rejected because the user's stated goal is to keep CodeCommit as the canonical source-of-truth for the existing pipeline, not to replace it. A CodeStar connection would require rewriting `pipeline.tf` and the EventBridge rule.
- **ALT-002**: **Use a third-party "GitHub → CodeCommit mirror" action (e.g., `pixta-dev/repository-mirroring-action`).** Rejected because it typically requires SSH keys stored as long-lived secrets, violating SEC-001. Rolling the push inline with OIDC is more secure and only ~40 lines of YAML.
- **ALT-003**: **Preserve full commit history via `git subtree split`.** Rejected: subtree split is slow on large monorepos and produces non-deterministic SHAs that complicate idempotency. A fresh orphan snapshot per run is simpler, reliable, and sufficient — CodePipeline only cares about the current tree, not commit lineage.
- **ALT-004**: **Trigger on `push` to `main` instead of `pull_request: closed`.** Rejected because the user explicitly requires the trigger to be "when a PR is merged to main". The `pull_request: closed` + `merged == true` pattern gives access to richer PR metadata (PR number, author, merger) for the commit message.
- **ALT-005**: **Run the sync inside the existing `vuejs-admin-dashboard-deploy.yml` workflow.** Rejected: mixing concerns (Amplify deploy + CodeCommit mirror) couples two independent failure domains. Keeping them in separate workflows allows each to be retried independently.

---

## 4. Dependencies

- **DEP-001**: AWS CodeCommit repository `vuejs-admin-dashboard` must already exist in `ap-southeast-1`. Provisioned by `inf/terraform/vuejs-admin-dashboard/main.tf` via the production workspace.
- **DEP-002**: GitHub OIDC provider for `token.actions.githubusercontent.com` must exist in the target AWS account. Likely already provisioned for the existing `vuejs-admin-dashboard-deploy.yml` role; if not, must be created in Phase 1.
- **DEP-003**: `aws-actions/configure-aws-credentials@v4` action (GitHub Marketplace).
- **DEP-004**: `actions/checkout@v6` action (GitHub Marketplace).
- **DEP-005**: AWS CLI v2 on the GitHub-hosted Ubuntu runner (pre-installed on `ubuntu-latest`).
- **DEP-006**: `rsync` binary on the runner (pre-installed on `ubuntu-latest`).
- **DEP-007**: IAM permissions for the Terraform-executing principal to create IAM roles and policies.

---

## 5. Files

- **FILE-001**: `.github/workflows/vuejs-admin-dashboard-codecommit-sync.yml` — **new** — the workflow defined in Phase 2.
- **FILE-002**: `inf/terraform/vuejs-admin-dashboard/iam.tf` — **modified** — new IAM role, inline policy, and assume-role trust per TASK-002 / TASK-003.
- **FILE-003**: `inf/terraform/vuejs-admin-dashboard/outputs.tf` — **modified** — new output `codecommit_sync_role_arn`.
- **FILE-004**: `inf/terraform/vuejs-admin-dashboard/README.md` — **modified** — document the automated sync in the "CodeCommit Setup and Authentication" section and mark manual push as break-glass only.
- **FILE-005**: `plan/feature-vuejs-admin-dashboard-codecommit-sync-1.md` — **new** — this plan document.

---

## 6. Testing

- **TEST-001**: **Trigger isolation test.** Open a PR that modifies only files outside `src/vuejs-admin-dashboard/` (e.g., `README.md` at repo root). Merge. Verify the sync workflow does NOT trigger (paths filter working).
- **TEST-002**: **Happy-path sync test.** Open a PR that modifies a file inside `src/vuejs-admin-dashboard/` (e.g., a comment in `vite.config.js`). Merge. Verify: (a) workflow triggers, (b) OIDC auth succeeds, (c) force-push lands on CodeCommit `main`, (d) commit message contains correct PR number and source SHA.
- **TEST-003**: **Idempotency test.** Immediately re-run the sync workflow manually (via `workflow_dispatch` if added, or by merging a no-op PR). Verify that the tree-hash comparison detects "no changes" and skips the push step. Step summary reads "No changes — already in sync".
- **TEST-004**: **Closed-without-merge test.** Open a PR touching `src/vuejs-admin-dashboard/`, then close it **without merging**. Verify the workflow is triggered by the `closed` event but the `if: github.event.pull_request.merged == true` guard short-circuits the `sync` job to skipped.
- **TEST-005**: **Pipeline chain test.** After TEST-002 passes, run `aws codepipeline list-pipeline-executions --pipeline-name vuejs-admin-dashboard-production-pipeline --max-items 1 --region ap-southeast-1` and confirm a new execution started within 2 minutes of the CodeCommit push. Watch the pipeline through the Deploy stage until Amplify reports the new commit live.
- **TEST-006**: **IAM least-privilege test.** Temporarily modify the workflow to call `aws s3 ls` (an action NOT granted by the role). Run. Verify the workflow fails with AccessDenied, confirming the role is scoped correctly. Revert.
- **TEST-007**: **Concurrency test.** Merge two PRs touching `src/vuejs-admin-dashboard/` within ~30 seconds. Verify the second run queues behind the first (concurrency group prevents parallel push races) and both eventually complete.

---

## 7. Risks & Assumptions

- **RISK-001**: **Force-push overwrites unrelated commits on CodeCommit `main`.** If anyone pushes directly to the CodeCommit `main` branch out-of-band, that work will be silently destroyed on the next GitHub merge. **Mitigation:** document that CodeCommit is a read-only mirror; all changes must flow through GitHub. Optionally add a CodeCommit branch protection or deny policy blocking `GitPush` from any principal other than the sync role.
- **RISK-002**: **CodeCommit repo history loss.** Because each run is an orphan commit, CodeCommit will not retain historical commits across runs. **Mitigation:** documented trade-off. Full history lives on GitHub, which is the source of truth. CodeBuild/CodePipeline only need the latest tree.
- **RISK-003**: **Credential helper misconfigured on ephemeral runner.** If `git config --global credential.UseHttpPath true` is forgotten, the AWS CLI credential helper returns credentials scoped to the host without the repo path, and push fails with 403. **Mitigation:** TASK-014 explicitly sets both flags; TEST-002 verifies.
- **RISK-004**: **Merge commit SHA mismatch.** `github.sha` on a `pull_request: closed` event refers to the PR head, not the merge commit. **Mitigation:** use `github.event.pull_request.merge_commit_sha` for traceability and checkout `${{ github.event.pull_request.merge_commit_sha }}` explicitly in the checkout step to ensure the sync reflects the merged state.
- **RISK-005**: **AWS CodeCommit regional deprecation.** AWS announced in 2024 that CodeCommit is not being expanded to new customers, and long-term support is uncertain. **Mitigation:** out of scope; this plan targets the existing approved architecture. A future plan may migrate to CodeStar + direct GitHub source.
- **ASSUMPTION-001**: The GitHub OIDC provider `token.actions.githubusercontent.com` already exists in the target AWS account (provisioned for the existing deploy role). If not, Phase 1 must also create it.
- **ASSUMPTION-002**: The repository owner is `HuyNguyen260398` and the repo name is `devops-engineer-profile` — matches the git remote observed in the working tree. The IAM trust condition is pinned to this exact repo.
- **ASSUMPTION-003**: The CodeCommit repo `vuejs-admin-dashboard` currently uses `main` as its primary branch (matches production pipeline branch per `pipeline_branch = main` in the production tfvars).
- **ASSUMPTION-004**: `rsync` is acceptable for the subtree copy. If the team prefers a pure-Git approach (e.g., `git archive`), TASK-015 can be swapped for `git archive HEAD src/vuejs-admin-dashboard | tar -x --strip-components=2 -C /tmp/codecommit-sync` without altering the rest of the plan.
- **ASSUMPTION-005**: Build artefacts (`dist/`) and `node_modules/` must not be synced to CodeCommit — `rsync --exclude` covers this, matching the existing `.gitignore` conventions.

---

## 8. Related Specifications / Further Reading

- `inf/terraform/vuejs-admin-dashboard/README.md` — existing CodeCommit manual-push documentation and AWS CI/CD architecture diagram.
- `.github/workflows/vuejs-admin-dashboard-deploy.yml` — structural template and OIDC pattern reused by this workflow.
- `plan/feature-vuejs-admin-dashboard-infrastructure-1.md` — infrastructure plan that provisioned the CodeCommit repo and production pipeline.
- AWS CodeCommit credential helper: https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-https-unixes.html
- GitHub OIDC federation with AWS: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- `aws-actions/configure-aws-credentials` action: https://github.com/aws-actions/configure-aws-credentials
- GitHub Actions `pull_request.closed` event semantics: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#pull_request
