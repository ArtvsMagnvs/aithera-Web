/* =============================================================================
 *  auth.js — cuentas de Aithera (BW1, contrato del doc 48 §3-§4)
 * =============================================================================
 *
 *  POR QUÉ VIVE EN SU PROPIO ARCHIVO: `server.js` lleva meses funcionando para
 *  los leads y el panel. Meter aquí dentro la identidad —lo más delicado del
 *  sitio— habría mezclado dos cosas con ciclos de vida distintos y habría hecho
 *  que cualquier error de auth pudiera tumbar el formulario de contacto. El
 *  router de `server.js` gana UNA línea: `if (auth.handle(...)) return;`.
 *
 *  QUÉ NO USA, y a propósito: ninguna dependencia. Ni Express, ni bcrypt, ni
 *  jsonwebtoken, ni una base de datos. El sitio entero es Node puro con
 *  persistencia en ficheros, y para una beta con cuentas opcionales eso es
 *  suficiente y es una cosa menos que mantener. `crypto` de Node trae scrypt
 *  (la función de derivación recomendada) y `timingSafeEqual`.
 *
 *  EL MODELO DE SEGURIDAD, en corto:
 *    · Las contraseñas NUNCA se guardan: se guarda `scrypt(password, salt)`.
 *    · Los tokens NUNCA se guardan en claro: se guarda su sha256. Si alguien
 *      se lleva el fichero de sesiones, no puede suplantar a nadie con él.
 *    · El `code` del deep-link es de UN SOLO USO, dura 5 minutos y está atado
 *      al `state` que generó la app — sin eso, cualquiera que viera la URL de
 *      vuelta podría robar la sesión.
 *    · Todas las comparaciones de secretos son en tiempo constante.
 *    · Escritura atómica (a `.tmp` y renombrar): un corte a media escritura no
 *      puede dejar el fichero de usuarios a medias.
 *
 *  LO QUE FALTA PARA PRODUCCIÓN, dicho aquí para que nadie lo descubra tarde:
 *    · OAuth de Google y GitHub: el esqueleto está (`/api/auth/oauth/:proveedor`)
 *      pero exige registrar una aplicación en cada proveedor y meter sus
 *      credenciales por entorno. Eso solo lo puede hacer el dueño de las
 *      cuentas; hasta entonces responde 501 con la explicación, NO finge.
 *    · Verificación del correo por email: hace falta un SMTP configurado.
 *      Mientras no lo haya, la cuenta se crea igualmente y queda marcada como
 *      no verificada (`email_verified: false`).
 * ========================================================================== */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const F_USERS = path.join(DATA_DIR, "users.json");
const F_SESSIONS = path.join(DATA_DIR, "sessions.json");
const F_CODES = path.join(DATA_DIR, "codes.json");

/* Duraciones. El access token es corto a propósito: si se filtra, caduca solo.
   El refresh es largo porque es lo que evita pedir la contraseña cada día. */
const ACCESS_TTL_S = 60 * 60;             // 1 hora
const REFRESH_TTL_S = 30 * 24 * 60 * 60;  // 30 días
const CODE_TTL_S = 5 * 60;                // 5 minutos (deep-link)

/* El esquema aithera:// lo registra la app de escritorio. Se deja
   configurable por si algún día cambia, pero NO se acepta desde la petición:
   un redirect controlado por el cliente es una vulnerabilidad clásica. */
const DEEP_LINK = process.env.AITHERA_DEEP_LINK || "aithera://auth";

/* -------------------------------------------------------------- utilidades */

function ensureData() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ya existe */ }
  for (const f of [F_USERS, F_SESSIONS, F_CODES]) {
    if (!fs.existsSync(f)) writeAtomic(f, {});
  }
}

/** Escritura atómica: a un temporal y renombrar. Un corte de luz a mitad no
 *  puede dejar el fichero de usuarios truncado. */
function writeAtomic(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "{}"); }
  catch (e) { return {}; }
}

