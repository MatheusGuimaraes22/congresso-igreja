const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzufcfefcikcklbkuerf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable__7eNcEjFykry9wBXn8tpzA_evGhJd9_";
const EVENTS_TABLE = process.env.SUPABASE_EVENTS_TABLE || "eventos_config";
const https = require("node:https");

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(body);
}

function normalizeEvent(event = {}) {
  const name = String(event.name || "Evento").trim();
  const key = String(event.key || slugify(name)).trim();
  const address = String(event.address || "Igreja Reformada Comunidade da Cruz").trim();
  return {
    key,
    name,
    paid: event.paid === true || event.paid === "true",
    capacity: Number(event.capacity || 450),
    audience: String(event.audience || "Toda a igreja").trim(),
    description: String(event.description || "").trim(),
    address,
    mapsUrl: String(event.mapsUrl || event.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).trim(),
    date: String(event.date || event.event_date || "").trim(),
    startsAt: String(event.startsAt || event.starts_at || "A confirmar").trim(),
    endsAt: String(event.endsAt || event.ends_at || "A confirmar").trim()
  };
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

async function supabase(path, options = {}) {
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
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await supabase(`${EVENTS_TABLE}?select=*&active=eq.true&order=created_at.asc`, {
        method: "GET",
        headers: { Prefer: "" }
      });
      return json(res, 200, { ok: true, events: (rows || []).map(fromRow) });
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const event = normalizeEvent(req.body && (req.body.event || req.body));
      const rows = await supabase(`${EVENTS_TABLE}?on_conflict=key`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(toRow(event))
      });
      return json(res, 200, { ok: true, event: fromRow(rows[0]) });
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
      error: error.message || "Erro interno.",
      details: error.details || null
    });
  }
};
