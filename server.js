/**
 * HEXACRIMSON LABS — Agent control plane
 * Serves the marketing site, docs, dashboard, and agent APIs.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'agents.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── In-memory + file-backed agent store ─────────────────────────────────────

function defaultSubscription() {
  return {
    active: false,
    plan: null,
    price: 0,
    period: 'monthly',
    addonSecurity: false,
    agentsLimit: 0,
    usage: { agents: 0, apiCalls: 0, storageGb: 0 },
    activatedAt: null
  };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const seed = {
      // No agents until customer completes billing and deploys
      agents: [],
      events: [],
      subscriptions: defaultSubscription(),
      invoices: []
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2));
    return;
  }

  // Migrate older stores that assumed an always-on Pro plan
  try {
    const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    let changed = false;
    if (!store.subscriptions) {
      store.subscriptions = defaultSubscription();
      changed = true;
    } else if (typeof store.subscriptions.active !== 'boolean') {
      // Treat legacy seeded "Pro" demo as inactive so billing is required
      store.subscriptions.active = false;
      store.subscriptions.plan = store.subscriptions.plan || null;
      changed = true;
    }
    if (!Array.isArray(store.agents)) {
      store.agents = [];
      changed = true;
    }
    if (!Array.isArray(store.events)) {
      store.events = [];
      changed = true;
    }
    if (!Array.isArray(store.invoices)) {
      store.invoices = [];
      changed = true;
    }
    if (changed) fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (_) {
    /* ignore migrate errors */
  }
}

function hasActiveSubscription(store) {
  return !!(store.subscriptions && store.subscriptions.active === true && store.subscriptions.plan);
}

function seedAgents() {
  const hosts = [
    { name: 'edge-aws-use1-01', env: 'aws', region: 'us-east-1' },
    { name: 'edge-gcp-euw1-02', env: 'gcp', region: 'europe-west1' },
    { name: 'onprem-dc1-node3', env: 'on-prem', region: 'dc1' },
    { name: 'azure-weu-web-04', env: 'azure', region: 'westeurope' },
    { name: 'rpi-lab-pi04', env: 'edge', region: 'lab' }
  ];
  return hosts.map((h, i) => ({
    id: `hxl-${crypto.randomBytes(4).toString('hex')}`,
    hostname: h.name,
    environment: h.env,
    region: h.region,
    status: i === 4 ? 'installing' : 'online',
    version: '3.2.1',
    pid: 18000 + i * 17,
    enrolledAt: new Date(Date.now() - (i + 1) * 3600_000 * 6).toISOString(),
    lastSeen: new Date(Date.now() - i * 45_000).toISOString(),
    metrics: {
      cpu: +(12 + Math.random() * 40).toFixed(1),
      memory: +(28 + Math.random() * 45).toFixed(1),
      uptimeSec: 86_400 * (3 + i),
      anomalies: i === 1 ? 2 : 0,
      threatsBlocked: i === 0 ? 14 : i === 2 ? 3 : 0
    },
    modules: {
      monitoring: true,
      threatDetection: i < 3,
      wifiIntelligence: i === 2
    }
  }));
}

function loadStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  ensureStore();
  store.subscriptions.usage.agents = store.agents.filter(a => a.status !== 'offline').length;
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function pushEvent(store, type, message, agentId = null) {
  store.events.unshift({
    id: crypto.randomBytes(6).toString('hex'),
    type,
    message,
    agentId,
    at: new Date().toISOString()
  });
  store.events = store.events.slice(0, 200);
}

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'hexacrimson-control-plane', version: '3.2.1' });
});

// ── Installer script (one-liner target) ─────────────────────────────────────

app.get('/install.sh', (_req, res) => {
  const script = fs.readFileSync(path.join(__dirname, 'public', 'install.sh'), 'utf8');
  res.type('text/plain').send(script.replaceAll('{{PUBLIC_URL}}', PUBLIC_URL));
});

// Alias used in marketing copy (path relative to this deployment)
app.get('/install', (_req, res) => res.redirect(302, '/install.sh'));

// ── Agent API ───────────────────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  const store = loadStore();
  const online = store.agents.filter(a => a.status === 'online').length;
  const installing = store.agents.filter(a => a.status === 'installing').length;
  const pending = store.agents.filter(a => a.status === 'queued').length;
  const envs = new Set(store.agents.map(a => a.environment)).size;
  res.json({
    brand: 'Hexacrimson Labs',
    version: '3.2.1',
    activeAgents: online,
    installing,
    pending,
    environments: envs,
    avgInstallSeconds: 4.2,
    uptimePercent: online ? 99.97 : 100,
    failedDeploysToday: 0,
    hub: 'hub.hexacrimson.io:443',
    billingActive: hasActiveSubscription(store),
    plan: store.subscriptions?.plan || null
  });
});

