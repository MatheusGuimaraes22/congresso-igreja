const https = require("node:https");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzufcfefcikcklbkuerf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable__7eNcEjFykry9wBXn8tpzA_evGhJd9_";
const ADMIN_CONFIG_TABLE = process.env.SUPABASE_ADMIN_TABLE || "admin_config";
const ADMIN_USERS_TABLE = process.env.SUPABASE_ADMIN_USERS_TABLE || "admin_users";

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(body);
}

async function supabase(path, options = {}) {
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

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const configRows = await supabase(`${ADMIN_CONFIG_TABLE}?select=admin_user,password_hash&id=eq.main`, {
        method: "GET",
        headers: { Prefer: "" }
      }).catch(() => []);
      const userRows = await supabase(`${ADMIN_USERS_TABLE}?select=admin_user,password_hash&active=eq.true`, {
        method: "GET",
        headers: { Prefer: "" }
      }).catch(() => []);

      return json(res, 200, {
        ok: true,
        config: configRows && configRows[0] ? {
          adminUser: configRows[0].admin_user,
          adminPasswordHash: configRows[0].password_hash
        } : null,
        users: (userRows || []).map((item) => ({
          adminUser: item.admin_user,
          passwordHash: item.password_hash
        }))
      });
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const body = req.body || {};
      const adminUser = String(body.adminUser || "").trim();
      const passwordHash = String(body.passwordHash || "").trim();
      if (!adminUser || !passwordHash) {
        return json(res, 400, { ok: false, error: "Usuário e senha/hash são obrigatórios." });
      }

      const target = body.target === "config" ? "config" : "user";
      if (target === "config") {
        await supabase(`${ADMIN_CONFIG_TABLE}?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify({
            id: "main",
            admin_user: adminUser,
            password_hash: passwordHash,
            updated_at: new Date().toISOString()
          })
        });
      } else {
        await supabase(`${ADMIN_USERS_TABLE}?on_conflict=admin_user`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify({
            admin_user: adminUser,
            password_hash: passwordHash,
            active: true,
            updated_at: new Date().toISOString()
          })
        });
      }

      return json(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET,POST,PUT,PATCH");
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  } catch (error) {
    return json(res, error.status || 500, {
      ok: false,
      error: error.message || "Erro interno.",
      details: error.details || null
    });
  }
};
