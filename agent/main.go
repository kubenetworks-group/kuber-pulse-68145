package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
)

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
type AgentConfig struct {
	APIEndpoint string
	APIKey      string
	ClusterID   string
	Interval    int
}

func loadConfig() AgentConfig {
	return AgentConfig{
		APIEndpoint: os.Getenv("API_ENDPOINT"),
		APIKey:      os.Getenv("API_KEY"),
		ClusterID:   os.Getenv("CLUSTER_ID"),
		Interval:    15,
	}
}

// ---------------------------------------------
// MAIN
// ---------------------------------------------
func main() {
	log.Println("🚀 Kuberpulse Agent starting...")

	config := loadConfig()

	// Connect to Kubernetes
	kubeconfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("❌ Failed to load Kubernetes config: %v", err)
	}

	clientset, err := kubernetes.NewForConfig(kubeconfig)
	if err != nil {
		log.Fatalf("❌ Failed to create Kubernetes client: %v", err)
	}

	// Create metrics client with insecure TLS (common for local clusters)
	metricsConfig := *kubeconfig
	metricsConfig.TLSClientConfig.Insecure = true
	metricsConfig.TLSClientConfig.CAData = nil
	metricsConfig.TLSClientConfig.CAFile = ""
	
	metricsClient, err := metricsv.NewForConfig(&metricsConfig)
	if err != nil {
		log.Printf("⚠️  Failed to create Metrics client: %v", err)
		log.Println("⚠️  Metrics API not available - will use capacity values")
		metricsClient = nil
	} else {
		log.Println("✅ Metrics Server client created (TLS verification disabled for local clusters)")
	}

	log.Println("✅ Connected to Kubernetes cluster")
	log.Printf("📡 Sending metrics every %ds", config.Interval)
	log.Printf("🔧 API Endpoint: %s", config.APIEndpoint)
	log.Printf("🔧 Cluster ID: %s", config.ClusterID)
	log.Printf("🔧 API Key: %s...%s", config.APIKey[:8], config.APIKey[len(config.APIKey)-4:])

	ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)

	for {
		select {
		case <-ticker.C:
			sendMetrics(clientset, metricsClient, config)
			getCommands(clientset, config)
		}
	}
}

// ---------------------------------------------
// POD DETAILS COLLECTION
// ---------------------------------------------
func collectPodDetails(clientset *kubernetes.Clientset) []map[string]interface{} {
	pods, _ := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})

	var podDetails []map[string]interface{}

	for _, pod := range pods.Items {
		totalRestarts := int32(0)
		var containerStatuses []map[string]interface{}

		for _, cs := range pod.Status.ContainerStatuses {
			totalRestarts += cs.RestartCount
			containerStatuses = append(containerStatuses, map[string]interface{}{
				"name":          cs.Name,
				"ready":         cs.Ready,
				"restart_count": cs.RestartCount,
				"state":         getContainerState(cs.State),
				"last_state":    getContainerState(cs.LastTerminationState),
			})
		}

		podDetails = append(podDetails, map[string]interface{}{
			"name":           pod.Name,
			"namespace":      pod.Namespace,
			"phase":          string(pod.Status.Phase),
			"total_restarts": totalRestarts,
			"ready":          isPodReady(pod),
			"containers":     containerStatuses,
			"node":           pod.Spec.NodeName,
			"created_at":     pod.CreationTimestamp.Time,
			"conditions":     getPodConditions(pod),
		})
	}

	return podDetails
}

func getContainerState(state corev1.ContainerState) map[string]interface{} {
	if state.Running != nil {
		return map[string]interface{}{
			"status":     "running",
			"started_at": state.Running.StartedAt.Time,
		}
	}
	if state.Waiting != nil {
		return map[string]interface{}{
			"status":  "waiting",
			"reason":  state.Waiting.Reason,
			"message": state.Waiting.Message,
		}
	}
	if state.Terminated != nil {
		return map[string]interface{}{
			"status":      "terminated",
			"reason":      state.Terminated.Reason,
			"message":     state.Terminated.Message,
			"exit_code":   state.Terminated.ExitCode,
			"finished_at": state.Terminated.FinishedAt.Time,
		}
	}
	return map[string]interface{}{"status": "unknown"}
}

func isPodReady(pod corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady {
			return condition.Status == corev1.ConditionTrue
		}
	}
	return false
}

func getPodConditions(pod corev1.Pod) []map[string]interface{} {
	var conditions []map[string]interface{}
	for _, c := range pod.Status.Conditions {
		conditions = append(conditions, map[string]interface{}{
			"type":    string(c.Type),
			"status":  string(c.Status),
			"reason":  c.Reason,
			"message": c.Message,
		})
	}
	return conditions
}

// ---------------------------------------------
// KUBERNETES EVENTS COLLECTION
// ---------------------------------------------
func collectKubernetesEvents(clientset *kubernetes.Clientset) []map[string]interface{} {
	// Get events from the last 30 minutes
	events, _ := clientset.CoreV1().Events("").List(context.Background(), metav1.ListOptions{})

	var eventDetails []map[string]interface{}
	thirtyMinutesAgo := time.Now().Add(-30 * time.Minute)

	for _, event := range events.Items {
		// Only include recent events
		if event.LastTimestamp.Time.Before(thirtyMinutesAgo) {
			continue
		}

		eventDetails = append(eventDetails, map[string]interface{}{
			"type":    event.Type, // Normal or Warning
			"reason":  event.Reason,
			"message": event.Message,
			"involved_object": map[string]interface{}{
				"kind":      event.InvolvedObject.Kind,
				"name":      event.InvolvedObject.Name,
				"namespace": event.InvolvedObject.Namespace,
			},
			"count":      event.Count,
			"first_time": event.FirstTimestamp.Time,
			"last_time":  event.LastTimestamp.Time,
			"source":     event.Source.Component,
		})
	}

	return eventDetails
}