app.get('/api/agents', (_req, res) => {
  const store = loadStore();
  res.json({ agents: store.agents, total: store.agents.length });
});

app.get('/api/agents/:id', (req, res) => {
  const store = loadStore();
  const agent = store.agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

app.post('/api/agents/enroll', (req, res) => {
  const store = loadStore();

  // Billing must be completed before any agent can be deployed
  if (!hasActiveSubscription(store)) {
    return res.status(402).json({
      error: 'Billing required',
      code: 'BILLING_REQUIRED',
      message: 'Complete a subscription plan before deploying agents.',
      billingUrl: '/#pricing'
    });
  }

  const limit = store.subscriptions.agentsLimit || 0;
  const liveCount = store.agents.filter(a => a.status !== 'offline').length;
  if (limit > 0 && liveCount >= limit) {
    return res.status(403).json({
      error: 'Agent limit reached',
      code: 'AGENT_LIMIT',
      message: `Your ${store.subscriptions.plan} plan allows up to ${limit} agents. Upgrade to deploy more.`,
      billingUrl: '/#pricing'
    });
  }

  const token = (req.body.token || req.headers['x-enroll-token'] || '').toString();
  if (!token || !token.startsWith('hxl-')) {
    return res.status(401).json({
      error: 'Invalid enrollment token',
      hint: 'Use a token like hxl-7f3a9c2e1b4d8a6f'
    });
  }

  const hostname = (req.body.hostname || os.hostname()).toString().slice(0, 64);
  const environment = (req.body.environment || 'local').toString().slice(0, 32);
  const region = (req.body.region || 'unknown').toString().slice(0, 32);
  const platform = (req.body.platform || process.platform).toString().slice(0, 32);
  const arch = (req.body.arch || process.arch).toString().slice(0, 16);

  const agent = {
    id: `hxl-${crypto.randomBytes(4).toString('hex')}`,
    hostname,
    environment,
    region,
    platform,
    arch,
    status: 'online',
    version: '3.2.1',
    pid: Math.floor(10000 + Math.random() * 50000),
    enrolledAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    metrics: {
      cpu: +(8 + Math.random() * 20).toFixed(1),
      memory: +(20 + Math.random() * 25).toFixed(1),
      uptimeSec: 0,
      anomalies: 0,
      threatsBlocked: 0
    },
    modules: {
      monitoring: true,
      threatDetection: false,
      wifiIntelligence: false
    },
    tokenHash: crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)
  };

  store.agents.unshift(agent);
  pushEvent(store, 'enroll', `Agent ${agent.hostname} enrolled (${agent.id})`, agent.id);
  saveStore(store);

  res.status(201).json({
    ok: true,
    message: 'Agent active (running)',
    agent: {
      id: agent.id,
      hostname: agent.hostname,
      status: agent.status,
      version: agent.version,
      pid: agent.pid
    },
    hub: 'hub.hexacrimson.io:443',
    commands: {
      status: `agent status --id ${agent.id}`,
      heartbeat: `POST /api/agents/${agent.id}/heartbeat`
    }
  });
});

app.post('/api/agents/:id/heartbeat', (req, res) => {
  const store = loadStore();
  const agent = store.agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  agent.lastSeen = new Date().toISOString();
  agent.status = 'online';
  if (req.body.metrics) {
    agent.metrics = {
      ...agent.metrics,
      ...req.body.metrics,
      uptimeSec: (agent.metrics.uptimeSec || 0) + 30
    };
  } else {
    agent.metrics.cpu = +(10 + Math.random() * 50).toFixed(1);
    agent.metrics.memory = +(20 + Math.random() * 55).toFixed(1);
    agent.metrics.uptimeSec = (agent.metrics.uptimeSec || 0) + 30;
  }
  saveStore(store);
  res.json({ ok: true, agent });
});

app.post('/api/agents/:id/modules', (req, res) => {
  const store = loadStore();
  const agent = store.agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { monitoring, threatDetection, wifiIntelligence } = req.body || {};
  if (typeof monitoring === 'boolean') agent.modules.monitoring = monitoring;
  if (typeof threatDetection === 'boolean') agent.modules.threatDetection = threatDetection;
  if (typeof wifiIntelligence === 'boolean') agent.modules.wifiIntelligence = wifiIntelligence;
  pushEvent(store, 'module', `Modules updated on ${agent.hostname}`, agent.id);
  saveStore(store);
  res.json({ ok: true, modules: agent.modules });
});

app.delete('/api/agents/:id', (req, res) => {
  const store = loadStore();
  const idx = store.agents.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
  const [removed] = store.agents.splice(idx, 1);
  pushEvent(store, 'remove', `Agent ${removed.hostname} decommissioned`, removed.id);
  saveStore(store);
  res.json({ ok: true, removed: removed.id });
});

app.get('/api/events', (_req, res) => {
  const store = loadStore();
  res.json({ events: store.events.slice(0, 50) });
});

app.get('/api/metrics/summary', (_req, res) => {
  const store = loadStore();
  const agents = store.agents.filter(a => a.status === 'online');
  const avgCpu = agents.length
    ? agents.reduce((s, a) => s + (a.metrics.cpu || 0), 0) / agents.length
    : 0;
  const avgMem = agents.length
    ? agents.reduce((s, a) => s + (a.metrics.memory || 0), 0) / agents.length
    : 0;
  const threats = store.agents.reduce((s, a) => s + (a.metrics.threatsBlocked || 0), 0);
  const anomalies = store.agents.reduce((s, a) => s + (a.metrics.anomalies || 0), 0);
  res.json({
    online: agents.length,
    avgCpu: +avgCpu.toFixed(1),
    avgMemory: +avgMem.toFixed(1),
    threatsBlocked: threats,
    anomaliesFlagged: anomalies,
    alertLatencyMs: 640 + Math.floor(Math.random() * 120)
  });
});

// ── Billing / subscription API (demo) ───────────────────────────────────────

app.get('/api/billing/subscription', (_req, res) => {
  const store = loadStore();
  const sub = store.subscriptions || defaultSubscription();
  res.json({
    ...sub,
    active: hasActiveSubscription(store),
    canDeploy: hasActiveSubscription(store)
  });
});

app.post('/api/billing/subscribe', (req, res) => {
  const store = loadStore();
  const { plan = 'Pro', price = 99, period = 'monthly', addonSecurity = false, method = 'card' } = req.body || {};
  const planLimits = { Starter: 10, Pro: 100, Enterprise: 999999 };
  const normalized = String(plan);
  store.subscriptions = {
    ...defaultSubscription(),
    ...store.subscriptions,
    active: true,
    plan: normalized,
    price: Number(price) || 99,
    period,
    addonSecurity: !!addonSecurity,
    agentsLimit: planLimits[normalized] || 100,
    method,
    activatedAt: new Date().toISOString()
  };
  const invId = `INV-${String(1000 + store.invoices.length + 1)}`;
  store.invoices.unshift({
    id: invId,
    date: new Date().toISOString().slice(0, 10),
    amount: method === 'btc' ? '₿ pending' : `$${store.subscriptions.price + (addonSecurity ? 29 : 0)}.00`,
    status: method === 'btc' ? 'BTC' : 'Paid',
    method
  });
  pushEvent(store, 'billing', `Subscription activated: ${normalized} (${method}) — agent deploy unlocked`);
  saveStore(store);
  res.json({ ok: true, subscription: store.subscriptions, invoice: store.invoices[0] });
});

app.get('/api/billing/invoices', (_req, res) => {
  const store = loadStore();
  res.json({ invoices: store.invoices });
});

// ── Static site ─────────────────────────────────────────────────────────────

app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.sh')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
  }
}));

