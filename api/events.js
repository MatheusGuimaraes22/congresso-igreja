const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzufcfefcikcklbkuerf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable__7eNcEjFykry9wBXn8tpzA_evGhJd9_";
const EVENTS_TABLE = process.env.SUPABASE_EVENTS_TABLE || "eventos_config";
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyC2OoAlETA2zvbvWqpC3P-qDEkc1HLDoHSax_v2xESbAXwyYB3W7oc1rJcT1OMNOkO/exec";
const https = require("node:https");
const LEGACY_DEFAULT_EVENT_KEYS = new Set([
  "clube-biblia",
  "congresso-mulheres",
  "musical",
  "missio-dei",
  "encontro-casais"
]);

function json(res, status, body, cacheControl = "no-store, max-age=0") {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.status(status).json(body);
}

function normalizeEvent(event = {}) {
  const name = String(event.name || "Evento").trim();
  const key = String(event.key || slugify(name)).trim();
  const address = String(event.address || "Igreja Reformada Comunidade da Cruz").trim();
  const imageUrls = normalizeImageUrls(event);
  const durationDays = Math.min(7, Math.max(1, Number(event.durationDays || event.duration_days || 1)));
  const eventDates = normalizeEventDates(event, durationDays);
  const eventSchedule = normalizeEventSchedule(event, durationDays, eventDates);
  return {
    key,
    name,
    paid: event.paid === true || event.paid === "true",
    capacity: Number(event.capacity || 450),
    audience: String(event.audience || "Toda a igreja").trim(),
    description: String(event.description || "").trim(),
    address,
    mapsUrl: String(event.mapsUrl || event.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).trim(),
    imageUrl: imageUrls[0] || "",
    imageUrls,
    date: eventDates[0] || String(event.date || event.event_date || "").trim(),
    eventDates,
    eventSchedule,
    durationDays,
    startsAt: eventSchedule[0]?.startsAt || String(event.startsAt || event.starts_at || "A confirmar").trim(),
    endsAt: eventSchedule[eventSchedule.length - 1]?.endsAt || String(event.endsAt || event.ends_at || "A confirmar").trim()
  };
}

function normalizeEventDates(event = {}, durationDays = 1) {
  const rawValues = [];
  const rawList = event.eventDates || event.event_dates;
  if (Array.isArray(rawList)) {
    rawValues.push(...rawList);
  } else if (typeof rawList === "string" && rawList.trim()) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) rawValues.push(...parsed);
      else rawValues.push(rawList);
    } catch (_) {
      rawValues.push(...rawList.split(/\n|,/));
    }
  }
  const cleanDates = rawValues
    .map((value) => String(value || "").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .slice(0, durationDays);

  if (cleanDates.length) return cleanDates;

  const firstDate = String(event.date || event.event_date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return [];
  return Array.from({ length: durationDays }, (_, index) => {
    const date = new Date(`${firstDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function normalizeEventSchedule(event = {}, durationDays = 1, eventDates = []) {
  const rawList = event.eventSchedule || event.event_schedule;
  const fallbackStartsAt = String(event.startsAt || event.starts_at || "A confirmar").trim();
  const fallbackEndsAt = String(event.endsAt || event.ends_at || "A confirmar").trim();
  let entries = [];
  if (Array.isArray(rawList)) {
    entries = rawList;
  } else if (typeof rawList === "string" && rawList.trim()) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) entries = parsed;
    } catch (_) {
      entries = [];
    }
  }
  return Array.from({ length: durationDays }, (_, index) => {
    const entry = entries[index] || {};
    return {
      date: String(entry.date || eventDates[index] || "").trim(),
      startsAt: String(entry.startsAt || entry.starts_at || fallbackStartsAt).trim(),
      endsAt: String(entry.endsAt || entry.ends_at || fallbackEndsAt).trim()
    };
  });
}

function normalizeImageUrls(event = {}) {
  const sources = [];
  const rawList = event.imageUrls || event.image_urls;
  if (Array.isArray(rawList)) {
    sources.push(...rawList);
  } else if (typeof rawList === "string" && rawList.trim()) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) sources.push(...parsed);
      else sources.push(rawList);
    } catch (_) {
      sources.push(...rawList.split(/\n|,/));
    }
  }
  if (event.imageUrl || event.image_url) {
    sources.push(event.imageUrl || event.image_url);
  }
  const seen = new Set();
  return sources
    .map((src) => String(src || "").trim())
    .filter(Boolean)
    .filter((src) => {
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    })
    .slice(0, 5);
}

function slugify(value) {
  return String(value || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `evento-${Date.now().toString(36)}`;
}

function toRow(event) {
  const normalized = normalizeEvent(event);
  return {
    key: normalized.key,
    name: normalized.name,
    paid: normalized.paid,
    capacity: normalized.capacity,
    audience: normalized.audience,
    description: normalized.description,
    address: normalized.address,
    maps_url: normalized.mapsUrl,
    event_date: normalized.date || null,
    starts_at: normalized.startsAt,
    ends_at: normalized.endsAt,
    active: true,
    data: normalized
  };
}

function fromRow(row) {
  return normalizeEvent({
    ...(row.data || {}),
    key: row.key,
    name: row.name,
    paid: row.paid,
    capacity: row.capacity,
    audience: row.audience,
    description: row.description,
    address: row.address,
    mapsUrl: row.maps_url,
    date: row.event_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at
  });
}

async function notifyEventChange(eventConfig, action) {
  if (!GOOGLE_APPS_SCRIPT_URL || !eventConfig) {
    return { ok: false, skipped: true };
  }
  try {
    const response = await requestJson(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        event: action === "updated" ? "event.updated" : "event.created",
        action: action === "updated" ? "updated" : "created",
        eventConfig
      })
    });
    let body = null;
    try {
      body = response.text ? JSON.parse(response.text) : null;
    } catch (_) {
      body = response.text || null;
    }
    return {
      ok: response.status >= 200 && response.status < 400 && (!body || body.ok !== false),
      status: response.status,
      body
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function supabase(path, options = {}) {
  try {
    const response = await requestJson(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options.headers || {})
      },
      body: options.body
    });

    const text = response.text;
    const data = text ? JSON.parse(text) : null;
    if (response.status < 200 || response.status >= 300) {
      const message = data && (data.message || data.error) ? data.message || data.error : `Supabase ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  } catch (error) {
    const message = error && error.message ? error.message : "Nao foi possivel acessar o Supabase.";
    const wrapped = new Error(`Falha no Supabase: ${message}`);
    wrapped.status = error.status || 502;
    wrapped.details = error.details || { supabaseUrl: SUPABASE_URL, table: EVENTS_TABLE };
    throw wrapped;
  }
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers: options.headers || {}
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, text });
      });
    });

    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy(new Error("Tempo esgotado ao chamar Supabase."));
    });
    if (options.body) req.write(options.body);
    req.end();
  }).catch(async (error) => {
    if (error && error.code === "ENOTFOUND") {
      if (new URL(url).hostname === "cloudflare-dns.com") throw error;
      return requestJsonWithResolvedHost(url, options);
    }
    throw error;
  });
}

