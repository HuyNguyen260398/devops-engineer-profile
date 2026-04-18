# Output values for the EC2 instance

output "instance_id" {
  description = "The ID of the EC2 instance"
  value       = module.ec2_instance.id
}

output "instance_arn" {
  description = "The ARN of the EC2 instance"
  value       = module.ec2_instance.arn
}

output "private_ip" {
  description = "The private IP address of the EC2 instance"
  value       = module.ec2_instance.private_ip
}

output "public_ip" {
  description = "The public IP address of the EC2 instance (if assigned)"
  value       = module.ec2_instance.public_ip
}
