# Input variables for the AWS EC2 instance

variable "aws_region" {
  description = "AWS region where the EC2 instance will be created"
  type        = string
  default     = "ap-southeast-1"
}

variable "instance_name" {
  description = "Name tag for the EC2 instance"
  type        = string
  default     = "single-instance"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of the SSH key pair to use for the instance"
  type        = string
}

variable "subnet_id" {
  description = "ID of the subnet to launch the instance in"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, production)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for tagging resources"
  type        = string
  default     = "devops-engineer-profile"
}
