export type JsonRecord = Record<string, unknown>;

export type MaintenanceMetric = {
  value: number | null;
  unit: string;
  period: { start: string; end: string };
  filters: JsonRecord;
  recordCount: number;
  recordIds: string[];
  source: string;
  formula: string;
  quality: {
    state: "valid" | "partial" | "insufficient";
    reason: string;
    ignoredRecords: number;
  };
  updatedAt: string;
  detail: string;
};

export type MaintenanceMetricsContract = {
  version: 1;
  period: { start: string; end: string; label: string };
  filters: JsonRecord;
  metrics: Record<string, MaintenanceMetric>;
  series: Record<string, Array<{
    start: string;
    end: string;
    label: string;
    value: number | null;
    quality: string;
    recordCount: number;
    recordIds: string[];
    source: string;
    detail: string;
  }>>;
  quality: {
    state: "valid" | "partial" | "insufficient";
    invalidRecords: number;
    missingAssetLinks: number;
    urgentOrdersWithoutDeadline: number;
    assetsWithoutOperationalCalendar: number;
  };
  updatedAt: string;
  source: string;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const SOURCE = "gm_tenant_state (Supabase/PostgreSQL)";

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object").map(record) : [];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function key(value: unknown): string {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function id(value: unknown): string {
  return text(value).slice(0, 180);
}

