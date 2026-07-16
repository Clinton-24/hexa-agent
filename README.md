# HEXACRIMSON LABS — Agent Install & Deploy

Control-plane website for the Hexacrimson agent platform: marketing landing page, live dashboard, documentation, one-line installers, and REST APIs.

## What it does

| Surface | Behavior |
|--------|----------|
| **Landing** (`/`) | Deploy / pricing / install / billing UI. **Deploy agent** enrolls a real agent via the API. |
| **Dashboard** (`/dashboard/`) | Live fleet: metrics, enroll, heartbeat, modules, decommission. |
| **Docs** (`/docs/…`) | Quickstart, API, security, CLI. |
| **Installer** (`/install.sh`) | One-liner enrolls this host with the control plane. |
| **API** (`/api/…`) | Agents, metrics, events, billing. |

## Quick start

```bash
npm install
npm start
```

Open:

- http://localhost:3000/
- http://localhost:3000/dashboard/
- http://localhost:3000/docs/quickstart.html

### Deploy an agent (demo client)

Linux / macOS:

```bash
curl -sSL http://localhost:3000/install.sh | bash
```

Windows PowerShell:

```powershell
irm http://localhost:3000/public/agent.ps1 | iex
```

Optional env vars: `HXL_TOKEN`, `HXL_ENV`, `HXL_REGION`.

Default demo token: `hxl-7f3a9c2e1b4d8a6f`

### API examples

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/status
curl http://localhost:3000/api/agents

curl -X POST http://localhost:3000/api/agents/enroll \
  -H "Content-Type: application/json" \
  -H "X-Enroll-Token: hxl-7f3a9c2e1b4d8a6f" \
  -d "{\"token\":\"hxl-7f3a9c2e1b4d8a6f\",\"hostname\":\"edge-01\",\"environment\":\"aws\"}"
```

## Deploy on Render

1. Push this repo to GitHub.
2. Create a **Web Service** from the repo (or use `render.yaml`).
3. Build: `npm install` · Start: `npm start`
4. Set `PUBLIC_URL` to your Render URL (e.g. `https://your-service.onrender.com`) so install scripts point at the right hub.

## Project layout

```
├── index.html          # Landing page
├── server.js           # Express control plane + static host
├── dashboard/          # Live fleet UI
├── docs/               # Documentation
├── public/             # install.sh, agent.ps1
├── css/ js/            # Shared assets
├── data/               # Agent store (runtime)
└── render.yaml         # Render blueprint
```

## License

MIT
