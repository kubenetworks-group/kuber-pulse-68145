package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
)

// Agent version - update this when releasing new versions
const AgentVersion = "v0.1.73"

// ---------------------------------------------
// PVC USAGE VIA DF COMMAND (EXEC IN CONTAINERS)
// ---------------------------------------------

// PVCDfUsage stores PVC usage collected via df command
type PVCDfUsage struct {
	MountPath      string
	UsedBytes      int64
	AvailableBytes int64
	TotalBytes     int64
	UsePercent     int
}

// pvcDfCache stores cached df results to avoid excessive exec calls
type pvcDfCache struct {
	sync.RWMutex
	data      map[string]PVCDfUsage // key: namespace/pvcName
	timestamp time.Time
	ttl       time.Duration
}

var dfCache = &pvcDfCache{
	data: make(map[string]PVCDfUsage),
	ttl:  5 * time.Minute, // Cache results for 5 minutes
}

// dfExecForbidden is set to true when pods/exec is denied by RBAC,
// so we skip further exec attempts and only log the fix once per process run.
var dfExecForbidden int32 // atomic: 0 = allowed, 1 = forbidden

// blockedNamespaces are system namespaces where we won't exec into containers
var blockedNamespaces = map[string]bool{
	"kube-system":     true,
	"kube-public":     true,
	"kube-node-lease": true,
	"calico-system":   true,
	"tigera-operator": true,
	"istio-system":    true,
	"linkerd":         true,
	"cert-manager":    true,
	"ingress-nginx":   true,
	"kodo":            true, // Don't exec into our own namespace
}

// isValidForDfExec checks if we should attempt df exec on this namespace
func isValidForDfExec(namespace string) bool {
	return !blockedNamespaces[namespace]
}

// findPVCMountInPod finds the container and mount path for a PVC in a pod
func findPVCMountInPod(pod *corev1.Pod, pvcName string) (containerName, mountPath string, found bool) {
	// Find the volume that references the PVC
	var volumeName string
	for _, vol := range pod.Spec.Volumes {
		if vol.PersistentVolumeClaim != nil && vol.PersistentVolumeClaim.ClaimName == pvcName {
			volumeName = vol.Name
			break
		}
	}

	if volumeName == "" {
		return "", "", false
	}

	// Find the container and mount path
	for _, container := range pod.Spec.Containers {
		for _, mount := range container.VolumeMounts {
			if mount.Name == volumeName {
				return container.Name, mount.MountPath, true
			}
		}
	}
	return "", "", false
}

// execCommandInContainer runs a command in a pod container and returns stdout.
func execCommandInContainer(clientset *kubernetes.Clientset, restConfig *rest.Config,
	namespace, podName, containerName string, command []string) (string, error) {

	req := clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: containerName,
			Command:   command,
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		return "", fmt.Errorf("failed to create executor: %v", err)
	}

	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	}); err != nil {
		errStr := err.Error()
		stderrStr := stderr.String()
		if strings.Contains(errStr, "forbidden") || strings.Contains(errStr, "cannot create resource") {
			return "", fmt.Errorf("forbidden: %v", err)
		}
		if strings.Contains(errStr, "executable file not found") || strings.Contains(stderrStr, "not found") {
			return "", fmt.Errorf("command not available in container")
		}
		return "", fmt.Errorf("exec failed: %v (stderr: %s)", err, stderrStr)
	}
	return stdout.String(), nil
}

// execDuInContainer runs "du -sk <mountPath>" and returns used bytes.
// This measures actual file sizes inside the directory — correct for local-path/hostPath PVCs
// where df -Pk shows the node's root filesystem (overlay), not the PVC's own usage.
func execDuInContainer(clientset *kubernetes.Clientset, restConfig *rest.Config,
	namespace, podName, containerName, mountPath string, requestedBytes int64) (*PVCDfUsage, error) {

	out, err := execCommandInContainer(clientset, restConfig, namespace, podName, containerName,
		[]string{"du", "-sk", mountPath})
	if err != nil {
		return nil, fmt.Errorf("du -sk failed: %v", err)
	}

	// du -sk output: "<1K-blocks>\t<path>"
	fields := strings.Fields(strings.TrimSpace(out))
	if len(fields) < 1 {
		return nil, fmt.Errorf("unexpected du output: %q", out)
	}
	used1K, err := strconv.ParseInt(fields[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("could not parse du output %q: %v", out, err)
	}
	const kib = int64(1024)
	usedBytes := used1K * kib
	// For du, we don't have total/available — use requested as capacity
	availBytes := int64(0)
	if requestedBytes > usedBytes {
		availBytes = requestedBytes - usedBytes
	}
	pct := 0
	if requestedBytes > 0 {
		pct = int(float64(usedBytes) / float64(requestedBytes) * 100)
	}
	log.Printf("   📁 du -sk %s: used=%.2fGB (of %.2fGB requested)",
		mountPath, float64(usedBytes)/(1024*1024*1024), float64(requestedBytes)/(1024*1024*1024))
	return &PVCDfUsage{
		MountPath:      mountPath,
		TotalBytes:     requestedBytes,
		UsedBytes:      usedBytes,
		AvailableBytes: availBytes,
		UsePercent:     pct,
	}, nil
}

// execDfInContainer executes df -Pk (POSIX portable, 1K-blocks) inside a container.
// If df reports a pseudo-filesystem (overlay, tmpfs) — common for local-path-provisioner PVCs
// where the node directory is bind-mounted — falls back to "du -sk" to measure actual file sizes.
// Output format (fixed columns):
//
//	Filesystem     1024-blocks      Used Available Capacity Mounted on
//	/dev/sda1         10485760   2097152   8388608      20% /prometheus
func execDfInContainer(clientset *kubernetes.Clientset, restConfig *rest.Config,
	namespace, podName, containerName, mountPath string, requestedBytes int64) (*PVCDfUsage, error) {

	log.Printf("   💾 exec df -Pk in %s/%s (container: %s, mount: %s)", namespace, podName, containerName, mountPath)

	out, err := execCommandInContainer(clientset, restConfig, namespace, podName, containerName,
		[]string{"df", "-Pk", mountPath})
	if err != nil {
		return nil, err
	}

	usage, dfErr := parseDfPosixOutput(out, mountPath)
	if dfErr != nil {
		// If df returned a pseudo-filesystem (overlay/tmpfs), fall back to du -sk
		// which directly sums file sizes — accurate for local-path-provisioner PVCs.
		if strings.Contains(dfErr.Error(), "pseudo-filesystem") {
			log.Printf("   🔄 df shows pseudo-filesystem for %s — falling back to du -sk", mountPath)
			return execDuInContainer(clientset, restConfig, namespace, podName, containerName, mountPath, requestedBytes)
		}
		return nil, dfErr
	}
	return usage, nil
}

// pseudoFilesystems are filesystem types that represent the container's root or
// in-memory mounts. Usage from these is the entire NODE disk / memory, not the
// PVC's own data, so we reject them to avoid misleading statistics.
var pseudoFilesystems = map[string]bool{
	"overlay": true, "tmpfs": true, "devtmpfs": true,
	"none": true, "udev": true, "cgroup": true, "cgroupfs": true,
	"proc": true, "sysfs": true, "devpts": true,
}

// parseDfPosixOutput parses df -Pk output (POSIX, 1K-block columns).
// Expected header + 1 data line:
//
//	Filesystem     1024-blocks      Used Available Capacity Mounted on
//	/dev/sda1         10485760   2097152   8388608      20% /prometheus
//
// All values are in 1024-byte blocks → multiply by 1024 to get bytes.
// Returns an error if the filesystem is pseudo (overlay, tmpfs, etc.),
// ensuring we only report usage from real block-device-backed PVCs.
func parseDfPosixOutput(output, mountPath string) (*PVCDfUsage, error) {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) < 2 {
		return nil, fmt.Errorf("unexpected df output (got %d lines): %q", len(lines), output)
	}

	// POSIX df -P guarantees no line-wrapping, so we can rely on field positions.
	// Some implementations concatenate long filesystem names, producing ≥6 fields;
	// others may wrap to 5 fields when filesystem is on a separate line.
	for _, line := range lines[1:] {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		// Field[0] is the Filesystem column (device name, e.g. /dev/sda1 or overlay)
		fsName := fields[0]

		// Determine offset: if filesystem name takes up field[0], data starts at [1]
		offset := 1
		if len(fields) == 5 {
			offset = 0 // filesystem was on previous line (rare), values start at 0
		}

		if offset+4 > len(fields) {
			continue
		}

		total1K, err := strconv.ParseInt(fields[offset], 10, 64)
		if err != nil {
			continue
		}
		used1K, err := strconv.ParseInt(fields[offset+1], 10, 64)
		if err != nil {
			continue
		}
		avail1K, err := strconv.ParseInt(fields[offset+2], 10, 64)
		if err != nil {
			continue
		}
		pctStr := strings.TrimSuffix(fields[offset+3], "%")
		pct, _ := strconv.Atoi(pctStr)

		// Reject pseudo-filesystems (overlay, tmpfs, …) — they reflect the
		// node's root disk or memory, NOT the PVC's own storage.
		if offset == 1 && pseudoFilesystems[fsName] {
			return nil, fmt.Errorf("skipping pseudo-filesystem %q for mount %s — not real PVC storage", fsName, mountPath)
		}

		const kib = int64(1024)
		return &PVCDfUsage{
			MountPath:      mountPath,
			TotalBytes:     total1K * kib,
			UsedBytes:      used1K * kib,
			AvailableBytes: avail1K * kib,
			UsePercent:     pct,
		}, nil
	}

	return nil, fmt.Errorf("could not parse df output for mount path %s", mountPath)
}

// collectPVCUsageViaDf tries to collect PVC usage by executing df (with du fallback) in containers.
// requestedBytes is the PVC's requested capacity, used as the "total" when du is the source.
func collectPVCUsageViaDf(clientset *kubernetes.Clientset, restConfig *rest.Config,
	pvcNamespace, pvcName string, requestedBytes int64) (*PVCDfUsage, error) {

	// Skip immediately if we already know exec is forbidden (RBAC not applied yet)
	if atomic.LoadInt32(&dfExecForbidden) == 1 {
		return nil, fmt.Errorf("pods/exec forbidden — re-apply ClusterRole to fix")
	}

	// Check cache first
	cacheKey := pvcNamespace + "/" + pvcName
	dfCache.RLock()
	if cached, exists := dfCache.data[cacheKey]; exists && time.Since(dfCache.timestamp) < dfCache.ttl {
		dfCache.RUnlock()
		return &cached, nil
	}
	dfCache.RUnlock()

	// Skip blocked namespaces
	if !isValidForDfExec(pvcNamespace) {
		return nil, fmt.Errorf("namespace %s is blocked for df exec", pvcNamespace)
	}

	// Find pods that use this PVC
	pods, err := clientset.CoreV1().Pods(pvcNamespace).List(context.Background(), metav1.ListOptions{
		FieldSelector: "status.phase=Running",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %v", err)
	}

	// Try each running pod that uses this PVC
	for _, pod := range pods.Items {
		containerName, mountPath, found := findPVCMountInPod(&pod, pvcName)
		if !found {
			continue
		}

		// Skip if pod is not fully running
		if pod.Status.Phase != corev1.PodRunning {
			continue
		}

		// Check if container is ready
		containerReady := false
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == containerName && cs.Ready {
				containerReady = true
				break
			}
		}
		if !containerReady {
			continue
		}

		// Try to exec df in this container
		usage, err := execDfInContainer(clientset, restConfig, pvcNamespace, pod.Name, containerName, mountPath, requestedBytes)
		if err != nil {
			errStr := err.Error()
			// Detect RBAC forbidden — set global flag so all future PVCs skip exec silently
			if strings.Contains(errStr, "forbidden") || strings.Contains(errStr, "cannot create resource") {
				if atomic.CompareAndSwapInt32(&dfExecForbidden, 0, 1) {
					// Log only on first detection
					log.Printf("   ❌ RBAC: pods/exec not allowed for service account kodo:kodo-agent.")
					log.Printf("      Fix: kubectl apply -f https://raw.githubusercontent.com/kubenetworks-group/kodo-agent/main/kubernetes/deployment.yaml")
					log.Printf("      Or:  kubectl apply -f agent/kubernetes/deployment.yaml")
				}
				return nil, fmt.Errorf("pods/exec forbidden — re-apply ClusterRole to fix")
			}
			log.Printf("   ⚠️  df exec failed for PVC %s in pod %s: %v", pvcName, pod.Name, err)
			continue
		}

		// Cache the result
		dfCache.Lock()
		dfCache.data[cacheKey] = *usage
		dfCache.timestamp = time.Now()
		dfCache.Unlock()

		log.Printf("   ✅ PVC %s: df exec successful - used=%.2fGB, total=%.2fGB (%d%%)",
			cacheKey,
			float64(usage.UsedBytes)/(1024*1024*1024),
			float64(usage.TotalBytes)/(1024*1024*1024),
			usage.UsePercent)

		return usage, nil
	}

	return nil, fmt.Errorf("no suitable pod found for PVC %s/%s", pvcNamespace, pvcName)
}

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
	log.Printf("🚀 Kodo Agent %s starting...", AgentVersion)

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

	// Report startup/restart event to backend (non-blocking)
	go reportAgentStartup(clientset, config)

	ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)

	for {
		select {
		case <-ticker.C:
			go sendMetrics(clientset, metricsClient, kubeconfig, config)
			go getCommands(clientset, metricsClient, kubeconfig, config)
		}
	}
}