function finite(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" || /^\d{10,13}$/.test(text(value)) ? Number(value) : NaN;
  const parsed = new Date(Number.isFinite(numeric) ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : text(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstDate(item: JsonRecord, fields: string[]): Date | null {
  for (const field of fields) {
    const parsed = dateValue(item[field]);
    if (parsed) return parsed;
  }
  return null;
}

function unique(items: JsonRecord[]): JsonRecord[] {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const value = id(item.id || item.number || `row-${index}`);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function metricIds(items: JsonRecord[]): string[] {
  return [...new Set(items.map((item) => id(item.id || item.number)).filter(Boolean))].slice(0, 500);
}

function isCanceled(status: unknown): boolean {
  return key(status).startsWith("cancelad");
}

function isClosed(status: unknown): boolean {
  const value = key(status);
  return value.startsWith("conclu") || value.startsWith("finaliz") || value.startsWith("cancelad");
}

function isRunning(status: unknown): boolean {
  return key(status).startsWith("em exec");
}

function isInactive(status: unknown): boolean {
  return key(status).startsWith("inativ");
}

function isCorrective(order: JsonRecord): boolean {
  const value = key([order.maintenanceType, order.maintenance, order.type, order.category, order.origin].filter(Boolean).join(" "));
  return value.includes("corret") || value.includes("falha") || value.includes("emerg");
}

function isPreventive(order: JsonRecord): boolean {
  return Boolean(order.preventivePlanId || order.planId)
    || key([order.maintenanceType, order.maintenance, order.type, order.category].filter(Boolean).join(" ")).includes("prevent");
}

function normalizeFilters(input: unknown): JsonRecord {
  const raw = record(input);
  const allowed = [
    "period", "start", "end", "rangeStart", "rangeEnd", "asset", "plant", "area", "location",
    "maintenanceType", "criticality", "orderStatus", "priority", "responsible", "team",
    "assetCategory", "downtimeType", "plan", "seriesBuckets",
  ];
  return Object.fromEntries(allowed.filter((name) => raw[name] !== undefined).map((name) => [name, raw[name]]));
}

function allStateDates(state: JsonRecord): Date[] {
  const collections = ["orders", "assets", "downtimes", "measurements", "pendingActions", "preventivePlans"];
  return collections.flatMap((name) => records(state[name])).flatMap((item) => [
    firstDate(item, ["createdAt", "startAt", "readAt", "scheduledAt", "nextExecution", "updatedAt"]),
  ]).filter((value): value is Date => Boolean(value));
}

function resolveRange(state: JsonRecord, filters: JsonRecord, now: Date): { start: Date; end: Date; label: string } {
  const explicitStart = dateValue(filters.rangeStart);
  const explicitEnd = dateValue(filters.rangeEnd);
  if (explicitStart && explicitEnd && explicitEnd >= explicitStart) {
    return { start: explicitStart, end: explicitEnd, label: "Período informado" };
  }

  const start = new Date(now);
  const end = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  const period = text(filters.period || "30");
  if (period === "today") return { start, end, label: "Hoje" };
  if (period === "7" || period === "30") {
    start.setUTCDate(start.getUTCDate() - (Number(period) - 1));
    return { start, end, label: `Últimos ${period} dias` };
  }
  if (period === "month") {
    start.setUTCDate(1);
    return { start, end, label: "Mês atual" };
  }
  if (period === "previous") {
    start.setUTCMonth(start.getUTCMonth() - 1, 1);
    end.setUTCDate(0);
    return { start, end, label: "Mês anterior" };
  }
  if (period === "year") {
    start.setUTCMonth(0, 1);
    return { start, end, label: "Ano atual" };
  }
  if (period === "custom") {
    const customStart = dateValue(filters.start);
    const customEnd = dateValue(filters.end);
    if (customStart && customEnd && customEnd >= customStart) {
      customStart.setUTCHours(0, 0, 0, 0);
      customEnd.setUTCHours(23, 59, 59, 999);
      return { start: customStart, end: customEnd, label: "Período personalizado" };
    }
  }
  if (period === "all") {
    const dates = allStateDates(state);
    const earliest = dates.length ? new Date(Math.min(...dates.map((value) => value.getTime()))) : new Date(now.getTime() - 29 * DAY_MS);
    earliest.setUTCHours(0, 0, 0, 0);
    return { start: earliest, end, label: "Todo o histórico registrado" };
  }
  start.setUTCDate(start.getUTCDate() - 29);
  return { start, end, label: "Últimos 30 dias" };
}

function within(value: Date | null, start: Date, end: Date): boolean {
  return Boolean(value && value >= start && value <= end);
}

function orderDate(order: JsonRecord): Date | null {
  return firstDate(order, ["finishedAt", "completedAt", "startedAt", "scheduledAt", "createdAt"]);
}

function orderDurationHours(order: JsonRecord): number | null {
  for (const field of ["actualHours", "executionHours", "workedHours", "mttr", "actualDurationHours"]) {
    const value = finite(order[field]);
    if (value !== null && value > 0) return value;
  }
  const started = firstDate(order, ["realStartAt", "startedAt"]);
  const finished = firstDate(order, ["realEndAt", "finishedAt", "completedAt", "closedAt"]);
  if (!started || !finished || finished <= started) return null;
  const pauseHours = Math.max(0, finite(order.pauseHours) ?? 0);
  const duration = (finished.getTime() - started.getTime()) / HOUR_MS - pauseHours;
  return duration > 0 ? duration : null;
}

function parseTime(value: unknown): number | null {
  const match = text(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

function weekdayValues(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const names: Record<string, number> = {
    dom: 0, domingo: 0, sun: 0, seg: 1, segunda: 1, mon: 1, ter: 2, terca: 2, tue: 2,
    qua: 3, quarta: 3, wed: 3, qui: 4, quinta: 4, thu: 4, sex: 5, sexta: 5, fri: 5,
    sab: 6, sabado: 6, sat: 6,
  };
  return [...new Set(value.map((item) => {
    const numeric = Number(item);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
    return names[key(item)];
  }).filter((item): item is number => Number.isInteger(item)))];
}

type TimeInterval = { start: number; end: number };

function overlap(left: TimeInterval, right: TimeInterval): TimeInterval | null {
  const start = Math.max(left.start, right.start);
  const end = Math.min(left.end, right.end);
  return end > start ? { start, end } : null;
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TimeInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) merged.push({ ...interval });
    else last.end = Math.max(last.end, interval.end);
  }
  return merged;
}

function intervalHours(intervals: TimeInterval[]): number {
  return intervals.reduce((sum, item) => sum + (item.end - item.start) / HOUR_MS, 0);
}

function calendarMatchesAsset(calendar: JsonRecord, asset: JsonRecord, context: JsonRecord): boolean {
  if (isInactive(calendar.status)) return false;
  const bindings: Array<[unknown, unknown]> = [
    [calendar.assetId, asset.id], [calendar.locationId, asset.locationId],
    [calendar.sectorLocationId, context.sectorLocationId], [calendar.operationalAreaId, context.operationalAreaId],
    [calendar.regionId, context.regionId],
  ];
  const declared = bindings.filter(([expected]) => text(expected));
  if (!declared.length) return calendar.appliesToAllAssets === true || calendar.default === true;
  return declared.every(([expected, actual]) => id(expected) === id(actual));
}

function scheduleIntervals(calendar: JsonRecord, asset: JsonRecord, range: { start: Date; end: Date }): TimeInterval[] {
  const weekdays = weekdayValues(calendar.weekdays || calendar.daysOfWeek || calendar.days);
  if (!weekdays.length) return [];
  let startMinute = parseTime(calendar.startTime || calendar.start);
  let endMinute = parseTime(calendar.endTime || calendar.end);
  const scheduleMatch = text(calendar.schedule || calendar.hours || calendar.operatingHours).match(/(\d{1,2}:\d{2})\s*[-–às]+\s*(\d{1,2}:\d{2})/i);
  if ((startMinute === null || endMinute === null) && scheduleMatch) {
    startMinute = parseTime(scheduleMatch[1]);
    endMinute = parseTime(scheduleMatch[2]);
  }
  const dailyHours = finite(calendar.dailyHours || calendar.hoursPerDay || calendar.operatingHoursPerDay);
  if ((startMinute === null || endMinute === null) && dailyHours !== null && dailyHours > 0 && dailyHours <= 24) {
    startMinute = 0;
    endMinute = Math.round(dailyHours * 60);
  }
  if (startMinute === null || endMinute === null || endMinute <= startMinute) return [];
  const breakMinutes = Math.max(0, finite(calendar.breakMinutes || calendar.breaksMinutes) ?? 0);
  const createdAt = dateValue(asset.createdAt)?.getTime() ?? range.start.getTime();
  const firstDay = new Date(Math.max(range.start.getTime(), createdAt));
  firstDay.setUTCHours(0, 0, 0, 0);
  const intervals: TimeInterval[] = [];
  for (let cursor = firstDay.getTime(); cursor <= range.end.getTime(); cursor += DAY_MS) {
    const day = new Date(cursor);
    if (!weekdays.includes(day.getUTCDay())) continue;
    const rawStart = cursor + startMinute * 60_000;
    const rawEnd = cursor + endMinute * 60_000 - breakMinutes * 60_000;
    const clipped = overlap({ start: rawStart, end: rawEnd }, { start: range.start.getTime(), end: range.end.getTime() + 1 });
    if (clipped) intervals.push(clipped);
  }
  return intervals;
}

function metric(
  value: number | null,
  unit: string,
  range: { start: Date; end: Date },
  filters: JsonRecord,
  items: JsonRecord[],
  formula: string,
  qualityState: "valid" | "partial" | "insufficient",
  reason: string,
  ignoredRecords: number,
  updatedAt: string,
  detail: string,
): MaintenanceMetric {
  return {
    value: value === null || !Number.isFinite(value) ? null : Number(value.toFixed(4)),
    unit,
    period: { start: range.start.toISOString(), end: range.end.toISOString() },
    filters,
    recordCount: unique(items).length,
    recordIds: metricIds(unique(items)),
    source: SOURCE,
    formula,
    quality: { state: qualityState, reason, ignoredRecords },
    updatedAt,
    detail,
  };
}

function computeMetricSet(state: JsonRecord, filters: JsonRecord, range: { start: Date; end: Date }, now: Date, updatedAt: string) {
  const locations = new Map(records(state.locations).map((item) => [id(item.id), item]));
  const regions = new Map(records(state.regions).map((item) => [id(item.id), item]));
  const sectors = new Map(records(state.sectorsLocations).map((item) => [id(item.id), item]));
  const structures = new Map(records(state.installationStructures).map((item) => [id(item.id), item]));
  const areas = new Map(records(state.operationalAreas).map((item) => [id(item.id), item]));
  const assetContext = (asset: JsonRecord) => {
    const location = locations.get(id(asset.locationId)) || {};
    const structure = structures.get(id(asset.installationStructureId || asset.structureId || asset.installationId)) || {};
    const sector = sectors.get(id(structure.sectorLocationId || asset.sectorLocationId)) || {};
    const area = areas.get(id(sector.operationalAreaId || asset.operationalAreaId || asset.areaId)) || {};
    const region = regions.get(id(location.regionId || asset.regionId)) || {};
    return {
      locationId: id(asset.locationId || sector.id),
      sectorLocationId: id(sector.id),
      operationalAreaId: id(area.id),
      regionId: id(region.id),
      plant: text(asset.plant || asset.unit || asset.factory || region.name),
      areaName: text(area.name),
      locationName: text(location.name || sector.name),
    };
  };
  const filterEquals = (expected: unknown, ...actual: unknown[]) => !text(expected) || actual.some((value) => key(value) === key(expected));
  const assets = records(state.assets).filter((asset) => {
    if (isInactive(asset.status)) return false;
    const created = dateValue(asset.createdAt);
    if (created && created > range.end) return false;
    const context = assetContext(asset);
    return filterEquals(filters.asset, asset.id)
      && filterEquals(filters.plant, context.plant, context.regionId)
      && filterEquals(filters.area, context.operationalAreaId, context.areaName, asset.area, asset.areaId)
      && filterEquals(filters.location, context.locationId, context.locationName, context.sectorLocationId)
      && filterEquals(filters.criticality, asset.criticality)
      && filterEquals(filters.assetCategory, asset.category, asset.type);
  });
  const assetIds = new Set(assets.map((asset) => id(asset.id)));
  const assetScopeRequested = ["asset", "plant", "area", "location", "criticality", "assetCategory"]
    .some((name) => text(filters[name]));
  const scopedOrders = unique(records(state.orders).filter((order) => {
    const orderAssetId = id(order.assetId);
    if ((orderAssetId || assetScopeRequested) && !assetIds.has(orderAssetId)) return false;
    return filterEquals(filters.maintenanceType, order.maintenanceType, order.maintenance, order.type, order.category)
      && filterEquals(filters.orderStatus, order.status)
      && filterEquals(filters.priority, order.priority)
      && filterEquals(filters.responsible, order.executor, order.responsible, order.owner, order.assignedTo)
      && filterEquals(filters.team, order.teamId, order.team, order.teamName)
      && filterEquals(filters.plan, order.preventivePlanId, order.planId);
  }));
  const periodOrders = scopedOrders.filter((order) => within(orderDate(order), range.start, range.end));
  const correctiveClosed = periodOrders.filter((order) => !isCanceled(order.status) && isClosed(order.status) && isCorrective(order));
  const mttrRows = correctiveClosed.map((order) => ({ order, hours: orderDurationHours(order) }));
  const validMttr = mttrRows.filter((item) => item.hours !== null) as Array<{ order: JsonRecord; hours: number }>;
  const mttrValue = validMttr.length ? validMttr.reduce((sum, item) => sum + item.hours, 0) / validMttr.length : null;

  const calendars = [...records(state.operationalCalendars), ...records(state.productiveCalendars)];
  const scheduleByAsset = new Map<string, TimeInterval[]>();
  for (const asset of assets) {
    const context = assetContext(asset);
    const matching = calendars.filter((calendar) => calendarMatchesAsset(calendar, asset, context));
    const intervals = mergeIntervals(matching.flatMap((calendar) => scheduleIntervals(calendar, asset, range)));
    if (intervals.length) scheduleByAsset.set(id(asset.id), intervals);
  }
  const scheduledHours = [...scheduleByAsset.values()].reduce((sum, intervals) => sum + intervalHours(intervals), 0);
  const assetsWithoutCalendar = assets.length - scheduleByAsset.size;

  const downtimeRows: Array<{ item: JsonRecord; interval: TimeInterval }> = [];
  let invalidDowntimes = 0;
  for (const item of records(state.downtimes)) {
    if (isCanceled(item.status) || !assetIds.has(id(item.assetId))) continue;
    if (!filterEquals(filters.downtimeType, item.type)) continue;
    const start = firstDate(item, ["startAt", "createdAt"]);
    let end = firstDate(item, ["endAt", "finishedAt"]);
    const registeredHours = finite(item.durationHours);
    if (!end && start && registeredHours !== null && registeredHours >= 0) end = new Date(start.getTime() + registeredHours * HOUR_MS);
    if (!end && key(item.status).startsWith("ativ")) end = now;
    if (!start || !end || end <= start) {
      invalidDowntimes += 1;
      continue;
    }
    const clipped = overlap({ start: start.getTime(), end: end.getTime() }, { start: range.start.getTime(), end: range.end.getTime() + 1 });
    if (clipped) downtimeRows.push({ item, interval: clipped });
  }
  const scheduledDowntimeByAsset = new Map<string, TimeInterval[]>();
  for (const row of downtimeRows) {
    const assetId = id(row.item.assetId);
    const schedule = scheduleByAsset.get(assetId) || [];
    const intersections = schedule.map((slot) => overlap(slot, row.interval)).filter((item): item is TimeInterval => Boolean(item));
    scheduledDowntimeByAsset.set(assetId, [...(scheduledDowntimeByAsset.get(assetId) || []), ...intersections]);
  }
  const stoppedScheduledHours = [...scheduledDowntimeByAsset.values()].reduce((sum, intervals) => sum + intervalHours(mergeIntervals(intervals)), 0);
  const availabilityValue = scheduledHours > 0 ? Math.max(0, (scheduledHours - stoppedScheduledHours) / scheduledHours * 100) : null;

  const measurementPoints = records(state.measurementPoints);
  const hourMeterPointIds = new Set(measurementPoints.filter((point) => key([point.measurementType, point.type, point.name, point.unit].join(" ")).includes("horimet")).filter((point) => assetIds.has(id(point.assetId))).map((point) => id(point.id)));
  const pointAssets = new Map(measurementPoints.map((point) => [id(point.id), id(point.assetId)]));
  const meterGroups = new Map<string, Array<{ item: JsonRecord; at: number; value: number }>>();
  for (const reading of records(state.measurements)) {
    const pointId = id(reading.pointId);
    const assetId = id(reading.assetId || pointAssets.get(pointId));
    const isMeter = hourMeterPointIds.has(pointId) || key([reading.type, reading.measurementType, reading.unit].join(" ")).includes("horimet");
    if (!isMeter || !assetIds.has(assetId) || reading.reductionJustification || reading.correctsMeasurementId) continue;
    const at = firstDate(reading, ["readAt", "recordedAt", "createdAt"]);
    const value = finite(reading.value ?? reading.reading);
    if (!at || at > range.end || value === null) continue;
    const groupId = pointId || `asset:${assetId}`;
    if (!meterGroups.has(groupId)) meterGroups.set(groupId, []);
    meterGroups.get(groupId)?.push({ item: reading, at: at.getTime(), value });
  }
  let meterHours = 0;
  const meterRecords: JsonRecord[] = [];
  const meteredAssets = new Set<string>();
  for (const readings of meterGroups.values()) {
    readings.sort((a, b) => a.at - b.at);
    const prior = [...readings].reverse().find((item) => item.at < range.start.getTime());
    const inRange = readings.filter((item) => item.at >= range.start.getTime());
    const selected = prior ? [prior, ...inRange] : inRange;
    for (let index = 1; index < selected.length; index += 1) {
      const delta = selected[index].value - selected[index - 1].value;
      if (delta > 0) {
        meterHours += delta;
        meterRecords.push(selected[index - 1].item, selected[index].item);
        const pointId = id(selected[index].item.pointId);
        meteredAssets.add(id(selected[index].item.assetId || pointAssets.get(pointId)));
      }
    }
  }
  const failures = correctiveClosed;
  const calendarOperatingHours = scheduledHours > 0 ? Math.max(0, scheduledHours - stoppedScheduledHours) : 0;
  const mtbfHours = meterHours > 0 ? meterHours : calendarOperatingHours;
  const mtbfValue = failures.length > 0 && mtbfHours > 0 ? mtbfHours / failures.length : null;

  const openOrders = periodOrders.filter((order) => !isClosed(order.status) && !isCanceled(order.status));
  const runningOrders = periodOrders.filter((order) => isRunning(order.status));
  const lateOrders = scopedOrders.filter((order) => {
    if (isClosed(order.status) || isCanceled(order.status)) return false;
    const due = firstDate(order, ["dueAt", "deadline", "scheduledAt"]);
    return Boolean(due && due < now);
  });
  const urgentWithoutDeadline = scopedOrders.filter((order) => !isClosed(order.status)
    && ["critica", "urgente"].includes(key(order.priority))
    && !firstDate(order, ["dueAt", "deadline", "scheduledAt"]));
  const preventiveOrders = periodOrders.filter((order) => isPreventive(order) && !isCanceled(order.status));
  const preventiveOnTime = preventiveOrders.filter((order) => {
    if (!isClosed(order.status)) return false;
    const done = firstDate(order, ["finishedAt", "completedAt"]);
    const due = firstDate(order, ["dueAt", "deadline", "scheduledAt"]);
    return Boolean(done && due && done <= due);
  });
  const validDowntimeItems = downtimeRows.map((row) => row.item);
  const downtimeByAsset = new Map<string, TimeInterval[]>();
  for (const row of downtimeRows) {
    const assetId = id(row.item.assetId);
    downtimeByAsset.set(assetId, [...(downtimeByAsset.get(assetId) || []), row.interval]);
  }
  const downtimeHours = [...downtimeByAsset.values()]
    .reduce((sum, intervals) => sum + intervalHours(mergeIntervals(intervals)), 0);
  const criticalAssets = assets.filter((asset) => key(asset.criticality).includes("crit") || key(asset.criticality) === "alta");
  const pendingActions = records(state.pendingActions).filter((item) => {
    if (["concluida", "cancelada"].includes(key(item.status))) return false;
    const due = firstDate(item, ["dueAt", "dueDate", "scheduledAt"]);
    return Boolean(due && due < now && due <= range.end);
  });
  const lowStock = records(state.spareParts).filter((item) => {
    const minimum = finite(item.minimum) ?? 0;
    const balance = finite(item.balance) ?? 0;
    return minimum > 0 && balance < minimum;
  });
  const missingAssetLinks = records(state.orders).filter((item) => item.assetId && !records(state.assets).some((asset) => id(asset.id) === id(item.assetId))).length
    + records(state.downtimes).filter((item) => item.assetId && !records(state.assets).some((asset) => id(asset.id) === id(item.assetId))).length;
  const qualityState = (valid: boolean, partial: boolean): "valid" | "partial" | "insufficient" => valid ? (partial ? "partial" : "valid") : "insufficient";
  const mttrReason = validMttr.length ? "O.S. corretivas concluídas com duração válida." : "Não há O.S. corretiva concluída com duração válida no período.";
  const mtbfReason = mtbfValue !== null
    ? (meterHours > 0 ? "Horas operacionais obtidas de horímetros válidos." : "Horas operacionais obtidas do calendário produtivo menos paradas válidas.")
    : failures.length === 0 ? "Não há falha corretiva concluída no período." : "Faltam horímetros ou calendário operacional válido para calcular horas entre falhas.";
  const availabilityReason = availabilityValue !== null
    ? (assetsWithoutCalendar ? "Cálculo parcial: somente ativos com calendário operacional válido." : "Calendário operacional e paradas válidas disponíveis.")
    : assets.length ? "Nenhum ativo filtrado possui calendário operacional vinculável e válido." : "Nenhum ativo válido no período e filtros informados.";
  const filtersOut = { ...filters };
  const metrics: Record<string, MaintenanceMetric> = {
    mttr: metric(mttrValue, "h", range, filtersOut, validMttr.map((item) => item.order), "Σ duração de reparos corretivos válidos ÷ quantidade de reparos", qualityState(mttrValue !== null, validMttr.length < correctiveClosed.length), mttrReason, correctiveClosed.length - validMttr.length, updatedAt, validMttr.length ? `${validMttr.length} reparo(s) válido(s).` : mttrReason),
    mtbf: metric(mtbfValue, "h", range, filtersOut, [...failures, ...meterRecords], "horas operacionais válidas ÷ falhas corretivas concluídas", qualityState(mtbfValue !== null, meterHours > 0 ? meteredAssets.size < assets.length : assetsWithoutCalendar > 0), mtbfReason, 0, updatedAt, mtbfValue !== null ? `${failures.length} falha(s) e ${mtbfHours.toFixed(1)} hora(s) operacionais.` : mtbfReason),
    availability: metric(availabilityValue, "%", range, filtersOut, validDowntimeItems, "(horas programadas − horas de parada dentro do calendário) ÷ horas programadas × 100", qualityState(availabilityValue !== null, assetsWithoutCalendar > 0 || invalidDowntimes > 0), availabilityReason, invalidDowntimes, updatedAt, availabilityValue !== null ? `${stoppedScheduledHours.toFixed(1)}h de parada em ${scheduledHours.toFixed(1)}h programadas.` : availabilityReason),
    openOrders: metric(openOrders.length, "", range, filtersOut, openOrders, "contagem de O.S. não concluídas e não canceladas no período", "valid", "Contagem direta de registros válidos.", 0, updatedAt, `${openOrders.length} O.S. pendente(s).`),
    runningOrders: metric(runningOrders.length, "", range, filtersOut, runningOrders, "contagem de O.S. em execução no período", "valid", "Contagem direta de registros válidos.", 0, updatedAt, `${runningOrders.length} O.S. em execução.`),
    lateOrders: metric(lateOrders.length, "", range, filtersOut, lateOrders, "contagem de O.S. abertas com prazo válido anterior ao instante de cálculo", urgentWithoutDeadline.length ? "partial" : "valid", urgentWithoutDeadline.length ? `${urgentWithoutDeadline.length} O.S. crítica/urgente sem prazo não pode ser classificada como atrasada.` : "Todos os prazos relevantes são classificáveis.", urgentWithoutDeadline.length, updatedAt, `${lateOrders.length} O.S. fora do prazo; ${urgentWithoutDeadline.length} crítica(s)/urgente(s) sem prazo.`),
    preventiveCompliance: metric(preventiveOrders.length ? preventiveOnTime.length / preventiveOrders.length * 100 : null, "%", range, filtersOut, preventiveOrders, "preventivas concluídas no prazo ÷ preventivas programadas × 100", preventiveOrders.length ? "valid" : "insufficient", preventiveOrders.length ? "Execuções preventivas programadas encontradas." : "Sem execuções preventivas programadas no período.", 0, updatedAt, preventiveOrders.length ? `${preventiveOnTime.length} de ${preventiveOrders.length} preventiva(s) no prazo.` : "Sem execuções preventivas programadas."),
    stops: metric(validDowntimeItems.length, "", range, filtersOut, validDowntimeItems, "contagem de ocorrências de parada válidas com sobreposição no período", invalidDowntimes ? "partial" : "valid", invalidDowntimes ? "Existem paradas com intervalo inválido ignoradas." : "Ocorrências com intervalos válidos.", invalidDowntimes, updatedAt, `${validDowntimeItems.length} ocorrência(s).`),
    stopHours: metric(validDowntimeItems.length ? downtimeHours : null, "h", range, filtersOut, validDowntimeItems, "união dos intervalos válidos de parada no período", validDowntimeItems.length ? (invalidDowntimes ? "partial" : "valid") : "insufficient", validDowntimeItems.length ? "Intervalos sobrepostos são consolidados." : "Sem paradas com duração válida.", invalidDowntimes, updatedAt, validDowntimeItems.length ? `${downtimeHours.toFixed(1)}h em ${validDowntimeItems.length} parada(s).` : "Sem paradas com duração válida."),
    criticalAssets: metric(criticalAssets.length, "", range, filtersOut, criticalAssets, "contagem de ativos válidos com criticidade alta ou crítica", "valid", "Contagem do cadastro de ativos filtrado.", 0, updatedAt, `${criticalAssets.length} ativo(s) crítico(s).`),
    overdueActions: metric(pendingActions.length, "", range, filtersOut, pendingActions, "contagem de ações não concluídas com prazo vencido", "valid", "Contagem direta de registros com prazo válido.", 0, updatedAt, `${pendingActions.length} ação(ões) vencida(s).`),
    lowStock: metric(lowStock.length, "", range, filtersOut, lowStock, "contagem de itens com mínimo maior que zero e saldo abaixo do mínimo", "valid", "Contagem do cadastro de peças.", 0, updatedAt, `${lowStock.length} item(ns) requerendo reposição.`),
  };
  return {
    metrics,
    quality: {
      state: (invalidDowntimes || missingAssetLinks || urgentWithoutDeadline.length || assetsWithoutCalendar) ? "partial" as const : "valid" as const,
      invalidRecords: invalidDowntimes + (correctiveClosed.length - validMttr.length),
      missingAssetLinks,
      urgentOrdersWithoutDeadline: urgentWithoutDeadline.length,
      assetsWithoutOperationalCalendar: assetsWithoutCalendar,
    },
  };
}

export function calculateMaintenanceMetrics(
  rawState: unknown,
  rawFilters: unknown = {},
  nowInput: string | number | Date = new Date(),
): MaintenanceMetricsContract {
  const state = record(rawState);
  const filters = normalizeFilters(rawFilters);
  const now = dateValue(nowInput) || new Date();
  const updatedAt = now.toISOString();
  const range = resolveRange(state, filters, now);
  const result = computeMetricSet(state, filters, range, now, updatedAt);
  const bucketCount = Math.max(0, Math.min(24, Math.trunc(finite(filters.seriesBuckets) ?? 0)));
  const series: MaintenanceMetricsContract["series"] = { mttr: [], mtbf: [], availability: [] };
  if (bucketCount > 0) {
    const total = range.end.getTime() - range.start.getTime() + 1;
    for (let index = 0; index < bucketCount; index += 1) {
      const start = new Date(range.start.getTime() + Math.floor(total * index / bucketCount));
      const end = new Date(range.start.getTime() + Math.floor(total * (index + 1) / bucketCount) - 1);
      const bucket = computeMetricSet(state, { ...filters, seriesBuckets: 0 }, { start, end }, now, updatedAt);
      const label = start.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", "").toUpperCase();
      for (const metricName of ["mttr", "mtbf", "availability"] as const) {
        series[metricName].push({
          start: start.toISOString(), end: end.toISOString(), label,
          value: bucket.metrics[metricName].value,
          quality: bucket.metrics[metricName].quality.state,
          recordCount: bucket.metrics[metricName].recordCount,
          recordIds: bucket.metrics[metricName].recordIds,
          source: bucket.metrics[metricName].source,
          detail: bucket.metrics[metricName].detail,
        });
      }
    }
  }
  const globalQuality = result.quality.state === "valid" && Object.values(result.metrics).some((item) => item.quality.state === "insufficient")
    ? { ...result.quality, state: "partial" as const }
    : result.quality;
  return {
    version: 1,
    period: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label },
    filters,
    metrics: result.metrics,
    series,
    quality: globalQuality,
    updatedAt,
    source: SOURCE,
  };
}