// ---------------------------------------------
// PVC COLLECTION
// ---------------------------------------------
func collectPVCs(clientset *kubernetes.Clientset) []map[string]interface{} {
	pvcs, err := clientset.CoreV1().PersistentVolumeClaims("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error collecting PVCs: %v", err)
		return []map[string]interface{}{}
	}

	// Get PVs to match with PVCs
	pvs, err := clientset.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Warning: Could not fetch PVs: %v", err)
	}

	// Create a map of PV name to PV for quick lookup
	pvMap := make(map[string]corev1.PersistentVolume)
	boundPVs := make(map[string]bool) // Track which PVs are bound
	if pvs != nil {
		for _, pv := range pvs.Items {
			pvMap[pv.Name] = pv
		}
	}

	var pvcDetails []map[string]interface{}

	for _, pvc := range pvcs.Items {
		requestedBytes := int64(0)
		if pvc.Spec.Resources.Requests != nil {
			if storage, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
				requestedBytes = storage.Value()
			}
		}

		usedBytes := int64(0)
		actualCapacity := int64(0)
		
		// Get actual capacity from the bound PV
		if pvc.Spec.VolumeName != "" {
			if pv, exists := pvMap[pvc.Spec.VolumeName]; exists {
				if capacity, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
					actualCapacity = capacity.Value()
				}
			}
		}

		// Use PVC status capacity if available
		if pvc.Status.Capacity != nil {
			if storage, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
				usedBytes = storage.Value()
			}
		}

		// If we have actual capacity from PV and no used bytes, use it
		if actualCapacity > 0 && usedBytes == 0 {
			usedBytes = actualCapacity
		}

		storageClassName := ""
		if pvc.Spec.StorageClassName != nil {
			storageClassName = *pvc.Spec.StorageClassName
		}

		pvcDetails = append(pvcDetails, map[string]interface{}{
			"name":            pvc.Name,
			"namespace":       pvc.Namespace,
			"storage_class":   storageClassName,
			"status":          string(pvc.Status.Phase),
			"requested_bytes": requestedBytes,
			"used_bytes":      usedBytes,
			"volume_name":     pvc.Spec.VolumeName,
			"created_at":      pvc.CreationTimestamp.Time,
		})
		
		// Mark PV as bound
		if pvc.Spec.VolumeName != "" {
			boundPVs[pvc.Spec.VolumeName] = true
		}
	}

	log.Printf("📦 Collected %d PVCs (matched with %d PVs)", len(pvcDetails), len(pvMap))
	return pvcDetails
}

// ---------------------------------------------
// STANDALONE PV COLLECTION (Released, Available, Failed)
// ---------------------------------------------
func collectStandalonePVs(clientset *kubernetes.Clientset) []map[string]interface{} {
	pvs, err := clientset.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error collecting PVs: %v", err)
		return []map[string]interface{}{}
	}

	var pvDetails []map[string]interface{}

	for _, pv := range pvs.Items {
		// Only collect Released, Available, or Failed PVs
		status := string(pv.Status.Phase)
		if status != "Released" && status != "Available" && status != "Failed" {
			continue
		}

		capacityBytes := int64(0)
		if capacity, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
			capacityBytes = capacity.Value()
		}

		storageClassName := ""
		if pv.Spec.StorageClassName != "" {
			storageClassName = pv.Spec.StorageClassName
		}

		reclaimPolicy := ""
		if pv.Spec.PersistentVolumeReclaimPolicy != "" {
			reclaimPolicy = string(pv.Spec.PersistentVolumeReclaimPolicy)
		}

		accessModes := []string{}
		for _, mode := range pv.Spec.AccessModes {
			accessModes = append(accessModes, string(mode))
		}

		volumeMode := ""
		if pv.Spec.VolumeMode != nil {
			volumeMode = string(*pv.Spec.VolumeMode)
		}

		claimRefNamespace := ""
		claimRefName := ""
		if pv.Spec.ClaimRef != nil {
			claimRefNamespace = pv.Spec.ClaimRef.Namespace
			claimRefName = pv.Spec.ClaimRef.Name
		}

		pvDetails = append(pvDetails, map[string]interface{}{
			"name":                 pv.Name,
			"status":               status,
			"capacity_bytes":       capacityBytes,
			"storage_class":        storageClassName,
			"reclaim_policy":       reclaimPolicy,
			"access_modes":         accessModes,
			"volume_mode":          volumeMode,
			"claim_ref_namespace":  claimRefNamespace,
			"claim_ref_name":       claimRefName,
			"created_at":           pv.CreationTimestamp.Time,
		})
	}

	log.Printf("🔓 Collected %d standalone PVs (Released/Available/Failed)", len(pvDetails))
	return pvDetails
}

// ---------------------------------------------
// STORAGE METRICS COLLECTION (from Persistent Volumes)
// ---------------------------------------------
func collectStorageMetrics(clientset *kubernetes.Clientset) map[string]interface{} {
	pvs, err := clientset.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error collecting storage metrics from PVs: %v", err)
		return map[string]interface{}{
			"total_bytes":       int64(0),
			"allocatable_bytes": int64(0),
		}
	}

	var totalStorage int64

	for _, pv := range pvs.Items {
		if storage, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
			totalStorage += storage.Value()
		}
	}

	log.Printf("💾 Storage metrics (PVs): total=%.2fGB",
		float64(totalStorage)/(1024*1024*1024))

	return map[string]interface{}{
		"total_bytes":       totalStorage,
		"allocatable_bytes": totalStorage, // For PVs, allocatable is the same as total
	}
}