// ---------------------------------------------
// POD DETAILS COLLECTION
// ---------------------------------------------
func collectPodDetails(clientset *kubernetes.Clientset) []map[string]interface{} {
	pods, _ := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})

	// Build index of spec containers by name for resource lookup
	var podDetails []map[string]interface{}

	for _, pod := range pods.Items {
		totalRestarts := int32(0)
		var containerStatuses []map[string]interface{}

		// Index spec containers by name to get resources
		specResources := make(map[string]map[string]interface{})
		for _, c := range pod.Spec.Containers {
			res := map[string]interface{}{}
			if c.Resources.Limits != nil {
				limits := map[string]interface{}{}
				if cpu := c.Resources.Limits.Cpu(); cpu != nil {
					limits["cpu"] = cpu.MilliValue() // millicores
				}
				if mem := c.Resources.Limits.Memory(); mem != nil {
					limits["memory"] = mem.Value() // bytes
				}
				res["limits"] = limits
			}
			if c.Resources.Requests != nil {
				requests := map[string]interface{}{}
				if cpu := c.Resources.Requests.Cpu(); cpu != nil {
					requests["cpu"] = cpu.MilliValue()
				}
				if mem := c.Resources.Requests.Memory(); mem != nil {
					requests["memory"] = mem.Value()
				}
				res["requests"] = requests
			}
			// Probes
			res["liveness_probe"]  = c.LivenessProbe != nil
			res["readiness_probe"] = c.ReadinessProbe != nil
			res["startup_probe"]   = c.StartupProbe != nil
			res["image"]           = c.Image
			specResources[c.Name] = res
		}

		for _, cs := range pod.Status.ContainerStatuses {
			totalRestarts += cs.RestartCount
			entry := map[string]interface{}{
				"name":          cs.Name,
				"ready":         cs.Ready,
				"restart_count": cs.RestartCount,
				"state":         getContainerState(cs.State),
				"last_state":    getContainerState(cs.LastTerminationState),
			}
			if res, ok := specResources[cs.Name]; ok {
				entry["resources"]       = res
				entry["liveness_probe"]  = res["liveness_probe"]
				entry["readiness_probe"] = res["readiness_probe"]
				entry["startup_probe"]   = res["startup_probe"]
				entry["image"]           = res["image"]
			}
			containerStatuses = append(containerStatuses, entry)
		}

		// For init containers not in status yet, include spec data
		for _, c := range pod.Spec.Containers {
			found := false
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Name == c.Name {
					found = true
					break
				}
			}
			if !found {
				entry := map[string]interface{}{
					"name":          c.Name,
					"ready":         false,
					"restart_count": 0,
					"state":         map[string]interface{}{"status": "unknown"},
					"last_state":    map[string]interface{}{"status": "unknown"},
				}
				if res, ok := specResources[c.Name]; ok {
					entry["resources"]       = res
					entry["liveness_probe"]  = res["liveness_probe"]
					entry["readiness_probe"] = res["readiness_probe"]
					entry["image"]           = res["image"]
				}
				containerStatuses = append(containerStatuses, entry)
			}
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

// collectServicesData collects all services across namespaces for the dashboard
func collectServicesData(clientset *kubernetes.Clientset) []map[string]interface{} {
	ctx := context.Background()
	var result []map[string]interface{}

	svcs, err := clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing services: %v", err)
		return result
	}

	skipNS := map[string]bool{"kube-system": true, "kube-public": true, "kube-node-lease": true}

	for _, svc := range svcs.Items {
		if skipNS[svc.Namespace] {
			continue
		}

		ports := []map[string]interface{}{}
		for _, p := range svc.Spec.Ports {
			portEntry := map[string]interface{}{
				"name":        p.Name,
				"protocol":    string(p.Protocol),
				"port":        p.Port,
				"target_port": p.TargetPort.String(),
			}
			if p.NodePort > 0 {
				portEntry["node_port"] = p.NodePort
			}
			ports = append(ports, portEntry)
		}

		// Get endpoint count for health check
		endpoints, epErr := clientset.CoreV1().Endpoints(svc.Namespace).Get(ctx, svc.Name, metav1.GetOptions{})
		endpointCount := 0
		if epErr == nil {
			for _, sub := range endpoints.Subsets {
				endpointCount += len(sub.Addresses)
			}
		}

		// External IPs
		externalIPs := svc.Spec.ExternalIPs
		lbIngress := []string{}
		for _, ing := range svc.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				lbIngress = append(lbIngress, ing.IP)
			} else if ing.Hostname != "" {
				lbIngress = append(lbIngress, ing.Hostname)
			}
		}

		svcEntry := map[string]interface{}{
			"name":            svc.Name,
			"namespace":       svc.Namespace,
			"type":            string(svc.Spec.Type),
			"cluster_ip":      svc.Spec.ClusterIP,
			"ports":           ports,
			"selector":        svc.Spec.Selector,
			"endpoint_count":  endpointCount,
			"external_ips":    externalIPs,
			"lb_ingress":      lbIngress,
			"created_at":      svc.CreationTimestamp.Time,
			"has_no_endpoints": endpointCount == 0 && svc.Spec.Type != corev1.ServiceTypeExternalName && svc.Spec.ClusterIP != "None",
		}
		result = append(result, svcEntry)
	}

	return result
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
// PREVIOUS CONTAINER LOGS COLLECTION
// Collects logs from crashed/restarted containers (Previous: true)
// Used by AI to diagnose root causes
// ---------------------------------------------
func collectPreviousLogs(clientset *kubernetes.Clientset) map[string]interface{} {
	logsData := []interface{}{}

	podList, err := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Could not list pods for previous logs: %v", err)
		return map[string]interface{}{"pods_with_logs": logsData}
	}

	for _, pod := range podList.Items {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.RestartCount == 0 {
				continue
			}

			tailLines := int64(100)
			prevReq := clientset.CoreV1().Pods(pod.Namespace).GetLogs(pod.Name, &corev1.PodLogOptions{
				Container: cs.Name,
				TailLines: &tailLines,
				Previous:  true,
			})
			prevStream, err := prevReq.Stream(context.Background())
			if err != nil {
				// No previous logs available (e.g. first crash logs already gone)
				continue
			}
			buf := new(bytes.Buffer)
			io.Copy(buf, prevStream)
			prevStream.Close()

			exitReason := ""
			exitCode := int32(0)
			var lastFinishedAt string
			if cs.LastTerminationState.Terminated != nil {
				lts := cs.LastTerminationState.Terminated
				exitReason = lts.Reason
				exitCode = lts.ExitCode
				lastFinishedAt = lts.FinishedAt.Format(time.RFC3339)
			}

			logsData = append(logsData, map[string]interface{}{
				"pod":              pod.Name,
				"namespace":        pod.Namespace,
				"container":        cs.Name,
				"restart_count":    cs.RestartCount,
				"exit_reason":      exitReason,
				"exit_code":        exitCode,
				"last_finished_at": lastFinishedAt,
				"logs":             buf.String(),
			})
		}
	}

	log.Printf("📋 Collected previous logs for %d restarted containers", len(logsData))
	return map[string]interface{}{"pods_with_logs": logsData}
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
	PodRef           PodReference  `json:"podRef"`
	VolumeStats      []VolumeStats `json:"volume,omitempty"`
	EphemeralStorage *FsStats      `json:"ephemeral-storage,omitempty"`
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

// fetchKubeletStatsSummary tries to get the Kubelet stats/summary from a node using
// multiple strategies: API-server proxy, nodes/stats subresource, and direct Kubelet HTTP.
func fetchKubeletStatsSummary(clientset *kubernetes.Clientset, node *corev1.Node) ([]byte, error) {
	// Strategy 1: nodes/proxy via API server (standard)
	data, err := clientset.CoreV1().RESTClient().Get().
		Resource("nodes").
		Name(node.Name).
		SubResource("proxy").
		Suffix("stats/summary").
		DoRaw(context.Background())
	if err == nil {
		return data, nil
	}
	proxyErr := err

	// Strategy 2: nodes/stats subresource (works on some clusters)
	data, err = clientset.CoreV1().RESTClient().Get().
		Resource("nodes").
		Name(node.Name).
		SubResource("stats").
		Suffix("summary").
		DoRaw(context.Background())
	if err == nil {
		return data, nil
	}

	// Strategy 3: Direct Kubelet read-only HTTP (port 10255, no auth)
	// Works on clusters that expose the read-only Kubelet port
	for _, addr := range node.Status.Addresses {
		if addr.Type != corev1.NodeInternalIP && addr.Type != corev1.NodeExternalIP {
			continue
		}
		url := fmt.Sprintf("http://%s:10255/stats/summary", addr.Address)
		httpClient := &http.Client{Timeout: 5 * time.Second}
		resp, httpErr := httpClient.Get(url)
		if httpErr != nil {
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr == nil && resp.StatusCode == 200 && len(body) > 10 {
			log.Printf("   📡 Got Kubelet stats for node %s via direct HTTP (port 10255)", node.Name)
			return body, nil
		}
	}

	// All strategies failed — return the original proxy error for logging
	return nil, proxyErr
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
		responseBytes, fetchErr := fetchKubeletStatsSummary(clientset, &node)

		if fetchErr != nil {
			errStr := fetchErr.Error()
			if strings.Contains(errStr, "forbidden") {
				log.Printf("⚠️  Kubelet stats forbidden for node %s — needs nodes/proxy and nodes/stats permission in ClusterRole", node.Name)
			} else {
				log.Printf("⚠️  Kubelet stats unavailable for node %s (%v) — will use df fallback", node.Name, fetchErr)
			}
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
// PVC COLLECTION (with df fallback for real usage)
// ---------------------------------------------
func collectPVCs(clientset *kubernetes.Clientset, restConfig *rest.Config) []map[string]interface{} {
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

	// Track PVCs that need df fallback (limit to avoid too many execs)
	dfFallbackCount := 0
	maxDfFallbacks := 10 // Maximum exec calls per collection cycle

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
		usageSource := "none"

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
		if stats, exists := pvcVolumeStats[pvcKey]; exists && stats.UsedBytes > 0 {
			usedBytes = stats.UsedBytes
			capacityBytes = stats.CapacityBytes
			usageSource = "kubelet"
			log.Printf("📊 PVC %s: real usage from Kubelet = %.2f GB / %.2f GB",
				pvcKey, float64(usedBytes)/(1024*1024*1024), float64(capacityBytes)/(1024*1024*1024))
		} else if restConfig != nil && dfFallbackCount < maxDfFallbacks && pvc.Status.Phase == corev1.ClaimBound {
			// Fallback: Try df command via exec if Kubelet stats returned 0 or missing
			dfUsage, err := collectPVCUsageViaDf(clientset, restConfig, pvc.Namespace, pvc.Name, requestedBytes)
			if err == nil && dfUsage.UsedBytes > 0 {
				usedBytes = dfUsage.UsedBytes
				capacityBytes = dfUsage.TotalBytes
				usageSource = "df_exec"
				dfFallbackCount++
				log.Printf("📊 PVC %s: real usage from df exec = %.2f GB / %.2f GB",
					pvcKey, float64(usedBytes)/(1024*1024*1024), float64(capacityBytes)/(1024*1024*1024))
			} else {
				// No data available from df either
				if pvc.Status.Capacity != nil {
					if storage, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
						capacityBytes = storage.Value()
					}
				}
				if actualCapacity > 0 && capacityBytes == 0 {
					capacityBytes = actualCapacity
				}
				usedBytes = 0
			}
		} else {
			// Final fallback: Use PVC status capacity if available
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
			"usage_source":    usageSource, // Track how we got usage data
		})

		// Mark PV as bound
		if pvc.Spec.VolumeName != "" {
			boundPVs[pvc.Spec.VolumeName] = true
		}
	}

	log.Printf("📦 Collected %d PVCs (Kubelet stats: %d, df fallback: %d)",
		len(pvcDetails), len(pvcVolumeStats), dfFallbackCount)
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
			"name":                pv.Name,
			"status":              status,
			"capacity_bytes":      capacityBytes,
			"storage_class":       storageClassName,
			"reclaim_policy":      reclaimPolicy,
			"access_modes":        accessModes,
			"volume_mode":         volumeMode,
			"claim_ref_namespace": claimRefNamespace,
			"claim_ref_name":      claimRefName,
			"created_at":          pv.CreationTimestamp.Time,
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
			"node_name":       node.Name,
			"capacity_bytes":  nodeCapacity,
			"used_bytes":      nodeUsed,
			"available_bytes": nodeAvailable,
			"source":          source,
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
		"cluster_roles_count":         0,
		"cluster_role_bindings_count": 0,
		"roles_count":                 0,
		"role_bindings_count":         0,
		"has_rbac":                    false,
		"cluster_roles":               []string{},
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
		"total_pods":                  0,
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
		"type":            "unknown",
		"detected":        false,
		"namespace":       "",
		"has_rbac":        false,
		"rbac_details":    map[string]interface{}{},
		"deployment_name": "",
		"service_account": "",
		"version":         "",
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
		"has_proper_rbac":      false,
		"cluster_role":         "",
		"cluster_role_binding": "",
		"role":                 "",
		"role_binding":         "",
		"missing_permissions":  []string{},
		"warnings":             []string{},
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
		"":                    {"services", "endpoints", "secrets", "configmaps", "pods"},
		"networking.k8s.io":   {"ingresses", "ingressclasses"},
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
func sendMetrics(clientset *kubernetes.Clientset, metricsClient *metricsv.Clientset, restConfig *rest.Config, config AgentConfig) {
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
				"pvcs": collectPVCs(clientset, restConfig),
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
		{
			"type":         "pod_previous_logs",
			"data":         collectPreviousLogs(clientset),
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "namespace_resources",
			"data": map[string]interface{}{
				"namespaces": collectNamespaceSummary(clientset),
			},
			"collected_at": time.Now().UTC().Format(time.RFC3339),
		},
		{
			"type": "services",
			"data": map[string]interface{}{
				"services": collectServicesData(clientset),
			},
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

	// Headers for authentication and version tracking
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)
	req.Header.Set("x-agent-version", AgentVersion)

	log.Printf("🔍 Headers: Content-Type=application/json, x-agent-key=%s...%s, x-agent-version=%s",
		config.APIKey[:8], config.APIKey[len(config.APIKey)-4:], AgentVersion)

	client := &http.Client{Timeout: 30 * time.Second}
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

func getCommands(clientset *kubernetes.Clientset, metricsClient *metricsv.Clientset, restConfig *rest.Config, config AgentConfig) {
	url := fmt.Sprintf("%s/agent-get-commands", config.APIEndpoint)
	log.Printf("🔍 Polling commands from: %s", url)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)
	req.Header.Set("x-agent-version", AgentVersion)

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
		executeCommands(clientset, metricsClient, restConfig, config, commandsResp.Commands)
	} else {
		log.Printf("📭 No pending commands")
	}
}

