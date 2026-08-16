const https = require("node:https");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzufcfefcikcklbkuerf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable__7eNcEjFykry9wBXn8tpzA_evGhJd9_";
const REGISTRATIONS_TABLE = process.env.SUPABASE_REGISTRATIONS_TABLE || "congresso_inscricoes";
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyC2OoAlETA2zvbvWqpC3P-qDEkc1HLDoHSax_v2xESbAXwyYB3W7oc1rJcT1OMNOkO/exec";

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(body);
}

function recordToRow(record = {}) {
  const storedRecord = {
    ...record,
    paymentProof: record.paymentProof ? { ...record.paymentProof, data: "" } : record.paymentProof
  };
  return {
    id: record.id,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: record.fullName || "",
    email: record.email || "",
    cpf: record.cpf || "",
    church: record.church || "",
    payment_method: record.paymentMethod || "",
    payment_status: record.paymentStatus || "Pendente",
    payment_reference: record.paymentReference || "",
    data: storedRecord
  };
}

function rowToRecord(row = {}) {
  return row.data || {
    id: row.id,
    createdAt: row.created_at,
    fullName: row.full_name,
    email: row.email,
    cpf: row.cpf,
    church: row.church,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference
  };
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function getRecordEventKey(record = {}) {
  return record.eventKey || "congresso-mulheres";
}

function isSameCpfAndEvent(left = {}, right = {}) {
  return onlyDigits(left.cpf) &&
    onlyDigits(left.cpf) === onlyDigits(right.cpf) &&
    getRecordEventKey(left) === getRecordEventKey(right) &&
    left.id !== right.id;
}

async function findDuplicateRegistration(record) {
  const rows = await supabase(`${REGISTRATIONS_TABLE}?select=id,cpf,data`, {
    method: "GET",
    headers: { Prefer: "" }
  });
  return (rows || [])
    .map(rowToRecord)
    .find((existing) => isSameCpfAndEvent(existing, record));
}

async function supabase(path, options = {}) {
  try {
    const response = await requestText(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
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
    const data = response.text ? JSON.parse(response.text) : null;
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
    wrapped.details = error.details || { supabaseUrl: SUPABASE_URL, table: REGISTRATIONS_TABLE };
    throw wrapped;
  }
}

function requestText(url, options = {}) {
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
      res.on("end", () => resolve({ status: res.statusCode || 0, text }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Tempo esgotado.")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function notifyRegistration(record) {
  if (!GOOGLE_APPS_SCRIPT_URL || !record || !record.email) {
    return { ok: false, skipped: true };
  }
  try {
    const response = await requestText(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        event: "calendar.invite_requested",
        registration: {
          id: record.id,
          fullName: record.fullName,
          email: record.email,
          phone: record.phone,
          eventName: record.eventName,
          eventDescription: record.eventDescription,
          eventDate: record.eventDate,
          eventDurationDays: record.eventDurationDays,
          eventDays: record.eventDays,
          eventDaysLabels: record.eventDaysLabels,
          eventDaysText: Array.isArray(record.eventDaysLabels) && record.eventDaysLabels.length
            ? record.eventDaysLabels.join(", ")
            : Array.isArray(record.eventDays) && record.eventDays.length
              ? record.eventDays.join(", ")
              : "",
          eventStartsAt: record.eventStartsAt,
          eventEndsAt: record.eventEndsAt,
          eventAddress: record.eventAddress,
          eventMapsUrl: record.eventMapsUrl,
          eventAudience: record.eventAudience,
          validationLink: record.validationLink,
          paymentStatus: record.paymentStatus,
          paymentReference: record.paymentReference
        }
      })
    });
    return { ok: response.status >= 200 && response.status < 400, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await supabase(`${REGISTRATIONS_TABLE}?select=*&order=created_at.desc`, {
        method: "GET",
        headers: { Prefer: "" }
      });
      return json(res, 200, { ok: true, records: (rows || []).map(rowToRecord) });
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const records = Array.isArray(req.body && req.body.records)
        ? req.body.records
        : [req.body && (req.body.record || req.body)].filter(Boolean);
      if (!records.length) return json(res, 400, { ok: false, error: "Nenhuma inscrição enviada." });

      for (const record of records) {
        const duplicate = await findDuplicateRegistration(record);
        if (duplicate) {
          return json(res, 409, {
            ok: false,
            error: "Este CPF ja possui inscricao para este evento.",
            duplicateId: duplicate.id
          });
        }
      }

      const rows = await supabase(`${REGISTRATIONS_TABLE}?on_conflict=id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(records.map(recordToRow))
      });

      let notifications = [];
      if (req.body && req.body.notify) {
        notifications = await Promise.all(records.map(notifyRegistration));
      }

      return json(res, 200, {
        ok: true,
        records: (rows || []).map(rowToRecord),
        notifications
      });
    }

    if (req.method === "DELETE") {
      const id = String((req.query && req.query.id) || "").trim();
      const eventKey = String((req.query && req.query.eventKey) || "").trim();
      if (id) {
        await supabase(`${REGISTRATIONS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return json(res, 200, { ok: true });
      }
      if (eventKey) {
        const rows = await supabase(`${REGISTRATIONS_TABLE}?select=id,data`, {
          method: "GET",
          headers: { Prefer: "" }
        });
        const matching = (rows || []).filter((row) => {
          const data = row.data || {};
          return (data.eventKey || "congresso-mulheres") === eventKey;
        });
        await Promise.all(matching.map((row) => supabase(`${REGISTRATIONS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, { method: "DELETE" })));
        return json(res, 200, { ok: true, deleted: matching.length });
      }
      return json(res, 400, { ok: false, error: "Informe id ou eventKey." });
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
