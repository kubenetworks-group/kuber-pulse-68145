{{/*
Expand the name of the chart.
*/}}
{{- define "kodo-agent.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kodo-agent.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "kodo-agent.name" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Image tag: use values.agent.image.tag if set, otherwise Chart appVersion
*/}}
{{- define "kodo-agent.imageTag" -}}
{{- if .Values.agent.image.tag }}
{{- .Values.agent.image.tag }}
{{- else }}
{{- .Chart.AppVersion }}
{{- end }}
{{- end }}

{{/*
Namespace
*/}}
{{- define "kodo-agent.namespace" -}}
{{- .Values.namespace.name | default "kodo" }}
{{- end }}