// ---------------------------------------------
// COMMAND EXECUTION
// ---------------------------------------------
func executeCommands(clientset *kubernetes.Clientset, metricsClient *metricsv.Clientset, restConfig *rest.Config, config AgentConfig, commands []Command) {
	for _, cmd := range commands {
		log.Printf("⚡ Executing command: %s (ID: %s)", cmd.CommandType, cmd.ID)
		log.Printf("   Params: %v", cmd.CommandParams)

		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🔥 PANIC in command %s (%s): %v", cmd.ID, cmd.CommandType, r)
					panicErr := fmt.Errorf("agent panic: %v", r)
					updateCommandStatus(config, cmd.ID, nil, panicErr)
				}
			}()

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
		case "self_update", "agent_update":
			log.Printf("   → Self-updating agent...")
			result, err = selfUpdate(clientset, cmd.CommandParams)
			// After successful update, the pod will restart and won't continue execution
		case "get_pod_logs":
			log.Printf("   → Fetching pod logs...")
			result, err = getPodLogs(clientset, cmd.CommandParams)
		case "send_metrics":
				log.Printf("   → Forcing immediate metrics push...")
				go sendMetrics(clientset, metricsClient, restConfig, config)
				result = map[string]interface{}{"status": "triggered"}
			case "collect_cluster_snapshot":
				log.Printf("   → Collecting cluster snapshot...")
				markCommandExecuting(config, cmd.ID)
				result, err = collectClusterSnapshot(clientset, config, cmd.CommandParams)
		case "apply_manifests":
			log.Printf("   → Applying transformed manifests...")
			markCommandExecuting(config, cmd.ID)
			result, err = applyManifests(clientset, cmd.CommandParams)
		case "validate_migration":
			log.Printf("   → Running migration validations...")
			markCommandExecuting(config, cmd.ID)
			result, err = validateMigration(clientset, cmd.CommandParams)
		case "create_namespace":
			log.Printf("   → Creating namespace...")
			result, err = createNamespace(clientset, cmd.CommandParams)
		case "delete_namespace":
			log.Printf("   → Deleting namespace...")
			result, err = deleteNamespace(clientset, cmd.CommandParams)
		case "create_network_policy":
			log.Printf("   → Creating network policy...")
			result, err = createNetworkPolicy(clientset, cmd.CommandParams)
		default:
				err = fmt.Errorf("unknown command type: %s", cmd.CommandType)
				log.Printf("   ❌ Unknown command type!")
			}

			if err != nil {
				log.Printf("   ❌ Command failed: %v", err)
			} else {
				log.Printf("   ✅ Command succeeded")
			}

			updateCommandStatus(config, cmd.ID, result, err)
		}()
	}
}

// ---------------------------------------------
// NAMESPACE MANAGEMENT
// ---------------------------------------------

// protectedNamespaces cannot be deleted via agent commands
var protectedNamespaces = map[string]bool{
	"default":          true,
	"kube-system":      true,
	"kube-public":      true,
	"kube-node-lease":  true,
	"kodo":             true,
	"kodo-agent":       true,
	"calico-system":    true,
	"calico-apiserver": true,
	"tigera-operator":  true,
	"cert-manager":     true,
	"ingress-nginx":    true,
	"monitoring":       true,
}

func collectNamespaceSummary(clientset *kubernetes.Clientset) []map[string]interface{} {
	namespaces, err := clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Error listing namespaces: %v", err)
		return []map[string]interface{}{}
	}

	result := make([]map[string]interface{}, 0, len(namespaces.Items))

	for _, ns := range namespaces.Items {
		nsName := ns.Name

		// Count pods
		pods, _ := clientset.CoreV1().Pods(nsName).List(context.Background(), metav1.ListOptions{})
		podList := []string{}
		if pods != nil {
			for _, p := range pods.Items {
				podList = append(podList, p.Name)
			}
		}

		// Count PVCs
		pvcs, _ := clientset.CoreV1().PersistentVolumeClaims(nsName).List(context.Background(), metav1.ListOptions{})
		pvcList := []string{}
		if pvcs != nil {
			for _, p := range pvcs.Items {
				pvcList = append(pvcList, p.Name)
			}
		}

		// Count services (skip the built-in kubernetes service)
		svcs, _ := clientset.CoreV1().Services(nsName).List(context.Background(), metav1.ListOptions{})
		svcList := []string{}
		if svcs != nil {
			for _, s := range svcs.Items {
				if s.Name == "kubernetes" && nsName == "default" {
					continue
				}
				svcList = append(svcList, s.Name)
			}
		}

		// Count user secrets (skip service-account tokens and helm releases)
		secrets, _ := clientset.CoreV1().Secrets(nsName).List(context.Background(), metav1.ListOptions{})
		secretList := []string{}
		if secrets != nil {
			for _, s := range secrets.Items {
				if s.Type == corev1.SecretTypeServiceAccountToken {
					continue
				}
				// Skip helm managed secrets
				if strings.HasPrefix(s.Name, "sh.helm.release.") {
					continue
				}
				secretList = append(secretList, s.Name)
			}
		}

		// Count deployments
		deploys, _ := clientset.AppsV1().Deployments(nsName).List(context.Background(), metav1.ListOptions{})
		deployCount := 0
		if deploys != nil {
			deployCount = len(deploys.Items)
		}

		isEmpty := len(podList) == 0 && len(pvcList) == 0 && len(svcList) == 0 && len(secretList) == 0 && deployCount == 0

		result = append(result, map[string]interface{}{
			"name":         nsName,
			"pods":         len(podList),
			"pod_list":     podList,
			"pvcs":         len(pvcList),
			"pvc_list":     pvcList,
			"services":     len(svcList),
			"service_list": svcList,
			"secrets":      len(secretList),
			"secret_list":  secretList,
			"deployments":  deployCount,
			"is_empty":     isEmpty,
			"is_protected": protectedNamespaces[nsName],
			"phase":        string(ns.Status.Phase),
			"created_at":   ns.CreationTimestamp.Format(time.RFC3339),
		})
	}

	return result
}

func createNamespace(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	name, _ := params["namespace"].(string)
	if name == "" {
		return nil, fmt.Errorf("namespace name is required")
	}
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
			Labels: map[string]string{
				"managed-by": "kodo",
				"created-by": "kodo-developer",
			},
		},
	}
	_, err := clientset.CoreV1().Namespaces().Create(context.Background(), ns, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"action":    "namespace_created",
		"namespace": name,
		"message":   fmt.Sprintf("Namespace '%s' created successfully", name),
	}, nil
}

func deleteNamespace(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	name, _ := params["namespace"].(string)
	if name == "" {
		return nil, fmt.Errorf("namespace name is required")
	}
	if protectedNamespaces[name] {
		return nil, fmt.Errorf("cannot delete protected namespace: %s", name)
	}
	err := clientset.CoreV1().Namespaces().Delete(context.Background(), name, metav1.DeleteOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"action":    "namespace_deleted",
		"namespace": name,
		"message":   fmt.Sprintf("Namespace '%s' deletion initiated", name),
	}, nil
}

func deletePod(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	podName := params["pod_name"].(string)
	namespace := params["namespace"].(string)
	commandID, _ := params["command_id"].(string)
	reason, _ := params["reason"].(string)
	deploymentName, _ := params["deployment_name"].(string)
	if reason == "" {
		reason = "manual_restart"
	}

	// Resolve the actual pod name — the AI may have stored a stale pod name
	// (pods get new hashes on restart; the command may be seconds or minutes old)
	resolvedPodName, err := resolveCurrentPodName(clientset, namespace, podName, deploymentName)
	if err != nil {
		return nil, fmt.Errorf("pod not found and could not find a replacement: %v", err)
	}
	if resolvedPodName != podName {
		log.Printf("⚠️  Pod %s/%s not found; resolved to current pod: %s", namespace, podName, resolvedPodName)
	}

	// Collect pod info and logs BEFORE deleting for audit
	auditData := collectPodAuditData(clientset, namespace, resolvedPodName, reason)

	// Delete the pod
	err = clientset.CoreV1().Pods(namespace).Delete(
		context.Background(),
		resolvedPodName,
		metav1.DeleteOptions{},
	)

	if err != nil {
		return nil, err
	}

	// Send audit data to backend (async, don't block on failure)
	go sendPodRestartAudit(auditData, commandID)

	return map[string]interface{}{
		"action":       "pod_deleted",
		"pod":          resolvedPodName,
		"original_pod": podName,
		"namespace":    namespace,
		"message":      "Pod deleted successfully. Kubernetes will recreate it.",
		"audit_logged": true,
	}, nil
}

