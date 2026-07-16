# Hexacrimson Labs — Agent install & deploy

Control-plane website for the Hexacrimson agent platform: marketing landing page, live dashboard, documentation, one-line installers, and REST APIs.

**Billing gate:** customers must complete a subscription plan before any agent can be enrolled or deployed (UI, CLI installers, and API all enforce this).

## What it does

| Surface | Behavior |
|--------|----------|
| **Landing** (`/`) | Deploy / pricing / install / billing UI. **Deploy agent** opens billing if inactive, otherwise enrolls. |
| **Dashboard** (`/dashboard/`) | Live fleet: metrics, enroll, heartbeat, modules, decommission (requires active plan). |
| **Docs** (`/docs/…`) | Quickstart, API, security, CLI. |
| **Installer** (`/install.sh`) | One-liner enrolls this host — blocked until billing is active. |
| **API** (`/api/…`) | Agents, metrics, events, billing (`402` if deploy without subscription). |

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

## Deploy on Render (clean URL, no `-q1ie` suffix)

Render appends a random suffix (like `q1ie`) when the service name is not unique. Use a clean unique name:

1. Push this repo to GitHub.
2. Create a **Web Service** named **`hexacrimson-labs`** (or use `render.yaml`).
3. That yields: **`https://hexacrimson-labs.onrender.com`**
4. Build: `npm install` · Start: `npm start`
5. Set `PUBLIC_URL=https://hexacrimson-labs.onrender.com`

If an old service already exists as `hexa-agent-q1ie`:

- **Settings → General → Name** → rename to `hexacrimson-labs` (if available), **or**
- Create a new service with that name and delete the old one.

Optional: attach a custom domain (e.g. `agents.hexacrimson.io`) under Render → Custom Domains.

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
