#!/usr/bin/env python3
"""
Deploy GitHub to S3 sync Lambda function
"""

import os
import sys
import zipfile
import tempfile
import subprocess
import boto3
from pathlib import Path

def create_deployment_package():
    """Create Lambda deployment package with dependencies."""
    
    print("📦 Creating Lambda deployment package...")
    
    # Create temporary directory for package
    with tempfile.TemporaryDirectory() as temp_dir:
        package_dir = Path(temp_dir) / "package"
        package_dir.mkdir()
        
        # Install dependencies
        print("📥 Installing dependencies...")
        subprocess.run([
            sys.executable, "-m", "pip", "install", 
            "-r", "lambda_requirements.txt", 
            "-t", str(package_dir)
        ], check=True)
        
        # Copy Lambda function
        lambda_file = Path("lambda_github_s3_sync.py")
        if not lambda_file.exists():
            raise FileNotFoundError("lambda_github_s3_sync.py not found")
        
        import shutil
        shutil.copy2(lambda_file, package_dir / "lambda_github_s3_sync.py")
        
        # Create ZIP file
        zip_path = Path("lambda_deployment_package.zip")
        if zip_path.exists():
            zip_path.unlink()
        
        print("🗜️  Creating ZIP package...")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in package_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(package_dir)
                    zipf.write(file_path, arcname)
        
        print(f"✅ Package created: {zip_path}")
        return zip_path

def update_lambda_function(function_name, zip_path):
    """Update Lambda function code."""
    
    print(f"🚀 Updating Lambda function: {function_name}")
    
    lambda_client = boto3.client('lambda')
    
    try:
        with open(zip_path, 'rb') as zip_file:
            response = lambda_client.update_function_code(
                FunctionName=function_name,
                ZipFile=zip_file.read()
            )
        
        print(f"✅ Function updated successfully")
        print(f"   Function ARN: {response['FunctionArn']}")
        print(f"   Last Modified: {response['LastModified']}")
        
    except Exception as e:
        print(f"❌ Failed to update function: {e}")
        return False
    
    return True

def deploy_cloudformation(stack_name="github-s3-sync-lambda"):
    """Deploy CloudFormation stack."""
    
    print(f"☁️  Deploying CloudFormation stack: {stack_name}")
    
    cf_client = boto3.client('cloudformation')
    
    try:
        with open('lambda_deployment.yaml', 'r') as template_file:
            template_body = template_file.read()
        
        # Check if stack exists
        try:
            cf_client.describe_stacks(StackName=stack_name)
            # Stack exists, update it
            response = cf_client.update_stack(
                StackName=stack_name,
                TemplateBody=template_body,
                Capabilities=['CAPABILITY_IAM']
            )
            print(f"📝 Updating existing stack...")
            
        except cf_client.exceptions.ClientError as e:
            if 'does not exist' in str(e):
                # Stack doesn't exist, create it
                response = cf_client.create_stack(
                    StackName=stack_name,
                    TemplateBody=template_body,
                    Capabilities=['CAPABILITY_IAM']
                )
                print(f"🆕 Creating new stack...")
            else:
                raise
        
        print(f"✅ CloudFormation operation initiated")
        print(f"   Stack ID: {response['StackId']}")
        
    except Exception as e:
        print(f"❌ CloudFormation deployment failed: {e}")
        return False
    
    return True

def main():
    """Main deployment function."""
    
    print("🚀 GitHub to S3 Sync Lambda Deployment")
    print("=" * 40)
    
    try:
        # Step 1: Create deployment package
        zip_path = create_deployment_package()
        
        # Step 2: Deploy CloudFormation (optional)
        deploy_cf = input("\n📋 Deploy CloudFormation stack? (y/N): ").lower().strip()
        if deploy_cf == 'y':
            if not deploy_cloudformation():
                print("❌ CloudFormation deployment failed")
                return
        
        # Step 3: Update Lambda function code
        function_name = input("\n🔧 Enter Lambda function name (or press Enter to skip): ").strip()
        if function_name:
            if not update_lambda_function(function_name, zip_path):
                print("❌ Lambda update failed")
                return
        
        print("\n🎉 Deployment completed!")
        print("\n📝 Next steps:")
        print("1. Test the Lambda function with a sample event")
        print("2. Configure EventBridge rule for scheduled sync (if needed)")
        print("3. Set up GitHub webhook for automatic sync (optional)")
        
        # Sample test event
        print("\n📋 Sample test event:")
        print("""
{
  "repo_url": "https://github.com/yourusername/your-repo.git",
  "bucket_name": "s3.nghuy.link",
  "branch": "main",
  "exclude_patterns": [".git", "*.md", "package.json"]
}
        """)
        
    except KeyboardInterrupt:
        print("\n❌ Deployment cancelled by user")
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")

if __name__ == "__main__":
    main()