// resolveCurrentPodName returns the pod name to actually delete.
// If the exact pod still exists → returns it unchanged.
// Otherwise it strips the pod-hash suffix to derive a deployment name,
// lists all pods in the namespace, and returns the first live pod whose
// name starts with the deployment prefix.
func resolveCurrentPodName(clientset *kubernetes.Clientset, namespace, podName, deploymentName string) (string, error) {
	// Fast path: exact pod still alive?
	_, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err == nil {
		return podName, nil // pod exists, use it directly
	}

	// Derive deployment-name prefix from the pod name if not provided.
	// Pod names follow: <deployment>-<replicaset-hash>-<pod-hash>
	// Strip the last two dash-separated segments to get the deployment name.
	prefix := deploymentName
	if prefix == "" {
		parts := strings.Split(podName, "-")
		if len(parts) >= 3 {
			// Remove last 2 segments (replicaset hash + pod hash)
			prefix = strings.Join(parts[:len(parts)-2], "-")
		} else if len(parts) >= 2 {
			prefix = strings.Join(parts[:len(parts)-1], "-")
		} else {
			prefix = podName
		}
	}

	log.Printf("🔍 Searching for current pod with prefix %q in namespace %s", prefix, namespace)

	podList, listErr := clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{})
	if listErr != nil {
		return "", fmt.Errorf("pod %s not found and cannot list pods: %v", podName, listErr)
	}

	for _, p := range podList.Items {
		if strings.HasPrefix(p.Name, prefix) && p.DeletionTimestamp == nil {
			// Prefer Running pods; fall back to any non-terminating pod
			if p.Status.Phase == corev1.PodRunning {
				return p.Name, nil
			}
		}
	}
	// Second pass: accept any non-terminating pod with the prefix
	for _, p := range podList.Items {
		if strings.HasPrefix(p.Name, prefix) && p.DeletionTimestamp == nil {
			return p.Name, nil
		}
	}

	return "", fmt.Errorf("no pod found with prefix %q in namespace %s (original: %s)", prefix, namespace, podName)
}

// collectPodAuditData collects pod state and logs before restart for auditing
func collectPodAuditData(clientset *kubernetes.Clientset, namespace, podName, reason string) map[string]interface{} {
	auditData := map[string]interface{}{
		"pod_name":       podName,
		"namespace":      namespace,
		"restart_reason": reason,
		"collected_at":   time.Now().UTC().Format(time.RFC3339),
	}

	// Get pod details
	pod, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		log.Printf("⚠️  Could not get pod details for audit: %v", err)
		return auditData
	}

	// Extract container info and previous state
	if len(pod.Status.ContainerStatuses) > 0 {
		for _, cs := range pod.Status.ContainerStatuses {
			auditData["container_name"] = cs.Name
			auditData["restart_count"] = cs.RestartCount

			// Get previous state (termination info)
			if cs.LastTerminationState.Terminated != nil {
				term := cs.LastTerminationState.Terminated
				auditData["exit_code"] = term.ExitCode
				auditData["terminated_at"] = term.FinishedAt.Format(time.RFC3339)
				auditData["previous_state"] = map[string]interface{}{
					"reason":      term.Reason,
					"message":     term.Message,
					"exit_code":   term.ExitCode,
					"signal":      term.Signal,
					"started_at":  term.StartedAt.Format(time.RFC3339),
					"finished_at": term.FinishedAt.Format(time.RFC3339),
				}
			}

			// Get container logs (last 100 lines)
			logs := getContainerLogs(clientset, namespace, podName, cs.Name, 100)
			if logs != "" {
				auditData["logs"] = logs
			}

			break // Just get first container for now
		}
	}

	return auditData
}

// getContainerLogs fetches the last N lines of logs from a container
func getContainerLogs(clientset *kubernetes.Clientset, namespace, podName, containerName string, tailLines int64) string {
	// Always fetch current logs first (most relevant for running containers)
	logsReq := clientset.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		Container: containerName,
		TailLines: &tailLines,
		Previous:  false,
	})
	logsStream, err := logsReq.Stream(context.Background())
	if err != nil {
		log.Printf("⚠️  Could not get logs for %s/%s (container=%s): %v", namespace, podName, containerName, err)
		if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
			return fmt.Sprintf("[ERRO DE PERMISSÃO] O agente não tem permissão para ler logs deste container.\nAdicione 'pods/log' ao ClusterRole do kodo-agent:\n  resources: [\"pods/log\"]\n  verbs: [\"get\"]")
		}
		return ""
	}
	defer logsStream.Close()

	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, logsStream)
	if err != nil {
		log.Printf("⚠️  Error reading logs: %v", err)
		return ""
	}
	return buf.String()
}

// getPodLogs fetches logs for a specific pod (on-demand command)
func getPodLogs(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	podName, _ := params["pod_name"].(string)
	namespace, _ := params["namespace"].(string)
	tailLinesF, _ := params["tail_lines"].(float64)
	containerName, _ := params["container_name"].(string)
	previousOnly, _ := params["previous"].(bool)

	if podName == "" || namespace == "" {
		return nil, fmt.Errorf("missing required params: pod_name, namespace")
	}

	tailLines := int64(200)
	if tailLinesF > 0 {
		tailLines = int64(tailLinesF)
	}

	// Get pod info to resolve container name and detect init containers
	pod, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %v", err)
	}

	// Find the best container to fetch logs from
	allContainers := []string{}
	for _, c := range pod.Spec.InitContainers {
		allContainers = append(allContainers, c.Name)
	}
	for _, c := range pod.Spec.Containers {
		allContainers = append(allContainers, c.Name)
	}

	if containerName == "" {
		// Default to first regular container (not init)
		if len(pod.Spec.Containers) > 0 {
			containerName = pod.Spec.Containers[0].Name
		} else if len(allContainers) > 0 {
			containerName = allContainers[0]
		}
	}

	if containerName == "" {
		return nil, fmt.Errorf("no containers found in pod %s/%s", namespace, podName)
	}

	streamLogs := func(previous bool) string {
		req := clientset.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
			Container: containerName,
			TailLines: &tailLines,
			Previous:  previous,
		})
		stream, err := req.Stream(context.Background())
		if err != nil {
			if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
				return fmt.Sprintf("[ERRO DE PERMISSÃO] O agente não tem acesso aos logs.\nAdicione 'pods/log' ao ClusterRole do kodo-agent e aplique: kubectl apply -f kodo-agent.yaml")
			}
			return "" // previous container not available, or other transient error
		}
		defer stream.Close()
		buf := new(bytes.Buffer)
		io.Copy(buf, stream)
		return buf.String()
	}

	var output string

	if previousOnly {
		// Requested only previous (crashed) container logs
		output = streamLogs(true)
		if output == "" {
			output = "Nenhum log do container anterior disponível (container não crashou recentemente)."
		}
	} else {
		// Fetch both: current logs + previous crashed container logs (if any)
		currentLogs := streamLogs(false)
		previousLogs := streamLogs(true)

		// Determine restart count for context
		restartCount := int32(0)
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == containerName {
				restartCount = cs.RestartCount
				break
			}
		}

		if currentLogs == "" && previousLogs == "" {
			output = "Nenhum log disponível para este container."
		} else if previousLogs != "" && currentLogs != "" && previousLogs != currentLogs {
			header := fmt.Sprintf("=== LOGS DO CONTAINER ATUAL (reinicializações: %d) ===\n", restartCount)
			prevHeader := "=== LOGS DO CONTAINER ANTERIOR (último crash) ===\n"
			output = header + currentLogs + "\n\n" + prevHeader + previousLogs
		} else if previousLogs != "" && currentLogs == "" {
			output = fmt.Sprintf("=== LOGS DO CONTAINER ANTERIOR (reinicializações: %d) ===\n", restartCount) + previousLogs
		} else {
			output = currentLogs
		}
	}

	log.Printf("📋 Fetched %d bytes of logs for %s/%s (container=%s)", len(output), namespace, podName, containerName)

	return map[string]interface{}{
		"logs":           output,
		"pod":            podName,
		"namespace":      namespace,
		"container":      containerName,
		"lines":          tailLines,
		"all_containers": allContainers,
	}, nil
}

// sendPodRestartAudit sends the audit data to the backend
func sendPodRestartAudit(auditData map[string]interface{}, commandID string) {
	config := loadConfig()
	if config.APIEndpoint == "" {
		log.Printf("⚠️  Cannot send audit: API endpoint not configured")
		return
	}

	if commandID != "" {
		auditData["command_id"] = commandID
	}

	body, err := json.Marshal(auditData)
	if err != nil {
		log.Printf("⚠️  Failed to marshal audit data: %v", err)
		return
	}

	url := fmt.Sprintf("%s/collect-pod-logs", config.APIEndpoint)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️  Failed to send pod restart audit: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		log.Printf("📋 Pod restart audit sent successfully for %s/%s", auditData["namespace"], auditData["pod_name"])
	} else {
		respBody, _ := ioutil.ReadAll(resp.Body)
		log.Printf("⚠️  Audit endpoint returned %d: %s", resp.StatusCode, string(respBody))
	}
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
	deploymentName, _ := params["deployment_name"].(string)
	namespace, _ := params["namespace"].(string)
	containerName, _ := params["container_name"].(string)

	if namespace == "" {
		namespace = "default"
	}
	if deploymentName == "" {
		return nil, fmt.Errorf("deployment_name is required (got nil/empty); apply_to_all_pods is not supported")
	}

	// If container_name is empty, target all containers in the deployment.
	applyToAll := containerName == ""

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
		if !applyToAll && container.Name != containerName {
			continue
		}
		if cpuRequest, ok := params["cpu_request"].(string); ok && cpuRequest != "" {
			if deployment.Spec.Template.Spec.Containers[i].Resources.Requests == nil {
				deployment.Spec.Template.Spec.Containers[i].Resources.Requests = corev1.ResourceList{}
			}
			deployment.Spec.Template.Spec.Containers[i].Resources.Requests[corev1.ResourceCPU] = resource.MustParse(cpuRequest)
		}
		if memRequest, ok := params["memory_request"].(string); ok && memRequest != "" {
			if deployment.Spec.Template.Spec.Containers[i].Resources.Requests == nil {
				deployment.Spec.Template.Spec.Containers[i].Resources.Requests = corev1.ResourceList{}
			}
			deployment.Spec.Template.Spec.Containers[i].Resources.Requests[corev1.ResourceMemory] = resource.MustParse(memRequest)
		}
		if cpuLimit, ok := params["cpu_limit"].(string); ok && cpuLimit != "" {
			if deployment.Spec.Template.Spec.Containers[i].Resources.Limits == nil {
				deployment.Spec.Template.Spec.Containers[i].Resources.Limits = corev1.ResourceList{}
			}
			deployment.Spec.Template.Spec.Containers[i].Resources.Limits[corev1.ResourceCPU] = resource.MustParse(cpuLimit)
		}
		if memLimit, ok := params["memory_limit"].(string); ok && memLimit != "" {
			if deployment.Spec.Template.Spec.Containers[i].Resources.Limits == nil {
				deployment.Spec.Template.Spec.Containers[i].Resources.Limits = corev1.ResourceList{}
			}
			deployment.Spec.Template.Spec.Containers[i].Resources.Limits[corev1.ResourceMemory] = resource.MustParse(memLimit)
		}
		updated = true
		if !applyToAll {
			break
		}
	}

	if !updated {
		if applyToAll {
			return nil, fmt.Errorf("deployment %s/%s has no containers", namespace, deploymentName)
		}
		return nil, fmt.Errorf("container %s not found in deployment %s/%s", containerName, namespace, deploymentName)
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

// createNetworkPolicy creates a NetworkPolicy in the target namespace.
// Supported policy_type values: "deny-all-ingress" (default), "deny-all-egress", "deny-all".
// If apply_to_all_namespaces=true, the policy is applied to every non-system namespace.
func createNetworkPolicy(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	namespace, _ := params["namespace"].(string)
	policyName, _ := params["policy_name"].(string)
	policyType, _ := params["policy_type"].(string)
	applyAll, _ := params["apply_to_all_namespaces"].(bool)

	if policyName == "" {
		policyName = fmt.Sprintf("kodo-deny-%d", time.Now().Unix())
	}
	if policyType == "" {
		policyType = "deny-all-ingress"
	}

	buildSpec := func() networkingv1.NetworkPolicySpec {
		spec := networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{}, // empty = all pods
		}
		switch policyType {
		case "deny-all-egress":
			spec.PolicyTypes = []networkingv1.PolicyType{networkingv1.PolicyTypeEgress}
		case "deny-all":
			spec.PolicyTypes = []networkingv1.PolicyType{networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress}
		default:
			spec.PolicyTypes = []networkingv1.PolicyType{networkingv1.PolicyTypeIngress}
		}
		return spec
	}

	targets := []string{}
	if applyAll {
		nsList, err := clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list namespaces: %v", err)
		}
		systemNS := map[string]bool{
			"kube-system": true, "kube-public": true, "kube-node-lease": true,
			"cert-manager": true, "ingress": true, "kodo": true, "lens-metrics": true,
		}
		for _, ns := range nsList.Items {
			if !systemNS[ns.Name] {
				targets = append(targets, ns.Name)
			}
		}
	} else {
		if namespace == "" {
			namespace = "default"
		}
		targets = append(targets, namespace)
	}

	created := []string{}
	skipped := []string{}
	for _, ns := range targets {
		np := &networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{
				Name:      policyName,
				Namespace: ns,
				Labels:    map[string]string{"managed-by": "kodo-agent"},
			},
			Spec: buildSpec(),
		}
		_, err := clientset.NetworkingV1().NetworkPolicies(ns).Create(
			context.Background(), np, metav1.CreateOptions{},
		)
		if err != nil {
			if strings.Contains(err.Error(), "already exists") {
				skipped = append(skipped, ns)
				continue
			}
			return map[string]interface{}{
				"action":  "create_network_policy",
				"created": created,
				"skipped": skipped,
				"error":   err.Error(),
			}, fmt.Errorf("failed to create network policy in %s: %v", ns, err)
		}
		created = append(created, ns)
	}

	return map[string]interface{}{
		"action":      "network_policy_created",
		"policy_name": policyName,
		"policy_type": policyType,
		"created":     created,
		"skipped":     skipped,
		"message":     fmt.Sprintf("NetworkPolicy %s applied to %d namespace(s), %d already existed", policyName, len(created), len(skipped)),
	}, nil
}