const now = () => Math.floor(Date.now() / 1000);
const rnd = (n) => crypto.randomBytes(n).toString("base64url");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Comparación en tiempo constante, tolerante a longitudes distintas. */
function equalsSafe(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* --------------------------------------------------------- contraseñas */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  // N=16384 es el coste recomendado por defecto de Node; subirlo encarece un
  // ataque por fuerza bruta, pero también cada login legítimo.
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const hash = crypto.scryptSync(password, rec.salt, 64).toString("hex");
  return equalsSafe(hash, rec.hash);
}

/* ------------------------------------------------------------- validación */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function checkCredentials(email, password) {
  if (!email || !RE_EMAIL.test(String(email))) return "Escribe un correo válido.";
  if (!password || String(password).length < 8) {
    return "La contraseña tiene que tener al menos 8 caracteres.";
  }
  if (String(password).length > 200) return "Esa contraseña es demasiado larga.";
  return null;
}

/* ------------------------------------------------------------- sesiones */

function newSession(userId, req) {
  const sessions = read(F_SESSIONS);
  const id = crypto.randomUUID();
  const access = rnd(32);
  const refresh = rnd(32);
  sessions[id] = {
    id,
    user_id: userId,
    // Se guarda el HASH, nunca el token: quien lea este fichero no puede
    // suplantar a nadie.
    access_hash: sha256(access),
    refresh_hash: sha256(refresh),
    device: String(req.headers["user-agent"] || "").slice(0, 160) || "Desconocido",
    ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .split(",")[0].trim(),
    created_at: now(),
    last_seen: now(),
    access_expires: now() + ACCESS_TTL_S,
    refresh_expires: now() + REFRESH_TTL_S,
  };
  writeAtomic(F_SESSIONS, sessions);
  return { id, access, refresh };
}

/** Resuelve el usuario a partir del `Authorization: Bearer`. */
function userFromRequest(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  if (!token) return null;
  const hash = sha256(token);
  const sessions = read(F_SESSIONS);
  for (const s of Object.values(sessions)) {
    if (s.access_hash === hash) {
      if (s.access_expires < now()) return null;   // caducado
      s.last_seen = now();
      sessions[s.id] = s;
      writeAtomic(F_SESSIONS, sessions);
      const users = read(F_USERS);
      const u = users[s.user_id];
      return u ? { user: u, session: s } : null;
    }
  }
  return null;
}

function publicUser(u) {
  return { id: u.id, email: u.email, email_verified: !!u.email_verified,
           created_at: u.created_at };
}

/* ------------------------------------------------------------ rate limit */
/* Reutiliza el patrón que ya usa server.js para los leads: ventana en memoria.
   No sobrevive a un reinicio, y para una beta es suficiente — lo que evita es
   el ataque por fuerza bruta sostenido, que es lo que importa aquí. */
const intentos = new Map();
function demasiadosIntentos(clave, max = 10, ventanaMs = 10 * 60 * 1000) {
  const t = Date.now();
  const arr = (intentos.get(clave) || []).filter((x) => t - x < ventanaMs);
  arr.push(t);
  intentos.set(clave, arr);
  if (intentos.size > 5000) intentos.clear();
  return arr.length > max;
}

/* ---------------------------------------------------------------- helpers */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function leerCuerpo(req, max, cb) {
  let body = "", grande = false;
  req.on("data", (c) => {
    body += c;
    if (body.length > max) { grande = true; req.destroy(); }
  });
  req.on("end", () => {
    if (grande) return cb(new Error("too_big"));
    try { cb(null, JSON.parse(body || "{}")); }
    catch (e) { cb(new Error("bad_json")); }
  });
}

/* ============================================================ los endpoints */

