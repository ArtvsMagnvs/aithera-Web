/* =============================================================
   AITHERA — aithera.tech
   Lo mínimo: menú móvil y marcado de la sección activa.
   Sin animación: el diseño es estático a propósito.
   ============================================================= */
(function () {
  "use strict";

  /* ---------- menú móvil ---------- */
  var burger = document.getElementById("burger");
  var tnav = document.getElementById("tnav");

  if (burger && tnav) {
    burger.addEventListener("click", function () {
      var open = tnav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    tnav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        tnav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && tnav.classList.contains("is-open")) {
        tnav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        burger.focus();
      }
    });
  }

  /* ---------- sección activa en el raíl y en la cabecera ---------- */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rnav[data-spy]"));
  var topLinks = Array.prototype.slice.call(document.querySelectorAll(".tnav__a[href^='#']"));
  if (!railLinks.length && !topLinks.length) return;

  var watched = [];
  railLinks.forEach(function (a) {
    var el = document.getElementById(a.getAttribute("data-spy"));
    if (el) watched.push({ el: el, link: a, group: "rail" });
  });
  topLinks.forEach(function (a) {
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) watched.push({ el: el, link: a, group: "top" });
  });
  if (!watched.length) return;

  function clear(group) {
    watched.forEach(function (w) {
      if (w.group === group) w.link.classList.remove("is-active");
    });
  }

  if (!("IntersectionObserver" in window)) return;

  var visible = { rail: null, top: null };

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var w = watched.filter(function (x) { return x.el === en.target; })[0];
      if (!w) return;
      w.ratio = en.isIntersecting ? en.intersectionRatio : 0;
    });

    ["rail", "top"].forEach(function (g) {
      var best = null;
      watched.forEach(function (w) {
        if (w.group !== g) return;
        if (w.ratio && (!best || w.ratio > best.ratio)) best = w;
      });
      if (best && best !== visible[g]) {
        clear(g);
        best.link.classList.add("is-active");
        visible[g] = best;
      }
    });
  }, { rootMargin: "-25% 0px -55% 0px", threshold: [0.01, 0.15, 0.4, 0.75] });

  watched.forEach(function (w) { io.observe(w.el); });
})();