// ---------------------------------------------
// NODE STORAGE METRICS COLLECTION (Physical disk from nodes)
// ---------------------------------------------
func collectNodeStorageMetrics(clientset *kubernetes.Clientset) map[string]interface{} {
	nodes, err := clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error collecting node storage: %v", err)
		return map[string]interface{}{
			"total_physical_bytes":     int64(0),
			"used_physical_bytes":      int64(0),
			"available_physical_bytes": int64(0),
			"nodes":                    []map[string]interface{}{},
		}
	}

	var totalPhysicalStorage int64
	var allocatableStorage int64
	var nodeStorageDetails []map[string]interface{}

	for _, node := range nodes.Items {
		// Get ephemeral-storage capacity (physical disk)
		storageCapacity := int64(0)
		storageAllocatable := int64(0)

		if ephemeralStorage, ok := node.Status.Capacity[corev1.ResourceEphemeralStorage]; ok {
			storageCapacity = ephemeralStorage.Value()
		}
		if ephemeralStorage, ok := node.Status.Allocatable[corev1.ResourceEphemeralStorage]; ok {
			storageAllocatable = ephemeralStorage.Value()
		}

		totalPhysicalStorage += storageCapacity
		allocatableStorage += storageAllocatable

		// Usado = Capacity - Allocatable (sistema + reservado)
		usedBySystem := storageCapacity - storageAllocatable

		nodeStorageDetails = append(nodeStorageDetails, map[string]interface{}{
			"node_name":        node.Name,
			"capacity_bytes":   storageCapacity,
			"allocatable_bytes": storageAllocatable,
			"used_bytes":       usedBySystem,
		})
	}

	// Storage usado pelo sistema = total - allocatable
	usedPhysicalStorage := totalPhysicalStorage - allocatableStorage

	log.Printf("💿 Node physical storage: total=%.2fGB, used=%.2fGB, available=%.2fGB across %d nodes",
		float64(totalPhysicalStorage)/(1024*1024*1024),
		float64(usedPhysicalStorage)/(1024*1024*1024),
		float64(allocatableStorage)/(1024*1024*1024),
		len(nodes.Items))

	return map[string]interface{}{
		"total_physical_bytes":     totalPhysicalStorage,
		"used_physical_bytes":      usedPhysicalStorage,
		"available_physical_bytes": allocatableStorage,
		"nodes":                    nodeStorageDetails,
	}
}

