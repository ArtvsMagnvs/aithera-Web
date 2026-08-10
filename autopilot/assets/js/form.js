/* =============================================================
   AITHERA AUTOPILOT — Formulario de reserva de consultoría
   Asistente de 3 pasos con validación, estados y envío al backend.
   -------------------------------------------------------------
   ENVÍO
   Por defecto apunta a `/api/lead`, el endpoint que levanta
   `server/server.js` (arráncalo con iniciar-servidor.cmd).

   Si abres la web haciendo doble clic en index.html (protocolo
   file://) no hay servidor detrás: el formulario entra solo en
   MODO DEMOSTRACIÓN, valida todo y muestra la confirmación sin
   enviar nada. El payload queda en la consola del navegador.

   Para usar un servicio externo en lugar del backend propio,
   cambia `endpoint` por la URL completa:
     · Formspree → "https://formspree.io/f/TU_ID"
     · Web3Forms → "https://api.web3forms.com/submit"
                    y añade access_key dentro de `extra`
   ============================================================= */
(function () {
  "use strict";

  var CONFIG = {
    endpoint: "/api/lead",
    extra: {
      _subject: "Nueva solicitud de consultoría — Aithera Autopilot",
      origen: "Landing Aithera Autopilot"
    }
  };

  /* Sin servidor detrás (file://) no se puede hacer POST: modo demo. */
  var OFFLINE = location.protocol === "file:";

  var form = document.getElementById("bookForm");
  if (!form) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var steps = $$(".fstep", form);
  var pSteps = $$(".pstep");
  var pBars = $$(".pbar");
  var btnBack = $("#btnBack");
  var btnNext = $("#btnNext");
  var btnSend = $("#btnSend");
  var alertBox = $("#formAlert");
  var alertText = $("#formAlertText");
  var successBox = $("#success");
  var areasWrap = $("#areas");
  var areasValue = $("#areasValue");
  var current = 0;

  /* ---------------- chips ---------------- */
  if (areasWrap) {
    $$(".chip", areasWrap).forEach(function (chip) {
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function () {
        var on = chip.classList.toggle("is-on");
        chip.setAttribute("aria-pressed", String(on));
        syncAreas();
        clearError(areasWrap.closest(".field"));
      });
    });
  }
  function selectedAreas() {
    return $$(".chip.is-on", areasWrap).map(function (c) { return c.getAttribute("data-value"); });
  }
  function syncAreas() {
    areasValue.value = selectedAreas().join(", ");
  }

  /* ---------------- validación ---------------- */
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var RE_TEL = /^[+()\d\s.\-]{7,20}$/;
  var RE_URL = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;

  function setError(field) {
    if (!field) return;
    field.classList.add("has-error");
  }
  function clearError(field) {
    if (!field) return;
    field.classList.remove("has-error");
  }

  function validateField(el) {
    var field = el.closest(".field");
    var v = (el.value || "").trim();

    if (el.type === "checkbox") {
      if (el.required && !el.checked) { setError(field); return false; }
      clearError(field); return true;
    }
    if (el.required && !v) { setError(field); return false; }
    if (el.type === "email" && v && !RE_EMAIL.test(v)) { setError(field); return false; }
    if (el.type === "tel" && v && !RE_TEL.test(v)) { setError(field); return false; }
    if (el.type === "url" && v && !RE_URL.test(v)) { setError(field); return false; }
    if (el.id === "nombre" && v && v.length < 3) { setError(field); return false; }
    clearError(field);
    return true;
  }

  function validateStep(i) {
    var ok = true, firstBad = null;
    var scope = steps[i];

    $$("input, select, textarea", scope).forEach(function (el) {
      if (el.type === "hidden") return;
      if (!validateField(el)) { ok = false; if (!firstBad) firstBad = el; }
    });

    /* áreas (paso 3) */
    if (scope.getAttribute("data-step") === "3") {
      var field = areasWrap.closest(".field");
      if (selectedAreas().length === 0) {
        setError(field); ok = false;
        if (!firstBad) firstBad = $(".chip", areasWrap);
      } else {
        clearError(field);
      }
    }

    if (!ok && firstBad) {
      firstBad.focus({ preventScroll: true });
      var r = firstBad.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight - 40) {
        window.scrollTo({ top: window.scrollY + r.top - 160, behavior: "smooth" });
      }
    }
    return ok;
  }

  /* limpia el error al corregir */
  $$("input, select, textarea", form).forEach(function (el) {
    var ev = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
    el.addEventListener(ev, function () {
      if (el.closest(".field") && el.closest(".field").classList.contains("has-error")) validateField(el);
    });
    el.addEventListener("blur", function () {
      if ((el.value || "").trim() || el.required) validateField(el);
    });
  });

  /* ---------------- navegación ---------------- */
  function render() {
    steps.forEach(function (s, i) { s.classList.toggle("is-current", i === current); });
    pSteps.forEach(function (p, i) {
      p.classList.toggle("is-active", i === current);
      p.classList.toggle("is-done", i < current);
    });
    pBars.forEach(function (b, i) { b.classList.toggle("is-filled", i < current); });

    btnBack.hidden = current === 0;
    btnNext.hidden = current === steps.length - 1;
    btnSend.hidden = current !== steps.length - 1;
    hideAlert();

    var h = steps[current].querySelector("h2");
    if (h) h.setAttribute("tabindex", "-1");
  }

  function goTo(i, skipValidation) {
    if (i > current && !skipValidation && !validateStep(current)) return;
    current = Math.max(0, Math.min(steps.length - 1, i));
    render();
    var card = document.querySelector(".form-card");
    var top = card.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > top + 40) window.scrollTo({ top: top, behavior: "smooth" });
  }

  btnNext.addEventListener("click", function () { goTo(current + 1); });
  btnBack.addEventListener("click", function () { goTo(current - 1, true); });

  /* Enter avanza en lugar de enviar (salvo en el último paso) */
  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA") return;
    if (current < steps.length - 1) { e.preventDefault(); goTo(current + 1); }
  });

  /* ---------------- alertas ---------------- */
  function showAlert(msg) { alertText.textContent = msg; alertBox.classList.add("is-on"); }
  function hideAlert() { alertBox.classList.remove("is-on"); }

  /* ---------------- envío ---------------- */
  function collect() {
    var data = {};
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") data[el.name] = el.checked ? "sí" : "no";
      else data[el.name] = (el.value || "").trim();
    });
    data.areas = selectedAreas().join(", ");
    data.enviado = new Date().toISOString();
    Object.keys(CONFIG.extra).forEach(function (k) { data[k] = CONFIG.extra[k]; });
    return data;
  }

  function setLoading(on) {
    btnSend.disabled = on;
    btnBack.disabled = on;
    var label = btnSend.querySelector(".btn__label");
    var ico = btnSend.querySelector(".ico");
    if (on) {
      label.textContent = "Enviando…";
      ico.style.display = "none";
      if (!btnSend.querySelector(".spinner")) {
        var sp = document.createElement("span");
        sp.className = "spinner";
        btnSend.appendChild(sp);
      }
    } else {
      label.textContent = "Reservar mi consultoría";
      ico.style.display = "";
      var s = btnSend.querySelector(".spinner");
      if (s) s.remove();
    }
  }

  function showSuccess(data) {
    form.style.display = "none";
    document.querySelector(".form-card__head").style.display = "none";
    $("#okName").textContent = (data.nombre || "").split(" ")[0] || "gracias";
    $("#okEmpresa").textContent = data.empresa || "—";
    $("#okEmail").textContent = data.email || "—";
    $("#okAreas").textContent = data.areas || "—";
    successBox.classList.add("is-on");
    var card = document.querySelector(".form-card");
    window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateStep(current)) return;
    var data = collect();
    setLoading(true);
    hideAlert();

    if (!CONFIG.endpoint || OFFLINE) {
      /* Modo demostración: web abierta desde disco o endpoint sin configurar */
      console.info("[Aithera] Modo demostración. Payload que se enviaría:", data);
      console.info("[Aithera] Arranca iniciar-servidor.cmd para guardar las solicitudes de verdad.");
      setTimeout(function () { setLoading(false); showSuccess(data); }, 1100);
      return;
    }

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) {
            var err = new Error(body.error || "HTTP " + r.status);
            err.fields = body.errors;
            throw err;
          }
          return body;
        });
      })
      .then(function () { setLoading(false); showSuccess(data); })
      .catch(function (err) {
        setLoading(false);
        if (err.fields) {
          /* El servidor ha rechazado campos concretos: los marcamos */
          Object.keys(err.fields).forEach(function (name) {
            var el = form.querySelector('[name="' + name + '"]');
            if (el && el.closest(".field")) setError(el.closest(".field"));
          });
          showAlert("Revisa los campos marcados: " +
            Object.keys(err.fields).map(function (k) { return err.fields[k]; }).join(" "));
          return;
        }
        showAlert("No hemos podido enviar tu solicitud (" + err.message +
          "). Inténtalo de nuevo o escríbenos a hola@aitheraautopilot.com.");
      });
  });

  syncAreas();
  render();
})();
