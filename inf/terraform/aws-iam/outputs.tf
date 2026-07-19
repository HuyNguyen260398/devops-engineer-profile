output "permissions_boundary_arn" {
  description = "ARN of the permissions boundary policy. Pass this to other stacks that create roles which must be capped by the same boundary."
  value       = aws_iam_policy.permissions_boundary.arn
}

output "custom_policy_arns" {
  description = "Map of policy key to ARN for every customer-managed policy created by this module."
  value       = { for policy_key, policy in aws_iam_policy.custom : policy_key => policy.arn }
}

output "custom_policy_names" {
  description = "Map of policy key to policy name. Identity Center permission sets reference customer-managed policies by NAME, not ARN — use this output when wiring the aws-iam-identity-center module."
  value       = { for policy_key, policy in aws_iam_policy.custom : policy_key => policy.name }
}

output "service_role_arns" {
  description = "Map of role key to ARN for every service role."
  value       = { for role_key, role in aws_iam_role.service : role_key => role.arn }
}

output "cross_account_role_arns" {
  description = "Map of role key to ARN for every cross-account role."
  value       = { for role_key, role in aws_iam_role.cross_account : role_key => role.arn }
}

output "break_glass_role_arn" {
  description = "ARN of the break-glass admin role, or null when disabled."
  value       = var.enable_break_glass_role ? aws_iam_role.break_glass[0].arn : null
}

output "group_names" {
  description = "Map of group key to the created IAM group name."
  value       = { for group_key, group in aws_iam_group.this : group_key => group.name }
}

output "user_names" {
  description = "Map of user key to the created IAM user name."
  value       = { for user_key, user in aws_iam_user.this : user_key => user.name }
}
