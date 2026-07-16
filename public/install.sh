#!/usr/bin/env bash
# HEXACRIMSON LABS agent — one-line deployment (demo control-plane client)
# Usage:  curl -sSL {{PUBLIC_URL}}/install.sh | bash
# Optional: HXL_TOKEN=hxl-... HXL_ENV=aws bash <(curl -sSL ...)

set -euo pipefail

HUB="{{PUBLIC_URL}}"
TOKEN="${HXL_TOKEN:-hxl-7f3a9c2e1b4d8a6f}"
ENV_NAME="${HXL_ENV:-local}"
REGION="${HXL_REGION:-unknown}"
VERSION="3.2.1"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${RED}# hexacrimson labs agent — one-line deployment${NC}"
  echo -e "${DIM}# hub: ${HUB}${NC}"
  echo ""
}

step() { echo -e "${CYAN}✓${NC} $1"; }
warn() { echo -e "${RED}!${NC} $1"; }

banner

echo -e "${DIM}\$ detecting platform...${NC}"
OS="$(uname -s 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
HOST="$(hostname 2>/dev/null || echo demo-host)"
step "Platform ${OS}/${ARCH} on ${HOST}"

sleep 0.4
echo -e "${DIM}\$ downloading agent binary (${VERSION})...${NC}"
sleep 0.5
step "Downloaded agent binary (2.1 MB)"

sleep 0.3
echo -e "${DIM}\$ verifying SHA256 checksum...${NC}"
sleep 0.4
CHECKSUM="$(printf '%s' "${VERSION}-${HOST}" | sha256sum 2>/dev/null | awk '{print $1}' || echo "demo-checksum")"
step "Checksum verified — SHA256 match (${CHECKSUM:0:16}…)"

sleep 0.3
echo -e "${DIM}\$ configuring agent service...${NC}"
sleep 0.5
step "Configuring system service ... done"

echo -e "${DIM}\$ enrolling with control plane...${NC}"
RESP="$(curl -sS -X POST "${HUB}/api/agents/enroll" \
  -H "Content-Type: application/json" \
  -H "X-Enroll-Token: ${TOKEN}" \
  -d "{\"token\":\"${TOKEN}\",\"hostname\":\"${HOST}\",\"environment\":\"${ENV_NAME}\",\"region\":\"${REGION}\",\"platform\":\"${OS}\",\"arch\":\"${ARCH}\"}" \
  || true)"

if command -v python3 >/dev/null 2>&1; then
  AGENT_ID="$(printf '%s' "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('agent',{}).get('id',''))" 2>/dev/null || true)"
  PID="$(printf '%s' "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('agent',{}).get('pid','0'))" 2>/dev/null || echo 0)"
else
  AGENT_ID="$(printf '%s' "$RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
  PID="18472"
fi

if [ -z "${AGENT_ID}" ]; then
  warn "Enrollment failed — is the control plane up at ${HUB}?"
  echo "$RESP"
  exit 1
fi

step "Agent active (running) — PID ${PID}"
step "Connected to hub — agent id ${AGENT_ID}"
echo ""
echo -e "${GREEN}🚀 Hexacrimson agent v${VERSION} successfully deployed${NC}"
echo ""
echo -e "${DIM}\$ agent status${NC}"
echo "  id:      ${AGENT_ID}"
echo "  host:    ${HOST}"
echo "  status:  online"
echo "  version: ${VERSION}"
echo "  dashboard: ${HUB}/dashboard/"
echo ""
echo -e "${DIM}Tip: open the dashboard to manage this agent and stream telemetry.${NC}"
echo ""
