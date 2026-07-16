(() => {
  const $ = (s) => document.querySelector(s);
  const toast = (msg) => {
    const el = $('#toast');
    const body = $('#toastBody');
    body.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2800);
  };

  const origin = window.location.origin;
  $('#installCmd').textContent = `curl -sSL ${origin}/install.sh | bash`;

  const hamburger = $('#hamburger');
  const navLinks = $('#navLinks');
  if (hamburger) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  function openEnroll() {
    $('#enrollModal').classList.add('open');
    const host = $('#enrollForm [name=hostname]');
    if (!host.value) host.value = `node-${Math.random().toString(36).slice(2, 7)}`;
  }
  function closeEnroll() {
    $('#enrollModal').classList.remove('open');
  }

  $('#enrollBtn')?.addEventListener('click', (e) => { e.preventDefault(); openEnroll(); });
  $('#enrollBtn2')?.addEventListener('click', openEnroll);
  $('#closeEnroll')?.addEventListener('click', closeEnroll);
  $('#enrollModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'enrollModal') closeEnroll();
  });

  $('#copyInstall')?.addEventListener('click', async () => {
    const text = $('#installCmd').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Install command copied');
    } catch {
      toast('Copy failed — select the command manually');
    }
  });

  $('#refreshBtn')?.addEventListener('click', () => loadAll(true));

  $('#enrollForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch('/api/agents/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enroll-Token': payload.token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enroll failed');
      toast(`Agent ${data.agent.id} online — PID ${data.agent.pid}`);
      closeEnroll();
      e.target.reset();
      loadAll();
    } catch (err) {
      toast(err.message);
    }
  });

  function relTime(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  function moduleTags(m = {}) {
    const keys = [
      ['monitoring', 'Mon'],
      ['threatDetection', 'Threat'],
      ['wifiIntelligence', 'WiFi']
    ];
    return keys.map(([k, label]) =>
      `<span class="mod-tag ${m[k] ? '' : 'off'}">${label}</span>`
    ).join('');
  }

  async function loadAll(manual) {
    try {
      const [agentsRes, metricsRes, eventsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/metrics/summary'),
        fetch('/api/events')
      ]);
      const agentsData = await agentsRes.json();
      const metrics = await metricsRes.json();
      const eventsData = await eventsRes.json();

      $('#statOnline').textContent = metrics.online.toLocaleString();
      $('#statCpu').textContent = `${metrics.avgCpu}%`;
      $('#statMem').textContent = `${metrics.avgMemory}%`;
      $('#statThreats').textContent = metrics.threatsBlocked.toLocaleString();
      $('#statAnomalies').textContent = metrics.anomaliesFlagged;
      $('#agentCount').textContent = agentsData.total;

      const tbody = $('#agentRows');
      tbody.innerHTML = agentsData.agents.map((a) => `
        <tr data-id="${a.id}">
          <td>
            <span class="status-pill">
              <span class="dot ${a.status === 'online' ? 'online' : a.status === 'installing' ? 'installing' : 'offline'}"></span>
              ${a.status}
            </span>
          </td>
          <td><strong>${escapeHtml(a.hostname)}</strong></td>
          <td class="mono">${a.id}</td>
          <td>${escapeHtml(a.environment)}${a.region ? ` · ${escapeHtml(a.region)}` : ''}</td>
          <td>${a.metrics?.cpu ?? '—'}%</td>
          <td>${a.metrics?.memory ?? '—'}%</td>
          <td><div class="mod-tags">${moduleTags(a.modules)}</div></td>
          <td class="mono">${relTime(a.lastSeen)}</td>
          <td>
            <button class="icon-btn" data-action="heartbeat" title="Heartbeat">♥</button>
            <button class="icon-btn" data-action="modules" title="Toggle security">🛡</button>
            <button class="icon-btn" data-action="remove" title="Decommission">✕</button>
          </td>
        </tr>
      `).join('') || `<tr><td colspan="9" class="muted">No agents yet — enroll one to get started.</td></tr>`;

      const list = $('#eventList');
      list.innerHTML = (eventsData.events || []).slice(0, 20).map((ev) => `
        <li>
          <span class="time">${new Date(ev.at).toLocaleString()} · ${ev.type}</span>
          ${escapeHtml(ev.message)}
        </li>
      `).join('') || '<li class="muted">No events yet</li>';

      if (manual) toast('Fleet refreshed');
    } catch (err) {
      toast('Failed to load control plane data');
      console.error(err);
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  $('#agentRows')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset.id;
    if (!id) return;
    const action = btn.dataset.action;
    try {
      if (action === 'heartbeat') {
        const res = await fetch(`/api/agents/${id}/heartbeat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) throw new Error('Heartbeat failed');
        toast(`Heartbeat OK for ${id}`);
      } else if (action === 'modules') {
        const res = await fetch(`/api/agents/${id}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threatDetection: true, monitoring: true })
        });
        if (!res.ok) throw new Error('Module update failed');
        toast('Security modules enabled');
      } else if (action === 'remove') {
        if (!confirm('Decommission this agent?')) return;
        const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Remove failed');
        toast('Agent decommissioned');
      }
      loadAll();
    } catch (err) {
      toast(err.message);
    }
  });

  loadAll();
  setInterval(loadAll, 8000);
})();