// markCommandExecuting notifies the server that this command is actively running.
// This prevents the stale-command cleanup from re-queuing or deleting long-running operations.
func markCommandExecuting(config AgentConfig, commandID string) {
	payload := map[string]interface{}{
		"command_id": commandID,
		"status":     "executing",
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/agent-update-command", config.APIEndpoint)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("⚠️  Failed to create executing request for %s: %v", commandID, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)
	req.Header.Set("x-agent-version", AgentVersion)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️  Failed to mark command executing: %v", err)
		return
	}
	defer resp.Body.Close()
	log.Printf("📌 Command %s marked as executing", commandID)
}

func updateCommandStatus(config AgentConfig, commandID string, result map[string]interface{}, err error) {
	status := "completed"
	if err != nil {
		status = "failed"
		result = map[string]interface{}{"error": err.Error()}
	}

	// Edge function rejects payloads >200KB — trim large log arrays before sending
	if result != nil {
		if applyLog, ok := result["apply_log"].([]map[string]interface{}); ok && len(applyLog) > 100 {
			// Keep only failures (most useful) and cap at 100 entries total
			var failures []map[string]interface{}
			for _, entry := range applyLog {
				if entry["status"] == "failed" {
					failures = append(failures, entry)
				}
			}
			if len(failures) > 100 {
				failures = failures[:100]
			}
			result["apply_log"] = failures
			result["apply_log_truncated"] = true
		}
		// Final safety check: if result JSON still exceeds 150KB, strip the log entirely
		if b, _ := json.Marshal(result); len(b) > 150000 {
			result = map[string]interface{}{
				"migration_id":  result["migration_id"],
				"applied":       result["applied"],
				"failed":        result["failed"],
				"log_truncated": true,
			}
		}
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
	req.Header.Set("x-agent-version", AgentVersion)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️  Failed to update command %s status: %v", commandID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := ioutil.ReadAll(resp.Body)
		log.Printf("⚠️  Command %s status update returned %d: %s", commandID, resp.StatusCode, string(respBody))
		return
	}

	log.Printf("✅ Command %s status updated: %s", commandID, status)
}

// ---------------------------------------------
// STARTUP REPORT
// Reports agent startup/restart event to backend
// ---------------------------------------------
func reportAgentStartup(clientset *kubernetes.Clientset, config AgentConfig) {
	podName := os.Getenv("HOSTNAME")
	namespace := "kodo"

	payload := map[string]interface{}{
		"agent_version":  AgentVersion,
		"pod_name":       podName,
		"start_time":     time.Now().Format(time.RFC3339),
		"restart_count":  0,
		"exit_code":      0,
		"restart_reason": "unknown",
		"previous_logs":  "",
	}

	if podName != "" && clientset != nil {
		pod, err := clientset.CoreV1().Pods(namespace).Get(
			context.Background(), podName, metav1.GetOptions{},
		)
		if err == nil {
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Name == "agent" || cs.Name == "kodo-agent" {
					payload["restart_count"] = cs.RestartCount
					if cs.LastTerminationState.Terminated != nil {
						lts := cs.LastTerminationState.Terminated
						payload["exit_code"] = lts.ExitCode
						payload["restart_reason"] = lts.Reason
						payload["last_finished_at"] = lts.FinishedAt.Format(time.RFC3339)
					}
					break
				}
			}
		} else {
			log.Printf("⚠️  Could not get own pod info: %v", err)
		}

		// Fetch last 50 lines of previous container logs (if container restarted)
		tailLines := int64(50)
		prevReq := clientset.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
			Container: "agent",
			TailLines: &tailLines,
			Previous:  true,
		})
		if prevStream, err := prevReq.Stream(context.Background()); err == nil {
			defer prevStream.Close()
			buf := new(bytes.Buffer)
			io.Copy(buf, prevStream)
			payload["previous_logs"] = buf.String()
		}
	}

	log.Printf("📤 Reporting startup event: version=%s pod=%s restart_count=%v reason=%v",
		AgentVersion, podName, payload["restart_count"], payload["restart_reason"])

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/agent-report-startup", config.APIEndpoint)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("⚠️  Failed to create startup report request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-key", config.APIKey)
	req.Header.Set("x-agent-version", AgentVersion)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️  Failed to report startup: %v", err)
		return
	}
	defer resp.Body.Close()
	log.Printf("📤 Startup event reported (HTTP %d)", resp.StatusCode)
}

// ---------------------------------------------
// SELF UPDATE
// Performs a rollout restart of the agent deployment
// ---------------------------------------------
func selfUpdate(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	// Auto-detect own namespace from mounted service account token (most reliable)
	defaultNamespace := "kodo-agent"
	if nsBytes, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); err == nil {
		ns := strings.TrimSpace(string(nsBytes))
		if ns != "" {
			defaultNamespace = ns
		}
	}

	namespace := defaultNamespace
	deploymentName := "kodo-agent"

	if ns, ok := params["namespace"].(string); ok && ns != "" {
		namespace = ns
	}
	if dn, ok := params["deployment_name"].(string); ok && dn != "" {
		deploymentName = dn
	}

	// Optional: new image tag
	newImage, hasNewImage := params["new_image"].(string)

	log.Printf("🔄 Starting self-update for %s/%s (current version: %s)", namespace, deploymentName, AgentVersion)

	// Get the deployment
	deployment, err := clientset.AppsV1().Deployments(namespace).Get(
		context.Background(),
		deploymentName,
		metav1.GetOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment %s/%s: %v", namespace, deploymentName, err)
	}

	// If new image provided, update it
	if hasNewImage && newImage != "" {
		log.Printf("📦 Updating image to: %s", newImage)
		updated := false
		// Try by name "agent" first, then by name "kodo-agent", then update all containers
		for _, targetName := range []string{"agent", "kodo-agent"} {
			for i := range deployment.Spec.Template.Spec.Containers {
				if deployment.Spec.Template.Spec.Containers[i].Name == targetName {
					deployment.Spec.Template.Spec.Containers[i].Image = newImage
					log.Printf("   Updated container %q to %s", targetName, newImage)
					updated = true
					break
				}
			}
			if updated {
				break
			}
		}
		// Fallback: if only one container, update it regardless of name
		if !updated && len(deployment.Spec.Template.Spec.Containers) == 1 {
			deployment.Spec.Template.Spec.Containers[0].Image = newImage
			log.Printf("   Updated sole container %q to %s", deployment.Spec.Template.Spec.Containers[0].Name, newImage)
		}
	}

	// Add/update annotation to trigger rollout restart
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}
	deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	// Update the deployment
	_, err = clientset.AppsV1().Deployments(namespace).Update(
		context.Background(),
		deployment,
		metav1.UpdateOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update deployment: %v", err)
	}

	log.Printf("✅ Self-update triggered! Deployment %s/%s will restart...", namespace, deploymentName)

	return map[string]interface{}{
		"action":           "self_update",
		"deployment":       deploymentName,
		"namespace":        namespace,
		"previous_version": AgentVersion,
		"new_image":        newImage,
		"message":          "Agent deployment updated. Pod will restart with new version.",
	}, nil
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
					"type":         event.Type,
					"reason":       event.Reason,
					"message":      event.Message,
					"namespace":    event.InvolvedObject.Namespace,
					"object":       event.InvolvedObject.Name,
					"kind":         event.InvolvedObject.Kind,
					"count":        event.Count,
					"last_time":    event.LastTimestamp.Time,
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

	// 4. RBAC wildcard scanning
	rbacFindings := collectRBACThreats(clientset)
	securityThreatsData["rbac_threats"] = rbacFindings

	// 5. Suspicious Jobs scanning
	jobThreats := collectJobThreats(clientset)
	securityThreatsData["suspicious_jobs"] = jobThreats

	// 6. Missing NetworkPolicies
	netPolGaps := collectNetworkPolicyGaps(clientset)
	securityThreatsData["network_policy_gaps"] = netPolGaps

	// 7. Secrets in ConfigMaps
	cmSecrets := collectConfigMapSecrets(clientset)
	securityThreatsData["configmap_secrets"] = cmSecrets

	// Log summary
	totalThreats := len(suspiciousPods) + len(privilegedContainers) + len(hostNetworkPods) + len(hostPidPods) +
		len(resourceAnomalies) + len(rbacFindings) + len(jobThreats) + len(netPolGaps) + len(cmSecrets)
	log.Printf("🔒 Security threats scan complete: %d potential threats detected", totalThreats)

	if totalThreats > 0 {
		log.Printf("   - Suspicious pods: %d", len(suspiciousPods))
		log.Printf("   - Privileged containers: %d", len(privilegedContainers))
		log.Printf("   - Host network pods: %d", len(hostNetworkPods))
		log.Printf("   - Host PID pods: %d", len(hostPidPods))
		log.Printf("   - Resource anomalies: %d", len(resourceAnomalies))
		log.Printf("   - RBAC threats: %d", len(rbacFindings))
		log.Printf("   - Suspicious jobs: %d", len(jobThreats))
		log.Printf("   - Network policy gaps: %d", len(netPolGaps))
		log.Printf("   - ConfigMap secrets: %d", len(cmSecrets))
	}

	return securityThreatsData
}

// collectRBACThreats scans ClusterRoles for wildcard permissions and dangerous bindings
func collectRBACThreats(clientset *kubernetes.Clientset) []map[string]interface{} {
	ctx := context.Background()
	var findings []map[string]interface{}

	clusterRoles, err := clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  RBAC scan: error listing ClusterRoles: %v", err)
		return findings
	}

	// Index ClusterRoles by name for binding lookup
	roleRules := make(map[string][]rbacv1.PolicyRule)
	for _, cr := range clusterRoles.Items {
		roleRules[cr.Name] = cr.Rules
	}

	// Find roles with wildcard permissions
	for _, cr := range clusterRoles.Items {
		// Skip built-in cluster-admin and system roles - they are expected
		if strings.HasPrefix(cr.Name, "system:") {
			continue
		}
		for _, rule := range cr.Rules {
			hasWildcardVerb := false
			hasWildcardResource := false
			for _, v := range rule.Verbs {
				if v == "*" {
					hasWildcardVerb = true
				}
			}
			for _, r := range rule.Resources {
				if r == "*" {
					hasWildcardResource = true
				}
			}
			if hasWildcardVerb || hasWildcardResource {
				findings = append(findings, map[string]interface{}{
					"kind":         "ClusterRole",
					"name":         cr.Name,
					"threat_level": "high",
					"source":       "rbac_wildcard",
					"reason":       fmt.Sprintf("ClusterRole '%s' has wildcard permissions (verbs=%v resources=%v)", cr.Name, rule.Verbs, rule.Resources),
				})
				break
			}
		}
	}

	// Find ClusterRoleBindings that grant cluster-admin or wildcard roles to non-system subjects
	bindings, err := clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  RBAC scan: error listing ClusterRoleBindings: %v", err)
		return findings
	}

	for _, crb := range bindings.Items {
		isDangerous := crb.RoleRef.Name == "cluster-admin"
		if !isDangerous {
			// Check if referenced role has wildcard
			for _, rule := range roleRules[crb.RoleRef.Name] {
				for _, v := range rule.Verbs {
					if v == "*" {
						isDangerous = true
						break
					}
				}
			}
		}
		if !isDangerous {
			continue
		}
		for _, subj := range crb.Subjects {
			// Skip system serviceaccounts
			if subj.Kind == "ServiceAccount" && subj.Namespace == "kube-system" {
				continue
			}
			if subj.Name == "system:masters" || strings.HasPrefix(subj.Name, "system:") {
				continue
			}
			// Flag non-system subjects bound to cluster-admin or wildcard roles
			threatLevel := "high"
			if crb.RoleRef.Name == "cluster-admin" {
				threatLevel = "critical"
			}
			findings = append(findings, map[string]interface{}{
				"kind":         "ClusterRoleBinding",
				"name":         crb.Name,
				"subject_kind": subj.Kind,
				"subject_name": subj.Name,
				"namespace":    subj.Namespace,
				"role_ref":     crb.RoleRef.Name,
				"threat_level": threatLevel,
				"source":       "rbac_privilege",
				"reason":       fmt.Sprintf("Subject '%s/%s' is bound to powerful role '%s' via ClusterRoleBinding '%s'", subj.Kind, subj.Name, crb.RoleRef.Name, crb.Name),
			})
		}
	}

	return findings
}

