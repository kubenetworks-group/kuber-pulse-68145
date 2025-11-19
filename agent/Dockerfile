# Build stage
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

# Argumentos para cross-compilation
ARG TARGETARCH
ARG TARGETOS

WORKDIR /app

# Copy go mod files
COPY ./agent/go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary for the target platform
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
    go build -a -installsuffix cgo -ldflags '-w -s' -o kuberpulse-agent .

# Final stage
FROM --platform=$TARGETPLATFORM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/kuberpulse-agent .

CMD ["./kuberpulse-agent"]