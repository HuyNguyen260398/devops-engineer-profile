# Secure Resume PDF Download Implementation Guide

## Overview

This document describes the implementation of a secure, scalable solution for hosting and distributing resume PDFs using AWS S3 and CloudFront with Origin Access Control (OAC).

## Architecture

```
┌─────────────┐
│   User's    │
│   Browser   │
└──────┬──────┘
       │ HTTPS Request
       ↓
┌─────────────────────┐
│  CloudFront CDN     │
│  (Global Edge)      │
│  - HTTPS Only       │
│  - Caching          │
│  - DDoS Protection  │
└──────┬──────────────┘
       │ Origin Access Control (OAC)
       ↓
┌─────────────────────┐
│  Private S3 Bucket  │
│  - No public access │
│  - Versioning       │
│  - Encryption       │
└─────────────────────┘
```

## Security Features

### 1. **Private S3 Bucket**
- ✅ All public access blocked
- ✅ Server-side AES-256 encryption
- ✅ Versioning enabled for audit trail
- ✅ No direct internet access

### 2. **CloudFront Origin Access Control**
- ✅ Only CloudFront can access S3 objects
- ✅ Uses AWS SigV4 authentication
- ✅ Prevents direct S3 URL access
- ✅ Validates CloudFront distribution ARN

### 3. **Transport Security**
- ✅ HTTPS only (HTTP automatically redirects)
- ✅ TLS 1.2+ minimum protocol version
- ✅ Modern cipher suites
- ✅ HSTS headers (recommended to add)

### 4. **Content Distribution**
- ✅ Global edge locations for fast delivery
- ✅ DDoS protection via AWS Shield Standard
- ✅ Caching reduces origin load
- ✅ Compression for smaller transfers

## Implementation Files

### Infrastructure (Terraform)

```
inf/terraform/aws-s3-resume/
├── main.tf              # S3 bucket, CloudFront, OAC configuration
├── variables.tf         # Input variables
├── outputs.tf          # Output values (URLs, resource IDs)
├── provider.tf         # AWS provider configuration
├── locals.tf           # Local values and computed variables
├── README.md           # Comprehensive deployment guide
└── environments/
    └── production.tfvars  # Production environment variables
```

### Operations Scripts

```
ops/
├── resume_upload.py    # Python script for uploading/managing PDFs
└── deploy_resume.sh    # Bash deployment automation script
```

### CI/CD Pipeline

```
.github/workflows/
└── deploy-resume-infrastructure.yml  # GitHub Actions workflow
```

### Frontend

```
src/aws-s3-web/
└── index.html          # Updated with secure download link
```

## Deployment Steps

### Step 1: Configure Variables

Edit `inf/terraform/aws-s3-resume/environments/production.tfvars`:

```hcl
resume_bucket_name = "nghuy-resume-pdf-bucket"  # Must be globally unique
environment        = "production"
aws_region         = "ap-southeast-1"
```

### Step 2: Deploy Infrastructure

```bash
cd inf/terraform/aws-s3-resume

# Initialize Terraform
terraform init

# Review planned changes
terraform plan -var-file="environments/production.tfvars"

# Deploy infrastructure
terraform apply -var-file="environments/production.tfvars"

# Note the outputs
terraform output
```

### Step 3: Upload Resume PDF

```bash
# Get bucket name and distribution ID
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)

# Upload PDF
aws s3 cp your-resume.pdf \
  s3://$BUCKET_NAME/resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
```

Or use the Python script:

```bash
python3 ops/resume_upload.py upload \
  --file your-resume.pdf \
  --bucket $BUCKET_NAME \
  --distribution-id $DIST_ID
```

### Step 4: Update HTML

The CloudFront URL is automatically inserted in `index.html`:

```html
<li>
  <i class="bi bi-chevron-right"></i> 
  <strong>PDF CV:</strong> 
  <span>
    <a href="https://cdn.your-domain.com/Nguyen-Gia-Huy-DevOps-Engineer.pdf" 
       download="Nguyen-Gia-Huy-DevOps-Engineer.pdf" 
       class="cv-download-link" 
       target="_blank" 
       rel="noopener noreferrer">
       Download Resume (PDF)
    </a>
  </span>
</li>
```

## Automated Deployment (GitHub Actions)

The CI/CD pipeline automatically:
1. Validates Terraform code
2. Runs security scans (Checkov)
3. Plans changes on pull requests
4. Applies changes on merge to main
5. Outputs CloudFront URL for easy access

### Workflow Triggers

- **Push to main**: Automatically applies Terraform changes
- **Pull request**: Runs plan and comments results
- **Manual dispatch**: Run plan/apply/destroy on demand

### Required Secrets

Configure in GitHub repository settings:

```yaml
AWS_ROLE_TO_ASSUME: arn:aws:iam::123456789012:role/GitHubActionsRole
```

