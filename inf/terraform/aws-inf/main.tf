module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 5.0"

  name = var.instance_name

  instance_type = var.instance_type
  key_name      = var.key_name
  monitoring    = true
  subnet_id     = var.subnet_id

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}