// ---------------------------------------------
// SECURITY DATA COLLECTION
// ---------------------------------------------
func collectSecurityData(clientset *kubernetes.Clientset) map[string]interface{} {
	ctx := context.Background()
	securityData := map[string]interface{}{
		"rbac":               map[string]interface{}{},
		"network_policies":   map[string]interface{}{},
		"secrets":            map[string]interface{}{},
		"resource_quotas":    map[string]interface{}{},
		"limit_ranges":       map[string]interface{}{},
		"pod_security":       map[string]interface{}{},
		"ingress_controller": map[string]interface{}{},
	}

	// 1. Collect RBAC data (ClusterRoles, ClusterRoleBindings, Roles, RoleBindings)
	log.Printf("🔍 Collecting RBAC data...")
	clusterRolesCount := 0
	clusterRoleBindingsCount := 0
	
	clusterRoles, err := clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing ClusterRoles: %v", err)
	} else {
		clusterRolesCount = len(clusterRoles.Items)
		var roleNames []string
		for _, cr := range clusterRoles.Items {
			roleNames = append(roleNames, cr.Name)
		}
		securityData["rbac"].(map[string]interface{})["cluster_roles_count"] = clusterRolesCount
		securityData["rbac"].(map[string]interface{})["cluster_roles"] = roleNames
		log.Printf("✅ Found %d ClusterRoles", clusterRolesCount)
	}

	clusterRoleBindings, err := clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing ClusterRoleBindings: %v", err)
	} else {
		clusterRoleBindingsCount = len(clusterRoleBindings.Items)
		securityData["rbac"].(map[string]interface{})["cluster_role_bindings_count"] = clusterRoleBindingsCount
		log.Printf("✅ Found %d ClusterRoleBindings", clusterRoleBindingsCount)
	}

	// Count roles and rolebindings across namespaces
	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing Namespaces: %v", err)
		namespaces = &corev1.NamespaceList{}
	} else {
		log.Printf("✅ Found %d namespaces to scan", len(namespaces.Items))
	}
	
	totalRoles := 0
	totalRoleBindings := 0
	for _, ns := range namespaces.Items {
		roles, err := clientset.RbacV1().Roles(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing Roles in namespace %s: %v", ns.Name, err)
		} else {
			totalRoles += len(roles.Items)
		}
		roleBindings, err := clientset.RbacV1().RoleBindings(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing RoleBindings in namespace %s: %v", ns.Name, err)
		} else {
			totalRoleBindings += len(roleBindings.Items)
		}
	}
	log.Printf("📊 RBAC scan complete: %d Roles, %d RoleBindings across all namespaces", totalRoles, totalRoleBindings)
	
	securityData["rbac"].(map[string]interface{})["roles_count"] = totalRoles
	securityData["rbac"].(map[string]interface{})["role_bindings_count"] = totalRoleBindings
	securityData["rbac"].(map[string]interface{})["has_rbac"] = (clusterRolesCount > 0 || totalRoles > 0)

	// 2. Collect NetworkPolicies - iterate through ALL namespaces
	totalNetworkPolicies := 0
	namespacesWithPolicies := 0
	networkPolicyDetails := []map[string]interface{}{}
	
	log.Printf("🔍 Scanning NetworkPolicies in %d namespaces...", len(namespaces.Items))
	for _, ns := range namespaces.Items {
		netPolicies, err := clientset.NetworkingV1().NetworkPolicies(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing NetworkPolicies in namespace %s: %v", ns.Name, err)
			continue
		}
		if len(netPolicies.Items) > 0 {
			totalNetworkPolicies += len(netPolicies.Items)
			namespacesWithPolicies++
			// Store details for each namespace with policies
			for _, np := range netPolicies.Items {
				networkPolicyDetails = append(networkPolicyDetails, map[string]interface{}{
					"name":      np.Name,
					"namespace": np.Namespace,
				})
			}
			log.Printf("✅ Found %d NetworkPolicies in namespace: %s", len(netPolicies.Items), ns.Name)
		}
	}
	log.Printf("📊 NetworkPolicies scan complete: found %d policies in %d namespaces", totalNetworkPolicies, namespacesWithPolicies)
	
	securityData["network_policies"].(map[string]interface{})["total_count"] = totalNetworkPolicies
	securityData["network_policies"].(map[string]interface{})["namespaces_with_policies"] = namespacesWithPolicies
	securityData["network_policies"].(map[string]interface{})["has_network_policies"] = totalNetworkPolicies > 0
	securityData["network_policies"].(map[string]interface{})["policies"] = networkPolicyDetails

	// 3. Collect Secrets info (count only, not content)
	log.Printf("🔍 Collecting Secrets data...")
	totalSecrets := 0
	secretTypes := make(map[string]int)
	for _, ns := range namespaces.Items {
		secrets, err := clientset.CoreV1().Secrets(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing Secrets in namespace %s: %v", ns.Name, err)
			continue
		}
		totalSecrets += len(secrets.Items)
		for _, s := range secrets.Items {
			secretTypes[string(s.Type)]++
		}
	}
	log.Printf("📊 Secrets scan complete: found %d secrets", totalSecrets)
	securityData["secrets"].(map[string]interface{})["total_count"] = totalSecrets
	securityData["secrets"].(map[string]interface{})["types"] = secretTypes
	securityData["secrets"].(map[string]interface{})["has_secrets"] = totalSecrets > 0

	// 4. Collect ResourceQuotas
	log.Printf("🔍 Collecting ResourceQuotas...")
	totalQuotas := 0
	for _, ns := range namespaces.Items {
		quotas, err := clientset.CoreV1().ResourceQuotas(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing ResourceQuotas in namespace %s: %v", ns.Name, err)
			continue
		}
		totalQuotas += len(quotas.Items)
	}
	log.Printf("📊 ResourceQuotas scan complete: found %d quotas", totalQuotas)
	securityData["resource_quotas"].(map[string]interface{})["total_count"] = totalQuotas
	securityData["resource_quotas"].(map[string]interface{})["has_quotas"] = totalQuotas > 0

	// 5. Collect LimitRanges
	totalLimitRanges := 0
	for _, ns := range namespaces.Items {
		limitRanges, err := clientset.CoreV1().LimitRanges(ns.Name).List(ctx, metav1.ListOptions{})
		if err == nil {
			totalLimitRanges += len(limitRanges.Items)
		}
	}
	securityData["limit_ranges"].(map[string]interface{})["total_count"] = totalLimitRanges
	securityData["limit_ranges"].(map[string]interface{})["has_limit_ranges"] = totalLimitRanges > 0

	// 6. Analyze Pod Security (containers running as root, privileged, etc.)
	pods, _ := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	podsWithSecurityContext := 0
	podsRunningAsNonRoot := 0
	podsWithResourceLimits := 0
	privilegedContainers := 0

	for _, pod := range pods.Items {
		hasSecurityContext := false
		isNonRoot := false
		hasLimits := false

		// Check pod-level security context
		if pod.Spec.SecurityContext != nil {
			hasSecurityContext = true
			if pod.Spec.SecurityContext.RunAsNonRoot != nil && *pod.Spec.SecurityContext.RunAsNonRoot {
				isNonRoot = true
			}
		}

		// Check container-level settings
		for _, container := range pod.Spec.Containers {
			if container.SecurityContext != nil {
				hasSecurityContext = true
				if container.SecurityContext.Privileged != nil && *container.SecurityContext.Privileged {
					privilegedContainers++
				}
				if container.SecurityContext.RunAsNonRoot != nil && *container.SecurityContext.RunAsNonRoot {
					isNonRoot = true
				}
			}
			if container.Resources.Limits != nil && len(container.Resources.Limits) > 0 {
				hasLimits = true
			}
		}

		if hasSecurityContext {
			podsWithSecurityContext++
		}
		if isNonRoot {
			podsRunningAsNonRoot++
		}
		if hasLimits {
			podsWithResourceLimits++
		}
	}

	totalPods := len(pods.Items)
	securityData["pod_security"].(map[string]interface{})["total_pods"] = totalPods
	securityData["pod_security"].(map[string]interface{})["pods_with_security_context"] = podsWithSecurityContext
	securityData["pod_security"].(map[string]interface{})["pods_running_as_non_root"] = podsRunningAsNonRoot
	securityData["pod_security"].(map[string]interface{})["pods_with_resource_limits"] = podsWithResourceLimits
	securityData["pod_security"].(map[string]interface{})["privileged_containers"] = privilegedContainers
	securityData["pod_security"].(map[string]interface{})["has_pod_security"] = podsWithSecurityContext > 0

	// Calculate percentages
	if totalPods > 0 {
		securityData["pod_security"].(map[string]interface{})["security_context_percentage"] = float64(podsWithSecurityContext) / float64(totalPods) * 100
		securityData["pod_security"].(map[string]interface{})["resource_limits_percentage"] = float64(podsWithResourceLimits) / float64(totalPods) * 100
	}

	// 7. Detect Ingress Controller and verify its RBAC
	log.Printf("🔍 Detecting Ingress Controller...")
	ingressControllerInfo := detectIngressController(clientset, ctx)
	securityData["ingress_controller"] = ingressControllerInfo

	log.Printf("🔒 Security data collected: RBAC=%v, NetworkPolicies=%d, Secrets=%d, Quotas=%d, LimitRanges=%d, PodsWithLimits=%d/%d, IngressController=%s",
		securityData["rbac"].(map[string]interface{})["has_rbac"],
		totalNetworkPolicies,
		totalSecrets,
		totalQuotas,
		totalLimitRanges,
		podsWithResourceLimits,
		totalPods,
		ingressControllerInfo["type"])

	return securityData
}

