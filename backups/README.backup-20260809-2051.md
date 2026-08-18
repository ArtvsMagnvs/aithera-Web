# Aithera Autopilot — Web

Landing única + página de reserva de consultoría, con servidor propio para las
solicitudes. Frontend en HTML5, CSS3 y JavaScript vanilla; backend en Node puro.
Sin frameworks y sin dependencias obligatorias: se arranca y funciona.

---

## Cómo verla

**Recomendado — con backend** (formulario real, las solicitudes se guardan):
doble clic en **`iniciar-servidor.cmd`**. Necesita [Node.js](https://nodejs.org)
instalado; no hace falta `npm install`.

| | |
|---|---|
| Web | `http://localhost:3000/` |
| Consultoría | `http://localhost:3000/consultoria.html` |
| Panel de solicitudes | `http://localhost:3000/admin?token=aithera` |

**Solo mirar el diseño:** doble clic en `index.html` (o en `servidor-local.cmd`
si tienes Python). Se ve exactamente igual — tipografías incluidas, van incrustadas
en el CSS — pero al no haber servidor el formulario entra en modo demostración:
valida y confirma, sin guardar nada.

---

## Estructura

```
index.html              Landing completa (una sola página)
consultoria.html        Formulario de reserva de consultoría
iniciar-servidor.cmd    Arranca la web CON backend (Windows)
servidor-local.cmd      Arranca solo la web, sin backend (necesita Python)
robots.txt / sitemap.xml
server/
  server.js             Servidor: estáticos + API + panel de solicitudes
  config.json           Puerto, token del panel, SMTP, límite de peticiones
  package.json          Solo para el nodemailer opcional
  data/                 leads.json y leads.csv (se crean solos)
assets/
  css/
    styles.css          Sistema de diseño completo (tokens, componentes, responsive)
    fonts.css           Saira + Inter variables, incrustadas en base64
  js/
    orb.js              Motor de render del orbe animado del hero
    main.js             Header, menú, scrollspy, reveals, contadores, carrusel, modales, cookies
    form.js             Asistente de 3 pasos, validación y envío
  fonts/                Las mismas fuentes en .woff2 suelto (para producción sobre servidor)
  img/                  Logotipo, favicon y escenas de los casos de éxito (SVG)
build/                  Scripts internos de generación de assets y capturas (no se publica)
```

---

## El orbe del hero (`assets/js/orb.js`)

Render 3D propio sobre canvas 2D, en bucle infinito. Capas, de atrás hacia delante:

1. Aura radial y campo de partículas interiores.
2. Esfera de 340 partículas en distribución de espiral áurea, con titileo y profundidad.
3. Siete anillos orbitales con inclinaciones propias, arco viajero y satélites luminosos.
4. Plataforma inferior: 64 radios con onda animada y cinco elipses concéntricas.
5. Columna de luz, pulsos de energía expansivos.
6. Semilla Aithera: tres hojas anidadas, destellos radiales y núcleo con latido.
7. Pase de *bloom* aditivo a media resolución (dos desenfoques compuestos en `lighter`).

Detalles de rendimiento y accesibilidad:

- Se detiene solo al salir del viewport (`IntersectionObserver`) y al ocultar la pestaña.
- `devicePixelRatio` limitado a 1.9 y buffer de bloom a media resolución.
- Con `prefers-reduced-motion` dibuja un único fotograma estático.
- Parallax suave siguiendo el puntero.

Para ajustarlo: los anillos están en el array `this.rings` (radio, inclinaciones, color,
opacidad, grosor, puntos, satélite, giro) dentro de `buildGeometry()`.

---

## Formulario de consultoría

Asistente de tres pasos (**Sobre ti · Tu empresa · Tu proyecto**) con barra de progreso,
validación por paso, mensajes de error en línea, estado de carga y pantalla de éxito.

Envía un `POST` con JSON a `/api/lead`. Si detecta que la web se ha abierto desde
disco (`file://`), pasa solo a modo demostración.

### Backend (`server/server.js`)

Node puro, sin dependencias obligatorias.

| Ruta | Qué hace |
|---|---|
| `POST /api/lead` | Valida, limita por IP, descarta bots y guarda la solicitud |
| `GET /admin?token=…` | Panel con todas las solicitudes |
| `GET /api/leads?token=…` | El mismo listado en JSON |
| `GET /api/leads.csv?token=…` | Descarga en CSV, lista para Excel |
| resto | Sirve la web estática con ETag y caché |

Cada solicitud se guarda por duplicado en `server/data/`: `leads.json` (completo) y
`leads.csv` (con `;` y BOM, así Excel en español lo abre bien).

Seguridad incluida: validación en servidor espejo de la del cliente, trampa antispam
(*honeypot*), límite de 8 envíos por IP cada 10 minutos, tope de tamaño del cuerpo y
protección contra *path traversal* en los estáticos.

### Configuración

Todo en `server/config.json`:

```json
{
  "port": 3000,
  "adminToken": "aithera",
  "email": { "enabled": false }
}
```

Cambia `adminToken` antes de publicar.

### Avisos por email (opcional)

1. `cd server` y `npm install nodemailer`
2. En `config.json` pon `email.enabled: true` y rellena `host`, `port`, `user`,
   `pass`, `from` y `to`.

Cada solicitud te llegará al correo con el `Reply-To` ya puesto al email del cliente.
Si el envío falla, la solicitud **igualmente queda guardada**: no se pierde ningún lead.

### ¿Prefieres un servicio externo?

Cambia `endpoint` en `assets/js/form.js` por la URL de Formspree, Web3Forms (añadiendo
`access_key` dentro de `extra`) o tu CRM, y podrás publicar la web como sitio 100 %
estático sin usar el servidor.

---

## Personalización rápida

| Qué | Dónde |
|---|---|
| Colores, tipografías, radios, espaciados | bloque `:root` de `styles.css` |
| Teléfono, email, dirección | pie de página de ambos HTML y JSON-LD de `index.html` |
| Enlace de WhatsApp | `https://wa.me/34611123456` en `index.html` |
| Textos legales | objeto `LEGAL` en `main.js` |
| Puerto, token del panel, SMTP | `server/config.json` |
| Métricas y casos de éxito | secciones correspondientes de `index.html` |
| Escenas de los casos | `build/gen_assets.py` (regenera los SVG) |

---

## Notas técnicas

- **Accesibilidad:** navegación por teclado completa, `aria-*` en menú, modales, carrusel
  y formulario, foco visible, enlace de salto y respeto a `prefers-reduced-motion`.
- **SEO:** metadatos, Open Graph, canónica, `robots.txt`, `sitemap.xml` y JSON-LD
  (`ProfessionalService`).
- **RGPD:** banner de cookies con elección persistente y modales de aviso legal,
  privacidad y cookies. Los textos son de ejemplo: revísalos con tu asesoría.
- **Compatibilidad:** Chrome, Edge, Firefox y Safari recientes. Usa `color-mix()`,
  `aspect-ratio` y `overflow: clip`.
- **Fuentes:** Saira e Inter, SIL Open Font License 1.1.

---

## Publicar

**Con backend** (recomendado, formulario incluido): cualquier hosting con Node —
Railway, Render, Fly.io o un VPS. Comando de arranque `node server/server.js`,
puerto por la variable de entorno `PORT` y `"host": "0.0.0.0"` en `config.json`.
Ponlo detrás de HTTPS y cambia `adminToken`.

**Sin backend**: cambia el `endpoint` de `form.js` por un servicio externo y sube la
carpeta (sin `build/` ni `server/`) a Netlify, Vercel, Cloudflare Pages o GitHub Pages.
No hace falta compilar nada.

Si lo sirves por HTTP y quieres aligerar el CSS, puedes sustituir `assets/css/fonts.css`
por reglas `@font-face` que apunten a `assets/fonts/*.woff2` (los archivos ya están ahí).
