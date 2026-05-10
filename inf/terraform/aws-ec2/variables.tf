variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  nullable    = false
}

variable "environment" {
  description = "Environment name used for tagging (e.g. dev, staging, production)"
  type        = string
  default     = "dev"
  nullable    = false
}

variable "project_name" {
  description = "Project name applied to all resource tags"
  type        = string
  default     = "devops-engineer-profile"
  nullable    = false
}

variable "name" {
  description = "Name prefix applied to the EC2 instance and associated resources"
  type        = string
  nullable    = false
}

variable "subnet_id" {
  description = "ID of the subnet to launch the EC2 instance in"
  type        = string
  nullable    = false
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs to attach to the EC2 instance"
  type        = list(string)
  default     = []
  nullable    = false
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
  nullable    = false
}

variable "key_name" {
  description = "Name of the EC2 key pair to use for SSH access; leave empty for no key pair"
  type        = string
  default     = ""
}

variable "associate_public_ip_address" {
  description = "Whether to assign a public IP address to the instance"
  type        = bool
  default     = false
  nullable    = false
}

variable "root_volume_size" {
  description = "Root EBS volume size in GiB"
  type        = number
  default     = 20
  nullable    = false
}

variable "monitoring" {
  description = "Enable detailed CloudWatch monitoring on the instance"
  type        = bool
  default     = false
  nullable    = false
}

variable "create_eip" {
  description = "Whether to allocate and attach an Elastic IP to the instance"
  type        = bool
  default     = false
  nullable    = false
}

variable "tags" {
  description = "Additional tags to merge onto all resources"
  type        = map(string)
  default     = {}
}
