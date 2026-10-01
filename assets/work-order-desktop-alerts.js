(function (global) {
  "use strict";

  const STORAGE_PREFIX = "gestman365.workOrderDesktopAlerts.v1";
  const MAX_SEEN = 500;
  let activeScope = "";
  let initialized = false;
  let seenIds = new Set();
  let audioContext = null;
  let accountProvider = function () { return null; };

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }

  function isOpenOrder(order) {
    const status = normalize(order?.status);
    return status === "aberta" || status === "aberto";
  }

  function scopeKey(account) {
    const companyId = account?.company?.id || "company";
    const userId = account?.user?.id || "user";
    return `${companyId}:${userId}`;
  }

  function storageKey(scope) {
    return `${STORAGE_PREFIX}:${scope}`;
  }

  function readSettings(scope) {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(storageKey(scope)) || "{}");
      return { enabled: parsed.enabled === true, seen: Array.isArray(parsed.seen) ? parsed.seen.slice(-MAX_SEEN) : [] };
    } catch {
      return { enabled: false, seen: [] };
    }
  }

  function writeSettings(scope, settings) {
    try {
      global.localStorage?.setItem(storageKey(scope), JSON.stringify({
        enabled: settings.enabled === true,
        seen: Array.from(settings.seen || []).slice(-MAX_SEEN)
      }));
    } catch {
      // A preferência local é opcional; o alerta continua funcionando na sessão atual.
    }
  }

  function ensureScope(account) {
    const nextScope = scopeKey(account);
    if (nextScope === activeScope) return readSettings(activeScope);
    activeScope = nextScope;
    const settings = readSettings(activeScope);
    seenIds = new Set(settings.seen);
    initialized = false;
    return settings;
  }

  function permissionState() {
    if (!("Notification" in global)) return "unsupported";
    return global.Notification.permission;
  }

  function status(account) {
    const settings = ensureScope(account);
    return {
      supported: "Notification" in global,
      permission: permissionState(),
      enabled: settings.enabled === true
    };
  }

  async function playSound() {
    const AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return false;
    try {
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === "suspended") await audioContext.resume();
      const now = audioContext.currentTime;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      gain.connect(audioContext.destination);
      [740, 988].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.16);
        oscillator.connect(gain);
        oscillator.start(now + index * 0.16);
        oscillator.stop(now + 0.38 + index * 0.16);
      });
      return true;
    } catch {
      return false;
    }
  }

  function notificationBody(order) {
    const asset = order?.assetName || order?.machineName || order?.equipmentName || "Equipamento não informado";
    const priority = order?.priority ? ` · Prioridade ${order.priority}` : "";
    return `${order?.title || order?.description || asset}${priority}`;
  }

  function emit(order, account) {
    const settings = ensureScope(account);
    if (!settings.enabled || permissionState() !== "granted") return false;
    const number = order?.number || "Nova O.S.";
    try {
      const notification = new global.Notification(`Nova Ordem de Serviço · ${number}`, {
        body: notificationBody(order),
        icon: "assets/ui/illustrations/apple-touch-icon-v2.png",
        badge: "assets/ui/illustrations/favicon-32.png",
        tag: `gestman-os-${order.id}`,
        renotify: false,
        silent: false
      });
      notification.onclick = function () {
        global.focus?.();
        if (typeof global.setView === "function") global.setView("orders");
        if (typeof global.showOrderDetails === "function") global.setTimeout(() => global.showOrderDetails(order.id), 80);
        notification.close?.();
      };
    } catch {
      return false;
    }
    playSound();
    if (typeof global.stage20EmitNotification === "function") {
      global.stage20EmitNotification({
        stableKey: `desktop-new-order:${order.id}`,
        title: `Nova O.S. aberta · ${number}`,
        message: notificationBody(order),
        category: "Ordem de Serviço",
        level: normalize(order?.priority).includes("urgent") || normalize(order?.priority).includes("critic") ? "Urgente" : "Atenção",
        related: { view: "orders", type: "order", id: order.id },
        action: "Abrir O.S."
      });
    }
    return true;
  }

  function observe(previousOrders, nextOrders, account) {
    const settings = ensureScope(account);
    const previousIds = new Set((Array.isArray(previousOrders) ? previousOrders : []).map(order => String(order?.id || "")).filter(Boolean));
    const current = (Array.isArray(nextOrders) ? nextOrders : []).filter(order => order?.id);
    if (!initialized) {
      current.forEach(order => seenIds.add(String(order.id)));
      initialized = true;
      writeSettings(activeScope, { ...settings, seen: seenIds });
      return [];
    }
    const alerted = [];
    current.forEach(order => {
      const id = String(order.id);
      if (previousIds.has(id) || seenIds.has(id) || !isOpenOrder(order)) return;
      seenIds.add(id);
      if (emit(order, account)) alerted.push(id);
    });
    writeSettings(activeScope, { ...settings, seen: seenIds });
    return alerted;
  }

  async function configure(account) {
    const settings = ensureScope(account);
    if (!("Notification" in global)) return { ok: false, reason: "unsupported" };
    let permission = global.Notification.permission;
    if (permission === "default") permission = await global.Notification.requestPermission();
    if (permission !== "granted") {
      writeSettings(activeScope, { ...settings, enabled: false, seen: seenIds });
      return { ok: false, reason: permission };
    }
    writeSettings(activeScope, { ...settings, enabled: true, seen: seenIds });
    await playSound();
    return { ok: true, reason: "granted" };
  }

  function disable(account) {
    const settings = ensureScope(account);
    writeSettings(activeScope, { ...settings, enabled: false, seen: seenIds });
    return status(account);
  }

  function statusLabel(current) {
    if (!current.supported) return "Este navegador não oferece notificações no computador.";
    if (current.permission === "denied") return "Notificações bloqueadas pelo navegador. Libere a permissão nas configurações do site.";
    if (current.enabled && current.permission === "granted") return "Ativo: novas O.S. abertas geram notificação e alerta sonoro.";
    return "Inativo: ative para receber novas O.S. neste computador.";
  }

  function enhancePreferences() {
    const form = global.document?.getElementById("s20NotificationPrefs");
    if (!form || form.querySelector("[data-desktop-order-alerts]")) return;
    const account = accountProvider();
    const current = status(account);
    const panel = global.document.createElement("div");
    panel.className = "full stage20-pref-list";
    panel.dataset.desktopOrderAlerts = "true";
    panel.innerHTML = `<div class="stage20-desktop-alert-row"><span><strong>Alertas de nova O.S. no computador</strong><small class="stage20-sub" data-desktop-alert-status>${statusLabel(current)}</small></span><div class="stage20-notification-actions"><button class="btn primary" type="button" data-desktop-alert-enable>${current.enabled ? "Testar alerta" : "Ativar alertas"}</button>${current.enabled ? '<button class="btn" type="button" data-desktop-alert-disable>Desativar</button>' : ""}</div></div>`;
    const actions = form.querySelector(".toolbar");
    form.insertBefore(panel, actions || null);
    panel.querySelector("[data-desktop-alert-enable]")?.addEventListener("click", async function () {
      const result = await configure(accountProvider());
      if (typeof global.showToast === "function") global.showToast(result.ok ? "Alertas ativados. O som de teste foi reproduzido." : result.reason === "denied" ? "O navegador bloqueou as notificações. Libere a permissão do site." : "Este navegador não oferece notificações no computador.", result.ok ? "success" : "warning");
      panel.remove();
      enhancePreferences();
    });
    panel.querySelector("[data-desktop-alert-disable]")?.addEventListener("click", function () {
      disable(accountProvider());
      if (typeof global.showToast === "function") global.showToast("Alertas de nova O.S. desativados neste computador.");
      panel.remove();
      enhancePreferences();
    });
  }

  function setAccountProvider(provider) {
    if (typeof provider === "function") accountProvider = provider;
  }

  const observer = global.MutationObserver ? new global.MutationObserver(enhancePreferences) : null;
  if (observer && global.document?.documentElement) observer.observe(global.document.documentElement, { childList: true, subtree: true });

  global.gmWorkOrderDesktopAlerts = { configure, disable, observe, status, playSound, isOpenOrder, setAccountProvider, enhancePreferences };
})(window);
