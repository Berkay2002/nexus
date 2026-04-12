---
created: 2026-04-12
updated: 2026-04-12
tags: [aio-sandbox, docker, execution, agent-infrastructure]
sources: [raw/aio-sandbox/README.md]
---

# AIO Sandbox Docker Setup

AIO Sandbox ships as a single Docker image. Running it requires only one flag beyond the standard `docker run` invocation: `--security-opt seccomp=unconfined`, which lifts the seccomp syscall filter so the browser and sandbox processes can function correctly.

## Content

### Quick Start

```bash
docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest
```

This is the command Nexus documents in its CLAUDE.md as the prerequisite step before `npm run dev`.

### Image Registry

| Registry | Image | Use case |
|----------|-------|----------|
| `ghcr.io/agent-infra/sandbox:latest` | GitHub Container Registry | Default; global |
| `enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest` | Volcengine Beijing | Mainland China mirror |

Pin to a specific version with the `${version}` tag format, e.g. `ghcr.io/agent-infra/sandbox:1.0.0.150`.

### Flags Explained

- `--security-opt seccomp=unconfined` — **required**. The browser (Chromium/CDP) and sandbox fusion layer use syscalls that Docker's default seccomp profile blocks. Without this flag the container will start but browser and certain shell operations will fail silently or crash.
- `--rm` — removes the container on exit. Appropriate for ephemeral dev use; drop it for persistent deployments.
- `-it` — allocates a pseudo-TTY and keeps stdin open. Needed for the interactive terminal experience.
- `-p 8080:8080` — maps container port 8080 to host port 8080. All [[aio-sandbox-features|AIO Sandbox services]] are multiplexed through this single port.

### Docker Compose (Production-Style)

```yaml
version: '3.8'
services:
  sandbox:
    container_name: aio-sandbox
    image: ghcr.io/agent-infra/sandbox:latest
    volumes:
      - /tmp/gem/vite-project:/home/gem/vite-project
    security_opt:
      - seccomp:unconfined
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: "unless-stopped"
    shm_size: "2gb"
    ports:
      - "${HOST_PORT:-8080}:8080"
    environment:
      PROXY_SERVER: ${PROXY_SERVER:-host.docker.internal:7890}
      JWT_PUBLIC_KEY: ${JWT_PUBLIC_KEY:-}
      DNS_OVER_HTTPS_TEMPLATES: ${DNS_OVER_HTTPS_TEMPLATES:-}
      WORKSPACE: ${WORKSPACE:-"/home/gem"}
      HOMEPAGE: ${HOMEPAGE:-}
      BROWSER_EXTRA_ARGS: ${BROWSER_EXTRA_ARGS:-}
      TZ: ${TZ:-Asia/Singapore}
      WAIT_PORTS: ${WAIT_PORTS:-}
```

Notable compose settings:
- `shm_size: "2gb"` — shared memory for Chromium; too small and the browser will crash under load.
- `WORKSPACE` — defaults to `/home/gem`. Changing this changes where the SDK's `get_context().home_dir` points.
- `JWT_PUBLIC_KEY` — enables JWT authentication on the HTTP API. Leave empty for local dev.
- `PROXY_SERVER` — useful in corporate/China environments where Docker networking routes through a proxy.

### Kubernetes

For multi-replica deployments, the standard Kubernetes manifest sets memory limit to `2Gi` and cpu to `1000m`. Each pod is an independent sandbox — there is no shared state across replicas. Nexus runs a single container in local dev; K8s is relevant only for cloud deployments of the agent platform.

### Endpoints After Start

Once the container is running:

| URL | Purpose |
|-----|---------|
| `http://localhost:8080/v1/docs` | Interactive API documentation (OpenAPI/Swagger) |
| `http://localhost:8080/vnc/index.html?autoconnect=true` | VNC browser — visual browser access |
| `http://localhost:8080/code-server/` | VSCode Server |
| `http://localhost:8080/mcp` | MCP server hub |

All SDK calls target `http://localhost:8080` as `baseURL`.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[agent-infra-sandbox-sdk]]

## Sources

- `raw/aio-sandbox/README.md` — Quick Start, Docker Compose, Kubernetes sections
