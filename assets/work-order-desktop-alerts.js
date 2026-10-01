(function (global) {
  "use strict";

  const STORAGE_PREFIX = "gestman365.workOrderDesktopAlerts.v1";
  const MAX_SEEN = 500;
  const SOUND_MODELS = [
    { name: "Sirene de fábrica", notes: [420, 1100], type: "sawtooth", step: 1, sweep: true },
    { name: "Buzzer de painel", notes: [180], type: "square", step: 0.5, pulse: 0.65 },
    { name: "Buzina industrial", notes: [220], type: "sawtooth", step: 1, pulse: 0.85, harmonic: 1.5 },
    { name: "Sirene de emergência", notes: [650, 1200], type: "square", step: 0.5 },
    { name: "Alarme de máquina", notes: [850], type: "square", step: 0.25, pulse: 0.6 },
    { name: "Sirene de varredura rápida", notes: [350, 1400], type: "sawtooth", step: 0.25, sweep: true },
    { name: "Alarme de ré industrial", notes: [1000], type: "square", step: 0.75, pulse: 0.5 },
    { name: "Buzina dupla de atenção", notes: [155, 195], type: "sawtooth", step: 0.5, pulse: 0.8, harmonic: 2 },
    { name: "Buzzer rápido de falha", notes: [300, 600], type: "square", step: 0.125, pulse: 0.75 },
    { name: "Sirene grave de operação", notes: [160, 480], type: "sawtooth", step: 1.25, sweep: true, harmonic: 1.5 }
  ];
  let soundEnd = 0;
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
      return { enabled: parsed.enabled === true, soundModel: validModel(parsed.soundModel), seen: Array.isArray(parsed.seen) ? parsed.seen.slice(-MAX_SEEN) : [] };
    } catch {
      return { enabled: false, soundModel: 0, seen: [] };
    }
  }

  function writeSettings(scope, settings) {
    try {
      global.localStorage?.setItem(storageKey(scope), JSON.stringify({
        enabled: settings.enabled === true,
        soundModel: validModel(settings.soundModel),
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
      enabled: settings.enabled === true,
      soundModel: settings.soundModel
    };
  }

  function validModel(value) {
    return Number.isInteger(value) && value >= 0 && value < SOUND_MODELS.length ? value : 0;
  }

  function selectSound(account, model) {
    const settings = ensureScope(account);
    writeSettings(activeScope, { ...settings, soundModel: validModel(Number(model)), seen: seenIds });
  }

  async function playSound(modelIndex = readSettings(activeScope).soundModel) {
    const AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return false;
    try {
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === "suspended") await audioContext.resume();
      const now = audioContext.currentTime;
      if (now < soundEnd) return true;
      soundEnd = now + 5;
      const model = SOUND_MODELS[validModel(modelIndex)];
      let index = 0;
      for (let offset = 0; offset < 5; offset += model.step) {
        const start = now + offset;
        const end = Math.min(now + 5, start + model.step);
        const toneEnd = start + (end - start) * (model.pulse || 1);
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(model.harmonic ? 0.07 : 0.12, Math.min(start + 0.01, toneEnd));
        gain.gain.setValueAtTime(model.harmonic ? 0.07 : 0.12, Math.max(start + 0.01, toneEnd - 0.025));
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        gain.connect(audioContext.destination);
        const oscillator = audioContext.createOscillator();
        oscillator.type = model.type;
        const noteIndex = index++ % model.notes.length;
        const frequency = model.notes[noteIndex];
        oscillator.frequency.setValueAtTime(frequency, start);
        if (model.sweep) oscillator.frequency.linearRampToValueAtTime(model.notes[(noteIndex + 1) % model.notes.length], toneEnd);
        oscillator.connect(gain);
        oscillator.start(start);
        oscillator.stop(end);
        oscillator.onended = () => { oscillator.disconnect?.(); gain.disconnect?.(); };
        if (model.harmonic) {
          const overtone = audioContext.createOscillator();
          overtone.type = "triangle";
          overtone.frequency.setValueAtTime(frequency * model.harmonic, start);
          if (model.sweep) overtone.frequency.linearRampToValueAtTime(model.notes[(noteIndex + 1) % model.notes.length] * model.harmonic, toneEnd);
          overtone.connect(gain);
          overtone.start(start);
          overtone.stop(end);
          overtone.onended = () => overtone.disconnect?.();
        }
      }
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
        silent: true
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
    playSound(settings.soundModel);
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
    await playSound(settings.soundModel);
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
    const chooser = global.document.createElement("label");
    chooser.innerHTML = `Modelo de alerta · 5 segundos<select class="field" aria-label="Modelo de alerta sonoro">${SOUND_MODELS.map((model, index) => `<option value="${index}" ${index === current.soundModel ? "selected" : ""}>${index + 1}. ${model.name}</option>`).join("")}</select><button class="btn" type="button" data-sound-preview>Ouvir modelo por 5 segundos</button>`;
    panel.appendChild(chooser);
    chooser.querySelector("select").addEventListener("change", event => selectSound(accountProvider(), event.target.value));
    chooser.querySelector("[data-sound-preview]").addEventListener("click", () => playSound(Number(chooser.querySelector("select").value)));
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

  global.gmWorkOrderDesktopAlerts = { configure, disable, observe, status, playSound, isOpenOrder, setAccountProvider, enhancePreferences, selectSound, soundModels: SOUND_MODELS };
})(window);
