output "instance_id" {
  description = "ID of the EC2 instance"
  value       = module.ec2.instance_id
}

output "instance_arn" {
  description = "ARN of the EC2 instance"
  value       = module.ec2.instance_arn
}

output "private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = module.ec2.private_ip
}

output "public_ip" {
  description = "Public IP address of the EC2 instance (EIP if create_eip = true)"
  value       = module.ec2.public_ip
}

output "availability_zone" {
  description = "Availability zone the instance was launched in"
  value       = module.ec2.availability_zone
}

output "ami_id" {
  description = "AMI ID used by the instance (reflects auto-selected AL2023 if ami_id was not provided)"
  value       = module.ec2.ami_id
}
