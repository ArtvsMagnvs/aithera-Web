#!/usr/bin/env node
/* =============================================================
   AITHERA AUTOPILOT — Servidor
   -------------------------------------------------------------
   Node puro, sin dependencias obligatorias. Hace tres cosas:

   1. Sirve la web estática (index.html, consultoria.html, assets…)
   2. Expone POST /api/lead  → valida, guarda y notifica por email
   3. Expone /admin          → panel mínimo para ver las solicitudes

   Arranque:  node server/server.js      (o iniciar-servidor.cmd)
   Config:    server/config.json
   Email:     opcional. `npm install nodemailer` dentro de /server
              y pon email.enabled = true en config.json
   ============================================================= */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");
// [BW1 2026-08-19] Las cuentas viven en su propio módulo: los leads y el
// panel llevan meses funcionando y un fallo de auth no puede tumbarlos.
const auth = require("./auth");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const LEADS_JSON = path.join(DATA_DIR, "leads.json");
const LEADS_CSV = path.join(DATA_DIR, "leads.csv");

/* ---------------------------------------------------------- config */
const DEFAULTS = {
  port: 3000,
  host: "127.0.0.1",
  adminToken: "aithera",
  maxBodyBytes: 32 * 1024,
  rateLimit: { windowMs: 10 * 60 * 1000, max: 8 },
  email: {
    enabled: false,
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "Aithera Autopilot <no-reply@aitheraautopilot.com>",
    to: "hola@aitheraautopilot.com"
  }
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
    return Object.assign({}, DEFAULTS, raw, { email: Object.assign({}, DEFAULTS.email, raw.email || {}),
      rateLimit: Object.assign({}, DEFAULTS.rateLimit, raw.rateLimit || {}) });
  } catch (e) {
    return DEFAULTS;
  }
}
const CFG = loadConfig();
const PORT = Number(process.env.PORT) || CFG.port;

/* ---------------------------------------------------------- utils */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function log(...a) {
  console.log("[" + new Date().toISOString().slice(11, 19) + "]", ...a);
}

function send(res, code, body, headers) {
  const h = Object.assign({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }, headers || {});
  res.writeHead(code, h);
  res.end(body);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------------------------------------------- almacenamiento */
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LEADS_JSON)) fs.writeFileSync(LEADS_JSON, "[]", "utf8");
}
function readLeads() {
  ensureData();
  try { return JSON.parse(fs.readFileSync(LEADS_JSON, "utf8")); } catch (e) { return []; }
}
function saveLead(lead) {
  ensureData();
  const all = readLeads();
  all.unshift(lead);
  fs.writeFileSync(LEADS_JSON, JSON.stringify(all, null, 2), "utf8");

  /* Copia en CSV, cómodo para abrir en Excel */
  const cols = ["id", "recibido", "nombre", "email", "telefono", "cargo", "empresa",
    "sector", "empleados", "web", "areas", "presupuesto", "plazo", "mensaje", "ip"];
  if (!fs.existsSync(LEADS_CSV)) fs.writeFileSync(LEADS_CSV, "﻿" + cols.join(";") + "\n", "utf8");
  const row = cols.map(c => '"' + String(lead[c] == null ? "" : lead[c]).replace(/"/g, '""') + '"').join(";");
  fs.appendFileSync(LEADS_CSV, row + "\n", "utf8");
}

/* ------------------------------------------------------- validación */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const RE_TEL = /^[+()\d\s.\-]{7,20}$/;

function validate(d) {
  const e = {};
  const s = k => String(d[k] == null ? "" : d[k]).trim();

  if (s("nombre").length < 3) e.nombre = "Nombre demasiado corto.";
  if (!RE_EMAIL.test(s("email"))) e.email = "Email no válido.";
  if (!RE_TEL.test(s("telefono"))) e.telefono = "Teléfono no válido.";
  if (!s("empresa")) e.empresa = "Falta la empresa.";
  if (!s("sector")) e.sector = "Falta el sector.";
  if (!s("empleados")) e.empleados = "Falta el tamaño de la empresa.";
  if (!s("areas")) e.areas = "Selecciona al menos un área.";
  if (s("rgpd") !== "sí" && d.rgpd !== true) e.rgpd = "Falta el consentimiento.";
  if (s("mensaje").length > 4000) e.mensaje = "Mensaje demasiado largo.";
  return e;
}

/* --------------------------------------------------- rate limiting */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const w = CFG.rateLimit.windowMs;
  const arr = (hits.get(ip) || []).filter(t => now - t < w);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > CFG.rateLimit.max;
}

/* -------------------------------------------------------- email */
let transport = null;
function mailer() {
  if (!CFG.email.enabled) return null;
  if (transport) return transport;
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    log("⚠  email.enabled = true pero nodemailer no está instalado.");
    log("   Ejecuta:  cd server && npm install nodemailer");
    return null;
  }
  transport = nodemailer.createTransport({
    host: CFG.email.host,
    port: CFG.email.port,
    secure: !!CFG.email.secure,
    auth: CFG.email.user ? { user: CFG.email.user, pass: CFG.email.pass } : undefined
  });
  return transport;
}

