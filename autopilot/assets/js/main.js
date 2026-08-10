/* =============================================================
   AITHERA AUTOPILOT — Interacciones de la landing
   ============================================================= */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- almacenamiento tolerante a fallos ---------- */
  var mem = {};
  var store = {
    get: function (k) {
      try { return window.localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; }
    }
  };

  /* ---------- año dinámico ---------- */
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- header sticky ---------- */
  var header = $("#header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-stuck", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- menú móvil ---------- */
  var burger = $("#burger"), mnav = $("#mobileNav");
  function closeNav() {
    if (!burger) return;
    burger.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Abrir menú");
    mnav.classList.remove("is-open");
    document.body.classList.remove("is-locked");
  }
  if (burger && mnav) {
    burger.addEventListener("click", function () {
      var open = !burger.classList.contains("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      mnav.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
    });
    $$("a", mnav).forEach(function (a) { a.addEventListener("click", closeNav); });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeNav(); closeModal(); }
  });

  /* ---------- reveal ---------- */
  if ("IntersectionObserver" in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); ro.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$("[data-reveal]").forEach(function (el) { ro.observe(el); });
  } else {
    $$("[data-reveal]").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- contadores ---------- */
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function formatNum(n, sep) {
    var s = String(Math.round(n));
    if (!sep) return s;
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  function runCounter(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;
    var pre = el.getAttribute("data-prefix") || "";
    var suf = el.getAttribute("data-suffix") || "";
    var sep = el.getAttribute("data-sep") || "";
    if (reduced) { el.textContent = pre + formatNum(target, sep) + suf; return; }
    var dur = 1500, t0 = null;
    function tick(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      el.textContent = pre + formatNum(target * easeOutExpo(p), sep) + suf;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var counters = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCounter(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- scrollspy ---------- */
  var links = $$(".nav__link");
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  function spy() {
    var y = window.scrollY + (window.innerHeight * 0.28);
    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= y) current = sections[i];
    }
    /* al final de la página marcamos la última sección visible */
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      current = sections[sections.length - 1];
    }
    links.forEach(function (a) {
      a.classList.toggle("is-active", current && a.getAttribute("href") === "#" + current.id);
    });
  }
  if (sections.length) {
    window.addEventListener("scroll", spy, { passive: true });
    window.addEventListener("resize", spy);
    spy();
  }

  /* ---------- marquee de logos ---------- */
  var logos = $("#logos");
  if (logos && !logos.dataset.cloned) {
    logos.innerHTML += logos.innerHTML;
    logos.dataset.cloned = "1";
  }
  var logosWrap = logos && logos.parentElement;
  function logosMode() {
    if (!logosWrap) return;
    logosWrap.classList.remove("is-static");
    var fits = logos.scrollWidth / 2 <= logosWrap.clientWidth;
    logosWrap.classList.toggle("is-static", fits && window.innerWidth > 1024);
  }
  window.addEventListener("resize", logosMode);
  logosMode();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(logosMode);

  /* ---------- carrusel de casos ---------- */
  (function carousel() {
    var vp = $("#casesViewport"), track = $("#casesTrack");
    if (!vp || !track) return;
    var prev = $("#casesPrev"), next = $("#casesNext"), dots = $("#casesDots");
    var items = $$(".case", track);
    var GAP = 16;
    var index = 0, pages = 1;

    function perView() {
      var w = window.innerWidth;
      if (w > 1024) return 3;
      if (w > 620) return 2;
      return 1;
    }

    function layout() {
      pages = Math.max(1, Math.ceil(items.length / perView()));
      if (index > pages - 1) index = pages - 1;
      dots.innerHTML = "";
      for (var i = 0; i < pages; i++) {
        var b = document.createElement("button");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-label", "Página " + (i + 1) + " de " + pages);
        b.addEventListener("click", (function (n) { return function () { go(n); }; })(i));
        dots.appendChild(b);
      }
      go(index, true);
    }

    function go(n, instant) {
      index = Math.max(0, Math.min(pages - 1, n));
      var w = vp.clientWidth;
      if (instant) track.style.transition = "none";
      track.style.transform = "translate3d(" + (-index * (w + GAP)) + "px,0,0)";
      if (instant) { void track.offsetWidth; track.style.transition = ""; }
      $$("button", dots).forEach(function (d, i) {
        d.classList.toggle("is-active", i === index);
        d.setAttribute("aria-selected", String(i === index));
      });
      prev.disabled = index === 0;
      next.disabled = index === pages - 1;
    }

    prev.addEventListener("click", function () { go(index - 1); });
    next.addEventListener("click", function () { go(index + 1); });

    /* swipe / arrastre */
    var startX = 0, dragging = false;
    vp.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; track.style.transition = "none";
    });
    window.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      track.style.transition = "";
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1)); else go(index);
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var w = vp.clientWidth;
      track.style.transform = "translate3d(" + (-index * (w + GAP) + dx * 0.6) + "px,0,0)";
    });

    vp.setAttribute("tabindex", "0");
    vp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 160);
    });
    layout();
  })();

  /* ---------- modales legales ---------- */
  var LEGAL = {
    legal: {
      t: "Aviso legal",
      h: "<h4>Titular del sitio</h4><p>Aithera Autopilot S.L. — NIF B-00000000. Domicilio social en Barcelona (España). Correo de contacto: hola@aitheraautopilot.com.</p>" +
         "<h4>Objeto</h4><p>Este sitio web tiene por finalidad informar sobre los servicios de consultoría e implementación de automatización e inteligencia artificial que presta Aithera Autopilot, así como facilitar el contacto comercial.</p>" +
         "<h4>Condiciones de uso</h4><p>El acceso y la navegación por este sitio atribuyen la condición de usuario e implican la aceptación de las presentes condiciones. El usuario se compromete a hacer un uso lícito de los contenidos y a no realizar actividades que puedan dañar, inutilizar o sobrecargar el sitio.</p>" +
         "<h4>Propiedad intelectual</h4><p>Todos los contenidos (textos, marcas, logotipos, diseño, código y elementos gráficos) son titularidad de Aithera Autopilot o se utilizan con licencia. Queda prohibida su reproducción total o parcial sin autorización expresa.</p>" +
         "<h4>Responsabilidad</h4><p>Aithera Autopilot no se responsabiliza del uso que terceros hagan de la información publicada ni de los daños derivados de la falta de disponibilidad temporal del sitio.</p>" +
         "<h4>Legislación aplicable</h4><p>Las presentes condiciones se rigen por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales de Barcelona.</p>" +
         "<p style='margin-top:18px;color:var(--txt-4);font-size:12px'>Texto de ejemplo. Sustitúyelo por el aviso legal definitivo revisado por tu asesoría antes de publicar.</p>"
    },
    privacidad: {
      t: "Política de privacidad",
      h: "<h4>Responsable del tratamiento</h4><p>Aithera Autopilot S.L., con domicilio en Barcelona (España) y correo de contacto hola@aitheraautopilot.com.</p>" +
         "<h4>Finalidad</h4><p>Tratamos los datos que nos facilitas a través del formulario de reserva de consultoría para atender tu solicitud, preparar el diagnóstico y enviarte comunicaciones relacionadas con el servicio solicitado.</p>" +
         "<h4>Legitimación</h4><p>La base jurídica es tu consentimiento expreso y la aplicación de medidas precontractuales a petición del interesado.</p>" +
         "<h4>Conservación</h4><p>Conservamos los datos mientras exista interés mutuo y, posteriormente, durante los plazos legalmente exigibles.</p>" +
         "<h4>Destinatarios</h4><p>No cedemos datos a terceros salvo obligación legal. Utilizamos proveedores tecnológicos que actúan como encargados del tratamiento con contrato firmado y garantías adecuadas.</p>" +
         "<h4>Derechos</h4><p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a hola@aitheraautopilot.com. También puedes reclamar ante la Agencia Española de Protección de Datos.</p>" +
         "<p style='margin-top:18px;color:var(--txt-4);font-size:12px'>Texto de ejemplo. Sustitúyelo por la política definitiva antes de publicar.</p>"
    },
    cookies: {
      t: "Política de cookies",
      h: "<h4>Qué son</h4><p>Las cookies son pequeños archivos que se descargan en tu dispositivo al navegar y permiten recordar preferencias y obtener información estadística sobre el uso del sitio.</p>" +
         "<h4>Cookies necesarias</h4><p>Imprescindibles para el funcionamiento del sitio y la gestión de tu consentimiento. No requieren autorización previa.</p>" +
         "<h4>Cookies analíticas</h4><p>Nos permiten medir el número de visitas y cómo se navega por el sitio para mejorarlo. Solo se activan si aceptas.</p>" +
         "<h4>Gestión</h4><p>Puedes cambiar tu elección en cualquier momento borrando los datos del navegador para este sitio, o configurando tu navegador para bloquear cookies.</p>" +
         "<p style='margin-top:18px;color:var(--txt-4);font-size:12px'>Texto de ejemplo. Ajústalo a las herramientas de medición que utilices realmente.</p>"
    }
  };

  var modal = $("#modal"), modalTitle = $("#modalTitle"), modalBody = $("#modalBody"), lastFocus = null;

  function openModal(key) {
    var data = LEGAL[key];
    if (!data || !modal) return;
    lastFocus = document.activeElement;
    modalTitle.textContent = data.t;
    modalBody.innerHTML = data.h;
    modal.hidden = false;
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    document.body.classList.add("is-locked");
    $("#modalClose").focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(function () { modal.hidden = true; }, 320);
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-modal]");
    if (trigger) { e.preventDefault(); openModal(trigger.getAttribute("data-modal")); return; }
    if (e.target === modal) closeModal();
    if (e.target.closest("#modalClose")) closeModal();
  });

  /* ---------- cookies ---------- */
  var cookies = $("#cookies");
  if (cookies) {
    if (!store.get("aithera-cookies")) {
      setTimeout(function () { cookies.classList.add("is-visible"); }, 1400);
    }
    $$("[data-cookie]", cookies).forEach(function (b) {
      b.addEventListener("click", function () {
        store.set("aithera-cookies", b.getAttribute("data-cookie"));
        cookies.classList.remove("is-visible");
      });
    });
  }

  /* ---------- anclas suaves con offset ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id === "#" || a.hasAttribute("data-modal")) return;
    var el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    var top = el.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight + 14 : 0);
    window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", id);
  });
})();