// detectIngressController identifies the ingress controller type and checks its RBAC configuration
func detectIngressController(clientset *kubernetes.Clientset, ctx context.Context) map[string]interface{} {
	result := map[string]interface{}{
		"type":             "unknown",
		"detected":         false,
		"namespace":        "",
		"has_rbac":         false,
		"rbac_details":     map[string]interface{}{},
		"deployment_name":  "",
		"service_account":  "",
		"version":          "",
	}

	// Common ingress controller identifiers
	ingressControllers := []struct {
		name           string
		labelSelectors []string
		namespaces     []string
	}{
		{
			name:           "nginx",
			labelSelectors: []string{"app.kubernetes.io/name=ingress-nginx", "app=ingress-nginx", "app.kubernetes.io/component=controller"},
			namespaces:     []string{"ingress-nginx", "nginx-ingress", "kube-system"},
		},
		{
			name:           "traefik",
			labelSelectors: []string{"app.kubernetes.io/name=traefik", "app=traefik"},
			namespaces:     []string{"traefik", "traefik-system", "kube-system"},
		},
		{
			name:           "haproxy",
			labelSelectors: []string{"app.kubernetes.io/name=haproxy-ingress", "app=haproxy-ingress"},
			namespaces:     []string{"haproxy-controller", "kube-system"},
		},
		{
			name:           "kong",
			labelSelectors: []string{"app.kubernetes.io/name=kong", "app=kong"},
			namespaces:     []string{"kong", "kong-system", "kube-system"},
		},
		{
			name:           "istio",
			labelSelectors: []string{"app=istiod", "istio=ingressgateway"},
			namespaces:     []string{"istio-system", "istio-ingress"},
		},
		{
			name:           "contour",
			labelSelectors: []string{"app.kubernetes.io/name=contour", "app=contour"},
			namespaces:     []string{"projectcontour", "contour", "kube-system"},
		},
	}

	// Check each ingress controller type
	for _, ic := range ingressControllers {
		for _, ns := range ic.namespaces {
			for _, labelSelector := range ic.labelSelectors {
				// Check for Deployments
				deployments, err := clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil && len(deployments.Items) > 0 {
					deploy := deployments.Items[0]
					result["type"] = ic.name
					result["detected"] = true
					result["namespace"] = ns
					result["deployment_name"] = deploy.Name
					
					// Get service account
					if deploy.Spec.Template.Spec.ServiceAccountName != "" {
						result["service_account"] = deploy.Spec.Template.Spec.ServiceAccountName
					}
					
					// Try to get version from container image
					if len(deploy.Spec.Template.Spec.Containers) > 0 {
						image := deploy.Spec.Template.Spec.Containers[0].Image
						result["version"] = image
					}
					
					log.Printf("✅ Detected %s ingress controller in namespace %s (deployment: %s)", ic.name, ns, deploy.Name)
					
					// Check RBAC for this ingress controller
					rbacDetails := checkIngressControllerRBAC(clientset, ctx, ns, result["service_account"].(string), ic.name)
					result["has_rbac"] = rbacDetails["has_proper_rbac"]
					result["rbac_details"] = rbacDetails
					
					return result
				}
				
				// Also check DaemonSets (some controllers use DaemonSets)
				daemonsets, err := clientset.AppsV1().DaemonSets(ns).List(ctx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil && len(daemonsets.Items) > 0 {
					ds := daemonsets.Items[0]
					result["type"] = ic.name
					result["detected"] = true
					result["namespace"] = ns
					result["deployment_name"] = ds.Name + " (DaemonSet)"
					
					if ds.Spec.Template.Spec.ServiceAccountName != "" {
						result["service_account"] = ds.Spec.Template.Spec.ServiceAccountName
					}
					
					if len(ds.Spec.Template.Spec.Containers) > 0 {
						image := ds.Spec.Template.Spec.Containers[0].Image
						result["version"] = image
					}
					
					log.Printf("✅ Detected %s ingress controller (DaemonSet) in namespace %s", ic.name, ns)
					
					rbacDetails := checkIngressControllerRBAC(clientset, ctx, ns, result["service_account"].(string), ic.name)
					result["has_rbac"] = rbacDetails["has_proper_rbac"]
					result["rbac_details"] = rbacDetails
					
					return result
				}
			}
		}
	}

	// Check IngressClass resources as a fallback
	ingressClasses, err := clientset.NetworkingV1().IngressClasses().List(ctx, metav1.ListOptions{})
	if err == nil && len(ingressClasses.Items) > 0 {
		for _, ic := range ingressClasses.Items {
			controllerName := ic.Spec.Controller
			log.Printf("📋 Found IngressClass: %s with controller: %s", ic.Name, controllerName)
			
			// Detect type from controller name
			if strings.Contains(controllerName, "nginx") {
				result["type"] = "nginx"
			} else if strings.Contains(controllerName, "traefik") {
				result["type"] = "traefik"
			} else if strings.Contains(controllerName, "haproxy") {
				result["type"] = "haproxy"
			} else if strings.Contains(controllerName, "kong") {
				result["type"] = "kong"
			} else if strings.Contains(controllerName, "istio") {
				result["type"] = "istio"
			} else if strings.Contains(controllerName, "contour") {
				result["type"] = "contour"
			} else {
				result["type"] = controllerName
			}
			result["detected"] = true
			result["deployment_name"] = ic.Name + " (IngressClass)"
			break
		}
	}

	if !result["detected"].(bool) {
		log.Printf("⚠️ No ingress controller detected")
	}

	return result
}

// checkIngressControllerRBAC verifies RBAC configuration for the ingress controller
func checkIngressControllerRBAC(clientset *kubernetes.Clientset, ctx context.Context, namespace, serviceAccount, controllerType string) map[string]interface{} {
	rbacDetails := map[string]interface{}{
		"has_proper_rbac":         false,
		"cluster_role":            "",
		"cluster_role_binding":    "",
		"role":                    "",
		"role_binding":            "",
		"missing_permissions":     []string{},
		"warnings":                []string{},
	}

	if serviceAccount == "" {
		rbacDetails["warnings"] = append(rbacDetails["warnings"].([]string), "No service account specified")
		return rbacDetails
	}

	// Check ClusterRoleBindings for this service account
	clusterRoleBindings, err := clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️ Error listing ClusterRoleBindings: %v", err)
		return rbacDetails
	}

	foundClusterRoleBinding := false
	for _, crb := range clusterRoleBindings.Items {
		for _, subject := range crb.Subjects {
			if subject.Kind == "ServiceAccount" && subject.Name == serviceAccount && subject.Namespace == namespace {
				foundClusterRoleBinding = true
				rbacDetails["cluster_role_binding"] = crb.Name
				rbacDetails["cluster_role"] = crb.RoleRef.Name
				
				// Verify the ClusterRole has required permissions
				clusterRole, err := clientset.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
				if err == nil {
					missingPerms := checkRequiredPermissions(clusterRole.Rules, controllerType)
					rbacDetails["missing_permissions"] = missingPerms
					if len(missingPerms) == 0 {
						rbacDetails["has_proper_rbac"] = true
					}
				}
				break
			}
		}
		if foundClusterRoleBinding {
			break
		}
	}

	// Check namespace-scoped RoleBindings as well
	roleBindings, err := clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, rb := range roleBindings.Items {
			for _, subject := range rb.Subjects {
				if subject.Kind == "ServiceAccount" && subject.Name == serviceAccount {
					rbacDetails["role_binding"] = rb.Name
					rbacDetails["role"] = rb.RoleRef.Name
					break
				}
			}
		}
	}

	if !foundClusterRoleBinding {
		rbacDetails["warnings"] = append(rbacDetails["warnings"].([]string), "No ClusterRoleBinding found for ingress controller service account")
	}

	log.Printf("📋 RBAC check for %s controller (SA: %s): has_proper_rbac=%v", controllerType, serviceAccount, rbacDetails["has_proper_rbac"])

	return rbacDetails
}

