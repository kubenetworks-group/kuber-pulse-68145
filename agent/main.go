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
			getCommands(config)
		}
	}
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
				"total_cores":   totalCPU / 1000, // converter de milicores para cores
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
func getCommands(config AgentConfig) {
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
	log.Printf("📥 Commands response: %s", string(body))
}