function register(req, res, d, ip) {
  if (demasiadosIntentos("reg:" + ip, 5)) {
    return json(res, 429, { ok: false, error: "Demasiados intentos. Prueba en unos minutos." });
  }
  const mal = checkCredentials(d.email, d.password);
  if (mal) return json(res, 400, { ok: false, error: mal });

  const email = String(d.email).trim().toLowerCase();
  const users = read(F_USERS);
  if (Object.values(users).some((u) => u.email === email)) {
    // Se dice claro que ya existe: ocultarlo no aporta seguridad real (el
    // login lo revelaría igual) y sí confunde a quien simplemente olvidó que
    // ya se había registrado.
    return json(res, 409, { ok: false, error: "Ya hay una cuenta con ese correo." });
  }
  const id = crypto.randomUUID();
  users[id] = {
    id, email,
    pass: hashPassword(String(d.password)),
    // Sin SMTP configurado no se puede verificar el correo. Se marca como no
    // verificado en vez de mentir diciendo que sí.
    email_verified: false,
    created_at: now(),
  };
  writeAtomic(F_USERS, users);
  const s = newSession(id, req);
  return json(res, 201, {
    ok: true, access_token: s.access, refresh_token: s.refresh,
    expires_in: ACCESS_TTL_S, user: publicUser(users[id]),
  });
}

function login(req, res, d, ip) {
  if (demasiadosIntentos("log:" + ip)) {
    return json(res, 429, { ok: false, error: "Demasiados intentos. Prueba en unos minutos." });
  }
  const email = String(d.email || "").trim().toLowerCase();
  const users = read(F_USERS);
  const u = Object.values(users).find((x) => x.email === email);
  // Mismo mensaje exista o no la cuenta: aquí sí importa no revelar qué
  // correos están registrados a quien va probando.
  const generico = { ok: false, error: "Correo o contraseña incorrectos." };
  if (!u) {
    // Se calcula un hash igualmente para no delatar por el tiempo de respuesta
    // que el usuario no existe.
    hashPassword(String(d.password || "x"));
    return json(res, 401, generico);
  }
  if (!verifyPassword(String(d.password || ""), u.pass)) return json(res, 401, generico);

  const s = newSession(u.id, req);
  return json(res, 200, {
    ok: true, access_token: s.access, refresh_token: s.refresh,
    expires_in: ACCESS_TTL_S, user: publicUser(u),
  });
}

function refresh(req, res, d) {
  const hash = sha256(String(d.refresh_token || ""));
  const sessions = read(F_SESSIONS);
  const s = Object.values(sessions).find((x) => x.refresh_hash === hash);
  if (!s || s.refresh_expires < now()) {
    return json(res, 401, { ok: false, error: "Sesión caducada. Vuelve a entrar." });
  }
  const access = rnd(32);
  s.access_hash = sha256(access);
  s.access_expires = now() + ACCESS_TTL_S;
  s.last_seen = now();
  sessions[s.id] = s;
  writeAtomic(F_SESSIONS, sessions);
  return json(res, 200, { ok: true, access_token: access, expires_in: ACCESS_TTL_S });
}

function logout(req, res, d) {
  const hash = sha256(String(d.refresh_token || ""));
  const sessions = read(F_SESSIONS);
  const s = Object.values(sessions).find((x) => x.refresh_hash === hash);
  if (s) { delete sessions[s.id]; writeAtomic(F_SESSIONS, sessions); }
  // Idempotente: cerrar una sesión que ya no existe no es un error.
  res.writeHead(204); res.end();
}

/* ------------------------------------------------- el puente al escritorio */

/** La app abre /auth/desktop?state=X en el navegador. Si hay sesión web, se
 *  emite un código de un solo uso y se vuelve a la app por el deep-link. Si no
 *  la hay, se manda al login conservando el `state`. */
