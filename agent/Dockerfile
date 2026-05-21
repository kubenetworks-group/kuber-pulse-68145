# Build stage
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETARCH
ARG TARGETOS
ARG VERSION=dev

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
    go build -a -installsuffix cgo \
    -ldflags "-w -s -X main.AgentVersion=${VERSION}" \
    -o kodo-agent .

# Final stage
FROM --platform=$TARGETPLATFORM alpine:latest

RUN apk --no-cache add ca-certificates && \
    addgroup -S kodo && adduser -S kodo -G kodo

WORKDIR /app

COPY --from=builder /app/kodo-agent .
RUN chmod +x kodo-agent && chown kodo:kodo kodo-agent

USER kodo

CMD ["./kodo-agent"]