async function requestJsonWithResolvedHost(url, options = {}) {
  const parsed = new URL(url);
  const address = await resolveARecord(parsed.hostname);
  return new Promise((resolve, reject) => {
    const headers = {
      ...(options.headers || {}),
      Host: parsed.hostname
    };
    const req = https.request({
      hostname: address,
      servername: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, text });
      });
    });

    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy(new Error("Tempo esgotado ao chamar Supabase."));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function resolveARecord(hostname) {
  const result = await requestJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
    method: "GET",
    headers: { Accept: "application/dns-json" }
  });
  const data = result.text ? JSON.parse(result.text) : null;
  const answer = data && Array.isArray(data.Answer)
    ? data.Answer.find((item) => item.type === 1 && item.data)
    : null;
  if (!answer) throw new Error(`DNS não resolveu ${hostname}.`);
  return answer.data;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await supabase(`${EVENTS_TABLE}?select=*&active=eq.true&order=created_at.asc`, {
        method: "GET",
        headers: { Prefer: "" }
      });
      const events = (rows || [])
        .map(fromRow)
        .filter((event) => !LEGACY_DEFAULT_EVENT_KEYS.has(event.key));
      return json(res, 200, { ok: true, events }, "public, s-maxage=30, stale-while-revalidate=300");
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const event = normalizeEvent(req.body && (req.body.event || req.body));
      const action = req.body && req.body.action === "updated" ? "updated" : "created";
      const rows = await supabase(`${EVENTS_TABLE}?on_conflict=key`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(toRow(event))
      });
      const savedEvent = fromRow(rows[0]);
      const notification = req.body && req.body.notify
        ? await notifyEventChange(savedEvent, action)
        : { ok: false, skipped: true };
      return json(res, 200, { ok: true, event: savedEvent, notification });
    }

    if (req.method === "DELETE") {
      const key = String((req.query && req.query.key) || (req.body && req.body.key) || "").trim();
      if (!key) return json(res, 400, { ok: false, error: "Informe a chave do evento." });
      await supabase(`${EVENTS_TABLE}?key=eq.${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false })
      });
      return json(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET,POST,PUT,PATCH,DELETE");
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  } catch (error) {
    return json(res, error.status || 500, {
      ok: false,
      error: error.message || "Nao foi possivel acessar o backend.",
      details: error.details || null
    });
  }
};
