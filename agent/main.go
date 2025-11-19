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
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
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

	log.Println("✅ Connected to Kubernetes cluster")
	log.Printf("📡 Sending metrics every %ds", config.Interval)
	log.Printf("🔧 API Endpoint: %s", config.APIEndpoint)
	log.Printf("🔧 Cluster ID: %s", config.ClusterID)
	log.Printf("🔧 API Key: %s...%s", config.APIKey[:8], config.APIKey[len(config.APIKey)-4:])

	ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)

	for {
		select {
		case <-ticker.C:
			sendMetrics(clientset, config)
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
// MÉTRICAS
// ---------------------------------------------
func sendMetrics(clientset *kubernetes.Clientset, config AgentConfig) {
	log.Println("📊 Collecting metrics...")

	nodes, _ := clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	pods, _ := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})

	// Calcular métricas agregadas
	var totalCPU, totalMemory, usedCPU, usedMemory int64
	runningPods := 0

	for _, node := range nodes.Items {
		cpu := node.Status.Capacity.Cpu().MilliValue()
		mem := node.Status.Capacity.Memory().Value()
		totalCPU += cpu
		totalMemory += mem

		// CPU e memória alocados (simplificado)
		allocatedCPU := node.Status.Allocatable.Cpu().MilliValue()
		allocatedMem := node.Status.Allocatable.Memory().Value()
		usedCPU += (cpu - allocatedCPU)
		usedMemory += (mem - allocatedMem)
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
				"nodes": extractNodeInfo(nodes.Items),
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

// Extrai cpu/mem simples
func extractNodeInfo(nodes []corev1.Node) []map[string]interface{} {
	var result []map[string]interface{}

	for _, node := range nodes {
		result = append(result, map[string]interface{}{
			"name":   node.Name,
			"cpu":    node.Status.Capacity.Cpu().String(),
			"memory": node.Status.Capacity.Memory().String(),
			"status": getNodeStatus(node),
		})
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
