# DevOps Engineer Profile

A comprehensive showcase of personal DevOps and cloud solutions projects designed to demonstrate expertise and best practices in cloud architecture, infrastructure automation, and DevOps engineering.

## 🎯 Purpose

This repository contains a collection of DevOps and cloud engineering projects that highlight:
- **Cloud Infrastructure Design** - AWS, Azure, GCP, or multi-cloud solutions
- **Infrastructure as Code (IaC)** - Terraform, CloudFormation, ARM Templates
- **CI/CD Pipelines** - GitHub Actions, Jenkins, GitLab CI, AWS CodePipeline
- **Container Orchestration** - Docker, Kubernetes, ECS
- **Monitoring & Logging** - Prometheus, ELK Stack, CloudWatch, Datadog
- **Infrastructure Automation** - Ansible, Chef, Puppet, bash scripts
- **Security Best Practices** - IAM, secrets management, compliance

## 📁 Project Structure

Projects are organized by purpose and technology:

### `/inf` - Infrastructure as Code
Cloud infrastructure definitions and deployment templates:
- **`aws-eks/`** - Amazon EKS (Elastic Kubernetes Service) cluster configuration with Terraform, including monitoring setup
- **`aws-github-oidc/`** - GitHub OIDC integration with AWS for secure CI/CD authentication
- **`aws-s3-web/`** - S3-based static website hosting infrastructure
- **`cloudformation_templates/`** - AWS CloudFormation templates for Lambda and S3 deployments
- **`lambda_scripts/`** - Lambda functions for GitHub-S3 synchronization and deployment automation

### `/src` - Source Code
Application source code and static assets:
- **`aws-s3-web/`** - Portfolio website static files (HTML, CSS, JavaScript) with Bootstrap and modern UI components

### `/ops` - Operations & Automation
Operational scripts and automation tools:
- **`github_s3_sync.py`** - Python script for synchronizing GitHub repository content with S3 buckets

### `/doc` - Documentation
Project documentation and implementation guides:
- Implementation notes and guides for various features and sections

## 🚀 Getting Started

Each project includes its own README with specific setup instructions, prerequisites, and usage guidelines.

## 📝 Contributing

Feel free to fork, suggest improvements, or use these projects as learning resources.

## 📄 License

MIT License - See LICENSE file for details
