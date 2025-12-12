# Kodo Agent Deployment Guide

This guide explains how to deploy the Kodo agent to your Kubernetes cluster.

## Security Notice

⚠️ **IMPORTANT**: Never commit actual API keys or cluster IDs to version control!

The `deployment.yaml` file contains template placeholders that must be replaced with your actual credentials during deployment.

## Prerequisites

- Access to a Kubernetes cluster
- `kubectl` configured to communicate with your cluster
- Kodo API key (generated from the Agents page in the Kodo dashboard)
- Your cluster ID (found in the Kodo dashboard)

## Deployment Steps

### Option 1: Manual Deployment (Recommended for first-time setup)

1. **Generate API Key**:
   - Go to your Kodo dashboard → Agents page
   - Click "Generate New API Key"
   - Copy the generated key (starts with `kp_`)

2. **Get Cluster ID**:
   - Find your cluster in the Kodo dashboard
   - Copy the cluster ID (UUID format)

3. **Update the Secret**:
   ```bash
   # Method A: Using the update-secret.sh script (recommended)
   cd agent
   ./scripts/update-secret.sh <YOUR_API_KEY> <YOUR_CLUSTER_ID>
   
   # Method B: Manual kubectl command
   kubectl create secret generic kodo-secret \
     --from-literal=API_KEY=<YOUR_API_KEY> \
     --from-literal=CLUSTER_ID=<YOUR_CLUSTER_ID> \
     -n kodo
   ```

4. **Deploy the Agent**:
   ```bash
   # Using the deploy script
   ./scripts/deploy.sh
   
   # Or manually
   kubectl apply -f kubernetes/deployment.yaml
   ```

### Option 2: Automated Deployment with Environment Variables

For CI/CD pipelines, use environment variables:

```bash
export KODO_API_KEY="your_api_key_here"
export KODO_CLUSTER_ID="your_cluster_id_here"

# Replace placeholders in deployment.yaml
sed "s/<REPLACE_WITH_YOUR_API_KEY>/$KODO_API_KEY/g" deployment.yaml | \
sed "s/<REPLACE_WITH_YOUR_CLUSTER_ID>/$KODO_CLUSTER_ID/g" | \
kubectl apply -f -
```

## Verifying the Deployment

Check if the agent is running:

```bash
# Check pod status
kubectl get pods -n kodo

# View agent logs
kubectl logs -n kodo -l app=kodo-agent --tail=50 -f
```

You should see logs indicating successful connection:
```
🔧 API Key configured: XX characters
🔧 Cluster ID: xxxxx-xxxxx-xxxxx
✅ Metrics sent successfully
```

## Updating Credentials

If you need to rotate your API key:

1. Generate a new API key from the dashboard
2. Run the update script:
   ```bash
   ./scripts/update-secret.sh <NEW_API_KEY> <CLUSTER_ID>
   ```

The agent deployment will automatically restart with the new credentials.

## Security Best Practices

1. **Never commit secrets to Git**:
   - The deployment.yaml file should only contain placeholders
   - Use Kubernetes secrets or external secret management

2. **Use Sealed Secrets for Production**:
   ```bash
   # Install Sealed Secrets controller
   kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml
   
   # Create sealed secret
   kubeseal --format=yaml < secret.yaml > sealed-secret.yaml
   ```

3. **Rotate API keys regularly**:
   - Set up a key rotation schedule (e.g., every 90 days)
   - Revoke old keys after successful rotation

4. **Monitor agent activity**:
   - Check logs regularly for authentication errors
   - Monitor rate limit warnings
   - Set up alerts for failed authentication attempts

## Troubleshooting

### Agent can't authenticate

```bash
# Check if secret exists
kubectl get secret kodo-secret -n kodo

# Verify secret contents (keys only, not values)
kubectl describe secret kodo-secret -n kodo
```

### Connection issues

```bash
# Check network policies
kubectl get networkpolicies -n kodo

# Test connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -v https://dadaeduevxyvkhjmwlel.supabase.co/functions/v1/agent-receive-metrics
```

### Rate limiting errors

If you see "Rate limit exceeded" errors:
- Default limits: 4 requests/minute for metrics
- Increase `COLLECT_INTERVAL` in ConfigMap if needed
- Contact support if you need higher limits

## Support

For issues or questions:
- Check the [Kodo documentation](https://docs.kodo.io)
- Open an issue on GitHub
- Contact support@kodo.io