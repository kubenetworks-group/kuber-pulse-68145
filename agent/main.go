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
	log.Println("🚀 Kodo Agent starting...")

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
// PVC VOLUME STATS (Real usage from Kubelet)
// ---------------------------------------------
// Kubelet Stats Summary API structures
// Based on: https://github.com/kubernetes/kubelet/blob/master/pkg/apis/stats/v1alpha1/types.go
type StatsSummary struct {
	Node NodeStats  `json:"node"`
	Pods []PodStats `json:"pods"`
}

type NodeStats struct {
	NodeName string   `json:"nodeName"`
	Fs       *FsStats `json:"fs,omitempty"`
}

type PodStats struct {
	PodRef         PodReference  `json:"podRef"`
	VolumeStats    []VolumeStats `json:"volume,omitempty"`
	EphemeralStorage *FsStats    `json:"ephemeral-storage,omitempty"`
}

type PodReference struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type VolumeStats struct {
	// FsStats contains filesystem stats
	FsStats
	// Name is the name of the volume
	Name   string        `json:"name"`
	PVCRef *PVCReference `json:"pvcRef,omitempty"`
}

type FsStats struct {
	Time           string  `json:"time,omitempty"`
	AvailableBytes *uint64 `json:"availableBytes,omitempty"`
	CapacityBytes  *uint64 `json:"capacityBytes,omitempty"`
	UsedBytes      *uint64 `json:"usedBytes,omitempty"`
	InodesFree     *uint64 `json:"inodesFree,omitempty"`
	Inodes         *uint64 `json:"inodes,omitempty"`
	InodesUsed     *uint64 `json:"inodesUsed,omitempty"`
}

type PVCReference struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type PVCVolumeUsage struct {
	UsedBytes      int64
	CapacityBytes  int64
	AvailableBytes int64
}