// checkRequiredPermissions verifies that the RBAC rules contain required permissions for the ingress controller
func checkRequiredPermissions(rules []rbacv1.PolicyRule, controllerType string) []string {
	missing := []string{}
	
	// Common required permissions for ingress controllers
	requiredResources := map[string][]string{
		"": {"services", "endpoints", "secrets", "configmaps", "pods"},
		"networking.k8s.io": {"ingresses", "ingressclasses"},
		"coordination.k8s.io": {"leases"},
	}
	
	// Check each required resource
	for apiGroup, resources := range requiredResources {
		for _, resource := range resources {
			found := false
			for _, rule := range rules {
				for _, rg := range rule.APIGroups {
					if rg == apiGroup || rg == "*" {
						for _, r := range rule.Resources {
							if r == resource || r == "*" {
								// Check if has at least get/list/watch
								hasRead := false
								for _, verb := range rule.Verbs {
									if verb == "get" || verb == "list" || verb == "watch" || verb == "*" {
										hasRead = true
										break
									}
								}
								if hasRead {
									found = true
								}
								break
							}
						}
					}
					if found {
						break
					}
				}
				if found {
					break
				}
			}
			if !found {
				if apiGroup == "" {
					missing = append(missing, resource)
				} else {
					missing = append(missing, apiGroup+"/"+resource)
				}
			}
		}
	}
	
	return missing
}

// ---------------------------------------------
// HELPER: Calcula recursos dos pods em um node (fallback)
// ---------------------------------------------
func getPodResourcesOnNode(pods []corev1.Pod, nodeName string) (cpuMillis int64, memBytes int64) {
	for _, pod := range pods {
		if pod.Spec.NodeName != nodeName || pod.Status.Phase != corev1.PodRunning {
			continue
		}
		for _, container := range pod.Spec.Containers {
			// Usar requests como aproximação do uso
			if cpu, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
				cpuMillis += cpu.MilliValue()
			}
			if mem, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
				memBytes += mem.Value()
			}
		}
	}
	return cpuMillis, memBytes
}