function notify(lead) {
  const t = mailer();
  if (!t) return Promise.resolve(false);
  const rows = ["nombre", "email", "telefono", "cargo", "empresa", "sector", "empleados",
    "web", "areas", "presupuesto", "plazo", "mensaje"]
    .map(k => `<tr><td style="padding:6px 14px 6px 0;color:#7b8f8b;white-space:nowrap">${k}</td>
      <td style="padding:6px 0;color:#0d1a18">${esc(lead[k]) || "—"}</td></tr>`).join("");
  return t.sendMail({
    from: CFG.email.from,
    to: CFG.email.to,
    replyTo: lead.email,
    subject: `Nueva consultoría · ${lead.empresa} (${lead.nombre})`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:14px">
      <h2 style="margin:0 0 4px">Nueva solicitud de consultoría</h2>
      <p style="margin:0 0 18px;color:#7b8f8b">${esc(lead.recibido)} · id ${esc(lead.id)}</p>
      <table style="border-collapse:collapse">${rows}</table></div>`
  }).then(() => true).catch(err => { log("✖ email:", err.message); return false; });
}

/* ------------------------------------------------------ estáticos */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.join(ROOT, rel);

  /* Evita salir de la carpeta del proyecto */
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, "Prohibido");

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      return send(res, 404, "<h1>404</h1><p>No encontrado. <a href=\"/\">Volver al inicio</a></p>",
        { "Content-Type": "text/html; charset=utf-8" });
    }
    const ext = path.extname(file).toLowerCase();
    const etag = '"' + st.size + "-" + Number(st.mtimeMs).toString(36) + '"';
    if (req.headers["if-none-match"] === etag) return send(res, 304, "");
    const cache = /\.(woff2|svg|png|jpg|webp|ico)$/.test(ext)
      ? "public, max-age=604800" : "no-cache";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": cache,
      ETag: etag,
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------------------------------------------- panel /admin */
function adminPage(res, token) {
  if (token !== CFG.adminToken) {
    return send(res, 401, `<!doctype html><meta charset="utf-8">
      <title>Acceso</title>
      <body style="font-family:system-ui;background:#050d0f;color:#cfe2de;display:grid;place-items:center;height:100vh;margin:0">
      <form style="text-align:center">
        <h1 style="font-weight:300;letter-spacing:.1em">PANEL DE SOLICITUDES</h1>
        <p style="color:#64807b">Introduce el token de administración.</p>
        <input name="token" type="password" placeholder="token"
          style="padding:11px 14px;border-radius:8px;border:1px solid #1e3a38;background:#08171a;color:#eafaf6">
        <button style="padding:12px 18px;border:0;border-radius:8px;background:#3ff09a;color:#04120c;font-weight:600;cursor:pointer">Entrar</button>
      </form></body>`, { "Content-Type": "text/html; charset=utf-8" });
  }
  const leads = readLeads();
  const rows = leads.map(l => `<tr>
    <td>${esc(l.recibido).replace("T", " ").slice(0, 16)}</td>
    <td><b>${esc(l.nombre)}</b><br><span class="m">${esc(l.cargo) || "—"}</span></td>
    <td>${esc(l.empresa)}<br><span class="m">${esc(l.sector)} · ${esc(l.empleados)}</span></td>
    <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a><br><span class="m">${esc(l.telefono)}</span></td>
    <td>${esc(l.areas)}</td>
    <td>${esc(l.presupuesto) || "—"}<br><span class="m">${esc(l.plazo) || "—"}</span></td>
    <td class="msg">${esc(l.mensaje) || "—"}</td></tr>`).join("");

  send(res, 200, `<!doctype html><html lang="es"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Solicitudes · Aithera</title>
    <style>
      body{font-family:system-ui,sans-serif;background:#040c0d;color:#cfe2de;margin:0;padding:28px}
      h1{font-weight:300;letter-spacing:.14em;text-transform:uppercase;font-size:18px;margin:0 0 4px}
      p.sub{color:#64807b;font-size:13px;margin:0 0 22px}
      a{color:#3ff09a}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{text-align:left;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64807b;
         padding:0 12px 10px 0;border-bottom:1px solid #17302e}
      td{padding:13px 12px 13px 0;border-bottom:1px solid #10231f;vertical-align:top}
      .m{color:#5f7773;font-size:11.5px}
      .msg{max-width:280px;color:#8fa9a4}
      .empty{color:#64807b;padding:40px 0}
    </style>
    <h1>Solicitudes de consultoría</h1>
    <p class="sub">${leads.length} registro(s) · <a href="/api/leads.csv?token=${encodeURIComponent(token)}">descargar CSV</a></p>
    ${leads.length ? `<table><thead><tr>
      <th>Fecha</th><th>Contacto</th><th>Empresa</th><th>Datos</th><th>Áreas</th><th>Presupuesto</th><th>Mensaje</th>
    </tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Todavía no hay solicitudes.</p>'}
    </html>`, { "Content-Type": "text/html; charset=utf-8" });
}

/* ------------------------------------------------------- servidor */
const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  /* --- Cuentas (BW1): /api/auth/*, /api/account/*, /auth/desktop --- */
  if (auth.handle(req, res, u, ip, CFG.maxBodyBytes)) return;

  /* --- API: alta de solicitud --- */
  if (req.method === "POST" && u.pathname === "/api/lead") {
    if (rateLimited(ip)) return json(res, 429, { ok: false, error: "Demasiadas solicitudes. Prueba en unos minutos." });

    let body = "", tooBig = false;
    req.on("data", c => {
      body += c;
      if (body.length > CFG.maxBodyBytes) { tooBig = true; req.destroy(); }
    });
    req.on("end", () => {
      if (tooBig) return json(res, 413, { ok: false, error: "Solicitud demasiado grande." });
      let d;
      try { d = JSON.parse(body || "{}"); } catch (e) { return json(res, 400, { ok: false, error: "JSON no válido." }); }

      /* Trampa antispam: si el campo oculto viene relleno, es un bot */
      if (d.website) { log("bot descartado desde", ip); return json(res, 200, { ok: true, id: "ignored" }); }

      const errors = validate(d);
      if (Object.keys(errors).length) return json(res, 422, { ok: false, error: "Revisa los datos.", errors });

      const lead = {
        id: crypto.randomBytes(5).toString("hex"),
        recibido: new Date().toISOString(),
        nombre: String(d.nombre).trim(),
        email: String(d.email).trim(),
        telefono: String(d.telefono).trim(),
        cargo: String(d.cargo || "").trim(),
        empresa: String(d.empresa).trim(),
        sector: String(d.sector).trim(),
        empleados: String(d.empleados).trim(),
        web: String(d.web || "").trim(),
        areas: String(d.areas).trim(),
        presupuesto: String(d.presupuesto || "").trim(),
        plazo: String(d.plazo || "").trim(),
        mensaje: String(d.mensaje || "").trim(),
        origen: String(d.origen || "").trim(),
        ip
      };

      try { saveLead(lead); } catch (e) {
        log("✖ no se ha podido guardar:", e.message);
        return json(res, 500, { ok: false, error: "No se ha podido guardar la solicitud." });
      }
      log("✔ nueva solicitud:", lead.empresa, "·", lead.email);

      notify(lead).then(sent => json(res, 200, { ok: true, id: lead.id, email: sent }));
    });
    return;
  }

  /* --- API: listado (protegido) --- */
  if (req.method === "GET" && u.pathname === "/api/leads") {
    if (u.query.token !== CFG.adminToken) return json(res, 401, { ok: false, error: "No autorizado." });
    return json(res, 200, { ok: true, leads: readLeads() });
  }
  if (req.method === "GET" && u.pathname === "/api/leads.csv") {
    if (u.query.token !== CFG.adminToken) return json(res, 401, { ok: false, error: "No autorizado." });
    ensureData();
    const csv = fs.existsSync(LEADS_CSV) ? fs.readFileSync(LEADS_CSV) : "﻿";
    return send(res, 200, csv, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aithera-leads.csv"'
    });
  }

  /* --- Panel --- */
  if (req.method === "GET" && (u.pathname === "/admin" || u.pathname === "/admin/")) {
    return adminPage(res, u.query.token || "");
  }

  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { ok: false, error: "Método no permitido." });

  serveStatic(req, res, u.pathname);
});

server.listen(PORT, CFG.host, () => {
  ensureData();
  console.log("");
  console.log("  ◆  AITHERA AUTOPILOT");
  console.log("  ─────────────────────────────────────────────");
  console.log("  Web        →  http://localhost:" + PORT + "/");
  console.log("  Consultoría→  http://localhost:" + PORT + "/consultoria.html");
  console.log("  Panel      →  http://localhost:" + PORT + "/admin?token=" + CFG.adminToken);
  console.log("  Email      →  " + (CFG.email.enabled ? CFG.email.host + " → " + CFG.email.to : "desactivado (config.json)"));
  console.log("  Datos      →  server/data/leads.json  ·  leads.csv");
  console.log("  ─────────────────────────────────────────────");
  console.log("  Ctrl+C para parar");
  console.log("");
});

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error("\n  ✖ El puerto " + PORT + " ya está ocupado.");
    console.error("    Cambia \"port\" en server/config.json o cierra el otro proceso.\n");
  } else {
    console.error(err);
  }
  process.exit(1);
});
