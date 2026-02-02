# AWS S3 Static Website Hosting - Terraform Configuration

This Terraform configuration manages AWS S3 buckets for static website hosting across multiple environments (staging and production).

## 📋 Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- AWS account with permissions to create S3 buckets and related resources

## 🏗️ Architecture

This configuration creates:

- **S3 Bucket**: Static website hosting bucket
- **Bucket Versioning**: Version control for website files
- **Website Configuration**: Index and error document settings
- **Public Access Policy**: Read-only public access for website content
- **Encryption**: Server-side encryption (AES256)
- **Lifecycle Rules**: Automated cleanup of old versions
- **CORS Configuration**: Cross-origin resource sharing rules (optional)
- **Logging**: Access logging (optional, production only)

## 📁 Project Structure

```
inf/aws-s3-web/
├── main.tf                    # Main resource definitions
├── variables.tf               # Variable declarations
├── provider.tf                # AWS provider configuration
├── locals.tf                  # Local values
├── outputs.tf                 # Output values
├── README.md                  # This file
└── environments/
    ├── staging.tfvars         # Staging environment variables
    └── production.tfvars      # Production environment variables
```

## 🚀 Usage

### Initialize Terraform

```bash
terraform init
```

### Plan Changes

**Staging Environment:**
```bash
terraform plan -var-file="environments/staging.tfvars"
```

**Production Environment:**
```bash
terraform plan -var-file="environments/production.tfvars"
```

### Apply Configuration

**Staging Environment:**
```bash
terraform apply -var-file="environments/staging.tfvars"
```

**Production Environment:**
```bash
terraform apply -var-file="environments/production.tfvars"
```

### Destroy Resources

```bash
terraform destroy -var-file="environments/staging.tfvars"
# or
terraform destroy -var-file="environments/production.tfvars"
```

## 🔧 Configuration

### Environment-Specific Variables

Each environment has its own `.tfvars` file in the `environments/` directory:

- `staging.tfvars`: Staging environment configuration
- `production.tfvars`: Production environment configuration

### Key Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region for resources | `ap-southeast-1` |
| `environment` | Environment name | - |
| `bucket_name` | S3 bucket name | - |
| `index_document` | Index document | `index.html` |
| `error_document` | Error document | `error.html` |
| `enable_versioning` | Enable bucket versioning | `true` |
| `enable_logging` | Enable access logging | `false` |
| `enable_lifecycle_rules` | Enable lifecycle rules | `true` |

## 📤 Outputs

After applying the configuration, the following outputs are available:

- `bucket_id`: S3 bucket name
- `bucket_arn`: S3 bucket ARN
- `website_endpoint`: Website endpoint URL
- `website_url`: Full HTTP URL of the website

View outputs:
```bash
terraform output
```

## 🔐 Security Considerations

- The S3 bucket is configured for **public read access** (required for static websites)
- Server-side encryption is **enabled by default** (AES256)
- Versioning is **enabled** to protect against accidental deletions
- Lifecycle rules automatically clean up old versions
- Production environment has **logging enabled** for audit trails

## 📊 Cost Optimization

- Lifecycle rules delete noncurrent versions after 30 days (staging) / 90 days (production)
- Incomplete multipart uploads are automatically aborted after 7 days
- Consider using S3 Intelligent-Tiering for cost savings on larger sites

## 🔄 CI/CD Integration

This configuration can be integrated with GitHub Actions or other CI/CD pipelines:

1. **Terraform Plan**: Run on pull requests
2. **Terraform Apply**: Run on merge to main branch
3. **Content Sync**: Use AWS CLI or GitHub Actions to sync website content

Example GitHub Actions workflow:
```yaml
- name: Terraform Apply
  run: |
    terraform init
    terraform apply -var-file="environments/${{ matrix.environment }}.tfvars" -auto-approve
```

## 🔗 Related Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS S3 Static Website Hosting Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)

## 📝 Notes

- Bucket names must be globally unique across all AWS accounts
- Update `bucket_name` in `.tfvars` files to match your naming convention
- For custom domains, configure Route 53 or CloudFront separately
- CORS rules can be customized in the `.tfvars` files

## 🛠️ Troubleshooting

### Issue: Bucket name already exists
**Solution**: S3 bucket names must be globally unique. Change the `bucket_name` in your `.tfvars` file.

### Issue: Access denied when accessing website
**Solution**: Ensure the bucket policy allows public read access and public access block settings are configured correctly.

### Issue: 404 errors for all pages
**Solution**: Verify that `index.html` exists in the bucket and the website configuration is correct.

## 📄 License

This configuration is part of the devops-engineer-profile project.

---

**Maintained by:** DevOps Team  
**Last Updated:** February 2026
