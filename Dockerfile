FROM node:22-bookworm-slim

ARG PI_VERSION=0.87.1
ARG MCP_SCANNER_VERSION=4.7.5
ENV UV_TOOL_BIN_DIR=/usr/local/bin \
    NODE_ENV=production \
    PORT=8080 \
    LAB_MODE=demo

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git python3 \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@${PI_VERSION}" \
 && curl -LsSf https://astral.sh/uv/install.sh | sh \
 && /root/.local/bin/uv tool install --python 3.13 "cisco-ai-mcp-scanner==${MCP_SCANNER_VERSION}" \
 && useradd --create-home --uid 10001 learner

WORKDIR /opt/agent-foundry
COPY --chown=learner:learner . .
RUN chmod +x scripts/*.sh && mkdir -p reports data/progress /workspace && chown -R learner:learner reports data/progress /workspace

USER learner
RUN pi install npm:pi-code@1.0.77
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s --retries=3 CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server.mjs"]
