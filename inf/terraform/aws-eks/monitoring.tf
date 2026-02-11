# CloudWatch Container Insights for EKS
# Note: CloudWatch log group is managed by EKS module to avoid conflicts

# CloudWatch Agent is commented out due to repository issues
# To enable, use AWS Distro for OpenTelemetry (ADOT) instead:
# https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-EKS-quickstart.html

# # IAM Role for CloudWatch Container Insights
# module "cloudwatch_observability_irsa" {
#   count   = var.enable_cloudwatch_logs ? 1 : 0
#   source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
#   version = "~> 5.0"
#
#   role_name_prefix = "${local.cluster_name}-cw-observability-"
#
#   role_policy_arns = {
#     policy = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
#   }
#
#   oidc_providers = {
#     main = {
#       provider_arn               = module.eks.oidc_provider_arn
#       namespace_service_accounts = ["amazon-cloudwatch:cloudwatch-agent"]
#     }
#   }
#
#   tags = local.common_tags
# }
#
# # Deploy CloudWatch Agent for Container Insights
# resource "helm_release" "cloudwatch_agent" {
#   count = var.enable_cloudwatch_logs ? 1 : 0
#
#   name       = "amazon-cloudwatch-observability"
#   repository = "https://aws-observability.github.io/aws-cloudwatch-metrics"
#   chart      = "amazon-cloudwatch-observability"
#   namespace  = "amazon-cloudwatch"
#   version    = "0.1.0"
#
#   create_namespace = true
#
#   set {
#     name  = "clusterName"
#     value = local.cluster_name
#   }
#
#   set {
#     name  = "region"
#     value = var.aws_region
#   }
#
#   set {
#     name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
#     value = module.cloudwatch_observability_irsa[0].iam_role_arn
#   }
#
#   depends_on = [module.eks]
# }

# Kubernetes Namespace for Monitoring Stack
resource "kubernetes_namespace" "monitoring" {
  count = var.enable_prometheus || var.enable_grafana ? 1 : 0

  metadata {
    name = var.prometheus_namespace

    labels = {
      name        = var.prometheus_namespace
      environment = var.environment
    }
  }

  depends_on = [module.eks]
}

# Prometheus Stack (includes Prometheus, Alertmanager, and Grafana)
resource "helm_release" "prometheus_stack" {
  count = var.enable_prometheus ? 1 : 0

  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = var.prometheus_namespace
  version    = "51.9.4"

  values = [
    yamlencode({
      # Prometheus configuration
      prometheus = {
        prometheusSpec = {
          retention   = "7d"
          storageSpec = null # Use emptyDir for minimal cost
          resources = {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }

      # Alertmanager configuration
      alertmanager = {
        enabled = true
        alertmanagerSpec = {
          storage = null # Use emptyDir for minimal cost
          resources = {
            requests = {
              cpu    = "50m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
        }
      }

      # Grafana configuration
      grafana = {
        enabled       = var.enable_grafana
        adminPassword = var.grafana_admin_password != "" ? var.grafana_admin_password : "admin"
        persistence = {
          enabled = false # Disable for minimal cost
        }
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
        service = {
          type = "ClusterIP"
        }
        # Pre-configured dashboards for EKS monitoring
        dashboardProviders = {
          "dashboardproviders.yaml" = {
            apiVersion = 1
            providers = [
              {
                name            = "default"
                orgId           = 1
                folder          = ""
                type            = "file"
                disableDeletion = false
                editable        = true
                options = {
                  path = "/var/lib/grafana/dashboards/default"
                }
              }
            ]
          }
        }
      }

      # Prometheus Node Exporter
      nodeExporter = {
        enabled = true
        resources = {
          requests = {
            cpu    = "50m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "100m"
            memory = "128Mi"
          }
        }
      }

      # Kube State Metrics
      kubeStateMetrics = {
        enabled = true
        resources = {
          requests = {
            cpu    = "50m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "100m"
            memory = "128Mi"
          }
        }
      }

      # Prometheus Operator
      prometheusOperator = {
        resources = {
          requests = {
            cpu    = "50m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
      }
    })
  ]

  depends_on = [
    module.eks,
    kubernetes_namespace.monitoring
  ]
}

# Metrics Server for HPA
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = "3.11.0"

  set {
    name  = "args[0]"
    value = "--kubelet-preferred-address-types=InternalIP"
  }

  set {
    name  = "resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "resources.requests.memory"
    value = "128Mi"
  }

  depends_on = [module.eks]
}
