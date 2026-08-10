/* =============================================================
   AITHERA ORB — núcleo animado del hero
   Render 3D propio sobre canvas 2D con pase de bloom aditivo.
   Sin dependencias. Bucle infinito, pausa fuera de viewport.
   ============================================================= */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- utilidades ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Ruido determinista (para titileo estable) */
  function hash(n) {
    var s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ---------- clase principal ---------- */
  function Orb(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.bloom = document.createElement("canvas");
    this.bctx = this.bloom.getContext("2d");
    this.t = 0;
    this.rotY = 0;
    this.mx = 0; this.my = 0;      // objetivo de parallax
    this.px = 0; this.py = 0;      // parallax suavizado
    this.running = false;
    this.supportsFilter = typeof this.ctx.filter === "string";

    this.buildGeometry();
    this.resize();
    this.bind();
  }

  /* ---------- geometría ---------- */
  Orb.prototype.buildGeometry = function () {
    var i, n;

    /* Campo de partículas: distribución en espiral áurea sobre la esfera */
    this.parts = [];
    n = 340;
    var ga = Math.PI * (3 - Math.sqrt(5));
    for (i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;
      var rad = Math.sqrt(Math.max(0, 1 - y * y));
      var th = ga * i;
      var jitter = 0.82 + hash(i * 3.7) * 0.2;
      this.parts.push({
        x: Math.cos(th) * rad * jitter,
        y: y * jitter,
        z: Math.sin(th) * rad * jitter,
        s: 0.45 + hash(i * 7.1) * 1.05,
        a: 0.2 + hash(i * 11.3) * 0.65,
        ph: hash(i * 5.9) * TAU,
        sp: 0.6 + hash(i * 2.3) * 1.9
      });
    }

    /* Partículas interiores (profundidad) */
    this.inner = [];
    for (i = 0; i < 110; i++) {
      var u = hash(i * 13.1) * TAU;
      var v = Math.acos(2 * hash(i * 17.7) - 1);
      var r = 0.18 + Math.pow(hash(i * 19.3), 0.6) * 0.62;
      this.inner.push({
        x: r * Math.sin(v) * Math.cos(u),
        y: r * Math.cos(v),
        z: r * Math.sin(v) * Math.sin(u),
        s: 0.35 + hash(i * 23.9) * 0.75,
        a: 0.14 + hash(i * 29.1) * 0.4,
        ph: hash(i * 31.7) * TAU,
        sp: 0.8 + hash(i * 37.3) * 2.2
      });
    }

    /* Anillos orbitales: r, tiltX, tiltZ, color, alpha, grosor, satélite */
    this.rings = [
      { r: 1.00, tx: 0.05, tz: 0.00, c: [130, 246, 236], a: 0.62, w: 1.35, dots: 56, sat: 0, spin: 0.00 },
      { r: 0.88, tx: 1.32, tz: 0.22, c: [86, 214, 232], a: 0.40, w: 1.05, dots: 0, sat: 1, spin: 0.55 },
      { r: 0.76, tx: 1.16, tz: -0.62, c: [110, 236, 210], a: 0.34, w: 1.0, dots: 0, sat: 1, spin: -0.72 },
      { r: 0.63, tx: 1.44, tz: 1.05, c: [96, 226, 240], a: 0.30, w: 0.95, dots: 0, sat: 1, spin: 0.9 },
      { r: 1.14, tx: 1.50, tz: 0.78, c: [70, 190, 205], a: 0.17, w: 0.8, dots: 0, sat: 0, spin: -0.35 },
      { r: 0.50, tx: 0.95, tz: 2.05, c: [130, 250, 200], a: 0.26, w: 0.9, dots: 0, sat: 1, spin: 1.25 },
      { r: 1.32, tx: 0.08, tz: 0.00, c: [72, 196, 208], a: 0.20, w: 0.75, dots: 34, sat: 0, spin: 0.0 }
    ];
    /* Precálculo de puntos unitarios del círculo */
    this.circle = [];
    var SEG = 128;
    for (i = 0; i <= SEG; i++) {
      var an = (i / SEG) * TAU;
      this.circle.push([Math.cos(an), Math.sin(an)]);
    }

    /* Latitudes tenues */
    this.lats = [-0.62, -0.32, 0, 0.32, 0.62];

    /* Pulsos de energía */
    this.pulses = [0, 1.15, 2.3];
  };

  /* ---------- dimensionado ---------- */
  Orb.prototype.resize = function () {
    var rect = this.cv.getBoundingClientRect();
    var dpr = clamp(window.devicePixelRatio || 1, 1, 1.9);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.bw = Math.max(1, Math.round(w * 0.5));
    this.bh = Math.max(1, Math.round(h * 0.5));
    this.bloom.width = this.bw;
    this.bloom.height = this.bh;

    this.cx = w * 0.5;
    this.cy = h * 0.47;
    this.R = Math.min(w * 0.298, h * 0.395);
  };

  /* ---------- proyección ---------- */
  Orb.prototype.project = function (x, y, z) {
    /* rotación global Y */
    var cy1 = Math.cos(this.rotY), sy1 = Math.sin(this.rotY);
    var x1 = x * cy1 + z * sy1;
    var z1 = -x * sy1 + z * cy1;
    /* inclinación X (parallax + fijo) */
    var ax = -0.16 + this.py * 0.28;
    var cx1 = Math.cos(ax), sx1 = Math.sin(ax);
    var y2 = y * cx1 - z1 * sx1;
    var z2 = y * sx1 + z1 * cx1;
    /* parallax Y adicional */
    var ay = this.px * 0.34;
    var cy2 = Math.cos(ay), sy2 = Math.sin(ay);
    var x3 = x1 * cy2 + z2 * sy2;
    var z3 = -x1 * sy2 + z2 * cy2;

    var f = 3.1;
    var s = f / (f + z3);
    return {
      x: this.cx + x3 * this.R * s,
      y: this.cy + y2 * this.R * s,
      s: s,
      z: z3
    };
  };

  /* Aplica orientación fija de un anillo (tiltX luego tiltZ) */
  function orient(cx, cy, tx, tz) {
    // punto en plano XY del anillo -> 3D
    var x = cx, y = cy, z = 0;
    // rot X
    var c = Math.cos(tx), s = Math.sin(tx);
    var y1 = y * c - z * s, z1 = y * s + z * c;
    // rot Z
    var c2 = Math.cos(tz), s2 = Math.sin(tz);
    var x2 = x * c2 - y1 * s2, y2 = x * s2 + y1 * c2;
    return [x2, y2, z1];
  }

  /* ---------- dibujo ---------- */
  Orb.prototype.draw = function () {
    var ctx = this.ctx, R = this.R, cx = this.cx, cy = this.cy, t = this.t;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "lighter";

    this.drawAura();
    this.drawBase();
    this.drawBeam();
    this.drawParticles(this.inner, 0.75);
    this.drawLatitudes();
    this.drawRings(true);
    this.drawParticles(this.parts, 1);
    this.drawRings(false);
    this.drawPulses();
    this.drawCore();

    ctx.globalCompositeOperation = "source-over";
    this.applyBloom();
  };

  Orb.prototype.drawAura = function () {
    var ctx = this.ctx, R = this.R;
    var g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, R * 2.0);
    g.addColorStop(0, "rgba(46,214,190,0.20)");
    g.addColorStop(0.32, "rgba(30,150,160,0.10)");
    g.addColorStop(0.66, "rgba(16,80,92,0.045)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  };

  /* Plataforma inferior con radios */
  Orb.prototype.drawBase = function () {
    var ctx = this.ctx, R = this.R, cx = this.cx;
    var by = this.cy + R * (1.16 + this.py * 0.06);
    var t = this.t;

    ctx.save();
    /* radios */
    var N = 64;
    var outer = R * 1.52;
    for (var i = 0; i < N; i++) {
      var a = (i / N) * TAU;
      var wave = 0.5 + 0.5 * Math.sin(a * 3 - t * 1.5);
      var al = (0.035 + wave * 0.075) * (1 - Math.abs(Math.sin(a)) * 0.35);
      var rx = Math.cos(a) * outer;
      var ry = Math.sin(a) * outer * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx + rx * 0.18, by + ry * 0.18);
      ctx.lineTo(cx + rx, by + ry);
      ctx.strokeStyle = "rgba(88,222,214," + al.toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    /* elipses concéntricas */
    var rings = [0.42, 0.72, 1.02, 1.3, 1.52];
    for (var k = 0; k < rings.length; k++) {
      var rr = R * rings[k];
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.1 - k * 0.7);
      var alpha = (0.30 - k * 0.045) * (0.72 + pulse * 0.4);
      ctx.beginPath();
      ctx.ellipse(cx, by, rr, rr * 0.2, 0, 0, TAU);
      ctx.strokeStyle = "rgba(96,232,220," + Math.max(0, alpha).toFixed(3) + ")";
      ctx.lineWidth = k === 2 ? 1.2 : 0.8;
      ctx.stroke();
    }
    /* núcleo de la base */
    var g = ctx.createRadialGradient(cx, by, 0, cx, by, R * 0.62);
    g.addColorStop(0, "rgba(120,255,225,0.34)");
    g.addColorStop(0.4, "rgba(60,210,200,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, by, R * 0.62, R * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /* Columna de luz vertical */
  Orb.prototype.drawBeam = function () {
    var ctx = this.ctx, R = this.R, cx = this.cx, cy = this.cy;
    var by = cy + R * 1.16;
    var w = R * 0.16 * (0.9 + 0.14 * Math.sin(this.t * 1.6));
    var g = ctx.createLinearGradient(0, cy, 0, by);
    g.addColorStop(0, "rgba(110,255,215,0.20)");
    g.addColorStop(0.7, "rgba(70,220,205,0.07)");
    g.addColorStop(1, "rgba(70,220,205,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy);
    ctx.lineTo(cx + w * 0.3, cy);
    ctx.lineTo(cx + w, by);
    ctx.lineTo(cx - w, by);
    ctx.closePath();
    ctx.fill();
  };

  Orb.prototype.drawParticles = function (list, mul) {
    var ctx = this.ctx, t = this.t;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var q = this.project(p.x, p.y, p.z);
      var depth = clamp((q.s - 0.72) / 0.62, 0, 1);
      var tw = 0.62 + 0.38 * Math.sin(t * p.sp + p.ph);
      var a = p.a * mul * (0.28 + depth * 0.85) * tw;
      if (a <= 0.012) continue;
      var r = p.s * q.s * mul;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fillStyle = "rgba(" +
        Math.round(lerp(120, 190, depth)) + "," +
        Math.round(lerp(220, 255, depth)) + "," +
        Math.round(lerp(215, 240, depth)) + "," + a.toFixed(3) + ")";
      ctx.fill();
    }
  };

  Orb.prototype.drawLatitudes = function () {
    var ctx = this.ctx;
    for (var k = 0; k < this.lats.length; k++) {
      var y = this.lats[k];
      var rr = Math.sqrt(Math.max(0, 1 - y * y)) * 0.995;
      ctx.beginPath();
      for (var i = 0; i < this.circle.length; i++) {
        var c = this.circle[i];
        var q = this.project(c[0] * rr, y, c[1] * rr);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = "rgba(70,190,190,0.055)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };

  /* back=true dibuja la mitad trasera; back=false la delantera */
  Orb.prototype.drawRings = function (back) {
    var ctx = this.ctx, t = this.t;
    for (var k = 0; k < this.rings.length; k++) {
      var ring = this.rings[k];
      var spin = ring.spin * t;
      var col = ring.c;
      ctx.lineWidth = ring.w;

      var prev = null;
      for (var i = 0; i < this.circle.length; i++) {
        var c = this.circle[i];
        var ca = c[0] * Math.cos(spin) - c[1] * Math.sin(spin);
        var sa = c[0] * Math.sin(spin) + c[1] * Math.cos(spin);
        var p3 = orient(ca * ring.r, sa * ring.r, ring.tx, ring.tz);
        var q = this.project(p3[0], p3[1], p3[2]);
        var isBack = q.z > 0;
        if (prev) {
          if (isBack === back) {
            var depth = clamp((q.s - 0.7) / 0.6, 0, 1);
            var a = ring.a * (back ? 0.3 + depth * 0.35 : 0.35 + depth * 0.85);
            /* arco brillante viajero */
            var head = ((t * (0.16 + k * 0.045)) % 1) * this.circle.length;
            var d = Math.abs(i - head);
            d = Math.min(d, this.circle.length - d);
            var boost = Math.exp(-d * d / 260) * (back ? 0.5 : 1.4);
            a = clamp(a + boost * 0.55, 0, 1);
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + a.toFixed(3) + ")";
            ctx.stroke();
          }
        }
        prev = q;

        /* puntos sobre el anillo */
        if (ring.dots && i % Math.round(this.circle.length / ring.dots) === 0 && isBack === back) {
          var da = ring.a * (back ? 0.35 : 1.05) * (0.5 + 0.5 * Math.sin(t * 2 + i));
          ctx.beginPath();
          ctx.arc(q.x, q.y, 1.15 * q.s, 0, TAU);
          ctx.fillStyle = "rgba(190,255,246," + clamp(da, 0, 1).toFixed(3) + ")";
          ctx.fill();
        }
      }

      /* satélite */
      if (ring.sat && !back) {
        var ang = t * (0.55 + k * 0.2) + k * 1.7;
        var sc = Math.cos(ang) * ring.r, ss = Math.sin(ang) * ring.r;
        var sp = orient(sc, ss, ring.tx, ring.tz);
        var sq = this.project(sp[0], sp[1], sp[2]);
        if (sq.z <= 0.05) {
          var rr = 2.2 * sq.s;
          var g = ctx.createRadialGradient(sq.x, sq.y, 0, sq.x, sq.y, rr * 6);
          g.addColorStop(0, "rgba(220,255,248,0.95)");
          g.addColorStop(0.25, "rgba(120,250,220,0.42)");
          g.addColorStop(1, "rgba(120,250,220,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sq.x, sq.y, rr * 6, 0, TAU);
          ctx.fill();
        }
      }
    }
  };

  Orb.prototype.drawPulses = function () {
    var ctx = this.ctx, R = this.R, t = this.t;
    for (var i = 0; i < this.pulses.length; i++) {
      var period = 3.6;
      var ph = ((t + this.pulses[i]) % period) / period;
      var rr = R * (0.16 + ph * 1.16);
      var a = Math.pow(1 - ph, 2.1) * 0.30;
      if (a < 0.004) continue;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, rr, 0, TAU);
      ctx.strokeStyle = "rgba(130,250,210," + a.toFixed(3) + ")";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  };

  /* Semilla central + destellos */
  Orb.prototype.drawCore = function () {
    var ctx = this.ctx, R = this.R, cx = this.cx, cy = this.cy, t = this.t;
    var pulse = 0.5 + 0.5 * Math.sin(t * 1.35);
    var beat = 0.5 + 0.5 * Math.sin(t * 2.7 + 1.1);

    /* destellos radiales largos */
    ctx.save();
    var flare = R * (1.05 + pulse * 0.12);
    var lg = ctx.createLinearGradient(cx - flare, cy, cx + flare, cy);
    lg.addColorStop(0, "rgba(90,240,200,0)");
    lg.addColorStop(0.5, "rgba(150,255,220,0.24)");
    lg.addColorStop(1, "rgba(90,240,200,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(cx - flare, cy - R * 0.011, flare * 2, R * 0.022);
    var vg = ctx.createLinearGradient(cx, cy - flare * 0.82, cx, cy + flare * 0.82);
    vg.addColorStop(0, "rgba(90,240,200,0)");
    vg.addColorStop(0.5, "rgba(150,255,220,0.20)");
    vg.addColorStop(1, "rgba(90,240,200,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(cx - R * 0.009, cy - flare * 0.82, R * 0.018, flare * 1.64);
    ctx.restore();

    /* rayos finos */
    var rays = 16;
    for (var i = 0; i < rays; i++) {
      var a = (i / rays) * TAU + t * 0.08;
      var len = R * (0.4 + 0.34 * hash(i * 3.3));
      var al = 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.8 + i));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.14, cy + Math.sin(a) * R * 0.14);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.strokeStyle = "rgba(140,255,220," + al.toFixed(3) + ")";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    /* hojas de la semilla */
    var H = R * 0.98;
    this.leaf(cx, cy, H * 0.50, H, "rgba(150,246,232,", 0.42 + pulse * 0.16, 1.5);
    this.leaf(cx, cy, H * 0.335, H * 0.70, "rgba(180,255,236,", 0.55 + pulse * 0.2, 1.3);
    this.leaf(cx, cy, H * 0.19, H * 0.41, "rgba(210,255,240,", 0.42 + beat * 0.25, 1.1);

    /* halo del núcleo */
    var hr = R * (0.30 + pulse * 0.045);
    var hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr);
    hg.addColorStop(0, "rgba(190,255,225,0.55)");
    hg.addColorStop(0.22, "rgba(80,245,175,0.30)");
    hg.addColorStop(0.6, "rgba(50,210,170,0.10)");
    hg.addColorStop(1, "rgba(40,200,160,0)");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, TAU);
    ctx.fill();

    /* núcleo brillante */
    var cr = R * (0.062 + beat * 0.012);
    var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    cg.addColorStop(0, "rgba(255,255,255,1)");
    cg.addColorStop(0.32, "rgba(214,255,236,0.96)");
    cg.addColorStop(0.62, "rgba(63,240,154,0.75)");
    cg.addColorStop(1, "rgba(63,240,154,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fill();
  };

  Orb.prototype.leaf = function (cx, cy, w, h, rgb, alpha, lw) {
    var ctx = this.ctx;
    var hw = w, hh = h / 2;
    var k = hw * 0.92;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.bezierCurveTo(cx + k * 0.52, cy - hh * 0.62, cx + hw, cy - hh * 0.28, cx + hw, cy);
    ctx.bezierCurveTo(cx + hw, cy + hh * 0.28, cx + k * 0.52, cy + hh * 0.62, cx, cy + hh);
    ctx.bezierCurveTo(cx - k * 0.52, cy + hh * 0.62, cx - hw, cy + hh * 0.28, cx - hw, cy);
    ctx.bezierCurveTo(cx - hw, cy - hh * 0.28, cx - k * 0.52, cy - hh * 0.62, cx, cy - hh);
    ctx.closePath();
    ctx.strokeStyle = rgb + clamp(alpha, 0, 1).toFixed(3) + ")";
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  Orb.prototype.applyBloom = function () {
    if (!this.supportsFilter) return;
    var ctx = this.ctx;
    this.bctx.clearRect(0, 0, this.bw, this.bh);
    this.bctx.drawImage(this.cv, 0, 0, this.bw, this.bh);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(7px)";
    ctx.globalAlpha = 0.62;
    ctx.drawImage(this.bloom, 0, 0, this.w, this.h);
    ctx.filter = "blur(18px)";
    ctx.globalAlpha = 0.4;
    ctx.drawImage(this.bloom, 0, 0, this.w, this.h);
    ctx.restore();
  };

  /* ---------- bucle ---------- */
  Orb.prototype.frame = function (now) {
    if (!this.running) return;
    var dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    this.rotY += dt * 0.085;
    this.px = lerp(this.px, this.mx, 0.055);
    this.py = lerp(this.py, this.my, 0.055);
    this.draw();
    this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  Orb.prototype.start = function () {
    if (this.running || reduced) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  Orb.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  };

  Orb.prototype.bind = function () {
    var self = this;

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { self.resize(); if (reduced) self.draw(); }, 140);
    }, { passive: true });

    /* Parallax con el puntero */
    window.addEventListener("pointermove", function (e) {
      var r = self.cv.getBoundingClientRect();
      self.mx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width || 1), -1, 1);
      self.my = clamp((e.clientY - (r.top + r.height / 2)) / (r.height || 1), -1, 1);
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) self.stop(); else self.start();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) self.start(); else self.stop();
        });
      }, { rootMargin: "120px" }).observe(this.cv);
    } else {
      this.start();
    }
  };

  /* ---------- arranque ---------- */
  function init() {
    var cv = document.getElementById("orb");
    if (!cv) return;
    var orb = new Orb(cv);
    window.__aitheraOrb = orb;
    if (reduced) { orb.t = 2.2; orb.draw(); } else { orb.start(); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
