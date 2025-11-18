package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
)

type Config struct {
	APIEndpoint string
	APIKey      string
	ClusterID   string
	Interval    time.Duration
}

type Metric struct {
	Type        string                 `json:"type"`
	Data        map[string]interface{} `json:"data"`
	CollectedAt string                 `json:"collected_at"`
}

type Command struct {
	ID            string                 `json:"id"`
	CommandType   string                 `json:"command_type"`
	CommandParams map[string]interface{} `json:"command_params"`
}

func main() {
	log.Println("🚀 Kuberpulse Agent starting...")

	config := Config{
		APIEndpoint: getEnv("API_ENDPOINT", "https://mcqfgnjootzthtizboom.supabase.co/functions/v1"),
		APIKey:      getEnv("API_KEY", ""),
		ClusterID:   getEnv("CLUSTER_ID", ""),
		Interval:    time.Duration(getEnvInt("COLLECT_INTERVAL", 30)) * time.Second,
	}

	if config.APIKey == "" {
		log.Fatal("❌ API_KEY is required")
	}

	// Create Kubernetes client
	k8sConfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("❌ Failed to create in-cluster config: %v", err)
	}

	clientset, err := kubernetes.NewForConfig(k8sConfig)
	if err != nil {
		log.Fatalf("❌ Failed to create clientset: %v", err)
	}

	metricsClient, err := metricsv.NewForConfig(k8sConfig)
	if err != nil {
		log.Fatalf("❌ Failed to create metrics client: %v", err)
	}

	log.Printf("✅ Connected to Kubernetes cluster")
	log.Printf("📡 Sending metrics every %v", config.Interval)

	// Start metrics collection loop
	go collectAndSendMetrics(clientset, metricsClient, config)

	// Start command polling loop
	go pollForCommands(clientset, config)

	// Keep running
	select {}
}

func collectAndSendMetrics(clientset *kubernetes.Clientset, metricsClient *metricsv.Clientset, config Config) {
	ticker := time.NewTicker(config.Interval)
	defer ticker.Stop()

	for range ticker.C {
		log.Println("📊 Collecting metrics...")

		metrics := []Metric{}
		ctx := context.Background()

		// Collect CPU and Memory metrics
		nodeMetrics, err := metricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error collecting node metrics: %v", err)
		} else {
			var totalCPU, totalMemory, usedCPU, usedMemory int64
			for _, node := range nodeMetrics.Items {
				cpu := node.Usage.Cpu().MilliValue()
				memory := node.Usage.Memory().Value()
				
				usedCPU += cpu
				usedMemory += memory
				
				// Get node capacity
				nodeInfo, _ := clientset.CoreV1().Nodes().Get(ctx, node.Name, metav1.GetOptions{})
				if nodeInfo != nil {
					totalCPU += nodeInfo.Status.Capacity.Cpu().MilliValue()
					totalMemory += nodeInfo.Status.Capacity.Memory().Value()
				}
			}

			cpuPercent := float64(0)
			memPercent := float64(0)
			if totalCPU > 0 {
				cpuPercent = float64(usedCPU) / float64(totalCPU) * 100
			}
			if totalMemory > 0 {
				memPercent = float64(usedMemory) / float64(totalMemory) * 100
			}

			metrics = append(metrics, Metric{
				Type: "cpu",
				Data: map[string]interface{}{
					"usage_percent": cpuPercent,
					"used_millis":   usedCPU,
					"total_millis":  totalCPU,
				},
				CollectedAt: time.Now().UTC().Format(time.RFC3339),
			})

			metrics = append(metrics, Metric{
				Type: "memory",
				Data: map[string]interface{}{
					"usage_percent": memPercent,
					"used_bytes":    usedMemory,
					"total_bytes":   totalMemory,
				},
				CollectedAt: time.Now().UTC().Format(time.RFC3339),
			})
		}

		// Collect Pod metrics
		pods, err := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error collecting pod metrics: %v", err)
		} else {
			runningPods := 0
			pendingPods := 0
			failedPods := 0

			for _, pod := range pods.Items {
				switch pod.Status.Phase {
				case "Running":
					runningPods++
				case "Pending":
					pendingPods++
				case "Failed":
					failedPods++
				}
			}

			metrics = append(metrics, Metric{
				Type: "pods",
				Data: map[string]interface{}{
					"total":   len(pods.Items),
					"running": runningPods,
					"pending": pendingPods,
					"failed":  failedPods,
				},
				CollectedAt: time.Now().UTC().Format(time.RFC3339),
			})
		}

		// Collect Events (warnings and errors)
		events, err := clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error collecting events: %v", err)
		} else {
			warningEvents := []map[string]interface{}{}
			for _, event := range events.Items {
				if event.Type == "Warning" || event.Type == "Error" {
					// Only collect recent events (last 5 minutes)
					if time.Since(event.LastTimestamp.Time) < 5*time.Minute {
						warningEvents = append(warningEvents, map[string]interface{}{
							"type":      event.Type,
							"reason":    event.Reason,
							"message":   event.Message,
							"namespace": event.Namespace,
							"object":    event.InvolvedObject.Name,
							"timestamp": event.LastTimestamp.Format(time.RFC3339),
						})
					}
				}
			}

			metrics = append(metrics, Metric{
				Type: "events",
				Data: map[string]interface{}{
					"warnings": len(warningEvents),
					"recent":   warningEvents,
				},
				CollectedAt: time.Now().UTC().Format(time.RFC3339),
			})
		}

		// Collect Node metrics
		nodes, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("⚠️  Error collecting node info: %v", err)
		} else {
			readyNodes := 0
			for _, node := range nodes.Items {
				for _, condition := range node.Status.Conditions {
					if condition.Type == "Ready" && condition.Status == "True" {
						readyNodes++
						break
					}
				}
			}

			metrics = append(metrics, Metric{
				Type: "nodes",
				Data: map[string]interface{}{
					"total": len(nodes.Items),
					"ready": readyNodes,
				},
				CollectedAt: time.Now().UTC().Format(time.RFC3339),
			})
		}

		// Send metrics to backend
		if err := sendMetrics(config, metrics); err != nil {
			log.Printf("❌ Failed to send metrics: %v", err)
		} else {
			log.Printf("✅ Sent %d metrics successfully", len(metrics))
		}
	}
}

