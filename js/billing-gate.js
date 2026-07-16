/**
 * Shared billing gate — agents cannot enroll/deploy until subscription is active.
 */
(function (global) {
  const STORAGE_KEY = 'hxl_subscription';

  function cacheLocal(sub) {
    try {
      if (sub) localStorage.setItem(STORAGE_KEY, JSON.stringify(sub));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchSubscription() {
    try {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) return readLocal();
      const data = await res.json();
      cacheLocal(data);
      return data;
    } catch (_) {
      return readLocal();
    }
  }

  function isActive(sub) {
    return !!(sub && sub.active === true && sub.plan);
  }

  async function requireBilling(options = {}) {
    const sub = await fetchSubscription();
    if (isActive(sub)) {
      return { ok: true, subscription: sub };
    }
    if (typeof options.onBlocked === 'function') {
      options.onBlocked(sub);
    }
    return {
      ok: false,
      subscription: sub,
      message: options.message || 'Complete billing before deploying agents.'
    };
  }

  function markActiveLocal(plan, price, period) {
    const sub = {
      active: true,
      plan: plan || 'Pro',
      price: price || 99,
      period: period || 'monthly',
      activatedAt: new Date().toISOString()
    };
    cacheLocal(sub);
    return sub;
  }

  global.HxlBilling = {
    fetchSubscription,
    requireBilling,
    isActive,
    markActiveLocal,
    cacheLocal
  };
})(window);