func collectPVCVolumeStats(clientset *kubernetes.Clientset) map[string]PVCVolumeUsage {
	pvcUsage := make(map[string]PVCVolumeUsage)
	
	nodes, err := clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing nodes for PVC stats: %v", err)
		return pvcUsage
	}

	log.Printf("🔍 Fetching PVC volume stats from %d nodes...", len(nodes.Items))
	
	totalVolumes := 0
	totalPVCVolumes := 0

	for _, node := range nodes.Items {
		// Call Kubelet stats/summary API via API server proxy
		request := clientset.CoreV1().RESTClient().Get().
			Resource("nodes").
			Name(node.Name).
			SubResource("proxy").
			Suffix("stats/summary")

		responseBytes, err := request.DoRaw(context.Background())
		if err != nil {
			log.Printf("⚠️  Error fetching stats from node %s: %v", node.Name, err)
			continue
		}

		var summary StatsSummary
		if err := json.Unmarshal(responseBytes, &summary); err != nil {
			log.Printf("⚠️  Error parsing stats from node %s: %v", node.Name, err)
			continue
		}

		nodeVolumes := 0
		nodePVCVolumes := 0

		// Extract PVC volume stats from each pod
		for _, pod := range summary.Pods {
			for _, vol := range pod.VolumeStats {
				nodeVolumes++
				totalVolumes++
				
				if vol.PVCRef == nil {
					continue // Skip volumes without PVC reference (emptyDir, configMap, etc.)
				}

				nodePVCVolumes++
				totalPVCVolumes++
				
				key := vol.PVCRef.Namespace + "/" + vol.PVCRef.Name
				
				usage := PVCVolumeUsage{}
				if vol.UsedBytes != nil {
					usage.UsedBytes = int64(*vol.UsedBytes)
				}
				if vol.CapacityBytes != nil {
					usage.CapacityBytes = int64(*vol.CapacityBytes)
				}
				if vol.AvailableBytes != nil {
					usage.AvailableBytes = int64(*vol.AvailableBytes)
				}

				// Log each PVC's real usage
				if usage.UsedBytes > 0 || usage.CapacityBytes > 0 {
					log.Printf("   💾 PVC %s: used=%.2fGB, capacity=%.2fGB, available=%.2fGB",
						key,
						float64(usage.UsedBytes)/(1024*1024*1024),
						float64(usage.CapacityBytes)/(1024*1024*1024),
						float64(usage.AvailableBytes)/(1024*1024*1024))
				}

				pvcUsage[key] = usage
			}
		}
		
		log.Printf("   📦 Node %s: %d pods, %d volumes, %d PVC volumes", 
			node.Name, len(summary.Pods), nodeVolumes, nodePVCVolumes)
	}

	log.Printf("📊 Kubelet stats: %d total volumes, %d PVC volumes with real usage data", totalVolumes, totalPVCVolumes)
	return pvcUsage
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

	// Get real PVC usage from Kubelet
	pvcVolumeStats := collectPVCVolumeStats(clientset)

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
		capacityBytes := int64(0)
		actualCapacity := int64(0)
		
		// Get actual capacity from the bound PV
		if pvc.Spec.VolumeName != "" {
			if pv, exists := pvMap[pvc.Spec.VolumeName]; exists {
				if capacity, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
					actualCapacity = capacity.Value()
				}
			}
		}

		// Try to get real usage from Kubelet stats first
		pvcKey := pvc.Namespace + "/" + pvc.Name
		if stats, exists := pvcVolumeStats[pvcKey]; exists {
			usedBytes = stats.UsedBytes
			capacityBytes = stats.CapacityBytes
			log.Printf("📊 PVC %s: real usage = %.2f GB / %.2f GB", 
				pvcKey, float64(usedBytes)/(1024*1024*1024), float64(capacityBytes)/(1024*1024*1024))
		} else {
			// Fallback: Use PVC status capacity if available
			if pvc.Status.Capacity != nil {
				if storage, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
					capacityBytes = storage.Value()
				}
			}

			// If we have actual capacity from PV and no capacity bytes, use it
			if actualCapacity > 0 && capacityBytes == 0 {
				capacityBytes = actualCapacity
			}
			
			// For fallback, we don't have real usage data, so set to 0
			// This is better than reporting allocated as used
			usedBytes = 0
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
			"capacity_bytes":  capacityBytes,
			"volume_name":     pvc.Spec.VolumeName,
			"created_at":      pvc.CreationTimestamp.Time,
		})
		
		// Mark PV as bound
		if pvc.Spec.VolumeName != "" {
			boundPVs[pvc.Spec.VolumeName] = true
		}
	}

	log.Printf("📦 Collected %d PVCs (matched with %d PVs, %d with real usage data)", 
		len(pvcDetails), len(pvMap), len(pvcVolumeStats))
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
// NODE STORAGE METRICS COLLECTION (Physical disk from nodes via Kubelet)
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

	var totalCapacity int64
	var totalUsed int64
	var totalAvailable int64
	var nodeStorageDetails []map[string]interface{}

	log.Printf("🔍 Fetching real storage metrics from %d nodes via Kubelet...", len(nodes.Items))

	for _, node := range nodes.Items {
		// Try to get REAL storage usage from Kubelet stats/summary API
		request := clientset.CoreV1().RESTClient().Get().
			Resource("nodes").
			Name(node.Name).
			SubResource("proxy").
			Suffix("stats/summary")

		responseBytes, err := request.DoRaw(context.Background())

		var nodeCapacity int64
		var nodeUsed int64
		var nodeAvailable int64
		var source string

		if err == nil {
			var summary StatsSummary
			if err := json.Unmarshal(responseBytes, &summary); err == nil && summary.Node.Fs != nil {
				// Use REAL data from Kubelet
				if summary.Node.Fs.CapacityBytes != nil {
					nodeCapacity = int64(*summary.Node.Fs.CapacityBytes)
				}
				if summary.Node.Fs.UsedBytes != nil {
					nodeUsed = int64(*summary.Node.Fs.UsedBytes)
				}
				if summary.Node.Fs.AvailableBytes != nil {
					nodeAvailable = int64(*summary.Node.Fs.AvailableBytes)
				}
				source = "kubelet"
			}
		}

		// Fallback to node status if Kubelet stats unavailable
		if nodeCapacity == 0 {
			if ephemeralStorage, ok := node.Status.Capacity[corev1.ResourceEphemeralStorage]; ok {
				nodeCapacity = ephemeralStorage.Value()
			}
			if ephemeralStorage, ok := node.Status.Allocatable[corev1.ResourceEphemeralStorage]; ok {
				nodeAvailable = ephemeralStorage.Value()
			}
			nodeUsed = nodeCapacity - nodeAvailable
			source = "fallback"
		}

		totalCapacity += nodeCapacity
		totalUsed += nodeUsed
		totalAvailable += nodeAvailable

		log.Printf("   💾 Node %s (%s): capacity=%.2fGB, used=%.2fGB, available=%.2fGB",
			node.Name, source,
			float64(nodeCapacity)/(1024*1024*1024),
			float64(nodeUsed)/(1024*1024*1024),
			float64(nodeAvailable)/(1024*1024*1024))

		nodeStorageDetails = append(nodeStorageDetails, map[string]interface{}{
			"node_name":         node.Name,
			"capacity_bytes":    nodeCapacity,
			"used_bytes":        nodeUsed,
			"available_bytes":   nodeAvailable,
			"source":            source,
		})
	}

	log.Printf("💿 Node physical storage: total=%.2fGB, used=%.2fGB, available=%.2fGB across %d nodes",
		float64(totalCapacity)/(1024*1024*1024),
		float64(totalUsed)/(1024*1024*1024),
		float64(totalAvailable)/(1024*1024*1024),
		len(nodes.Items))

	return map[string]interface{}{
		"total_physical_bytes":     totalCapacity,
		"used_physical_bytes":      totalUsed,
		"available_physical_bytes": totalAvailable,
		"nodes":                    nodeStorageDetails,
	}
}

