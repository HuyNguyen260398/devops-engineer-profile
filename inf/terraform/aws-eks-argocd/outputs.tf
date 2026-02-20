output "argocd_irsa_role_arn" {
  description = "IAM Role ARN to annotate on ArgoCD Kubernetes service accounts (IRSA). Pass this value to deploy-aws.sh via ARGOCD_IRSA_ROLE_ARN."
  value       = module.argocd_irsa.iam_role_arn
}

output "argocd_irsa_role_name" {
  description = "IAM Role name for ArgoCD service accounts"
  value       = module.argocd_irsa.iam_role_name
}

output "argocd_namespace" {
  description = "Kubernetes namespace where ArgoCD service accounts are annotated"
  value       = var.argocd_namespace
}

output "cluster_name" {
  description = "EKS cluster name used by this module"
  value       = var.cluster_name
}
