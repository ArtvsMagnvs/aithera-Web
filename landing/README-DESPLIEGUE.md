# Aithera — la web del producto: cómo funciona y cómo publicarla

Escrito el 2026-08-19, cuando se añadieron la página de descarga y las cuentas
(BW1). Está en español a propósito: es documentación interna, no contenido del
sitio.

---

## 1. Qué hay aquí

En esta carpeta conviven **dos webs distintas**. Conviene tenerlo claro antes de
tocar nada:

| Carpeta | Qué es | Dominio |
|---|---|---|
| la raíz (`index.html`, `consultoria.html`) | **Aithera Autopilot** — la consultoría B2B, en español | `aitheraautopilot.com` |
| `aithera-tech/` | **Aithera** — el producto de escritorio, en inglés | `aithera.tech` |
| `landing-backup-20260817/` | versión vieja, sustituida | — |

Todo lo de este documento es de `aithera-tech/`.

### Páginas del producto

| Página | Para qué |
|---|---|
| `index.html` | La portada |
| `download.html` | **Descarga del instalador** + el aviso de SmartScreen |
| `login.html` | Entrar o crear cuenta. También es donde aterriza la app de escritorio |
| `account.html` | Dispositivos, cerrar sesiones, eliminar la cuenta |
| `privacy.html` / `terms.html` | Legales |

---

## 2. El servidor

`server/server.js` es Node **puro**: sin Express, sin dependencias (salvo
`nodemailer`, que es opcional y está desactivado). Sirve los estáticos y tiene
el formulario de leads del sitio de consultoría.

`server/auth.js` (nuevo) añade las cuentas. Vive en su propio archivo a
propósito: los leads llevan meses funcionando y un fallo de identidad no puede
tumbarlos. `server.js` solo gana una línea en su router.

**Arrancar:**

```bash
node server/server.js
```

Variables de entorno que entiende:

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | el de `server/config.json` (3000) |
| `AITHERA_DEEP_LINK` | Esquema al que se devuelve la app | `aithera://auth` |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Entrar con Google | sin definir → desactivado |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | Entrar con GitHub | sin definir → desactivado |

**Dónde se guardan los datos:** ficheros JSON en `server/data/`
(`users.json`, `sessions.json`, `codes.json`). No hay base de datos, y para una
beta con cuentas opcionales es suficiente. Están en `.gitignore`: **nunca deben
subirse al repositorio.**

---

## 3. Las cuentas (contrato del doc 48 §3-§4)

Estos son los endpoints que la app de escritorio espera. Están implementados y
probados de punta a punta:

| Método y ruta | Qué hace |
|---|---|
| `POST /api/auth/register` | Crea la cuenta y devuelve tokens |
| `POST /api/auth/login` | Entra |
| `POST /api/auth/refresh` | Renueva el token de acceso |
| `POST /api/auth/logout` | Cierra esa sesión |
| `GET /api/auth/me` | Quién soy |
| `GET /auth/desktop?state=…` | Puente para la app (redirige a `aithera://`) |
| `POST /api/auth/desktop-code` | Igual, pero en JSON — lo usa la página de login |
| `POST /api/auth/exchange` | La app canjea el código por tokens |
| `GET /api/account/sessions` | Mis dispositivos |
| `DELETE /api/account/sessions/{id}` | Cerrar uno |
| `DELETE /api/account/sessions` | Cerrar todos |
| `DELETE /api/account` | Eliminar la cuenta |

### Cómo entra la app de escritorio

1. La app genera un `state` aleatorio y abre en el navegador
   `https://aithera.tech/auth/desktop?state=…`
2. Si no hay sesión, se va a `login.html` conservando el `state`.
3. Al entrar, la página pide un **código de un solo uso** y navega a
   `aithera://auth?code=…&state=…`
4. La app comprueba que el `state` es el suyo y hace
   `POST /api/auth/exchange {code}` → recibe sus tokens.

El código **caduca en 5 minutos y solo sirve una vez**. Sin la comprobación del
`state`, cualquiera que viera esa URL podría quedarse con la sesión.

