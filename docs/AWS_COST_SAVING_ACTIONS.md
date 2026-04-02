# AWS Cost Saving Actions

**Date:** 2026-03-21  
**Account:** 010382427026  
**Analysis Period:** 2026-03-01 → 2026-03-21  

---

## 📊 Cost Analysis Summary

The following analysis was performed using the AWS Cost Explorer CLI to identify all billable services for the period 1–21 March 2026.

### Full Bill Breakdown (Mar 1–21, 2026)

| Service | Cost (USD) |
|---|---|
| AmazonCloudWatch | $6.72 |
| AWS WAF | $5.69 |
| Amazon Route 53 | $1.79 |
| Tax | $1.47 |
| AWS Config | $0.23 |
| Amazon ECR | $0.14 |
| Amazon S3 | $0.07 |
| EC2 - Other | $0.06 |
| Amazon RDS | $0.04 |
| **TOTAL** | **$16.21** |

> **Note:** No EC2 compute instances were found running. The `EC2 - Other` charge reflects minor data transfer or EBS snapshot costs only.

---

## 🔍 CloudWatch Deep-Dive

CloudWatch was the **#1 cost driver** at $6.72. A detailed breakdown by usage type revealed:

| Usage Type | Cost (USD) | Resource |
|---|---|---|
| Internet Monitor – Monitored Resource | $4.79 | `cloudfront_E3MGWTP58YX35G-Monitor` (ap-southeast-1) |
| CloudWatch Dashboards | $1.93 | ~1 dashboard (deleted prior to analysis — historical charge) |
| Alarms, Log Storage, Vended Logs | $0.00 | Within free tier |

### Internet Monitor Root Cause

- **Monitor name:** `cloudfront_E3MGWTP58YX35G-Monitor`
- **Region:** `ap-southeast-1`
- **Monitored resource:** CloudFront distribution `E3MGWTP58YX35G` (serving `nghuy.link`)
- **Traffic monitored:** 100%
- **Status:** `ACTIVE` but faulted — `FAULT_ACCESS_CLOUDWATCH`
  - The monitor was unable to deliver logs to CloudWatch log groups
  - It was **broken and still charging** ~$7.18/month
- **Created:** 2025-11-17

---

## ✅ Actions Taken

### Action 1 — Delete CloudWatch Internet Monitor

**Resource:** `cloudfront_E3MGWTP58YX35G-Monitor`  
**Region:** `ap-southeast-1`  
**Reason:** Personal/portfolio website (`nghuy.link`) does not require internet monitoring. CloudFront's native metrics provide sufficient observability for free.

**Commands executed:**

```bash
# Step 1: Set monitor to INACTIVE (required before deletion)
aws internetmonitor update-monitor \
  --monitor-name "cloudfront_E3MGWTP58YX35G-Monitor" \
  --status INACTIVE \
  --region ap-southeast-1

# Step 2: Delete the monitor
aws internetmonitor delete-monitor \
  --monitor-name "cloudfront_E3MGWTP58YX35G-Monitor" \
  --region ap-southeast-1
```

**Result:** ✅ Monitor successfully deleted. Confirmed via `list-monitors` returning empty.

---

### Action 2 — CloudWatch Dashboard Charges (No Action Required)

**Reason:** No dashboards were found in any AWS region at the time of analysis. The $1.93 charge was historical usage from a dashboard that had already been deleted. No further action needed — charges will not recur.

---

## 💰 Cost Savings Projection

| Action | One-Time Saving (Mar 2026) | Monthly Saving Going Forward |
|---|---|---|
| Delete Internet Monitor | ~$4.79 (partial month) | **~$7.18/month** |
| Dashboard cleanup (already done) | ~$1.93 (historical) | **$0** (already resolved) |
| **Total** | **~$6.72** | **~$7.18/month** |

> **Annualised saving:** ~$86/year

---

## 📋 Remaining Bills & Notes

| Service | Mar Cost | Notes |
|---|---|---|
| AWS WAF | $5.69 | Web Application Firewall for `nghuy.link` — expected, keep as-is |
| Amazon Route 53 | $1.79 | DNS for `nghuy.link` — expected, keep as-is |
| Tax | $1.47 | Computed automatically |
| AWS Config | $0.23 | Configuration recorder — review if needed |
| Amazon ECR | $0.14 | Container image storage — review unused images |
| Amazon S3 | $0.07 | Within normal range |
| EC2 - Other / RDS | $0.10 | Minor residual — monitor for growth |

### Recommended Follow-up Actions

- [ ] Review **AWS Config** recorder — if not actively auditing compliance, disabling it saves ~$0.35/month
- [ ] Audit **Amazon ECR** — delete unused/old container images to reduce storage costs
- [ ] Review **AWS WAF** rules — ensure only necessary rules are active to avoid excess request charges
- [ ] Set up a **CloudWatch Billing Alarm** to alert when monthly spend exceeds a threshold (e.g. $20)
