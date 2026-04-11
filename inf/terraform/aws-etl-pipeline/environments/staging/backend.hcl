bucket         = "aws-etl-pipeline-tf-state"
key            = "aws-etl-pipeline/staging/terraform.tfstate"
region         = "ap-southeast-1"
encrypt        = true
dynamodb_table = "aws-etl-pipeline-tf-lock"
