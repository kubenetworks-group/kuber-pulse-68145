# MicroK8s Installation Guide (Ubuntu)

## Overview
This guide explains how to install and configure MicroK8s on Ubuntu.

MicroK8s is a lightweight Kubernetes distribution maintained by Canonical and ideal for:
- Development environments
- Labs
- Edge computing
- On-premises clusters
- Small production environments

---

# Requirements

- Ubuntu 20.04+ recommended
- sudo privileges
- Internet access
- Minimum:
  - 2 CPU
  - 4GB RAM
  - 20GB disk

---

# 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

# 2. Install Snapd

Verify if snap exists:

```bash
snap version
```

If not installed:

```bash
sudo apt install snapd -y
```

---

# 3. Install MicroK8s

Latest stable version:

```bash
sudo snap install microk8s --classic
```

Specific version example:

```bash
sudo snap install microk8s --classic --channel=1.30
```

---

# 4. Configure User Permissions

Add your user to the microk8s group:

```bash
sudo usermod -aG microk8s $USER
sudo chown -f -R $USER ~/.kube
```

Apply group changes:

```bash
newgrp microk8s
```

---

# 5. Validate Installation

Check cluster status:

```bash
microk8s status --wait-ready
```

Check nodes:

```bash
microk8s kubectl get nodes
```

Expected output:

```bash
NAME        STATUS   ROLES    AGE   VERSION
ubuntu      Ready    <none>   1m    v1.xx.x
```

---

# 6. Enable Essential Addons

## DNS
```bash
microk8s enable dns
```

## Storage
```bash
microk8s enable hostpath-storage
```

## Ingress
```bash
microk8s enable ingress
```

Optional useful addons:

```bash
microk8s enable metrics-server
microk8s enable dashboard
microk8s enable registry
```

---

# 7. Using kubectl

MicroK8s already includes kubectl internally:

```bash
microk8s kubectl get pods -A
```

If you want the standard kubectl command:

```bash
sudo snap install kubectl --classic

mkdir -p ~/.kube

microk8s config > ~/.kube/config
```

Test:

```bash
kubectl get nodes
```

---

# 8. Firewall Configuration (UFW)

If using UFW:

```bash
sudo ufw allow in on cni0
sudo ufw allow out on cni0

sudo ufw allow in on vxlan.calico
sudo ufw allow out on vxlan.calico
```

---

# 9. Useful Commands

## Cluster status
```bash
microk8s status
```

## Stop cluster
```bash
microk8s stop
```

## Start cluster
```bash
microk8s start
```

## Restart cluster
```bash
microk8s restart
```

## View running pods
```bash
microk8s kubectl get pods -A
```

---

# 10. Uninstall MicroK8s

```bash
sudo snap remove microk8s
```

---

# Official Documentation

- https://microk8s.io/docs

---

# Recommended Next Steps

- Install Helm
- Configure Traefik or NGINX Ingress
- Configure MetalLB
- Create persistent storage
- Configure CI/CD pipelines
- Configure monitoring with Prometheus + Grafana

---