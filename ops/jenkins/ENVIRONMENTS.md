# Environment Configuration Comparison

This document provides a quick reference for the key differences between the three Jenkins environments.

## Quick Reference Table

| Feature | Local | Staging (EKS) | Production (EKS) |
|---------|-------|---------------|------------------|
| **Namespace** | `jenkins` | `jenkins-staging` | `jenkins-production` |
| **Jenkins Version** | 2.440-jdk17 | 2.440-jdk17 | 2.440-jdk17 |
| **Access Method** | NodePort 32000 | LoadBalancer (Internal) | Ingress + TLS |
| **Admin Secret** | Inline (admin123) | Kubernetes Secret | AWS Secrets Manager |
| **Storage Size** | 8Gi | 50Gi | 100Gi |
| **Storage Class** | standard | gp3 | gp3 |
| **CPU Request** | 500m | 1 core | 2 cores |
| **CPU Limit** | 2 cores | 4 cores | 8 cores |
| **Memory Request** | 1Gi | 2Gi | 4Gi |
| **Memory Limit** | 2Gi | 4Gi | 8Gi |
| **Java Heap (Xmx)** | 1536m | 3072m | 6144m |
| **Max Agents** | 10 | 20 | 50 |
| **Executors on Controller** | 0 | 0 | 0 |
| **Network Policies** | Disabled | Enabled | Enabled (Strict) |
| **IRSA** | N/A | Optional | Required |
| **Backup** | None | Daily (Velero) | Every 6 hours |
| **Monitoring** | Basic | Prometheus | Full Stack |
| **HA Setup** | No | No | Yes (PDB + Affinity) |
| **Ingress WAF** | N/A | No | Yes |
| **Rate Limiting** | No | No | Yes |

## URLs

- **Local**: http://localhost:32000
- **Staging**: http://jenkins-staging.example.com (update in values file)
- **Production**: https://jenkins.example.com (update in values file)

## Plugin Differences

### Local Environment
- Minimal plugin set for development
- Plugins: Core + Kubernetes + Git + Basic UI

### Staging Environment
- Full plugin set for testing
- Adds: AWS plugins, SCM plugins, monitoring

### Production Environment
- Hardened plugin set
- Adds: Security plugins, audit trail, compliance plugins

## Security Configurations

### Local
- Basic authentication
- No encryption
- Standard pod security

### Staging
- Role-based access control (RBAC)
- Internal load balancer
- Network policies enabled
- Pod security baseline

### Production
- RBAC with detailed roles
- TLS encryption (Let's Encrypt)
- Strict network policies
- Pod security restricted
- IRSA for AWS access
- Audit logging enabled
- WAF enabled on Ingress

## Agent Configurations

### Local
- Default JNLP agent only
- Resources: 500m CPU, 512Mi RAM

### Staging
- Default JNLP agent
- Docker agent (DinD)
- Resources: 1 CPU, 1-2Gi RAM

### Production
- Default JNLP agent
- Docker agent (DinD)
- Maven agent
- Node.js agent
- Resources: 1-4 CPU, 2-4Gi RAM
- Pod retention on failure

## Kubernetes Resources Created

All environments create:
- StatefulSet (Jenkins controller)
- Service (ClusterIP)
- ConfigMap (JCasC configuration)
- Secret (Admin credentials)
- PersistentVolumeClaim (Jenkins home)
- ServiceAccount (Controller + Agents)
- Role/RoleBinding (RBAC)

Staging/Production additionally create:
- NetworkPolicy
- ServiceMonitor (Prometheus)
- Ingress (Production only)
- PodDisruptionBudget (Production only)

## Common Configurations

All environments share:
- Configuration as Code (JCasC) enabled
- Kubernetes plugin for dynamic agents
- Security realm: Local user database
- No executors on controller (agent-only builds)
- Git plugin for SCM
- Pipeline plugins

## Customization Points

### Required Changes Before Deployment

**Local**:
- [ ] Change admin password (default: admin123)

**Staging**:
- [ ] Update `jenkinsUrl` to actual LoadBalancer DNS
- [ ] Create `jenkins-admin-credentials` secret
- [ ] Optional: Configure IRSA role ARN
- [ ] Update admin email address

**Production**:
- [ ] Update `jenkinsUrl` to production domain
- [ ] Update Ingress hostname
- [ ] Create `jenkins-admin-credentials` secret (via AWS Secrets Manager)
- [ ] Configure IRSA role ARNs (controller + agents)
- [ ] Update admin email address
- [ ] Configure backup S3 bucket
- [ ] Set up monitoring alerts
- [ ] Configure DNS CNAME records

## ArgoCD Sync Behavior

| Environment | Sync Mode | Auto-Prune | Self-Heal | Sync Window |
|-------------|-----------|------------|-----------|-------------|
| Local | Automated | Yes | Yes | Always |
| Staging | Automated | Yes | Yes | Mon-Fri 8AM-6PM |
| Production | **Manual** | Yes | No | Sat 8-10PM |

## Cost Estimates (AWS)

Approximate monthly costs for EKS deployments:

**Staging**:
- EKS Control Plane: $73
- Worker Nodes (t3.large × 2): ~$120
- EBS Storage (50Gi gp3): ~$5
- Load Balancer: ~$20
- **Total**: ~$218/month

**Production**:
- EKS Control Plane: $73
- Worker Nodes (t3.xlarge × 3): ~$270
- EBS Storage (100Gi gp3): ~$10
- Load Balancer + Ingress: ~$40
- Backup Storage: ~$10
- **Total**: ~$403/month

*Note: Costs vary by region and actual usage patterns.*

## Scaling Considerations

### Vertical Scaling (More Resources per Pod)
Edit `controller.resources` in values file.

### Horizontal Scaling (More Agents)
Edit `containerCapStr` in JCasC cloud configuration.

### Storage Scaling
Cannot easily resize PVC. Plan ahead or use volume migration strategies.

## Maintenance Windows

- **Local**: Anytime
- **Staging**: Business hours (Mon-Fri, 8 AM - 6 PM)
- **Production**: Saturday evenings (8-10 PM) only

## Support Contacts

- **Local Issues**: Self-service
- **Staging Issues**: DevOps team
- **Production Issues**: On-call DevOps engineer + incident management

---

**Last Updated**: February 2026