func sendMetrics(config Config, metrics []Metric) error {
	payload := map[string]interface{}{
		"metrics": metrics,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %w", err)
	}

	req, err := http.NewRequest("POST", config.APIEndpoint+"/agent-receive-metrics", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)


	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad response status: %d", resp.StatusCode)
	}

	return nil
}

func pollForCommands(clientset *kubernetes.Clientset, config Config) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		commands, err := getCommands(config)
		if err != nil {
			log.Printf("⚠️  Error getting commands: %v", err)
			continue
		}

		for _, cmd := range commands {
			log.Printf("📥 Received command: %s (%s)", cmd.CommandType, cmd.ID)
			result := executeCommand(clientset, cmd)
			
			if err := updateCommandStatus(config, cmd.ID, result); err != nil {
				log.Printf("❌ Failed to update command status: %v", err)
			}
		}
	}
}

func getCommands(config Config) ([]Command, error) {
	req, err := http.NewRequest("GET", config.APIEndpoint+"/agent-get-commands", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.APIKey)


	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Commands []Command `json:"commands"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Commands, nil
}

func executeCommand(clientset *kubernetes.Clientset, cmd Command) map[string]interface{} {
	ctx := context.Background()
	result := map[string]interface{}{
		"success": false,
		"message": "",
	}

	switch cmd.CommandType {
	case "restart_pod":
		namespace := cmd.CommandParams["namespace"].(string)
		podName := cmd.CommandParams["pod"].(string)
		
		err := clientset.CoreV1().Pods(namespace).Delete(ctx, podName, metav1.DeleteOptions{})
		if err != nil {
			result["message"] = fmt.Sprintf("Failed to restart pod: %v", err)
		} else {
			result["success"] = true
			result["message"] = fmt.Sprintf("Pod %s restarted successfully", podName)
		}

	case "scale_deployment":
		namespace := cmd.CommandParams["namespace"].(string)
		deploymentName := cmd.CommandParams["deployment"].(string)
		replicas := int32(cmd.CommandParams["replicas"].(float64))
		
		deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
		if err != nil {
			result["message"] = fmt.Sprintf("Failed to get deployment: %v", err)
		} else {
			deployment.Spec.Replicas = &replicas
			_, err = clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
			if err != nil {
				result["message"] = fmt.Sprintf("Failed to scale deployment: %v", err)
			} else {
				result["success"] = true
				result["message"] = fmt.Sprintf("Deployment scaled to %d replicas", replicas)
			}
		}

	default:
		result["message"] = fmt.Sprintf("Unknown command type: %s", cmd.CommandType)
	}

	return result
}

func updateCommandStatus(config Config, commandID string, result map[string]interface{}) error {
	status := "failed"
	if success, ok := result["success"].(bool); ok && success {
		status = "completed"
	}

	payload := map[string]interface{}{
		"command_id": commandID,
		"status":     status,
		"result":     result,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", config.APIEndpoint+"/agent-update-command", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)


	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var intValue int
		fmt.Sscanf(value, "%d", &intValue)
		return intValue
	}
	return defaultValue
}