// ---------------------------------------------
// SECURITY DATA COLLECTION
// ---------------------------------------------
func collectSecurityData(clientset *kubernetes.Clientset) map[string]interface{} {
	ctx := context.Background()
	
	// Initialize RBAC data
	rbacData := map[string]interface{}{
		"cluster_roles_count":          0,
		"cluster_role_bindings_count":  0,
		"roles_count":                  0,
		"role_bindings_count":          0,
		"has_rbac":                     false,
		"cluster_roles":                []string{},
	}
	
	// Initialize security data with all fields
	securityData := map[string]interface{}{
		"rbac":               rbacData,
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
	
	log.Printf("🔍 Attempting to list ClusterRoles...")
	clusterRoles, err := clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("❌ ERROR listing ClusterRoles: %v", err)
	} else {
		clusterRolesCount = len(clusterRoles.Items)
		// Only store first 50 names to avoid huge payloads
		maxRolesToStore := 50
		if clusterRolesCount < maxRolesToStore {
			maxRolesToStore = clusterRolesCount
		}
		roleNames := make([]string, 0, maxRolesToStore)
		for i, cr := range clusterRoles.Items {
			if i < maxRolesToStore {
				roleNames = append(roleNames, cr.Name)
			}
		}
		rbacData["cluster_roles_count"] = clusterRolesCount
		rbacData["cluster_roles"] = roleNames
		log.Printf("✅ Found %d ClusterRoles (storing %d names)", clusterRolesCount, len(roleNames))
	}

	log.Printf("🔍 Attempting to list ClusterRoleBindings...")
	clusterRoleBindings, err := clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("❌ ERROR listing ClusterRoleBindings: %v", err)
	} else {
		clusterRoleBindingsCount = len(clusterRoleBindings.Items)
		rbacData["cluster_role_bindings_count"] = clusterRoleBindingsCount
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
	rolesByNamespace := make(map[string]int)
	
	for _, ns := range namespaces.Items {
		roles, err := clientset.RbacV1().Roles(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing Roles in namespace %s: %v", ns.Name, err)
		} else {
			roleCount := len(roles.Items)
			totalRoles += roleCount
			if roleCount > 0 {
				rolesByNamespace[ns.Name] = roleCount
			}
		}
		roleBindings, err := clientset.RbacV1().RoleBindings(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error listing RoleBindings in namespace %s: %v", ns.Name, err)
		} else {
			totalRoleBindings += len(roleBindings.Items)
		}
	}
	
	hasRbac := (clusterRolesCount > 0 || clusterRoleBindingsCount > 0 || totalRoles > 0 || totalRoleBindings > 0)
	log.Printf("📊 RBAC scan complete: %d ClusterRoles, %d ClusterRoleBindings, %d Roles, %d RoleBindings, has_rbac=%v", 
		clusterRolesCount, clusterRoleBindingsCount, totalRoles, totalRoleBindings, hasRbac)
	
	if len(rolesByNamespace) > 0 {
		log.Printf("📋 Roles by namespace: %v", rolesByNamespace)
	}
	
	// Update RBAC data with all counts
	rbacData["roles_count"] = totalRoles
	rbacData["role_bindings_count"] = totalRoleBindings
	rbacData["roles_by_namespace"] = rolesByNamespace
	rbacData["has_rbac"] = hasRbac
	
	// Update the security data with the complete RBAC data
	securityData["rbac"] = rbacData
	
	// Debug: Print final RBAC data
	log.Printf("🔒 Final RBAC data: cluster_roles=%d, cluster_role_bindings=%d, roles=%d, role_bindings=%d, has_rbac=%v",
		rbacData["cluster_roles_count"], rbacData["cluster_role_bindings_count"], 
		rbacData["roles_count"], rbacData["role_bindings_count"], rbacData["has_rbac"])

	// 2. Collect NetworkPolicies - iterate through ALL namespaces
	networkPoliciesData := map[string]interface{}{
		"total_count":              0,
		"namespaces_with_policies": 0,
		"has_network_policies":     false,
		"policies":                 []map[string]interface{}{},
	}
	
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
	
	networkPoliciesData["total_count"] = totalNetworkPolicies
	networkPoliciesData["namespaces_with_policies"] = namespacesWithPolicies
	networkPoliciesData["has_network_policies"] = totalNetworkPolicies > 0
	networkPoliciesData["policies"] = networkPolicyDetails
	securityData["network_policies"] = networkPoliciesData

	// 3. Collect Secrets info (count only, not content)
	secretsData := map[string]interface{}{
		"total_count": 0,
		"types":       map[string]int{},
		"has_secrets": false,
	}
	
	log.Printf("🔍 Collecting Secrets data from %d namespaces...", len(namespaces.Items))
	totalSecrets := 0
	secretTypes := make(map[string]int)
	secretsByNamespace := make(map[string]int)
	for _, ns := range namespaces.Items {
		secrets, err := clientset.CoreV1().Secrets(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("❌ ERROR listing Secrets in namespace %s: %v", ns.Name, err)
			continue
		}
		secretCount := len(secrets.Items)
		totalSecrets += secretCount
		if secretCount > 0 {
			secretsByNamespace[ns.Name] = secretCount
		}
		for _, s := range secrets.Items {
			secretTypes[string(s.Type)]++
		}
	}
	log.Printf("✅ Secrets scan complete: found %d secrets across namespaces", totalSecrets)
	if len(secretsByNamespace) > 0 {
		log.Printf("📋 Secrets by namespace: %v", secretsByNamespace)
	}
	
	secretsData["total_count"] = totalSecrets
	secretsData["types"] = secretTypes
	secretsData["has_secrets"] = totalSecrets > 0
	secretsData["by_namespace"] = secretsByNamespace
	securityData["secrets"] = secretsData

	// 4. Collect ResourceQuotas
	resourceQuotasData := map[string]interface{}{
		"total_count": 0,
		"has_quotas":  false,
	}
	
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
	
	resourceQuotasData["total_count"] = totalQuotas
	resourceQuotasData["has_quotas"] = totalQuotas > 0
	securityData["resource_quotas"] = resourceQuotasData

	// 5. Collect LimitRanges
	limitRangesData := map[string]interface{}{
		"total_count":      0,
		"has_limit_ranges": false,
	}
	
	totalLimitRanges := 0
	for _, ns := range namespaces.Items {
		limitRanges, err := clientset.CoreV1().LimitRanges(ns.Name).List(ctx, metav1.ListOptions{})
		if err == nil {
			totalLimitRanges += len(limitRanges.Items)
		}
	}
	
	limitRangesData["total_count"] = totalLimitRanges
	limitRangesData["has_limit_ranges"] = totalLimitRanges > 0
	securityData["limit_ranges"] = limitRangesData

	// 6. Analyze Pod Security (containers running as root, privileged, etc.)
	podSecurityData := map[string]interface{}{
		"total_pods":                   0,
		"pods_with_security_context":  0,
		"pods_running_as_non_root":    0,
		"pods_with_resource_limits":   0,
		"privileged_containers":       0,
		"has_pod_security":            false,
		"security_context_percentage": float64(0),
		"resource_limits_percentage":  float64(0),
	}
	
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
	podSecurityData["total_pods"] = totalPods
	podSecurityData["pods_with_security_context"] = podsWithSecurityContext
	podSecurityData["pods_running_as_non_root"] = podsRunningAsNonRoot
	podSecurityData["pods_with_resource_limits"] = podsWithResourceLimits
	podSecurityData["privileged_containers"] = privilegedContainers
	podSecurityData["has_pod_security"] = podsWithSecurityContext > 0

	// Calculate percentages
	if totalPods > 0 {
		podSecurityData["security_context_percentage"] = float64(podsWithSecurityContext) / float64(totalPods) * 100
		podSecurityData["resource_limits_percentage"] = float64(podsWithResourceLimits) / float64(totalPods) * 100
	}
	securityData["pod_security"] = podSecurityData

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

	// Common ingress controller identifiers with more label options
	ingressControllers := []struct {
		name           string
		labelSelectors []string
		namespaces     []string
		namePatterns   []string // Deployment/DaemonSet name patterns to search
	}{
		{
			name:           "nginx",
			labelSelectors: []string{"app.kubernetes.io/name=ingress-nginx", "app=ingress-nginx", "app.kubernetes.io/component=controller", "app=nginx-ingress"},
			namespaces:     []string{"ingress-nginx", "nginx-ingress", "kube-system", "default"},
			namePatterns:   []string{"ingress-nginx", "nginx-ingress", "nginx-controller"},
		},
		{
			name:           "traefik",
			labelSelectors: []string{"app.kubernetes.io/name=traefik", "app=traefik", "app.kubernetes.io/instance=traefik"},
			namespaces:     []string{"traefik", "traefik-system", "kube-system", "default"},
			namePatterns:   []string{"traefik"},
		},
		{
			name:           "haproxy",
			labelSelectors: []string{"app.kubernetes.io/name=haproxy-ingress", "app=haproxy-ingress", "app=haproxy"},
			namespaces:     []string{"haproxy-controller", "haproxy-ingress", "kube-system"},
			namePatterns:   []string{"haproxy"},
		},
		{
			name:           "kong",
			labelSelectors: []string{"app.kubernetes.io/name=kong", "app=kong", "app.kubernetes.io/instance=kong"},
			namespaces:     []string{"kong", "kong-system", "kube-system"},
			namePatterns:   []string{"kong"},
		},
		{
			name:           "istio",
			labelSelectors: []string{"app=istiod", "istio=ingressgateway", "app=istio-ingressgateway"},
			namespaces:     []string{"istio-system", "istio-ingress"},
			namePatterns:   []string{"istiod", "istio-ingressgateway"},
		},
		{
			name:           "contour",
			labelSelectors: []string{"app.kubernetes.io/name=contour", "app=contour", "app=envoy"},
			namespaces:     []string{"projectcontour", "contour", "kube-system"},
			namePatterns:   []string{"contour", "envoy"},
		},
		{
			name:           "ambassador",
			labelSelectors: []string{"app.kubernetes.io/name=ambassador", "app=ambassador", "product=aes"},
			namespaces:     []string{"ambassador", "emissary", "kube-system"},
			namePatterns:   []string{"ambassador", "emissary"},
		},
		{
			name:           "aws-alb",
			labelSelectors: []string{"app.kubernetes.io/name=aws-load-balancer-controller"},
			namespaces:     []string{"kube-system"},
			namePatterns:   []string{"aws-load-balancer-controller"},
		},
	}

	// First, check by label selectors
	log.Printf("🔍 Checking ingress controllers by labels...")
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
					
					if deploy.Spec.Template.Spec.ServiceAccountName != "" {
						result["service_account"] = deploy.Spec.Template.Spec.ServiceAccountName
					}
					
					if len(deploy.Spec.Template.Spec.Containers) > 0 {
						result["version"] = deploy.Spec.Template.Spec.Containers[0].Image
					}
					
					log.Printf("✅ Detected %s ingress controller in namespace %s (deployment: %s, label: %s)", ic.name, ns, deploy.Name, labelSelector)
					
					rbacDetails := checkIngressControllerRBAC(clientset, ctx, ns, result["service_account"].(string), ic.name)
					result["has_rbac"] = rbacDetails["has_proper_rbac"]
					result["rbac_details"] = rbacDetails
					
					return result
				}
				
				// Check DaemonSets
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
						result["version"] = ds.Spec.Template.Spec.Containers[0].Image
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

	// Second, search by deployment/daemonset name patterns across all namespaces
	log.Printf("🔍 Checking ingress controllers by name patterns...")
	allNamespaces, _ := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	for _, ic := range ingressControllers {
		for _, ns := range allNamespaces.Items {
			// Get all deployments in namespace
			deployments, err := clientset.AppsV1().Deployments(ns.Name).List(ctx, metav1.ListOptions{})
			if err == nil {
				for _, deploy := range deployments.Items {
					for _, pattern := range ic.namePatterns {
						if strings.Contains(strings.ToLower(deploy.Name), pattern) {
							result["type"] = ic.name
							result["detected"] = true
							result["namespace"] = ns.Name
							result["deployment_name"] = deploy.Name
							
							if deploy.Spec.Template.Spec.ServiceAccountName != "" {
								result["service_account"] = deploy.Spec.Template.Spec.ServiceAccountName
							}
							
							if len(deploy.Spec.Template.Spec.Containers) > 0 {
								result["version"] = deploy.Spec.Template.Spec.Containers[0].Image
							}
							
							log.Printf("✅ Detected %s ingress controller by name pattern in namespace %s (deployment: %s)", ic.name, ns.Name, deploy.Name)
							
							rbacDetails := checkIngressControllerRBAC(clientset, ctx, ns.Name, result["service_account"].(string), ic.name)
							result["has_rbac"] = rbacDetails["has_proper_rbac"]
							result["rbac_details"] = rbacDetails
							
							return result
						}
					}
				}
			}
			
			// Get all daemonsets in namespace
			daemonsets, err := clientset.AppsV1().DaemonSets(ns.Name).List(ctx, metav1.ListOptions{})
			if err == nil {
				for _, ds := range daemonsets.Items {
					for _, pattern := range ic.namePatterns {
						if strings.Contains(strings.ToLower(ds.Name), pattern) {
							result["type"] = ic.name
							result["detected"] = true
							result["namespace"] = ns.Name
							result["deployment_name"] = ds.Name + " (DaemonSet)"
							
							if ds.Spec.Template.Spec.ServiceAccountName != "" {
								result["service_account"] = ds.Spec.Template.Spec.ServiceAccountName
							}
							
							if len(ds.Spec.Template.Spec.Containers) > 0 {
								result["version"] = ds.Spec.Template.Spec.Containers[0].Image
							}
							
							log.Printf("✅ Detected %s ingress controller (DaemonSet) by name pattern in namespace %s", ic.name, ns.Name)
							
							rbacDetails := checkIngressControllerRBAC(clientset, ctx, ns.Name, result["service_account"].(string), ic.name)
							result["has_rbac"] = rbacDetails["has_proper_rbac"]
							result["rbac_details"] = rbacDetails
							
							return result
						}
					}
				}
			}
		}
	}

	// Third, check IngressClass resources
	log.Printf("🔍 Checking IngressClass resources...")
	ingressClasses, err := clientset.NetworkingV1().IngressClasses().List(ctx, metav1.ListOptions{})
	if err == nil && len(ingressClasses.Items) > 0 {
		for _, ic := range ingressClasses.Items {
			controllerName := ic.Spec.Controller
			log.Printf("📋 Found IngressClass: %s with controller: %s", ic.Name, controllerName)
			
			controllerLower := strings.ToLower(controllerName)
			if strings.Contains(controllerLower, "nginx") {
				result["type"] = "nginx"
			} else if strings.Contains(controllerLower, "traefik") {
				result["type"] = "traefik"
			} else if strings.Contains(controllerLower, "haproxy") {
				result["type"] = "haproxy"
			} else if strings.Contains(controllerLower, "kong") {
				result["type"] = "kong"
			} else if strings.Contains(controllerLower, "istio") {
				result["type"] = "istio"
			} else if strings.Contains(controllerLower, "contour") {
				result["type"] = "contour"
			} else if strings.Contains(controllerLower, "ambassador") || strings.Contains(controllerLower, "emissary") {
				result["type"] = "ambassador"
			} else if strings.Contains(controllerLower, "alb") || strings.Contains(controllerLower, "aws") {
				result["type"] = "aws-alb"
			} else {
				result["type"] = controllerName
			}
			result["detected"] = true
			result["deployment_name"] = ic.Name + " (IngressClass)"
			
			log.Printf("✅ Detected ingress controller from IngressClass: %s -> %s", ic.Name, result["type"])
			break
		}
	}

	// Fourth, check Ingress resources to infer controller
	if !result["detected"].(bool) {
		log.Printf("🔍 Checking existing Ingress resources...")
		ingresses, err := clientset.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
		if err == nil && len(ingresses.Items) > 0 {
			for _, ing := range ingresses.Items {
				// Check annotations for controller hints
				if className, ok := ing.Annotations["kubernetes.io/ingress.class"]; ok {
					log.Printf("📋 Found Ingress %s/%s with class annotation: %s", ing.Namespace, ing.Name, className)
					classLower := strings.ToLower(className)
					if strings.Contains(classLower, "nginx") {
						result["type"] = "nginx"
					} else if strings.Contains(classLower, "traefik") {
						result["type"] = "traefik"
					} else {
						result["type"] = className
					}
					result["detected"] = true
					result["deployment_name"] = className + " (from annotation)"
					break
				}
				
				// Check spec.ingressClassName
				if ing.Spec.IngressClassName != nil {
					log.Printf("📋 Found Ingress %s/%s with ingressClassName: %s", ing.Namespace, ing.Name, *ing.Spec.IngressClassName)
					classLower := strings.ToLower(*ing.Spec.IngressClassName)
					if strings.Contains(classLower, "nginx") {
						result["type"] = "nginx"
					} else if strings.Contains(classLower, "traefik") {
						result["type"] = "traefik"
					} else {
						result["type"] = *ing.Spec.IngressClassName
					}
					result["detected"] = true
					result["deployment_name"] = *ing.Spec.IngressClassName + " (from spec)"
					break
				}
			}
		}
	}

	if !result["detected"].(bool) {
		log.Printf("⚠️ No ingress controller detected after all checks")
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
		{
			"type":         "security_threats",
			"data":         collectSecurityThreatsData(clientset),
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
	log.Printf("🔍 Polling commands from: %s", url)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Error polling commands: %v", err)
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		log.Printf("⚠️  Commands request returned %d: %s", resp.StatusCode, string(body))
		return
	}

	log.Printf("📥 Commands response: %s", string(body))

	var commandsResp CommandsResponse
	if err := json.Unmarshal(body, &commandsResp); err != nil {
		log.Printf("❌ Error parsing commands: %v", err)
		return
	}

	if len(commandsResp.Commands) > 0 {
		log.Printf("📥 Received %d commands to execute", len(commandsResp.Commands))
		for i, cmd := range commandsResp.Commands {
			log.Printf("  [%d] ID=%s Type=%s Params=%v", i+1, cmd.ID, cmd.CommandType, cmd.CommandParams)
		}
		executeCommands(clientset, config, commandsResp.Commands)
	} else {
		log.Printf("📭 No pending commands")
	}
}

