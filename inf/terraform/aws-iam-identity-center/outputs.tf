output "sso_instance_arn" {
  description = "ARN of the IAM Identity Center instance this module manages."
  value       = local.sso_instance_arn
}

output "identity_store_id" {
  description = "ID of the Identity Store backing the Identity Center instance."
  value       = local.identity_store_id
}

output "permission_set_arns" {
  description = "Map of permission set name to ARN, covering both baseline and user-supplied sets."
  value       = { for ps_name, ps in aws_ssoadmin_permission_set.this : ps_name => ps.arn }
}

output "group_ids" {
  description = "Map of group name to Identity Store group ID."
  value       = { for group_key, group in aws_identitystore_group.this : group_key => group.group_id }
}

output "user_ids" {
  description = "Map of username to Identity Store user ID."
  value       = { for user_key, user in aws_identitystore_user.this : user_key => user.user_id }
}

output "assignment_keys" {
  description = "Sorted list of every (group/permission_set/account_alias) assignment. Useful as a reviewable access-matrix summary in plan output and PR diffs."
  value       = sort(keys(local.assignments))
}