// ---------------------------------------------
// MÉTRICAS
// ---------------------------------------------
func sendMetrics(clientset *kubernetes.Clientset, metricsClient *metricsv.Clientset, config AgentConfig) {
	log.Println("📊 Collecting metrics...")

	nodes, _ := clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	pods, _ := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})

	// Calcular métricas agregadas
	var totalCPU, totalMemory, usedCPU, usedMemory int64
	runningPods := 0

	// Tentar obter métricas reais da Metrics API
	var nodeMetricsMap map[string]map[string]int64
	if metricsClient != nil {
		nodeMetricsList, err := metricsClient.MetricsV1beta1().NodeMetricses().List(context.Background(), metav1.ListOptions{})
		if err == nil {
			nodeMetricsMap = make(map[string]map[string]int64)
			for _, nm := range nodeMetricsList.Items {
				nodeMetricsMap[nm.Name] = map[string]int64{
					"cpu":    nm.Usage.Cpu().MilliValue(),
					"memory": nm.Usage.Memory().Value(),
				}
			}
			log.Printf("✅ Fetched real metrics for %d nodes from Metrics API", len(nodeMetricsMap))
		} else {
			log.Printf("⚠️  Metrics API unavailable: %v", err)
		}
	}

	for _, node := range nodes.Items {
		cpu := node.Status.Capacity.Cpu().MilliValue()
		mem := node.Status.Capacity.Memory().Value()
		totalCPU += cpu
		totalMemory += mem

		// Usar métricas reais da Metrics API se disponível
		if metrics, ok := nodeMetricsMap[node.Name]; ok {
			usedCPU += metrics["cpu"]
			usedMemory += metrics["memory"]
		} else {
			// Fallback: estimar baseado em requests dos pods no node
			nodePodsCPU, nodePodsMem := getPodResourcesOnNode(pods.Items, node.Name)
			usedCPU += nodePodsCPU
			usedMemory += nodePodsMem
		}
	}

	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			runningPods++
		}
	}

	cpuPercent := float64(0)
	if totalCPU > 0 {
		cpuPercent = float64(usedCPU) / float64(totalCPU) * 100
	}

	memoryPercent := float64(0)
	if totalMemory > 0 {
		memoryPercent = float64(usedMemory) / float64(totalMemory) * 100
	}

	// Formato esperado pela Edge Function
	metrics := []map[string]interface{}{
		{
			"type": "cpu",
			"data": map[string]interface{}{
				"usage_percent": cpuPercent,
				"total_cores":   totalCPU / 1000,
				"used_cores":    usedCPU / 1000,
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "memory",
			"data": map[string]interface{}{
				"usage_percent": memoryPercent,
				"total_bytes":   totalMemory,
				"used_bytes":    usedMemory,
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "pods",
			"data": map[string]interface{}{
				"running": runningPods,
				"total":   len(pods.Items),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "nodes",
			"data": map[string]interface{}{
				"count": len(nodes.Items),
				"nodes": extractNodeInfo(nodes.Items, metricsClient),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "pod_details",
			"data": map[string]interface{}{
				"pods": collectPodDetails(clientset),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "events",
			"data": map[string]interface{}{
				"events": collectKubernetesEvents(clientset),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "pvcs",
			"data": map[string]interface{}{
				"pvcs": collectPVCs(clientset),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "standalone_pvs",
			"data": map[string]interface{}{
				"pvs": collectStandalonePVs(clientset),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type":         "storage",
			"data":         collectStorageMetrics(clientset),
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type":         "node_storage",
			"data":         collectNodeStorageMetrics(clientset),
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type":         "security",
			"data":         collectSecurityData(clientset),
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
	}

	payload := map[string]interface{}{
		"metrics": metrics,
	}

	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("%s/agent-receive-metrics", config.APIEndpoint)
	log.Printf("🔍 Sending to: %s", url)
	log.Printf("🔍 Payload size: %d bytes", len(body))
	log.Printf("🔍 Metrics: CPU=%.2f%%, Memory=%.2f%%, Pods=%d, Nodes=%d",
		cpuPercent, memoryPercent, runningPods, len(nodes.Items))

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))

	// HEADER CORRETO: x-agent-key
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)

	log.Printf("🔍 Headers: Content-Type=application/json, x-agent-key=%s...%s",
		config.APIKey[:8], config.APIKey[len(config.APIKey)-4:])

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Error sending metrics: %v", err)
		return
	}
	defer resp.Body.Close()

	responseBody, _ := ioutil.ReadAll(resp.Body)
	log.Printf("🔍 Response status: %d", resp.StatusCode)
	log.Printf("🔍 Response body: %s", string(responseBody))

	if resp.StatusCode != 200 {
		log.Printf("❌ Failed to send metrics: %s", string(responseBody))
	} else {
		log.Println("✅ Metrics sent successfully")
	}
}

// Extrai cpu/mem com usage real da Metrics API
func extractNodeInfo(nodes []corev1.Node, metricsClient *metricsv.Clientset) []map[string]interface{} {
	var result []map[string]interface{}

	// Try to get node metrics from Metrics API
	var nodeMetricsMap map[string]map[string]int64
	if metricsClient != nil {
		nodeMetricsList, err := metricsClient.MetricsV1beta1().NodeMetricses().List(context.Background(), metav1.ListOptions{})
		if err == nil {
			nodeMetricsMap = make(map[string]map[string]int64)
			for _, nm := range nodeMetricsList.Items {
				nodeMetricsMap[nm.Name] = map[string]int64{
					"cpu":    nm.Usage.Cpu().MilliValue(),
					"memory": nm.Usage.Memory().Value(),
				}
			}
			log.Printf("✅ Fetched metrics for %d nodes from Metrics API", len(nodeMetricsMap))
		} else {
			log.Printf("⚠️  Failed to fetch node metrics: %v", err)
		}
	}

	for _, node := range nodes {
		// Capacity values
		cpuCapacity := node.Status.Capacity.Cpu().MilliValue()
		memCapacity := node.Status.Capacity.Memory().Value()

		nodeInfo := map[string]interface{}{
			"name":   node.Name,
			"status": getNodeStatus(node),
			"capacity": map[string]interface{}{
				"cpu":    cpuCapacity,
				"memory": memCapacity,
			},
		}

		// Usage values from Metrics API
		if metrics, ok := nodeMetricsMap[node.Name]; ok {
			nodeInfo["usage"] = map[string]interface{}{
				"cpu":    metrics["cpu"],
				"memory": metrics["memory"],
			}
		} else {
			// Fallback: use allocatable as approximation
			nodeInfo["usage"] = map[string]interface{}{
				"cpu":    cpuCapacity - node.Status.Allocatable.Cpu().MilliValue(),
				"memory": memCapacity - node.Status.Allocatable.Memory().Value(),
			}
		}

		// Add OS information
		if node.Status.NodeInfo.OSImage != "" {
			nodeInfo["osImage"] = node.Status.NodeInfo.OSImage
		}
		if node.Status.NodeInfo.KernelVersion != "" {
			nodeInfo["kernelVersion"] = node.Status.NodeInfo.KernelVersion
		}
		if node.Status.NodeInfo.ContainerRuntimeVersion != "" {
			nodeInfo["containerRuntime"] = node.Status.NodeInfo.ContainerRuntimeVersion
		}

		// Add node labels (useful for pool identification)
		if len(node.Labels) > 0 {
			labels := make(map[string]string)
			for k, v := range node.Labels {
				// Include relevant labels
				if k == "node.kubernetes.io/instance-type" ||
					k == "topology.kubernetes.io/zone" ||
					k == "node-role.kubernetes.io/master" ||
					k == "node-role.kubernetes.io/control-plane" ||
					k == "pool" || k == "agentpool" {
					labels[k] = v
				}
			}
			if len(labels) > 0 {
				nodeInfo["labels"] = labels
			}
		}

		result = append(result, nodeInfo)
	}
	return result
}

func getNodeStatus(node corev1.Node) string {
	for _, condition := range node.Status.Conditions {
		if condition.Type == corev1.NodeReady {
			if condition.Status == corev1.ConditionTrue {
				return "Ready"
			}
			return "NotReady"
		}
	}
	return "Unknown"
}

// ---------------------------------------------
// COMANDOS (POLLING)
// ---------------------------------------------
type Command struct {
	ID            string                 `json:"id"`
	CommandType   string                 `json:"command_type"`
	CommandParams map[string]interface{} `json:"command_params"`
}

type CommandsResponse struct {
	Commands []Command `json:"commands"`
}

func getCommands(clientset *kubernetes.Clientset, config AgentConfig) {
	url := fmt.Sprintf("%s/agent-get-commands", config.APIEndpoint)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Error polling commands: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := ioutil.ReadAll(resp.Body)
		log.Printf("⚠️  Commands request returned %d: %s", resp.StatusCode, string(body))
		return
	}

	body, _ := ioutil.ReadAll(resp.Body)

	var commandsResp CommandsResponse
	if err := json.Unmarshal(body, &commandsResp); err != nil {
		log.Printf("❌ Error parsing commands: %v", err)
		return
	}

	if len(commandsResp.Commands) > 0 {
		log.Printf("📥 Received %d commands", len(commandsResp.Commands))
		executeCommands(clientset, config, commandsResp.Commands)
	}
}

// ---------------------------------------------
// COMMAND EXECUTION
// ---------------------------------------------
func executeCommands(clientset *kubernetes.Clientset, config AgentConfig, commands []Command) {
	for _, cmd := range commands {
		log.Printf("⚡ Executing command: %s", cmd.CommandType)

		var result map[string]interface{}
		var err error

	switch cmd.CommandType {
	case "restart_pod", "delete_pod":
		result, err = deletePod(clientset, cmd.CommandParams)
	case "scale_deployment":
		result, err = scaleDeployment(clientset, cmd.CommandParams)
	case "update_deployment_image":
		result, err = updateDeploymentImage(clientset, cmd.CommandParams)
	case "update_deployment_resources":
		result, err = updateDeploymentResources(clientset, cmd.CommandParams)
	default:
		err = fmt.Errorf("unknown command type: %s", cmd.CommandType)
	}

		updateCommandStatus(config, cmd.ID, result, err)
	}
}

func deletePod(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	podName := params["pod_name"].(string)
	namespace := params["namespace"].(string)

	err := clientset.CoreV1().Pods(namespace).Delete(
		context.Background(),
		podName,
		metav1.DeleteOptions{},
	)

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"action":    "pod_deleted",
		"pod":       podName,
		"namespace": namespace,
		"message":   "Pod deleted successfully. Kubernetes will recreate it.",
	}, nil
}

func scaleDeployment(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	deploymentName := params["deployment_name"].(string)
	namespace := params["namespace"].(string)
	replicas := int32(params["replicas"].(float64))

	deployment, err := clientset.AppsV1().Deployments(namespace).Get(
		context.Background(),
		deploymentName,
		metav1.GetOptions{},
	)
	if err != nil {
		return nil, err
	}

	deployment.Spec.Replicas = &replicas

	_, err = clientset.AppsV1().Deployments(namespace).Update(
		context.Background(),
		deployment,
		metav1.UpdateOptions{},
	)

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"action":     "deployment_scaled",
		"deployment": deploymentName,
		"namespace":  namespace,
		"replicas":   replicas,
	}, nil
}

func updateDeploymentImage(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	deploymentName := params["deployment_name"].(string)
	namespace := params["namespace"].(string)
	containerName := params["container_name"].(string)
	newImage := params["new_image"].(string)

	deployment, err := clientset.AppsV1().Deployments(namespace).Get(
		context.Background(),
		deploymentName,
		metav1.GetOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment: %v", err)
	}

	// Find and update the container image
	updated := false
	for i, container := range deployment.Spec.Template.Spec.Containers {
		if container.Name == containerName {
			deployment.Spec.Template.Spec.Containers[i].Image = newImage
			updated = true
			break
		}
	}

	if !updated {
		return nil, fmt.Errorf("container %s not found in deployment", containerName)
	}

	_, err = clientset.AppsV1().Deployments(namespace).Update(
		context.Background(),
		deployment,
		metav1.UpdateOptions{},
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update deployment: %v", err)
	}

	return map[string]interface{}{
		"action":          "deployment_image_updated",
		"deployment":      deploymentName,
		"namespace":       namespace,
		"container":       containerName,
		"new_image":       newImage,
		"message":         "Deployment image updated successfully. Kubernetes will roll out the new pods.",
	}, nil
}

func updateDeploymentResources(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	deploymentName := params["deployment_name"].(string)
	namespace := params["namespace"].(string)
	containerName := params["container_name"].(string)

	deployment, err := clientset.AppsV1().Deployments(namespace).Get(
		context.Background(),
		deploymentName,
		metav1.GetOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment: %v", err)
	}

	// Find and update the container resources
	updated := false
	for i, container := range deployment.Spec.Template.Spec.Containers {
		if container.Name == containerName {
			if cpuRequest, ok := params["cpu_request"].(string); ok {
				if deployment.Spec.Template.Spec.Containers[i].Resources.Requests == nil {
					deployment.Spec.Template.Spec.Containers[i].Resources.Requests = corev1.ResourceList{}
				}
				deployment.Spec.Template.Spec.Containers[i].Resources.Requests[corev1.ResourceCPU] = resource.MustParse(cpuRequest)
			}
			if memRequest, ok := params["memory_request"].(string); ok {
				if deployment.Spec.Template.Spec.Containers[i].Resources.Requests == nil {
					deployment.Spec.Template.Spec.Containers[i].Resources.Requests = corev1.ResourceList{}
				}
				deployment.Spec.Template.Spec.Containers[i].Resources.Requests[corev1.ResourceMemory] = resource.MustParse(memRequest)
			}
			if cpuLimit, ok := params["cpu_limit"].(string); ok {
				if deployment.Spec.Template.Spec.Containers[i].Resources.Limits == nil {
					deployment.Spec.Template.Spec.Containers[i].Resources.Limits = corev1.ResourceList{}
				}
				deployment.Spec.Template.Spec.Containers[i].Resources.Limits[corev1.ResourceCPU] = resource.MustParse(cpuLimit)
			}
			if memLimit, ok := params["memory_limit"].(string); ok {
				if deployment.Spec.Template.Spec.Containers[i].Resources.Limits == nil {
					deployment.Spec.Template.Spec.Containers[i].Resources.Limits = corev1.ResourceList{}
				}
				deployment.Spec.Template.Spec.Containers[i].Resources.Limits[corev1.ResourceMemory] = resource.MustParse(memLimit)
			}
			updated = true
			break
		}
	}

	if !updated {
		return nil, fmt.Errorf("container %s not found in deployment", containerName)
	}

	_, err = clientset.AppsV1().Deployments(namespace).Update(
		context.Background(),
		deployment,
		metav1.UpdateOptions{},
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update deployment resources: %v", err)
	}

	return map[string]interface{}{
		"action":     "deployment_resources_updated",
		"deployment": deploymentName,
		"namespace":  namespace,
		"container":  containerName,
		"message":    "Deployment resources updated successfully. Kubernetes will roll out the new pods.",
	}, nil
}

func updateCommandStatus(config AgentConfig, commandID string, result map[string]interface{}, err error) {
	status := "completed"
	if err != nil {
		status = "failed"
		result = map[string]interface{}{"error": err.Error()}
	}

	payload := map[string]interface{}{
		"command_id": commandID,
		"status":     status,
		"result":     result,
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/agent-update-command", config.APIEndpoint)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)

	client := &http.Client{}
	resp, _ := client.Do(req)
	if resp != nil {
		defer resp.Body.Close()
	}

	log.Printf("✅ Command %s status updated: %s", commandID, status)
}