### Seguridad, en corto

- Las contraseñas se guardan con `scrypt` + sal propia. Nunca en claro.
- Los tokens se guardan **hasheados** (sha256): quien lea el fichero de sesiones
  no puede suplantar a nadie.
- Comparaciones en tiempo constante.
- Límite de intentos en login y registro.
- Escritura atómica de los ficheros.
- Solo puedes cerrar **tus** sesiones (comprobado, no confiado).

---

## 4. LO QUE TIENES QUE HACER TÚ (no lo puedo hacer yo)

### 4.1 — Poner esto en git

Esta carpeta **no es un repositorio**. Antes de publicar nada:

```bash
cd "C:\Users\Alejandro\Desktop\CLAUDE\Aithera Website"
git init
git remote add origin https://github.com/ArtvsMagnvs/aithera-Web.git
git add -A
git commit -m "web: descarga del instalador + cuentas (BW1)"
git push -u origin main
```

> **Antes del primer push**: `server/config.json` tiene el token de
> administración **en claro**. O lo sacas del repo (a una variable de entorno) o
> lo cambias por uno nuevo después de publicar.

### 4.2 — Activar el acceso con Google y GitHub

Ahora mismo los dos botones aparecen **desactivados y diciendo que no están
activos**, y el servidor responde `501` explicando por qué. No están fingidos.

Para activarlos hace falta registrar una aplicación OAuth en cada proveedor, y
eso solo lo puede hacer quien es dueño de esas cuentas:

**Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
1. Crea un proyecto (o usa el que ya tienes para Gmail/Calendar).
2. «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth».
3. Tipo: **Aplicación web**.
4. URI de redirección autorizado: `https://aithera.tech/api/auth/oauth/google/callback`
5. Copia el ID y el secreto a `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.

**GitHub** — [Developer settings → OAuth Apps](https://github.com/settings/developers)
1. «New OAuth App».
2. Authorization callback URL: `https://aithera.tech/api/auth/oauth/github/callback`
3. Copia el ID y genera un secreto → `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.

Con las variables puestas, `server/auth.js` → `oauth()` deja de decir «falta
configurar» y pasa a decir «falta completar el flujo»: queda **implementar el
intercambio** (redirigir al proveedor, recibir el `code`, canjearlo por el perfil
y crear o vincular la cuenta). Es la parte que quedó sin escribir.

### 4.3 — Publicar

El sitio es estático más un servidor Node pequeño. Dos caminos:

- **Con backend** (necesario para las cuentas): Railway, Render, Fly.io o un VPS.
  Arranque: `node server/server.js`. Pon `PORT` por entorno y `"host": "0.0.0.0"`
  en `server/config.json`.
- **Sin backend** (solo la web, sin cuentas): Netlify / Vercel / Cloudflare Pages.
  La descarga seguiría funcionando porque apunta a GitHub Releases.

### 4.4 — Verificar el correo de registro

Hoy la cuenta se crea y queda marcada `email_verified: false`. No se miente
diciendo que está verificada. Para verificarlo de verdad hace falta un SMTP
configurado (`server/config.json` → `email`), que ya existe para los leads.

---

## 5. La página de descarga

`download.html` apunta a
`https://github.com/ArtvsMagnvs/aithera-releases/releases/latest`, es decir a la
**última** release — así no caduca cada vez que publicas una versión.

Incluye, a propósito y con detalle, el **aviso de SmartScreen**: el instalador no
está firmado con un certificado de código, así que Windows enseña la pantalla
azul de «Windows protegió tu PC» y hay que pulsar «Más información → Ejecutar de
todas formas». No decirlo haría que la gente pensara que el archivo está
infectado.

Cuando publiques una release, **pon el SHA-256 del `.exe` en las notas**: la
página le dice a quien quiera comprobarlo que lo encontrará ahí.

```powershell
Get-FileHash "Aithera-Setup-X.Y.Z.exe" -Algorithm SHA256
```

Si algún día compras un certificado EV de firma de código, ese aviso desaparece
solo y esa sección de la página se puede quitar.
