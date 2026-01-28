import json
import os
import tempfile
import zipfile
import requests
import boto3
from botocore.exceptions import ClientError
import mimetypes
import hashlib
from urllib.parse import urlparse
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class LambdaGitHubS3Sync:
    def __init__(self, bucket_name, github_token=None):
        self.bucket_name = bucket_name
        self.github_token = github_token
        self.s3_client = boto3.client('s3')
        
    def download_repo_zip(self, repo_url, branch='main'):
        """Download repository as ZIP from GitHub API."""
        # Parse GitHub URL to get owner/repo
        if 'github.com' in repo_url:
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo = parts[-1].replace('.git', '')
        else:
            raise ValueError("Invalid GitHub URL")
        
        # GitHub API URL for downloading ZIP
        api_url = f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}"
        
        headers = {}
        if self.github_token:
            headers['Authorization'] = f'token {self.github_token}'
        
        logger.info(f"Downloading {owner}/{repo} from branch {branch}")
        
        response = requests.get(api_url, headers=headers, stream=True)
        response.raise_for_status()
        
        # Save to temporary file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        for chunk in response.iter_content(chunk_size=8192):
            temp_zip.write(chunk)
        temp_zip.close()
        
        return temp_zip.name
    
    def extract_zip(self, zip_path, extract_to):
        """Extract ZIP file to specified directory."""
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        
        # GitHub ZIP creates a folder like "owner-repo-commit"
        # Find the extracted folder
        extracted_folders = [f for f in os.listdir(extract_to) 
                           if os.path.isdir(os.path.join(extract_to, f))]
        
        if extracted_folders:
            return os.path.join(extract_to, extracted_folders[0])
        return extract_to
    
    def get_content_type(self, file_path):
        """Determine content type for a file."""
        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = 'binary/octet-stream'
        return content_type
    
    def calculate_file_hash(self, file_path):
        """Calculate MD5 hash of a file."""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def file_needs_upload(self, local_file, s3_key):
        """Check if file needs upload by comparing hashes."""
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            s3_etag = response['ETag'].strip('"')
            local_hash = self.calculate_file_hash(local_file)
            return local_hash != s3_etag
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return True
            logger.warning(f"Error checking S3 object {s3_key}: {e}")
            return True
    
    def sync_directory(self, source_dir, exclude_patterns=None):
        """Sync directory contents to S3."""
        if exclude_patterns is None:
            exclude_patterns = ['.git', '.gitignore', '__pycache__', '*.pyc', '.DS_Store']
        
        uploaded_count = 0
        skipped_count = 0
        
        for root, dirs, files in os.walk(source_dir):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if not any(pattern in d for pattern in exclude_patterns)]
            
            for file in files:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, source_dir)
                
                # Check exclusions
                should_exclude = any(
                    pattern in relative_path or file == pattern 
                    for pattern in exclude_patterns
                )
                
                if should_exclude:
                    continue
                
                # Use forward slashes for S3 keys
                s3_key = relative_path.replace('\\', '/')
                
                # Check if upload needed
                if not self.file_needs_upload(file_path, s3_key):
                    logger.debug(f"Skipping {s3_key} (unchanged)")
                    skipped_count += 1
                    continue
                
                try:
                    content_type = self.get_content_type(file_path)
                    
                    self.s3_client.upload_file(
                        file_path,
                        self.bucket_name,
                        s3_key,
                        ExtraArgs={'ContentType': content_type}
                    )
                    
                    logger.info(f"Uploaded: {s3_key}")
                    uploaded_count += 1
                    
                except ClientError as e:
                    logger.error(f"Failed to upload {s3_key}: {e}")
        
        return uploaded_count, skipped_count


def lambda_handler(event, context):
    """
    Lambda handler function.
    
    Expected event structure:
    {
        "repo_url": "https://github.com/owner/repo.git",
        "bucket_name": "your-bucket-name",
        "branch": "main",  # optional, defaults to main
        "source_dir": "dist",  # optional, sync specific subdirectory
        "exclude_patterns": [".git", "*.md"],  # optional
        "github_token": "ghp_xxx"  # optional, for private repos
    }
    """
    
    try:
        # Parse event parameters
        repo_url = event['repo_url']
        bucket_name = event['bucket_name']
        branch = event.get('branch', 'main')
        source_dir = event.get('source_dir')
        exclude_patterns = event.get('exclude_patterns', [
            '.git', '.gitignore', '.github', '__pycache__', 
            '*.pyc', '.DS_Store', 'node_modules', '.env'
        ])
        github_token = event.get('github_token') or os.environ.get('GITHUB_TOKEN')
        
        logger.info(f"Starting sync: {repo_url} -> s3://{bucket_name}")
        
        # Initialize syncer
        syncer = LambdaGitHubS3Sync(bucket_name, github_token)
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Download repository ZIP
            zip_path = syncer.download_repo_zip(repo_url, branch)
            
            try:
                # Extract ZIP
                extracted_dir = syncer.extract_zip(zip_path, temp_dir)
                
                # Determine sync source
                sync_source = extracted_dir
                if source_dir:
                    sync_source = os.path.join(extracted_dir, source_dir)
                    if not os.path.exists(sync_source):
                        raise ValueError(f"Source directory '{source_dir}' not found in repository")
                
                # Sync to S3
                uploaded, skipped = syncer.sync_directory(sync_source, exclude_patterns)
                
                result = {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Sync completed successfully',
                        'uploaded_files': uploaded,
                        'skipped_files': skipped,
                        'bucket': bucket_name,
                        'repository': repo_url,
                        'branch': branch
                    })
                }
                
                logger.info(f"Sync completed: {uploaded} uploaded, {skipped} skipped")
                return result
                
            finally:
                # Clean up ZIP file
                if os.path.exists(zip_path):
                    os.unlink(zip_path)
    
    except Exception as e:
        logger.error(f"Sync failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Sync failed'
            })
        }


# For local testing
if __name__ == "__main__":
    # Test event
    test_event = {
        "repo_url": "https://github.com/yourusername/your-repo.git",
        "bucket_name": "s3.nghuy.link",
        "branch": "main",
        "exclude_patterns": [".git", "*.md", "package.json"]
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))