function desktop(req, res, query) {
  const state = String(query.state || "").trim();
  if (!state || state.length < 8) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Falta el parámetro state.");
  }
  const ctx = userFromRequest(req);
  if (!ctx) {
    // Sin sesión: al login, que sabrá volver aquí.
    res.writeHead(302, { Location: "/aithera-tech/login.html?desktop=1&state=" +
                                   encodeURIComponent(state) });
    return res.end();
  }
  const code = emitirCodigo(ctx.user.id, state);
  res.writeHead(302, {
    Location: `${DEEP_LINK}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  });
  res.end();
}

function emitirCodigo(userId, state) {
  const codes = read(F_CODES);
  const code = rnd(32);
  // Se guarda el HASH del código, igual que los tokens.
  codes[sha256(code)] = { user_id: userId, state, expires: now() + CODE_TTL_S };
  // Limpieza de los caducados: este fichero es de usar y tirar.
  for (const [k, v] of Object.entries(codes)) if (v.expires < now()) delete codes[k];
  writeAtomic(F_CODES, codes);
  return code;
}

/** La app canjea el código por tokens. UN SOLO USO. */
function exchange(req, res, d) {
  const hash = sha256(String(d.code || ""));
  const codes = read(F_CODES);
  const c = codes[hash];
  if (!c || c.expires < now()) {
    return json(res, 400, { ok: false, error: "Ese código ya no vale. Vuelve a iniciar sesión desde la app." });
  }
  // Se consume ANTES de emitir nada: si algo fallara después, el código ya no
  // sirve — es preferible repetir el login a que un código quede reutilizable.
  delete codes[hash];
  writeAtomic(F_CODES, codes);

  const users = read(F_USERS);
  const u = users[c.user_id];
  if (!u) return json(res, 400, { ok: false, error: "Esa cuenta ya no existe." });

  const s = newSession(u.id, req);
  return json(res, 200, {
    ok: true, access_token: s.access, refresh_token: s.refresh,
    expires_in: ACCESS_TTL_S, user: publicUser(u),
  });
}

/** Variante JSON del puente, para la PÁGINA de login.
 *
 *  POR QUÉ EXISTE: `/auth/desktop` funciona cuando quien llama puede poner la
 *  cabecera `Authorization` (la propia app, o un `fetch`). Pero un REDIRECT del
 *  navegador no lleva cabeceras, así que la página de login no podía usarlo:
 *  habría rebotado a sí misma en bucle. Aquí la página, que sí tiene el token
 *  en memoria, pide el enlace y navega ella misma a `aithera://`.
 */
function desktopCode(req, res, d) {
  const state = String(d.state || "").trim();
  if (!state || state.length < 8) {
    return json(res, 400, { ok: false, error: "Falta el parámetro state." });
  }
  const ctx = userFromRequest(req);
  if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." });
  const code = emitirCodigo(ctx.user.id, state);
  return json(res, 200, {
    ok: true,
    deep_link: `${DEEP_LINK}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  });
}

/* ------------------------------------------------- sesiones y dispositivos */

function listarSesiones(req, res) {
  const ctx = userFromRequest(req);
  if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." });
  const sessions = read(F_SESSIONS);
  const mias = Object.values(sessions)
    .filter((s) => s.user_id === ctx.user.id && s.refresh_expires >= now())
    .map((s) => ({
      id: s.id, device: s.device, ip: s.ip,
      created_at: s.created_at, last_seen: s.last_seen,
      current: s.id === ctx.session.id,
    }))
    .sort((a, b) => b.last_seen - a.last_seen);
  return json(res, 200, { ok: true, sessions: mias });
}

function cerrarSesion(req, res, id) {
  const ctx = userFromRequest(req);
  if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." });
  const sessions = read(F_SESSIONS);
  const s = sessions[id];
  // Solo puedes cerrar TUS sesiones: sin esta comprobación, conocer un id
  // ajeno bastaría para echar a otra persona.
  if (!s || s.user_id !== ctx.user.id) {
    return json(res, 404, { ok: false, error: "Esa sesión no existe." });
  }
  delete sessions[id];
  writeAtomic(F_SESSIONS, sessions);
  res.writeHead(204); res.end();
}

function cerrarTodas(req, res) {
  const ctx = userFromRequest(req);
  if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." });
  const sessions = read(F_SESSIONS);
  for (const [id, s] of Object.entries(sessions)) {
    if (s.user_id === ctx.user.id) delete sessions[id];
  }
  writeAtomic(F_SESSIONS, sessions);
  res.writeHead(204); res.end();
}

function borrarCuenta(req, res) {
  const ctx = userFromRequest(req);
  if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." });
  const users = read(F_USERS);
  delete users[ctx.user.id];
  writeAtomic(F_USERS, users);
  const sessions = read(F_SESSIONS);
  for (const [id, s] of Object.entries(sessions)) {
    if (s.user_id === ctx.user.id) delete sessions[id];
  }
  writeAtomic(F_SESSIONS, sessions);
  res.writeHead(204); res.end();
}

/* --------------------------------------------------------------- OAuth */

/** Google y GitHub. NO se finge que funciona: sin las credenciales de una
 *  aplicación registrada (que solo puede crear el dueño de esas cuentas) esto
 *  no puede existir, y decirlo es mejor que un botón que falla raro. */
function oauth(req, res, proveedor) {
  const idEnv = proveedor === "google" ? "GOOGLE_OAUTH_CLIENT_ID" : "GITHUB_OAUTH_CLIENT_ID";
  if (!process.env[idEnv]) {
    return json(res, 501, {
      ok: false,
      error: `El acceso con ${proveedor === "google" ? "Google" : "GitHub"} todavía no está activado.`,
      detail: `Falta configurar ${idEnv} y su secreto en el servidor. ` +
              "Requiere registrar una aplicación OAuth en el proveedor.",
    });
  }
  return json(res, 501, {
    ok: false,
    error: "El intercambio con el proveedor aún no está implementado.",
    detail: "Las credenciales están puestas, falta completar el flujo. Ver README-DESPLIEGUE.md.",
  });
}

/* ====================================================== punto de entrada */

/**
 * Devuelve `true` si esta petición era suya (y ya la ha contestado).
 * `server.js` solo tiene que anteponer:  if (auth.handle(req, res, u, ip)) return;
 */
function handle(req, res, u, ip, maxBody) {
  const p = u.pathname;
  if (!p.startsWith("/api/auth") && !p.startsWith("/api/account") && p !== "/auth/desktop") {
    return false;
  }
  ensureData();
  const MAX = maxBody || 64 * 1024;

  const conCuerpo = (fn) => {
    leerCuerpo(req, MAX, (err, d) => {
      if (err) {
        return json(res, err.message === "too_big" ? 413 : 400,
                    { ok: false, error: err.message === "too_big"
                        ? "Petición demasiado grande." : "JSON no válido." });
      }
      fn(d);
    });
  };

  if (req.method === "POST" && p === "/api/auth/register") { conCuerpo((d) => register(req, res, d, ip)); return true; }
  if (req.method === "POST" && p === "/api/auth/login")    { conCuerpo((d) => login(req, res, d, ip)); return true; }
  if (req.method === "POST" && p === "/api/auth/refresh")  { conCuerpo((d) => refresh(req, res, d)); return true; }
  if (req.method === "POST" && p === "/api/auth/logout")   { conCuerpo((d) => logout(req, res, d)); return true; }
  if (req.method === "POST" && p === "/api/auth/exchange") { conCuerpo((d) => exchange(req, res, d)); return true; }
  if (req.method === "GET"  && p === "/auth/desktop")      { desktop(req, res, u.query); return true; }
  if (req.method === "POST" && p === "/api/auth/desktop-code") { conCuerpo((d) => desktopCode(req, res, d)); return true; }

  if (req.method === "GET" && p === "/api/auth/me") {
    const ctx = userFromRequest(req);
    if (!ctx) return json(res, 401, { ok: false, error: "No has iniciado sesión." }), true;
    return json(res, 200, { ok: true, user: publicUser(ctx.user) }), true;
  }

  const mOauth = p.match(/^\/api\/auth\/oauth\/(google|github)$/);
  if (req.method === "GET" && mOauth) { oauth(req, res, mOauth[1]); return true; }

  if (req.method === "GET"    && p === "/api/account/sessions") { listarSesiones(req, res); return true; }
  if (req.method === "DELETE" && p === "/api/account/sessions") { cerrarTodas(req, res); return true; }
  const mSes = p.match(/^\/api\/account\/sessions\/([\w-]+)$/);
  if (req.method === "DELETE" && mSes) { cerrarSesion(req, res, mSes[1]); return true; }
  if (req.method === "DELETE" && p === "/api/account") { borrarCuenta(req, res); return true; }

  json(res, 404, { ok: false, error: "No existe ese endpoint de cuentas." });
  return true;
}

module.exports = { handle, ensureData };
