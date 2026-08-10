# Aithera — Web (landing + Autopilot)

Dos sitios independientes, cada uno con su propio despliegue en Render:

| Carpeta      | Dominio                     | Tipo de servicio en Render | Contenido |
|--------------|------------------------------|------------------------------|-----------|
| `landing/`   | `aithera.tech` (principal)   | **Static Site**               | Landing mínima: header + orbe 3D + botón a Autopilot. Sin backend. |
| `autopilot/` | `autopilot.aithera.tech`     | **Web Service** (Node)        | Web completa de Aithera Autopilot: landing propia, página de consultoría y servidor Node (formulario + panel de solicitudes). |

No hay ninguna dependencia entre ambas: son dos repos-en-una-carpeta que se despliegan por separado. `landing/` enlaza a `autopilot/` con un botón, nada más — no comparten servidor ni base de datos.

---

## 1. Subir esto a GitHub

Si ya tienes el repo `aithera-web` creado:

1. Ve a `https://github.com/<tu-usuario>/aithera-web`
2. **Add file → Upload files**
3. Arrastra las carpetas `landing/`, `autopilot/` y este `README.md` (el navegador conserva la estructura)
4. **Commit changes**

---

## 2. Desplegar `landing/` (aithera.tech) — Static Site

En [render.com](https://dashboard.render.com):

1. **New → Static Site**
2. Conecta tu cuenta de GitHub (botón "Connect GitHub" — es OAuth, no pide ningún token) y elige el repo `aithera-web`
3. Configura:
   - **Root Directory**: `landing`
   - **Build Command**: (vacío — no hay build, son archivos estáticos)
   - **Publish Directory**: `.`
4. **Create Static Site**
5. Cuando esté desplegado: **Settings → Custom Domain** → añade `aithera.tech` y `www.aithera.tech`. Render te da los registros DNS (CNAME/A) para poner en Namecheap cuando compres el dominio.

---

## 3. Desplegar `autopilot/` (autopilot.aithera.tech) — Web Service

1. **New → Web Service**, mismo repo `aithera-web`
2. Configura:
   - **Root Directory**: `autopilot`
   - **Runtime**: Node
   - **Build Command**: `echo "sin dependencias obligatorias"` (o déjalo vacío)
   - **Start Command**: `node server/server.js`
3. **Environment** → añade estas variables (se ponen en el panel de Render, nunca en un archivo del repo):
   - `ADMIN_TOKEN` = un token largo y aleatorio tuyo (protege el panel `/admin`)
   - *(opcional)* si activas el email de notificación: `SMTP_*` según necesites, o edita `autopilot/server/config.json` antes de subir
4. **Create Web Service**
5. **Settings → Custom Domain** → añade `autopilot.aithera.tech` (subdominio, apunta con un CNAME al host que te da Render).

El servidor ya está preparado para producción: escucha en `0.0.0.0` y respeta el puerto que Render asigna (`process.env.PORT`) automáticamente — no hay que tocar nada más.

---

## 4. Namecheap → dominios

Cuando compres `aithera.tech`:
- En Namecheap → **Advanced DNS**, añade los registros que Render te muestre en cada "Custom Domain" (normalmente un `A`/`ALIAS` para `aithera.tech` y un `CNAME` para `autopilot`).
- La propagación puede tardar hasta un par de horas.

---

## Notas

- `autopilot/server/config.json` trae un `adminToken` de relleno a propósito — el real se pone como variable de entorno `ADMIN_TOKEN` en Render, nunca en el archivo (este repo puede ser público).
- `autopilot/server/data/` guarda las solicitudes recibidas (`leads.json`/`leads.csv`); está en `.gitignore`, así que no se sube ni se pisa entre despliegues... **salvo que sepas que el disco de un Web Service gratuito de Render no es persistente entre despliegues** — si necesitas que las solicitudes sobrevivan a un redeploy, dímelo y lo cambiamos a una base de datos o a un disco persistente (plan de pago).
- `landing/` no tiene backend ni formulario: es intencionadamente mínima.