// ---------------------------------------------
// COMMAND EXECUTION
// ---------------------------------------------
func executeCommands(clientset *kubernetes.Clientset, config AgentConfig, commands []Command) {
	for _, cmd := range commands {
		log.Printf("⚡ Executing command: %s (ID: %s)", cmd.CommandType, cmd.ID)
		log.Printf("   Params: %v", cmd.CommandParams)

		var result map[string]interface{}
		var err error

		switch cmd.CommandType {
		case "restart_pod", "delete_pod":
			log.Printf("   → Deleting/restarting pod...")
			result, err = deletePod(clientset, cmd.CommandParams)
		case "scale_deployment":
			log.Printf("   → Scaling deployment...")
			result, err = scaleDeployment(clientset, cmd.CommandParams)
		case "update_deployment_image":
			log.Printf("   → Updating deployment image...")
			result, err = updateDeploymentImage(clientset, cmd.CommandParams)
		case "update_deployment_resources":
			log.Printf("   → Updating deployment resources...")
			result, err = updateDeploymentResources(clientset, cmd.CommandParams)
		default:
			err = fmt.Errorf("unknown command type: %s", cmd.CommandType)
			log.Printf("   ❌ Unknown command type!")
		}

		if err != nil {
			log.Printf("   ❌ Command failed: %v", err)
		} else {
			log.Printf("   ✅ Command succeeded: %v", result)
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
	deploymentName, _ := params["deployment_name"].(string)
	namespace, _ := params["namespace"].(string)
	containerName, _ := params["container_name"].(string)
	newImage, _ := params["new_image"].(string)
	oldImage, _ := params["old_image"].(string)

	if deploymentName == "" || namespace == "" || newImage == "" {
		return nil, fmt.Errorf("missing required params: deployment_name, namespace, new_image")
	}

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
	updatedContainer := ""

	// 1) Prefer explicit container name when provided
	if containerName != "" {
		for i, container := range deployment.Spec.Template.Spec.Containers {
			if container.Name == containerName {
				deployment.Spec.Template.Spec.Containers[i].Image = newImage
				updated = true
				updatedContainer = container.Name
				break
			}
		}
	}

	// 2) If container not provided or not found, try match by old_image
	if !updated && oldImage != "" {
		for i, container := range deployment.Spec.Template.Spec.Containers {
			if container.Image == oldImage {
				deployment.Spec.Template.Spec.Containers[i].Image = newImage
				updated = true
				updatedContainer = container.Name
				break
			}
		}
	}

	// 3) If still not updated and there's only one container, update it
	if !updated && len(deployment.Spec.Template.Spec.Containers) == 1 {
		deployment.Spec.Template.Spec.Containers[0].Image = newImage
		updated = true
		updatedContainer = deployment.Spec.Template.Spec.Containers[0].Name
	}

	if !updated {
		if containerName == "" {
			return nil, fmt.Errorf("unable to determine which container to update (provide container_name or old_image)")
		}
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
		"action":     "deployment_image_updated",
		"deployment": deploymentName,
		"namespace":  namespace,
		"container":  updatedContainer,
		"new_image":  newImage,
		"old_image":  oldImage,
		"message":    "Deployment image updated successfully. Kubernetes will roll out the new pods.",
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

// ---------------------------------------------
// SECURITY THREATS DATA COLLECTION
// Coleta dados para detecção de DDoS, hackers, atividades suspeitas
// ---------------------------------------------
func collectSecurityThreatsData(clientset *kubernetes.Clientset) map[string]interface{} {
	ctx := context.Background()

	securityThreatsData := map[string]interface{}{
		"suspicious_pods":       []map[string]interface{}{},
		"suspicious_events":     []map[string]interface{}{},
		"container_exec_events": []map[string]interface{}{},
		"network_anomalies":     []map[string]interface{}{},
		"resource_anomalies":    []map[string]interface{}{},
		"privileged_containers": []map[string]interface{}{},
		"host_network_pods":     []map[string]interface{}{},
		"host_pid_pods":         []map[string]interface{}{},
	}

	// 1. Collect pods with suspicious configurations
	log.Printf("🔒 Collecting security threats data...")
	pods, err := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing pods for security analysis: %v", err)
		return securityThreatsData
	}

	var suspiciousPods []map[string]interface{}
	var privilegedContainers []map[string]interface{}
	var hostNetworkPods []map[string]interface{}
	var hostPidPods []map[string]interface{}
	var resourceAnomalies []map[string]interface{}

	for _, pod := range pods.Items {
		// Skip system namespaces for certain checks
		isSystemNS := pod.Namespace == "kube-system" || pod.Namespace == "kube-public" || pod.Namespace == "kube-node-lease"

		// Check for privileged containers
		for _, container := range pod.Spec.Containers {
			if container.SecurityContext != nil && container.SecurityContext.Privileged != nil && *container.SecurityContext.Privileged {
				privilegedContainers = append(privilegedContainers, map[string]interface{}{
					"pod_name":       pod.Name,
					"namespace":      pod.Namespace,
					"container_name": container.Name,
					"image":          container.Image,
					"node":           pod.Spec.NodeName,
					"threat_level":   "high",
					"reason":         "Container running in privileged mode",
				})
			}

			// Check for containers with dangerous capabilities
			if container.SecurityContext != nil && container.SecurityContext.Capabilities != nil {
				for _, cap := range container.SecurityContext.Capabilities.Add {
					if isDangerousCapability(string(cap)) {
						privilegedContainers = append(privilegedContainers, map[string]interface{}{
							"pod_name":       pod.Name,
							"namespace":      pod.Namespace,
							"container_name": container.Name,
							"image":          container.Image,
							"node":           pod.Spec.NodeName,
							"capability":     string(cap),
							"threat_level":   "high",
							"reason":         fmt.Sprintf("Container has dangerous capability: %s", cap),
						})
					}
				}
			}

			// Check for unusual resource patterns (potential crypto mining)
			if !isSystemNS && container.Resources.Limits != nil {
				cpuLimit := container.Resources.Limits.Cpu()
				memLimit := container.Resources.Limits.Memory()

				// High CPU with low memory is suspicious (crypto mining pattern)
				if cpuLimit != nil && memLimit != nil {
					cpuMillis := cpuLimit.MilliValue()
					memBytes := memLimit.Value()

					if cpuMillis > 2000 && memBytes < 512*1024*1024 { // >2 cores, <512MB
						resourceAnomalies = append(resourceAnomalies, map[string]interface{}{
							"pod_name":       pod.Name,
							"namespace":      pod.Namespace,
							"container_name": container.Name,
							"cpu_limit":      cpuMillis,
							"memory_limit":   memBytes,
							"node":           pod.Spec.NodeName,
							"threat_level":   "medium",
							"reason":         "High CPU with low memory - potential crypto mining pattern",
						})
					}
				}
			}
		}

		// Check for host network access
		if pod.Spec.HostNetwork && !isSystemNS {
			hostNetworkPods = append(hostNetworkPods, map[string]interface{}{
				"pod_name":     pod.Name,
				"namespace":    pod.Namespace,
				"node":         pod.Spec.NodeName,
				"threat_level": "high",
				"reason":       "Pod has host network access",
			})
		}

		// Check for host PID access
		if pod.Spec.HostPID && !isSystemNS {
			hostPidPods = append(hostPidPods, map[string]interface{}{
				"pod_name":     pod.Name,
				"namespace":    pod.Namespace,
				"node":         pod.Spec.NodeName,
				"threat_level": "high",
				"reason":       "Pod has host PID namespace access",
			})
		}

		// Check for suspicious image patterns
		for _, container := range pod.Spec.Containers {
			if isSuspiciousImage(container.Image) {
				suspiciousPods = append(suspiciousPods, map[string]interface{}{
					"pod_name":       pod.Name,
					"namespace":      pod.Namespace,
					"container_name": container.Name,
					"image":          container.Image,
					"node":           pod.Spec.NodeName,
					"threat_level":   "critical",
					"reason":         "Container using suspicious/known malicious image pattern",
				})
			}
		}

		// Check for pods running as root
		if pod.Spec.SecurityContext == nil ||
		   (pod.Spec.SecurityContext.RunAsNonRoot == nil || !*pod.Spec.SecurityContext.RunAsNonRoot) {
			for _, container := range pod.Spec.Containers {
				if container.SecurityContext == nil ||
				   (container.SecurityContext.RunAsNonRoot == nil || !*container.SecurityContext.RunAsNonRoot) {
					if !isSystemNS {
						suspiciousPods = append(suspiciousPods, map[string]interface{}{
							"pod_name":       pod.Name,
							"namespace":      pod.Namespace,
							"container_name": container.Name,
							"image":          container.Image,
							"node":           pod.Spec.NodeName,
							"threat_level":   "medium",
							"reason":         "Container potentially running as root",
						})
					}
				}
			}
		}
	}

	// 2. Collect suspicious Kubernetes events
	events, err := clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing events for security analysis: %v", err)
	} else {
		var suspiciousEvents []map[string]interface{}
		tenMinutesAgo := time.Now().Add(-10 * time.Minute)

		for _, event := range events.Items {
			if event.LastTimestamp.Time.Before(tenMinutesAgo) {
				continue
			}

			// Check for security-related events
			if isSecurityEvent(event.Reason, event.Message) {
				threatLevel := "medium"
				if strings.Contains(strings.ToLower(event.Message), "unauthorized") ||
				   strings.Contains(strings.ToLower(event.Message), "forbidden") ||
				   strings.Contains(strings.ToLower(event.Message), "denied") {
					threatLevel = "high"
				}

				suspiciousEvents = append(suspiciousEvents, map[string]interface{}{
					"type":       event.Type,
					"reason":     event.Reason,
					"message":    event.Message,
					"namespace":  event.InvolvedObject.Namespace,
					"object":     event.InvolvedObject.Name,
					"kind":       event.InvolvedObject.Kind,
					"count":      event.Count,
					"last_time":  event.LastTimestamp.Time,
					"threat_level": threatLevel,
				})
			}
		}
		securityThreatsData["suspicious_events"] = suspiciousEvents
	}

	// 3. Check for potential network anomalies via Service configurations
	services, err := clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing services for security analysis: %v", err)
	} else {
		var networkAnomalies []map[string]interface{}

		for _, svc := range services.Items {
			// Skip system namespaces
			if svc.Namespace == "kube-system" || svc.Namespace == "kube-public" {
				continue
			}

			// Check for LoadBalancer or NodePort services (potential attack surface)
			if svc.Spec.Type == corev1.ServiceTypeLoadBalancer || svc.Spec.Type == corev1.ServiceTypeNodePort {
				for _, port := range svc.Spec.Ports {
					// Common ports that shouldn't be exposed
					if isDangerousPort(int(port.Port)) {
						networkAnomalies = append(networkAnomalies, map[string]interface{}{
							"service_name": svc.Name,
							"namespace":    svc.Namespace,
							"service_type": string(svc.Spec.Type),
							"port":         port.Port,
							"target_port":  port.TargetPort.String(),
							"node_port":    port.NodePort,
							"threat_level": "high",
							"reason":       fmt.Sprintf("Dangerous port %d exposed via %s service", port.Port, svc.Spec.Type),
						})
					}
				}
			}
		}
		securityThreatsData["network_anomalies"] = networkAnomalies
	}

	securityThreatsData["suspicious_pods"] = suspiciousPods
	securityThreatsData["privileged_containers"] = privilegedContainers
	securityThreatsData["host_network_pods"] = hostNetworkPods
	securityThreatsData["host_pid_pods"] = hostPidPods
	securityThreatsData["resource_anomalies"] = resourceAnomalies

	// Log summary
	totalThreats := len(suspiciousPods) + len(privilegedContainers) + len(hostNetworkPods) + len(hostPidPods) + len(resourceAnomalies)
	log.Printf("🔒 Security threats scan complete: %d potential threats detected", totalThreats)

	if totalThreats > 0 {
		log.Printf("   - Suspicious pods: %d", len(suspiciousPods))
		log.Printf("   - Privileged containers: %d", len(privilegedContainers))
		log.Printf("   - Host network pods: %d", len(hostNetworkPods))
		log.Printf("   - Host PID pods: %d", len(hostPidPods))
		log.Printf("   - Resource anomalies: %d", len(resourceAnomalies))
	}

	return securityThreatsData
}

// isDangerousCapability checks if a Linux capability is considered dangerous
func isDangerousCapability(cap string) bool {
	dangerousCaps := []string{
		"SYS_ADMIN",
		"NET_ADMIN",
		"SYS_PTRACE",
		"SYS_MODULE",
		"DAC_OVERRIDE",
		"SETUID",
		"SETGID",
		"NET_RAW",
		"SYS_RAWIO",
		"MKNOD",
	}
	for _, dc := range dangerousCaps {
		if cap == dc {
			return true
		}
	}
	return false
}

// isSuspiciousImage checks for known malicious or suspicious image patterns
func isSuspiciousImage(image string) bool {
	suspiciousPatterns := []string{
		"xmrig",       // Crypto miner
		"monero",      // Crypto miner
		"cryptonight", // Crypto mining algorithm
		"minerd",      // Miner daemon
		"cpuminer",    // CPU miner
		"nicehash",    // Mining pool
		"stratum",     // Mining protocol
		"coinhive",    // Web miner
		"kinsing",     // Known malware
		"dota",        // Known malware
		"tsunami",     // Known malware
		"xorddos",     // Known DDoS malware
		"backdoor",    // Backdoor indicator
		"rootkit",     // Rootkit indicator
		"reverse-shell", // Reverse shell
		"netcat",      // Network utility (can be suspicious)
	}

	imageLower := strings.ToLower(image)
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(imageLower, pattern) {
			return true
		}
	}
	return false
}