## Security Validations

### ✅ Verify No Public Access

```bash
# This should fail (Access Denied)
curl -I https://nghuy-resume-pdf-bucket.s3.amazonaws.com/resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf
```

### ✅ Verify CloudFront Access Works

```bash
# This should succeed (200 OK)
curl -I https://d1234567890abc.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf
```

### ✅ Check S3 Bucket Security

```bash
aws s3api get-public-access-block --bucket nghuy-resume-pdf-bucket
```

Should return:
```json
{
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }
}
```

### ✅ Verify Encryption

```bash
aws s3api get-bucket-encryption --bucket nghuy-resume-pdf-bucket
```

## Cost Estimation

### Monthly Costs (Approximate)

| Service | Usage | Cost |
|---------|-------|------|
| S3 Storage | 1 MB (1 PDF) | $0.00 |
| S3 GET Requests | 1,000 requests | $0.00 |
| CloudFront Data Transfer | 100 MB (200 downloads) | $0.01 |
| CloudFront Requests | 1,000 requests | $0.01 |
| **Total** | | **< $0.10/month** |

### Notes
- First 1 TB of CloudFront data transfer is $0.085/GB
- First 10 million HTTP/HTTPS requests are $0.0075 per 10,000
- S3 storage for small files is negligible
- No charges for data transfer from S3 to CloudFront

## Monitoring & Maintenance

### CloudFront Metrics

Monitor these CloudFront metrics in AWS Console:
- Requests
- Bytes Downloaded
- Error Rate (4xx, 5xx)
- Cache Hit Ratio

### Set Up Alarms (Optional)

```bash
# Create CloudWatch alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name resume-cdn-high-errors \
  --alarm-description "Alert when CloudFront error rate > 5%" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=$DIST_ID \
  --evaluation-periods 2
```

## Troubleshooting

### Issue: 403 Forbidden Error

**Cause**: S3 bucket policy or OAC misconfigured

**Solution**:
```bash
# Verify CloudFront OAC is attached
aws cloudfront get-distribution-config --id $DIST_ID | grep OriginAccessControlId

# Check S3 bucket policy allows CloudFront
aws s3api get-bucket-policy --bucket $BUCKET_NAME
```

### Issue: Slow Download Speed

**Cause**: CloudFront caching not optimized

**Solution**:
```bash
# Check cache statistics
aws cloudfront get-distribution-config --id $DIST_ID | grep DefaultTTL

# Increase cache TTL in Terraform variables if needed
```

### Issue: Changes Not Visible

**Cause**: CloudFront cache not invalidated

**Solution**:
```bash
# Invalidate specific file
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/Nguyen-Gia-Huy-DevOps-Engineer.pdf"

# Or invalidate everything
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

## Advanced Features (Future Enhancements)

### Time-Limited Downloads

Implement pre-signed URLs with expiration:

```python
import boto3
from datetime import timedelta

s3 = boto3.client('s3')
url = s3.generate_presigned_url(
    'get_object',
    Params={'Bucket': 'bucket-name', 'Key': 'resume/file.pdf'},
    ExpiresIn=3600  # 1 hour
)
```

### CloudFront Signed URLs

For more control over access:

```bash
# Create CloudFront key pair
aws cloudfront create-public-key --public-key-config file://public-key.json

# Use AWS SDK to generate signed URLs
```

### Custom Domain with ACM Certificate

Update `production.tfvars`:

```hcl
use_custom_domain   = true
cdn_subdomain       = "cdn"
acm_certificate_arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/..."
route53_zone_id     = "Z1234567890ABC"
```

## Compliance & Best Practices

### ✅ AWS Well-Architected Framework

**Security**
- ✅ Principle of least privilege (OAC)
- ✅ Data encryption at rest and in transit
- ✅ No hardcoded credentials

**Reliability**
- ✅ Multi-AZ CloudFront distribution
- ✅ Versioning for data durability
- ✅ Automated backups via S3 versioning

**Performance**
- ✅ Global CDN for low latency
- ✅ Efficient caching strategy
- ✅ Compression enabled

**Cost Optimization**
- ✅ Minimal infrastructure
- ✅ Caching reduces origin requests
- ✅ Pay-as-you-go pricing

**Operational Excellence**
- ✅ Infrastructure as Code
- ✅ Automated deployment pipeline
- ✅ Monitoring and logging

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## Conclusion

This implementation provides enterprise-grade security for hosting your resume PDF:
- **Private**: S3 bucket is completely private
- **Secure**: Only accessible via HTTPS through CloudFront
- **Fast**: Global CDN ensures low latency
- **Scalable**: Handles any traffic volume
- **Cost-effective**: Less than $0.10/month
- **Automated**: CI/CD pipeline for updates

The solution follows AWS best practices and DevOps principles for infrastructure management.