app.use('/docs', express.static(path.join(__dirname, 'docs'), { extensions: ['html'] }));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard'), { extensions: ['html'] }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// SPA-ish fallback for unknown paths → home
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Simulate installing agents finishing over time
setInterval(() => {
  try {
    const store = loadStore();
    let changed = false;
    for (const a of store.agents) {
      if (a.status === 'installing' && Math.random() > 0.6) {
        a.status = 'online';
        a.lastSeen = new Date().toISOString();
        pushEvent(store, 'online', `${a.hostname} finished install and is online`, a.id);
        changed = true;
      }
      if (a.status === 'online' && Math.random() > 0.85) {
        a.metrics.cpu = +(8 + Math.random() * 55).toFixed(1);
        a.metrics.memory = +(18 + Math.random() * 60).toFixed(1);
        a.lastSeen = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) saveStore(store);
  } catch (_) {
    /* ignore background errors */
  }
}, 8000);

ensureStore();

app.listen(PORT, () => {
  console.log(`HEXACRIMSON LABS control plane listening on :${PORT}`);
  console.log(`  Landing:   ${PUBLIC_URL}/`);
  console.log(`  Dashboard: ${PUBLIC_URL}/dashboard/`);
  console.log(`  Install:   curl -sSL ${PUBLIC_URL}/install.sh | bash`);
  console.log(`  Health:    ${PUBLIC_URL}/health`);
});
