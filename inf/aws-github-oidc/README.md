# Terraform Configuration for GitHub Actions Secrets and AWS IAM

This Terraform configuration manages secrets and credentials for the GitHub Actions CI/CD workflow (`sync-to-s3.yml`) used to sync the `dep-web-src` directory to an AWS S3 bucket.

## Overview

The configuration provides:

1. **GitHub Actions Secrets Management**: Securely stores AWS credentials and configuration in GitHub
2. **GitHub Actions Variables**: Manages non-sensitive configuration values
3. **AWS IAM OIDC Configuration**: Sets up GitHub Actions to authenticate with AWS using OpenID Connect (OIDC)
4. **AWS IAM Policies**: Defines least-privilege permissions for S3 operations

## Architecture

### Authentication Methods

This configuration supports two authentication methods:

#### 1. **OIDC (Recommended)** - Default
- Uses OpenID Connect for credential-less authentication
- GitHub Actions obtains temporary AWS credentials at runtime
- No long-lived secrets stored in GitHub or AWS
- More secure and auditable

#### 2. **Access Keys (Legacy Fallback)**
- Uses static AWS access keys for authentication
- Provides fallback if OIDC is unavailable
- Less secure due to static credentials
- Only configure if OIDC cannot be used

## Secrets and Variables Created

### GitHub Secrets
- `AWS_REGION`: AWS region for operations
- `AWS_ROLE_TO_ASSUME`: ARN of the IAM role (OIDC method)
- `AWS_ACCESS_KEY_ID`: AWS access key (fallback method)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (fallback method)

### GitHub Variables
- `S3_BUCKET_NAME`: Name of the S3 bucket for syncing

## AWS Resources Created

### OIDC Provider
- Registers GitHub as a trusted OIDC provider in AWS
- Allows GitHub Actions to assume an IAM role without storing credentials

### IAM Role
- `github-actions-s3-sync-role`: Role that GitHub Actions assumes
- Trust policy restricts assumption to GitHub repository and main branch
- Can be scoped further by:
  - Specific branch patterns
  - GitHub Actions environments
  - Repository permissions

### IAM Policy
- `github-actions-s3-sync-role-s3-sync-policy`: Policy for S3 operations
- Permissions: `PutObject`, `GetObject`, `ListBucket`, `DeleteObject`
- Scoped to specific S3 bucket (least privilege)

## Prerequisites

1. **GitHub Access Token**
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```
   - Requires `repo` and `admin:org_hook` permissions
   - Or use GitHub App authentication (see `provider.tf`)

2. **AWS Credentials**
   ```bash
   export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
   export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
   export AWS_DEFAULT_REGION="ap-southeast-1"
   ```

3. **Required Variables**
   - `github_owner`: GitHub organization or username
   - `github_repository`: Repository name
   - `aws_region`: AWS region
   - `s3_bucket_name`: S3 bucket name

## Usage

### 1. Initialize Terraform
```bash
cd dep-web-inf
terraform init
```

### 2. Create Variables File
Copy and customize the example:
```bash
cp environments/prod.tfvars.example environments/prod.tfvars
# Edit environments/prod.tfvars with your values
```

### 3. Plan the Configuration
```bash
terraform plan -var-file="environments/prod.tfvars"
```

### 4. Apply the Configuration
```bash
terraform apply -var-file="environments/prod.tfvars"
```

### 5. Verify the Output
```bash
terraform output configuration_summary
```

## Variable Configuration

### Minimal Configuration (OIDC Only)
```hcl
github_owner       = "my-org"
github_repository  = "devops-engineer-profile"
github_token       = var.github_token  # Set via environment variable
aws_region         = "ap-southeast-1"
s3_bucket_name     = "my-bucket-name"
enable_oidc_authentication = true
```

### With Fallback Access Keys
```hcl
github_owner       = "my-org"
github_repository  = "devops-engineer-profile"
github_token       = var.github_token
aws_region         = "ap-southeast-1"
s3_bucket_name     = "my-bucket-name"
enable_oidc_authentication = true
aws_access_key_id     = var.aws_access_key_id
aws_secret_access_key = var.aws_secret_access_key
```

### Using Environment Variables
```bash
# Set secrets via environment variables
export TF_VAR_github_token="ghp_xxxx"
export TF_VAR_aws_access_key_id="AKIA..."  # Optional
export TF_VAR_aws_secret_access_key="wJalr..."  # Optional

# Apply with variables file for non-secret values
terraform apply -var-file="environments/prod.tfvars"
```

## Security Best Practices

### For GitHub Token
1. **Create a dedicated Personal Access Token (PAT)**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Scope to `repo` and `admin:org_hook` (if managing organization secrets)
   - Set expiration date (e.g., 90 days)
   - Rotate regularly

2. **Never commit the token**
   - Use environment variables or secrets manager
   - Use `-var` flag or `TF_VAR_*` environment variables
   - Consider GitHub Encrypted Secrets in CI/CD

### For AWS Credentials
1. **Prefer OIDC over access keys**
   - Set `enable_oidc_authentication = true` (default)
   - Only provide access keys if OIDC is unavailable
   - Never commit credentials to version control

2. **Rotate credentials regularly**
   - Access keys should be rotated every 90 days
   - Monitor access key usage in CloudTrail

3. **Use least-privilege policies**
   - The included policy is scoped to specific S3 bucket actions
   - No wildcard permissions
   - Review and restrict further if needed

## Workflow Integration

The GitHub workflow `sync-to-s3.yml` will:

1. **Check for OIDC configuration**
   ```yaml
   if: ${{ secrets.AWS_ROLE_TO_ASSUME != '' }}
   ```

2. **Assume the IAM role via OIDC**
   ```yaml
   uses: aws-actions/configure-aws-credentials@v4
   with:
     role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
     aws-region: ${{ secrets.AWS_REGION }}
   ```

3. **Fallback to access keys if OIDC unavailable**
   ```yaml
   if: ${{ secrets.AWS_ROLE_TO_ASSUME == '' }}
   ```

## Troubleshooting

### "Error: Unauthorized"
- Check GitHub token has correct permissions
- Verify token hasn't expired
- Regenerate token if necessary

### "AssumeRoleUnauthorized"
- Verify GitHub repository URL matches the trust policy
- Check branch is `main` (or update trust policy)
- Ensure IAM role exists and policy is attached

### "Access Denied" on S3 operations
- Verify S3 bucket name matches configuration
- Check IAM policy allows required actions on bucket
- Ensure bucket exists in specified AWS region

### Secrets not appearing in GitHub
- Verify `github_token` has `repo` and `admin:org_hook` scope
- Check `github_repository` matches exact name (case-sensitive)
- Review Terraform logs: `terraform apply -var-file=... -lock=false 2>&1 | grep -i secret`

## Cleanup

To remove all resources:
```bash
terraform destroy -var-file="environments/prod.tfvars"
```

**Note**: This will:
- Remove GitHub Actions secrets and variables
- Delete AWS IAM role, policy, and OIDC provider
- NOT delete the S3 bucket (to prevent data loss)

## References

- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [AWS IAM OIDC Provider](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## Files

- `provider.tf`: Provider configurations for GitHub and AWS
- `variables.tf`: Input variable definitions
- `locals.tf`: Local values and data sources
- `main.tf`: Core resource definitions
- `outputs.tf`: Output value definitions
- `environments/prod.tfvars.example`: Example variables file
- `README.md`: This documentation