// isSecurityEvent checks if an event is security-related
func isSecurityEvent(reason, message string) bool {
	securityIndicators := []string{
		"Forbidden",
		"Unauthorized",
		"FailedMount",
		"FailedAttachVolume",
		"FailedScheduling",
		"BackOff",
		"Unhealthy",
		"Killing",
		"OOMKilled",
		"FailedValidation",
		"InvalidImageName",
		"ImagePullBackOff",
		"ErrImagePull",
		"NetworkNotReady",
		"FailedCreatePodSandBox",
		"FailedSync",
	}

	reasonLower := strings.ToLower(reason)
	messageLower := strings.ToLower(message)

	for _, indicator := range securityIndicators {
		indicatorLower := strings.ToLower(indicator)
		if strings.Contains(reasonLower, indicatorLower) || strings.Contains(messageLower, indicatorLower) {
			return true
		}
	}

	// Additional security message patterns
	if strings.Contains(messageLower, "denied") ||
	   strings.Contains(messageLower, "forbidden") ||
	   strings.Contains(messageLower, "unauthorized") ||
	   strings.Contains(messageLower, "permission") ||
	   strings.Contains(messageLower, "secret") ||
	   strings.Contains(messageLower, "certificate") ||
	   strings.Contains(messageLower, "tls") ||
	   strings.Contains(messageLower, "authentication") {
		return true
	}

	return false
}

// isDangerousPort checks if a port is commonly associated with attacks
func isDangerousPort(port int) bool {
	dangerousPorts := []int{
		22,    // SSH (if exposed externally)
		23,    // Telnet
		25,    // SMTP
		135,   // MSRPC
		137,   // NetBIOS
		138,   // NetBIOS
		139,   // NetBIOS
		445,   // SMB
		1433,  // MSSQL
		1434,  // MSSQL Browser
		3306,  // MySQL
		3389,  // RDP
		5432,  // PostgreSQL
		5900,  // VNC
		6379,  // Redis
		8080,  // HTTP Proxy
		9200,  // Elasticsearch
		9300,  // Elasticsearch
		27017, // MongoDB
		27018, // MongoDB
	}

	for _, dp := range dangerousPorts {
		if port == dp {
			return true
		}
	}
	return false
}