// collectJobThreats scans Kubernetes Jobs for suspicious or failed patterns
func collectJobThreats(clientset *kubernetes.Clientset) []map[string]interface{} {
	ctx := context.Background()
	var findings []map[string]interface{}

	jobs, err := clientset.BatchV1().Jobs("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Jobs scan: error listing Jobs: %v", err)
		return findings
	}

	suspiciousJobPatterns := []string{
		"miner", "xmrig", "monero", "hack", "exploit", "shell", "backdoor",
		"crypto", "attack", "malware", "scan", "brute", "flood",
	}

	oneHourAgo := time.Now().Add(-1 * time.Hour)

	for _, job := range jobs.Items {
		isSystemNS := job.Namespace == "kube-system" || job.Namespace == "kube-public" || job.Namespace == "kube-node-lease"
		if isSystemNS {
			continue
		}

		nameLower := strings.ToLower(job.Name)

		// Check for suspicious job names
		for _, pattern := range suspiciousJobPatterns {
			if strings.Contains(nameLower, pattern) {
				findings = append(findings, map[string]interface{}{
					"job_name":     job.Name,
					"namespace":    job.Namespace,
					"threat_level": "high",
					"source":       "suspicious_job",
					"reason":       fmt.Sprintf("Job '%s/%s' has suspicious name pattern: '%s'", job.Namespace, job.Name, pattern),
					"created_at":   job.CreationTimestamp.Time,
				})
				break
			}
		}

		// Check for failed jobs with high retry count
		if job.Status.Failed > 3 {
			findings = append(findings, map[string]interface{}{
				"job_name":     job.Name,
				"namespace":    job.Namespace,
				"failed_count": job.Status.Failed,
				"threat_level": "medium",
				"source":       "failed_job",
				"reason":       fmt.Sprintf("Job '%s/%s' has %d failures - possible attack pattern or misconfiguration", job.Namespace, job.Name, job.Status.Failed),
				"created_at":   job.CreationTimestamp.Time,
			})
		}

		// Check for recently created jobs (last hour) without owner references (not from CronJob)
		isOrphaned := len(job.OwnerReferences) == 0
		isRecent := job.CreationTimestamp.Time.After(oneHourAgo)
		if isOrphaned && isRecent {
			// Check container images for suspicious patterns
			for _, container := range job.Spec.Template.Spec.Containers {
				if isSuspiciousImage(container.Image) {
					findings = append(findings, map[string]interface{}{
						"job_name":     job.Name,
						"namespace":    job.Namespace,
						"image":        container.Image,
						"threat_level": "critical",
						"source":       "suspicious_job_image",
						"reason":       fmt.Sprintf("Recently created orphaned Job '%s/%s' uses suspicious image '%s'", job.Namespace, job.Name, container.Image),
						"created_at":   job.CreationTimestamp.Time,
					})
				}
			}
		}

		// Check for jobs with privileged containers
		for _, container := range job.Spec.Template.Spec.Containers {
			if container.SecurityContext != nil && container.SecurityContext.Privileged != nil && *container.SecurityContext.Privileged {
				findings = append(findings, map[string]interface{}{
					"job_name":       job.Name,
					"namespace":      job.Namespace,
					"container_name": container.Name,
					"image":          container.Image,
					"threat_level":   "high",
					"source":         "privileged_job",
					"reason":         fmt.Sprintf("Job '%s/%s' runs container '%s' in privileged mode", job.Namespace, job.Name, container.Name),
					"created_at":     job.CreationTimestamp.Time,
				})
			}
		}

		_ = batchv1.JobConditionType("") // ensure batchv1 is used
	}

	return findings
}

// collectNetworkPolicyGaps finds namespaces without NetworkPolicies (open pod-to-pod traffic)
func collectNetworkPolicyGaps(clientset *kubernetes.Clientset) []map[string]interface{} {
	ctx := context.Background()
	var findings []map[string]interface{}

	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  NetworkPolicy scan: error listing namespaces: %v", err)
		return findings
	}

	systemNS := map[string]bool{
		"kube-system": true, "kube-public": true, "kube-node-lease": true,
		"calico-system": true, "tigera-operator": true,
		"kodo": true,
	}

	for _, ns := range namespaces.Items {
		if systemNS[ns.Name] {
			continue
		}

		// Check if namespace has any pods (only flag non-empty namespaces)
		pods, err := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{LabelSelector: "!job-name"})
		if err != nil || len(pods.Items) == 0 {
			continue
		}

		netPols, err := clientset.NetworkingV1().NetworkPolicies(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		if len(netPols.Items) == 0 {
			findings = append(findings, map[string]interface{}{
				"namespace":    ns.Name,
				"pod_count":    len(pods.Items),
				"threat_level": "medium",
				"source":       "no_network_policy",
				"reason":       fmt.Sprintf("Namespace '%s' has %d pods but NO NetworkPolicy — unrestricted pod-to-pod traffic", ns.Name, len(pods.Items)),
			})
		}
	}

	return findings
}

// collectConfigMapSecrets finds ConfigMaps that appear to contain credentials (anti-pattern)
func collectConfigMapSecrets(clientset *kubernetes.Clientset) []map[string]interface{} {
	ctx := context.Background()
	var findings []map[string]interface{}

	credentialPatterns := []string{
		"password", "passwd", "secret", "api_key", "apikey",
		"token", "credential", "private_key", "auth_token", "bearer",
	}

	cms, err := clientset.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  ConfigMap scan: error listing ConfigMaps: %v", err)
		return findings
	}

	for _, cm := range cms.Items {
		isSystemNS := cm.Namespace == "kube-system" || cm.Namespace == "kube-public" || cm.Namespace == "kube-node-lease"
		if isSystemNS {
			continue
		}

		for key := range cm.Data {
			keyLower := strings.ToLower(key)
			for _, pattern := range credentialPatterns {
				if strings.Contains(keyLower, pattern) {
					findings = append(findings, map[string]interface{}{
						"configmap_name": cm.Name,
						"namespace":      cm.Namespace,
						"key":            key,
						"threat_level":   "high",
						"source":         "configmap_secret",
						"reason":         fmt.Sprintf("ConfigMap '%s/%s' has key '%s' that may contain credentials (use Secrets instead)", cm.Namespace, cm.Name, key),
					})
					break
				}
			}
		}
	}

	return findings
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
		"xmrig",         // Crypto miner
		"monero",        // Crypto miner
		"cryptonight",   // Crypto mining algorithm
		"minerd",        // Miner daemon
		"cpuminer",      // CPU miner
		"nicehash",      // Mining pool
		"stratum",       // Mining protocol
		"coinhive",      // Web miner
		"kinsing",       // Known malware
		"dota",          // Known malware
		"tsunami",       // Known malware
		"xorddos",       // Known DDoS malware
		"backdoor",      // Backdoor indicator
		"rootkit",       // Rootkit indicator
		"reverse-shell", // Reverse shell
		"netcat",        // Network utility (can be suspicious)
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

// ---------------------------------------------
// CLUSTER SNAPSHOT / BACKUP
// ---------------------------------------------

