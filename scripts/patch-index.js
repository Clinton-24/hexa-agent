const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'index.html');
let c = fs.readFileSync(p, 'utf8');

// Dashboard nav link
c = c.replace(
  '<li><a class="nav-link" href="#docs">Docs</a></li>',
  '<li><a class="nav-link" href="#docs">Docs</a></li>\n            <li><a class="nav-link" href="/dashboard/">Dashboard</a></li>'
);

// Logo home
c = c.replace('<a href="#" class="logo">', '<a href="/" class="logo">');

// Doc cards → real pages
const docs = [
  ["Opening Hexacrimson quickstart guide...", "/docs/quickstart.html"],
  ["Opening Hexacrimson API reference...", "/docs/api.html"],
  ["Opening Hexacrimson security overview...", "/docs/security.html"],
  ["Opening Hexacrimson CLI reference...", "/docs/cli.html"]
];
for (const [msg, href] of docs) {
  const from = `href="#" class="doc-card" onclick="showToast(event, '${msg}')"`;
  const to = `href="${href}" class="doc-card"`;
  if (!c.includes(from)) console.warn('doc card not found:', msg);
  c = c.replace(from, to);
}

// Replace triggerInstall
const tiStart = c.indexOf('function triggerInstall(event)');
const tiEnd = c.indexOf('// ── BILLING OVERLAY FUNCTIONS ──');
if (tiStart === -1 || tiEnd === -1) {
  console.error('triggerInstall markers missing', tiStart, tiEnd);
  process.exit(1);
}

const newTrigger = `async function triggerInstall(event) {
            if (event) event.preventDefault();

            const messages = [
                'Downloading Hexacrimson agent binary...',
                'Verifying checksum... ✓',
                'Installing system service...',
                'Enrolling with control plane...',
                'Connected to hub — registering agent',
                '✓ Hexacrimson agent v3.2.1 successfully deployed'
            ];

            let index = 0;
            toastBody.textContent = messages[0];
            toast.classList.add('show');
            toastProgress.style.width = '0%';

            if (progressInterval) clearInterval(progressInterval);
            if (toastTimeout) clearTimeout(toastTimeout);

            let enrollResult = null;
            try {
                const res = await fetch('/api/agents/enroll', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Enroll-Token': 'hxl-7f3a9c2e1b4d8a6f'
                    },
                    body: JSON.stringify({
                        token: 'hxl-7f3a9c2e1b4d8a6f',
                        hostname: 'browser-' + Math.random().toString(36).slice(2, 8),
                        environment: 'web',
                        region: 'edge',
                        platform: navigator.platform || 'browser',
                        arch: 'unknown'
                    })
                });
                enrollResult = await res.json();
            } catch (_) {}

            let progress = 0;
            progressInterval = setInterval(() => {
                progress += 1.5;
                toastProgress.style.width = progress + '%';

                if (progress > 15 && index < 1) { index = 1; toastBody.textContent = messages[1]; }
                if (progress > 30 && index < 2) { index = 2; toastBody.textContent = messages[2]; }
                if (progress > 50 && index < 3) {
                    index = 3;
                    toastBody.textContent = enrollResult && enrollResult.agent
                        ? 'Agent active (running) — PID ' + enrollResult.agent.pid
                        : messages[3];
                }
                if (progress > 70 && index < 4) {
                    index = 4;
                    toastBody.textContent = enrollResult && enrollResult.agent
                        ? 'Connected — id ' + enrollResult.agent.id
                        : messages[4];
                }
                if (progress > 88 && index < 5) { index = 5; toastBody.textContent = messages[5]; }

                if (progress >= 100) {
                    clearInterval(progressInterval);
                    const activeEl = document.getElementById('activeCount');
                    const installingEl = document.getElementById('installingCount');
                    if (activeEl) {
                        let val = parseInt(activeEl.textContent.replace(/,/g, '')) + 1;
                        activeEl.textContent = val.toLocaleString();
                    }
                    if (installingEl) {
                        let val = parseInt(installingEl.textContent) - 1;
                        if (val < 0) val = 0;
                        installingEl.textContent = val;
                    }
                    toastTimeout = setTimeout(() => {
                        toast.classList.remove('show');
                        toastProgress.style.width = '0%';
                        if (enrollResult && enrollResult.ok) {
                            showToast(null, 'Agent online — open Dashboard to manage it');
                        }
                    }, 2200);
                }
            }, 30);
        }

        `;

c = c.slice(0, tiStart) + newTrigger + c.slice(tiEnd);
console.log('triggerInstall replaced');

const expose = '        // Expose functions globally';
const apiHook = `
        // Live install command for this deployment
        (function updateInstallCommands() {
            const origin = window.location.origin;
            const installSteps = document.querySelectorAll('#install .step-cmd');
            if (installSteps[0]) {
                installSteps[0].textContent = 'curl -sSL ' + origin + '/install.sh | bash';
            }
        })();

        // Live fleet counters from API
        async function refreshLiveStats() {
            try {
                const res = await fetch('/api/status');
                if (!res.ok) return;
                const s = await res.json();
                const activeEl = document.getElementById('activeCount');
                const installingEl = document.getElementById('installingCount');
                const pendingEl = document.getElementById('pendingCount');
                if (activeEl) activeEl.textContent = Number(s.activeAgents).toLocaleString();
                if (installingEl) installingEl.textContent = s.installing;
                if (pendingEl) pendingEl.textContent = s.pending;
            } catch (_) {}
        }
        refreshLiveStats();
        setInterval(refreshLiveStats, 10000);

        // Persist checkout to billing API
        const _origProcessCheckout = processCheckout;
        window.processCheckout = async function(event) {
            event.preventDefault();
            const isBtc = document.getElementById('bitcoinPaymentSection').classList.contains('visible');
            const plan = document.getElementById('checkoutPlanName').textContent || 'Pro';
            const price = parseInt(document.getElementById('checkoutAmount').textContent, 10) || 99;
            const addonSecurity = document.getElementById('addonSecurity') && document.getElementById('addonSecurity').classList.contains('selected');
            try {
                await fetch('/api/billing/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plan: plan,
                        price: price,
                        period: (typeof isYearly !== 'undefined' && isYearly) ? 'yearly' : 'monthly',
                        addonSecurity: !!addonSecurity,
                        method: isBtc ? 'btc' : 'card'
                    })
                });
            } catch (_) {}
            return _origProcessCheckout(event);
        };

`;

if (!c.includes(expose)) {
  console.error('expose marker missing');
  process.exit(1);
}
c = c.replace(expose, apiHook + expose);
console.log('api hooks injected');

fs.writeFileSync(p, c, 'utf8');
console.log('wrote', p, 'length', c.length);
console.log({
  dashboard: c.includes('/dashboard/'),
  quickstart: c.includes('/docs/quickstart.html'),
  asyncTrigger: c.includes('async function triggerInstall'),
  hooks: c.includes('refreshLiveStats')
});
