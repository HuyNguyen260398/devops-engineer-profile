# AWS S3 + CloudFront Resume PDF Hosting

Secure infrastructure for hosting and distributing resume PDFs using AWS S3 and CloudFront with Origin Access Control (OAC).

## 🏗️ Architecture

```
User Browser
    ↓ HTTPS Request
CloudFront Distribution (CDN)
    ↓ Origin Access Control (OAC)
Private S3 Bucket (/resume/ folder)
    └── Nguyen-Gia-Huy-DevOps-Engineer.pdf
```

## 🔒 Security Features

1. **Private S3 Bucket**: All public access blocked
2. **Origin Access Control (OAC)**: CloudFront is the only entity that can access S3 objects
3. **HTTPS Only**: Automatic redirect from HTTP to HTTPS
4. **Server-Side Encryption**: AES-256 encryption for S3 objects
5. **Versioning Enabled**: Track changes to resume files
6. **TLS 1.2+**: Modern encryption protocols only
7. **No Direct S3 Access**: Users cannot bypass CloudFront to access files directly

## 📋 Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.5.0
- AWS Account with permissions for S3, CloudFront, and optionally Route53

## 🚀 Deployment

### Step 1: Initialize Terraform

```bash
cd inf/terraform/aws-s3-resume
terraform init
```

### Step 2: Review Configuration

Edit `environments/production.tfvars`:

```hcl
resume_bucket_name = "your-unique-bucket-name"
environment        = "production"
aws_region         = "ap-southeast-1"
```

### Step 3: Plan and Apply

```bash
# Review changes
terraform plan -var-file="environments/production.tfvars"

# Apply configuration
terraform apply -var-file="environments/production.tfvars"
```

### Step 4: Note the CloudFront URL

After deployment, Terraform will output:

```bash
cloudfront_url = "https://d1234567890abc.cloudfront.net"
resume_download_url = "https://d1234567890abc.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
```

### Step 5: Upload Your Resume PDF

```bash
# Upload resume to S3
aws s3 cp path/to/your-resume.pdf \
  s3://your-bucket-name/resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf

# Verify upload
aws s3 ls s3://your-bucket-name/resume/

# Test download
curl -I https://your-cloudfront-url/Nguyen-Gia-Huy-DevOps-Engineer.pdf
```

### Step 6: Update HTML

Update your website's HTML with the CloudFront URL:

```html
<a href="https://d1234567890abc.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf" 
   download="Nguyen-Gia-Huy-DevOps-Engineer.pdf" 
   class="cv-download-link" 
   target="_blank" 
   rel="noopener noreferrer">
   Download Resume (PDF)
</a>
```

## 🌐 Optional: Custom Domain Setup

### Step 1: Request ACM Certificate (ap-southeast-1)

```bash
# CloudFront requires certificates in ap-southeast-1
aws acm request-certificate \
  --domain-name cdn.your-domain.com \
  --validation-method DNS \
  --region ap-southeast-1
```

### Step 2: Update tfvars

```hcl
use_custom_domain   = true
cdn_subdomain       = "cdn"
acm_certificate_arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/your-cert-id"
route53_zone_id     = "Z1234567890ABC"
```

### Step 3: Apply Changes

```bash
terraform apply -var-file="environments/production.tfvars"
```

Your resume will be available at: `https://cdn.your-domain.com/Nguyen-Gia-Huy-DevOps-Engineer.pdf`

## 🔄 Updating Resume

When you upload a new version of your resume:

```bash
# Upload new version
aws s3 cp new-resume.pdf \
  s3://your-bucket-name/resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf

# Invalidate CloudFront cache (force immediate update)
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
```

## 📊 Monitoring & Costs

### CloudFront Pricing (approximations)
- First 10 TB/month: $0.085/GB (US/Europe)
- Data transfer OUT to internet
- Typical resume PDF (~500KB) = negligible cost
- **Expected monthly cost for personal resume**: < $1

### S3 Pricing
- Storage: $0.023/GB/month
- GET requests: $0.0004 per 1,000 requests
- **Expected monthly cost**: < $0.10

### Total Estimated Cost: **< $1/month**

## 🛡️ Advanced Security (Optional)

### Option A: Time-Limited Downloads with Pre-Signed URLs

For more control, implement Lambda@Edge to generate time-limited URLs:

```python
# Lambda function (not included in this basic setup)
import boto3
from datetime import datetime, timedelta

def generate_presigned_url(event, context):
    s3 = boto3.client('s3')
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'your-bucket', 'Key': 'resume/resume.pdf'},
        ExpiresIn=3600  # 1 hour
    )
    return {'statusCode': 302, 'headers': {'Location': url}}
```

### Option B: CloudFront Signed URLs

For time-limited access:

1. Create CloudFront key pair
2. Use signed URLs with expiration
3. Requires JavaScript to fetch signed URL from API

## 📝 Outputs Reference

| Output | Description |
|--------|-------------|
| `s3_bucket_name` | S3 bucket name |
| `cloudfront_url` | CloudFront distribution URL |
| `resume_download_url` | Direct link to resume PDF |
| `upload_instructions` | Commands to upload/update resume |

## 🧹 Cleanup

To destroy all resources:

```bash
# Delete all objects in S3 bucket first
aws s3 rm s3://your-bucket-name/resume/ --recursive

# Destroy infrastructure
terraform destroy -var-file="environments/production.tfvars"
```

## 📚 Additional Resources

- [CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)

## 🤝 Contributing

This is a personal infrastructure project, but feel free to use it as a template for your own resume hosting.

## 📄 License

See [LICENSE](../../LICENSE) file in the repository root.