// collectClusterSnapshot exports all K8s manifests and uploads them to Supabase Storage
// Params: snapshot_id, upload_url (pre-signed PUT URL)
func collectClusterSnapshot(clientset *kubernetes.Clientset, config AgentConfig, params map[string]interface{}) (map[string]interface{}, error) {
	snapshotID, _ := params["snapshot_id"].(string)
	uploadURL, _ := params["upload_url"].(string)
	if snapshotID == "" || uploadURL == "" {
		return nil, fmt.Errorf("collect_cluster_snapshot requires snapshot_id and upload_url")
	}

	log.Printf("📸 Starting cluster snapshot %s", snapshotID)

	manifests := map[string]interface{}{}
	resourceCount := 0
	namespacesSet := map[string]bool{}

	ctx := context.Background()

	// Namespaces
	nsList, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err == nil {
		var nsItems []interface{}
		for _, ns := range nsList.Items {
			namespacesSet[ns.Name] = true
			ns.ManagedFields = nil
			item, _ := json.Marshal(ns)
			var obj interface{}
			json.Unmarshal(item, &obj)
			nsItems = append(nsItems, obj)
		}
		manifests["namespaces"] = nsItems
		resourceCount += len(nsItems)
	}

	// Deployments (all namespaces)
	deplList, err := clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, d := range deplList.Items {
			d.ManagedFields = nil
			item, _ := json.Marshal(d)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["deployments"] = items
		resourceCount += len(items)
	}

	// StatefulSets
	ssList, err := clientset.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, s := range ssList.Items {
			s.ManagedFields = nil
			item, _ := json.Marshal(s)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["statefulsets"] = items
		resourceCount += len(items)
	}

	// DaemonSets
	dsList, err := clientset.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, ds := range dsList.Items {
			ds.ManagedFields = nil
			item, _ := json.Marshal(ds)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["daemonsets"] = items
		resourceCount += len(items)
	}

	// Services
	svcList, err := clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, svc := range svcList.Items {
			svc.ManagedFields = nil
			item, _ := json.Marshal(svc)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["services"] = items
		resourceCount += len(items)
	}

	// ConfigMaps (skip system ones)
	cmList, err := clientset.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, cm := range cmList.Items {
			if strings.HasPrefix(cm.Namespace, "kube-") {
				continue
			}
			cm.ManagedFields = nil
			item, _ := json.Marshal(cm)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["configmaps"] = items
		resourceCount += len(items)
	}

	// Secrets (skip service account tokens and TLS auto-generated)
	secretList, err := clientset.CoreV1().Secrets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, s := range secretList.Items {
			if strings.HasPrefix(s.Namespace, "kube-") {
				continue
			}
			if s.Type == "kubernetes.io/service-account-token" {
				continue
			}
			s.ManagedFields = nil
			item, _ := json.Marshal(s)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["secrets"] = items
		resourceCount += len(items)
	}

	// PersistentVolumeClaims
	pvcList, err := clientset.CoreV1().PersistentVolumeClaims("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, pvc := range pvcList.Items {
			pvc.ManagedFields = nil
			item, _ := json.Marshal(pvc)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["pvcs"] = items
		resourceCount += len(items)
	}

	// Ingresses
	ingList, err := clientset.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, ing := range ingList.Items {
			ing.ManagedFields = nil
			item, _ := json.Marshal(ing)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["ingresses"] = items
		resourceCount += len(items)
	}

	// HorizontalPodAutoscalers
	hpaList, err := clientset.AutoscalingV2().HorizontalPodAutoscalers("").List(ctx, metav1.ListOptions{})
	if err == nil {
		var items []interface{}
		for _, hpa := range hpaList.Items {
			hpa.ManagedFields = nil
			item, _ := json.Marshal(hpa)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["hpas"] = items
		resourceCount += len(items)
	}

	// StorageClasses (cluster-wide)
	scList, err := clientset.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
	storageClasses := []string{}
	if err == nil {
		var items []interface{}
		for _, sc := range scList.Items {
			sc.ManagedFields = nil
			storageClasses = append(storageClasses, sc.Name)
			item, _ := json.Marshal(sc)
			var obj interface{}
			json.Unmarshal(item, &obj)
			items = append(items, obj)
		}
		manifests["storageclasses"] = items
		resourceCount += len(items)
	}

	// Build namespace list
	namespaceList := []string{}
	for ns := range namespacesSet {
		namespaceList = append(namespaceList, ns)
	}

	snapshot := map[string]interface{}{
		"snapshot_id":     snapshotID,
		"collected_at":    time.Now().UTC().Format(time.RFC3339),
		"resource_count":  resourceCount,
		"namespaces":      namespaceList,
		"storage_classes": storageClasses,
		"manifests":       manifests,
	}

	body, err := json.Marshal(snapshot)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	sizeBytes := len(body)
	log.Printf("📦 Snapshot %s: %d resources, %d bytes — uploading...", snapshotID, resourceCount, sizeBytes)

	// Upload to Supabase Storage via pre-signed URL (PUT)
	// Use a longer timeout for large clusters (up to 10 minutes)
	uploadReq, err := http.NewRequest("PUT", uploadURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}
	uploadReq.Header.Set("Content-Type", "application/json")
	uploadReq.ContentLength = int64(sizeBytes)

	uploadClient := &http.Client{Timeout: 600 * time.Second}
	resp, err := uploadClient.Do(uploadReq)
	if err != nil {
		return nil, fmt.Errorf("failed to upload snapshot (size=%d bytes): %w", sizeBytes, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("✅ Snapshot %s uploaded successfully: %d resources, %d bytes", snapshotID, resourceCount, sizeBytes)

	return map[string]interface{}{
		"snapshot_id":     snapshotID,
		"resource_count":  resourceCount,
		"size_bytes":      sizeBytes,
		"namespaces":      namespaceList,
		"storage_classes": storageClasses,
	}, nil
}

// ---------------------------------------------
// APPLY MANIFESTS (migration target side)
// ---------------------------------------------

// detectTargetStorageClasses queries the cluster for available StorageClasses.
// Returns a set of names and the default class name (empty if none is marked default).
func detectTargetStorageClasses(clientset *kubernetes.Clientset) (map[string]bool, string) {
	available := map[string]bool{}
	defaultClass := ""
	scList, err := clientset.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Printf("⚠️  Could not list StorageClasses: %v", err)
		return available, defaultClass
	}
	for _, sc := range scList.Items {
		available[sc.Name] = true
		if sc.Annotations["storageclass.kubernetes.io/is-default-class"] == "true" ||
			sc.Annotations["storageclass.beta.kubernetes.io/is-default-class"] == "true" {
			defaultClass = sc.Name
		}
	}
	log.Printf("📦 Target cluster StorageClasses: %v (default: %q)", keysOf(available), defaultClass)
	return available, defaultClass
}

func keysOf(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// remapStorageClass returns the best StorageClass for a PVC on the target cluster.
// If the requested class exists → keep it. If not → use the cluster default.
// If no default → use the first available class.
func remapStorageClass(requested string, available map[string]bool, defaultClass string) (string, string) {
	if requested != "" && available[requested] {
		return requested, "" // no change needed
	}
	if defaultClass != "" {
		return defaultClass, fmt.Sprintf("%q not found on target; using default StorageClass %q", requested, defaultClass)
	}
	for k := range available {
		return k, fmt.Sprintf("%q not found on target; using first available StorageClass %q", requested, k)
	}
	return requested, fmt.Sprintf("no StorageClasses found on target; keeping %q (may fail)", requested)
}

// applyManifests downloads transformed manifests and applies them to the target cluster.
// Params: migration_id, download_url (pre-signed GET URL)
func applyManifests(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	migrationID, _ := params["migration_id"].(string)
	downloadURL, _ := params["download_url"].(string)
	if migrationID == "" || downloadURL == "" {
		return nil, fmt.Errorf("apply_manifests requires migration_id and download_url")
	}

	log.Printf("📥 Downloading transformed manifests for migration %s", migrationID)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download manifests: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest data: %w", err)
	}

	var snapshot map[string]interface{}
	if err := json.Unmarshal(body, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to parse manifest data: %w", err)
	}

	ctx := context.Background()
	applied := 0
	failed := 0
	applyLog := []map[string]interface{}{}

	// Namespaces that MUST NOT be touched on the target cluster.
	// These contain infrastructure services or the agent's own credentials —
	// overwriting them would break cluster networking or authentication.
	infraNamespaces := map[string]bool{
		"kube-system":      true,
		"kube-public":      true,
		"kube-node-lease":  true,
		"default":          true,
		"kodo":             true,        // agent credentials live here
		"kodo-agent":       true,
		"calico-system":    true,
		"calico-apiserver": true,
		"tigera-operator":  true,
		"cert-manager":     true,
		"ingress-nginx":    true,
		"nginx-ingress":    true,
		"lens-metrics":     true,        // Lens system namespace
		"monitoring":       true,
		"istio-system":     true,
	}

	isInfraNamespace := func(ns string) bool {
		return infraNamespaces[ns] || strings.HasPrefix(ns, "kube-")
	}

	// Detect real StorageClasses on the target cluster before touching PVCs
	availableSCs, defaultSC := detectTargetStorageClasses(clientset)

	// ── helpers ─────────────────────────────────────────────────────────────

	logResult := func(kind, name, ns string, err error) {
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			failed++
			applyLog = append(applyLog, map[string]interface{}{"kind": kind, "name": name, "namespace": ns, "status": "failed", "error": err.Error()})
		} else {
			applied++
			applyLog = append(applyLog, map[string]interface{}{"kind": kind, "name": name, "namespace": ns, "status": "applied"})
		}
	}

	clearMeta := func(meta *metav1.ObjectMeta) {
		meta.ResourceVersion = ""
		meta.UID = ""
		meta.CreationTimestamp = metav1.Time{}
		meta.ManagedFields = nil
	}

	// ── 1. Namespaces ────────────────────────────────────────────────────────
	if items, ok := snapshot["namespaces"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj corev1.Namespace
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Name) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = corev1.NamespaceStatus{}
			_, err := clientset.CoreV1().Namespaces().Create(ctx, &obj, metav1.CreateOptions{})
			logResult("Namespace", obj.Name, "", err)
		}
	}

	// ── 2. ConfigMaps ────────────────────────────────────────────────────────
	if items, ok := snapshot["configmaps"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj corev1.ConfigMap
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			_, err := clientset.CoreV1().ConfigMaps(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			logResult("ConfigMap", obj.Name, obj.Namespace, err)
		}
	}

	// ── 3. Secrets ───────────────────────────────────────────────────────────
	if items, ok := snapshot["secrets"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj corev1.Secret
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if obj.Type == corev1.SecretTypeServiceAccountToken {
				continue // these are auto-created; skip
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			_, err := clientset.CoreV1().Secrets(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			logResult("Secret", obj.Name, obj.Namespace, err)
		}
	}

	// ── 4. PVCs — with live StorageClass remapping ───────────────────────────
	if items, ok := snapshot["pvcs"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var pvc corev1.PersistentVolumeClaim
			if err := json.Unmarshal(b, &pvc); err != nil {
				continue
			}
			clearMeta(&pvc.ObjectMeta)
			pvc.Spec.VolumeName = ""
			pvc.Status = corev1.PersistentVolumeClaimStatus{}

			// Strip binding annotations — if present, the binding controller thinks the PVC
			// is already bound and looks for spec.volumeName (which we cleared to ""),
			// making it go to Lost immediately.
			bindingAnnotations := []string{
				"pv.kubernetes.io/bind-completed",
				"pv.kubernetes.io/bound-by-controller",
				"pv.kubernetes.io/provisioned-by",
				"volume.beta.kubernetes.io/storage-provisioner",
				"volume.kubernetes.io/selected-node",
			}
			if pvc.Annotations != nil {
				for _, key := range bindingAnnotations {
					delete(pvc.Annotations, key)
				}
			}
			// Strip cloning/snapshot sources — these objects don't exist on the target cluster
			pvc.Spec.DataSource = nil
			pvc.Spec.DataSourceRef = nil

			// Remap StorageClass to one that actually exists on this cluster
			requestedSC := ""
			if pvc.Spec.StorageClassName != nil {
				requestedSC = *pvc.Spec.StorageClassName
			}
			newSC, reason := remapStorageClass(requestedSC, availableSCs, defaultSC)
			if reason != "" {
				log.Printf("🔄 PVC %s/%s: %s", pvc.Namespace, pvc.Name, reason)
				applyLog = append(applyLog, map[string]interface{}{
					"kind": "PVC", "name": pvc.Name, "namespace": pvc.Namespace,
					"note": reason,
				})
			}
			pvc.Spec.StorageClassName = &newSC

			// Downgrade ReadWriteMany if the target SC doesn't support it
			for i, mode := range pvc.Spec.AccessModes {
				if mode == corev1.ReadWriteMany && len(availableSCs) > 0 {
					pvc.Spec.AccessModes[i] = corev1.ReadWriteOnce
					log.Printf("⬇️  PVC %s/%s: ReadWriteMany → ReadWriteOnce (not universally supported)", pvc.Namespace, pvc.Name)
				}
			}

			// Check if PVC already exists and handle Lost state
			existing, getErr := clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Get(ctx, pvc.Name, metav1.GetOptions{})
			if getErr == nil {
				if existing.Status.Phase == corev1.ClaimLost {
					log.Printf("🔄 PVC %s/%s is Lost — cleaning up orphaned PV and recreating", pvc.Namespace, pvc.Name)
					// Delete the orphaned PV first (if any)
					if existing.Spec.VolumeName != "" {
						pvDelErr := clientset.CoreV1().PersistentVolumes().Delete(ctx, existing.Spec.VolumeName, metav1.DeleteOptions{})
						if pvDelErr != nil {
							log.Printf("⚠️  Could not delete orphaned PV %s: %v", existing.Spec.VolumeName, pvDelErr)
						} else {
							log.Printf("🗑️  Deleted orphaned PV %s", existing.Spec.VolumeName)
						}
					}
					// Delete the Lost PVC
					propagation := metav1.DeletePropagationForeground
					_ = clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Delete(ctx, pvc.Name, metav1.DeleteOptions{PropagationPolicy: &propagation})
					// Wait for deletion to complete (up to 15s)
					for i := 0; i < 15; i++ {
						time.Sleep(1 * time.Second)
						_, checkErr := clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Get(ctx, pvc.Name, metav1.GetOptions{})
						if checkErr != nil {
							break // PVC deleted
						}
					}
				} else {
					// PVC exists and is healthy (Pending/Bound) — skip
					logResult("PVC", pvc.Name, pvc.Namespace, fmt.Errorf("already exists"))
					continue
				}
			}
			_, err := clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Create(ctx, &pvc, metav1.CreateOptions{})
			logResult("PVC", pvc.Name, pvc.Namespace, err)
		}
	}

	// ── 5. Services ──────────────────────────────────────────────────────────
	if items, ok := snapshot["services"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj corev1.Service
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if obj.Name == "kubernetes" && obj.Namespace == "default" {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Spec.ClusterIP = ""
			obj.Spec.ClusterIPs = nil
			obj.Status = corev1.ServiceStatus{}
			_, err := clientset.CoreV1().Services(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			logResult("Service", obj.Name, obj.Namespace, err)
		}
	}

	// ── 6. Deployments ───────────────────────────────────────────────────────
	if items, ok := snapshot["deployments"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj appsv1.Deployment
			if err := json.Unmarshal(b, &obj); err != nil {
				failed++
				applyLog = append(applyLog, map[string]interface{}{"kind": "Deployment", "status": "failed", "error": err.Error()})
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = appsv1.DeploymentStatus{}
			_, err := clientset.AppsV1().Deployments(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			if err != nil && strings.Contains(err.Error(), "already exists") {
				existing, getErr := clientset.AppsV1().Deployments(obj.Namespace).Get(ctx, obj.Name, metav1.GetOptions{})
				if getErr == nil {
					obj.ResourceVersion = existing.ResourceVersion
					_, err = clientset.AppsV1().Deployments(obj.Namespace).Update(ctx, &obj, metav1.UpdateOptions{})
				}
			}
			logResult("Deployment", obj.Name, obj.Namespace, err)
		}
	}

	// ── 7. StatefulSets ──────────────────────────────────────────────────────
	if items, ok := snapshot["statefulsets"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj appsv1.StatefulSet
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = appsv1.StatefulSetStatus{}
			// Remap volumeClaimTemplates StorageClass
			for i := range obj.Spec.VolumeClaimTemplates {
				vct := &obj.Spec.VolumeClaimTemplates[i]
				requested := ""
				if vct.Spec.StorageClassName != nil {
					requested = *vct.Spec.StorageClassName
				}
				newSC, reason := remapStorageClass(requested, availableSCs, defaultSC)
				if reason != "" {
					log.Printf("🔄 StatefulSet %s/%s VCT %s: %s", obj.Namespace, obj.Name, vct.Name, reason)
				}
				vct.Spec.StorageClassName = &newSC
			}
			_, err := clientset.AppsV1().StatefulSets(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			if err != nil && strings.Contains(err.Error(), "already exists") {
				existing, getErr := clientset.AppsV1().StatefulSets(obj.Namespace).Get(ctx, obj.Name, metav1.GetOptions{})
				if getErr == nil {
					obj.ResourceVersion = existing.ResourceVersion
					_, err = clientset.AppsV1().StatefulSets(obj.Namespace).Update(ctx, &obj, metav1.UpdateOptions{})
				}
			}
			logResult("StatefulSet", obj.Name, obj.Namespace, err)
		}
	}

	// ── 8. DaemonSets ────────────────────────────────────────────────────────
	if items, ok := snapshot["daemonsets"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj appsv1.DaemonSet
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = appsv1.DaemonSetStatus{}
			_, err := clientset.AppsV1().DaemonSets(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			if err != nil && strings.Contains(err.Error(), "already exists") {
				existing, getErr := clientset.AppsV1().DaemonSets(obj.Namespace).Get(ctx, obj.Name, metav1.GetOptions{})
				if getErr == nil {
					obj.ResourceVersion = existing.ResourceVersion
					_, err = clientset.AppsV1().DaemonSets(obj.Namespace).Update(ctx, &obj, metav1.UpdateOptions{})
				}
			}
			logResult("DaemonSet", obj.Name, obj.Namespace, err)
		}
	}

	// ── 9. Ingresses ─────────────────────────────────────────────────────────
	if items, ok := snapshot["ingresses"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj networkingv1.Ingress
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = networkingv1.IngressStatus{}
			_, err := clientset.NetworkingV1().Ingresses(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			if err != nil && strings.Contains(err.Error(), "already exists") {
				existing, getErr := clientset.NetworkingV1().Ingresses(obj.Namespace).Get(ctx, obj.Name, metav1.GetOptions{})
				if getErr == nil {
					obj.ResourceVersion = existing.ResourceVersion
					_, err = clientset.NetworkingV1().Ingresses(obj.Namespace).Update(ctx, &obj, metav1.UpdateOptions{})
				}
			}
			logResult("Ingress", obj.Name, obj.Namespace, err)
		}
	}

	// ── 10. HPAs ─────────────────────────────────────────────────────────────
	if items, ok := snapshot["hpas"].([]interface{}); ok {
		for _, item := range items {
			b, _ := json.Marshal(item)
			var obj autoscalingv2.HorizontalPodAutoscaler
			if err := json.Unmarshal(b, &obj); err != nil {
				continue
			}
			if isInfraNamespace(obj.Namespace) {
				continue
			}
			clearMeta(&obj.ObjectMeta)
			obj.Status = autoscalingv2.HorizontalPodAutoscalerStatus{}
			_, err := clientset.AutoscalingV2().HorizontalPodAutoscalers(obj.Namespace).Create(ctx, &obj, metav1.CreateOptions{})
			if err != nil && strings.Contains(err.Error(), "already exists") {
				existing, getErr := clientset.AutoscalingV2().HorizontalPodAutoscalers(obj.Namespace).Get(ctx, obj.Name, metav1.GetOptions{})
				if getErr == nil {
					obj.ResourceVersion = existing.ResourceVersion
					_, err = clientset.AutoscalingV2().HorizontalPodAutoscalers(obj.Namespace).Update(ctx, &obj, metav1.UpdateOptions{})
				}
			}
			logResult("HPA", obj.Name, obj.Namespace, err)
		}
	}

	log.Printf("✅ Migration %s applied: %d success, %d failed", migrationID, applied, failed)

	return map[string]interface{}{
		"migration_id": migrationID,
		"applied":      applied,
		"failed":       failed,
		"apply_log":    applyLog,
	}, nil
}

// ---------------------------------------------
// VALIDATE MIGRATION
// ---------------------------------------------

// validateMigration runs post-migration health checks.
// Checks: pod health, PVC binding, deployment readiness, service endpoints,
// and the full Ingress → Service → Pod chain for external traffic readiness.
// Params: migration_id, namespaces ([]string, optional)
func validateMigration(clientset *kubernetes.Clientset, params map[string]interface{}) (map[string]interface{}, error) {
	migrationID, _ := params["migration_id"].(string)
	if migrationID == "" {
		return nil, fmt.Errorf("validate_migration requires migration_id")
	}

	targetNamespaces := []string{}
	if nsParam, ok := params["namespaces"].([]interface{}); ok {
		for _, ns := range nsParam {
			if nsStr, ok := ns.(string); ok {
				targetNamespaces = append(targetNamespaces, nsStr)
			}
		}
	}
	if len(targetNamespaces) == 0 {
		targetNamespaces = []string{""}
	}

	ctx := context.Background()
	results := []map[string]interface{}{}
	passed := 0
	failed := 0

	isSystem := func(ns string) bool {
		return strings.HasPrefix(ns, "kube-") || ns == "kube-system" || ns == "kube-public" || ns == "kube-node-lease"
	}

	for _, ns := range targetNamespaces {
		// ── Pod health ───────────────────────────────────────────────────
		pods, err := clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range pods.Items {
				if isSystem(pod.Namespace) {
					continue
				}
				phase := string(pod.Status.Phase)
				ok := phase == "Running" || phase == "Succeeded"
				detail := fmt.Sprintf("Phase: %s", phase)
				if !ok {
					// Add container-level reason for better diagnosis
					for _, cs := range pod.Status.ContainerStatuses {
						if cs.State.Waiting != nil {
							detail += fmt.Sprintf(" | %s: %s", cs.Name, cs.State.Waiting.Reason)
						} else if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
							detail += fmt.Sprintf(" | %s: exited %d", cs.Name, cs.State.Terminated.ExitCode)
						}
					}
					failed++
				} else {
					passed++
				}
				statusStr := "passed"
				if !ok {
					statusStr = "failed"
				}
				results = append(results, map[string]interface{}{
					"type":          "pod_health",
					"namespace":     pod.Namespace,
					"resource_name": pod.Name,
					"status":        statusStr,
					"detail":        detail,
				})
			}
		}

		// ── Deployment readiness ──────────────────────────────────────────
		depls, err := clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, d := range depls.Items {
				if isSystem(d.Namespace) {
					continue
				}
				desired := int32(1)
				if d.Spec.Replicas != nil {
					desired = *d.Spec.Replicas
				}
				ready := d.Status.ReadyReplicas
				ok := ready >= desired
				detail := fmt.Sprintf("%d/%d réplicas prontas", ready, desired)
				if !ok {
					failed++
				} else {
					passed++
				}
				statusStr := "passed"
				if !ok {
					statusStr = "failed"
				}
				results = append(results, map[string]interface{}{
					"type":          "deployment_ready",
					"namespace":     d.Namespace,
					"resource_name": d.Name,
					"status":        statusStr,
					"detail":        detail,
				})
			}
		}

		// ── PVC binding ───────────────────────────────────────────────────
		pvcs, err := clientset.CoreV1().PersistentVolumeClaims(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pvc := range pvcs.Items {
				if isSystem(pvc.Namespace) {
					continue
				}
				phase := string(pvc.Status.Phase)
				ok := phase == "Bound"
				detail := fmt.Sprintf("StorageClass: %s | Phase: %s", func() string {
					if pvc.Spec.StorageClassName != nil {
						return *pvc.Spec.StorageClassName
					}
					return "default"
				}(), phase)
				if !ok {
					detail += " — aguardando provisionamento"
					failed++
				} else {
					passed++
				}
				statusStr := "passed"
				if !ok {
					statusStr = "failed"
				}
				results = append(results, map[string]interface{}{
					"type":          "pvc_binding",
					"namespace":     pvc.Namespace,
					"resource_name": pvc.Name,
					"status":        statusStr,
					"detail":        detail,
				})
			}
		}

		// ── Service endpoints ─────────────────────────────────────────────
		svcs, err := clientset.CoreV1().Services(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, svc := range svcs.Items {
				if isSystem(svc.Namespace) || svc.Name == "kubernetes" {
					continue
				}
				if svc.Spec.Type == "ExternalName" || svc.Spec.ClusterIP == "None" {
					continue
				}
				endpoints, epErr := clientset.CoreV1().Endpoints(svc.Namespace).Get(ctx, svc.Name, metav1.GetOptions{})
				epCount := 0
				if epErr == nil {
					for _, subset := range endpoints.Subsets {
						epCount += len(subset.Addresses)
					}
				}
				ok := epCount > 0
				svcType := string(svc.Spec.Type)
				detail := fmt.Sprintf("Tipo: %s | %d endpoint(s) prontos", svcType, epCount)
				if !ok {
					detail += " — sem pods respondendo"
					failed++
				} else {
					passed++
				}
				statusStr := "passed"
				if !ok {
					statusStr = "failed"
				}
				results = append(results, map[string]interface{}{
					"type":           "service_connectivity",
					"namespace":      svc.Namespace,
					"resource_name":  svc.Name,
					"service_type":   svcType,
					"endpoint_count": epCount,
					"status":         statusStr,
					"detail":         detail,
				})
			}
		}

		// ── Ingress → Service → Pod chain ────────────────────────────────
		ingresses, err := clientset.NetworkingV1().Ingresses(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, ing := range ingresses.Items {
				if isSystem(ing.Namespace) {
					continue
				}
				// Default backend
				if ing.Spec.DefaultBackend != nil && ing.Spec.DefaultBackend.Service != nil {
					svcName := ing.Spec.DefaultBackend.Service.Name
					endpoints, epErr := clientset.CoreV1().Endpoints(ing.Namespace).Get(ctx, svcName, metav1.GetOptions{})
					epCount := 0
					if epErr == nil {
						for _, subset := range endpoints.Subsets {
							epCount += len(subset.Addresses)
						}
					}
					ok := epCount > 0
					statusStr := "passed"
					detail := fmt.Sprintf("Default backend → %s: %d endpoint(s)", svcName, epCount)
					if !ok {
						statusStr = "failed"
						failed++
					} else {
						passed++
					}
					results = append(results, map[string]interface{}{
						"type":            "ingress_routing",
						"namespace":       ing.Namespace,
						"resource_name":   ing.Name,
						"backend_service": svcName,
						"host":            "*",
						"path":            "/",
						"status":          statusStr,
						"detail":          detail,
					})
				}
				// Rule-based backends
				for _, rule := range ing.Spec.Rules {
					if rule.HTTP == nil {
						continue
					}
					for _, path := range rule.HTTP.Paths {
						if path.Backend.Service == nil {
							continue
						}
						svcName := path.Backend.Service.Name
						endpoints, epErr := clientset.CoreV1().Endpoints(ing.Namespace).Get(ctx, svcName, metav1.GetOptions{})
						epCount := 0
						if epErr == nil {
							for _, subset := range endpoints.Subsets {
								epCount += len(subset.Addresses)
							}
						}
						ok := epCount > 0
						statusStr := "passed"
						detail := fmt.Sprintf("%s%s → %s: %d endpoint(s)", rule.Host, path.Path, svcName, epCount)
						if !ok {
							statusStr = "failed"
							detail += " (sem pods prontos)"
							failed++
						} else {
							passed++
						}
						results = append(results, map[string]interface{}{
							"type":            "ingress_routing",
							"namespace":       ing.Namespace,
							"resource_name":   ing.Name,
							"backend_service": svcName,
							"host":            rule.Host,
							"path":            path.Path,
							"endpoint_count":  epCount,
							"status":          statusStr,
							"detail":          detail,
						})
					}
				}
			}
		}
	}

	// Traffic readiness: all ingress routes and services are healthy
	trafficReady := true
	for _, r := range results {
		t, _ := r["type"].(string)
		s, _ := r["status"].(string)
		if (t == "ingress_routing" || t == "service_connectivity") && s == "failed" {
			trafficReady = false
			break
		}
	}

	log.Printf("✅ Migration %s validation complete: %d passed, %d failed | traffic_ready=%v", migrationID, passed, failed, trafficReady)

	return map[string]interface{}{
		"migration_id":  migrationID,
		"passed":        passed,
		"failed":        failed,
		"traffic_ready": trafficReady,
		"results":       results,
	}, nil
}
