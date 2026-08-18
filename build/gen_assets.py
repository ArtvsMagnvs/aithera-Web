#!/usr/bin/env python3
"""Generador de assets SVG para Aithera Autopilot."""
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img")
os.makedirs(OUT, exist_ok=True)


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)
    print("->", name)


# ---------------------------------------------------------------- LOGO
def leaf(cx, cy, w, h):
    """Path de hoja/semilla (vesica apuntada) centrada en cx,cy."""
    hw, hh = w / 2, h / 2
    k = hw * 0.92
    return (
        f"M{cx},{cy-hh} "
        f"C{cx+k*0.52},{cy-hh*0.62} {cx+hw},{cy-hh*0.28} {cx+hw},{cy} "
        f"C{cx+hw},{cy+hh*0.28} {cx+k*0.52},{cy+hh*0.62} {cx},{cy+hh} "
        f"C{cx-k*0.52},{cy+hh*0.62} {cx-hw},{cy+hh*0.28} {cx-hw},{cy} "
        f"C{cx-hw},{cy-hh*0.28} {cx-k*0.52},{cy-hh*0.62} {cx},{cy-hh} Z"
    )


def logo_svg(size_glow=True):
    cx, cy = 60.0, 74.0
    p1 = leaf(cx, cy, 80, 136)
    p2 = leaf(cx, cy, 55, 96)
    p3 = leaf(cx, cy, 31, 56)
    glow = """
    <filter id="ag" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>""" if size_glow else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 148" fill="none" role="img" aria-label="Aithera">
  <defs>
    <linearGradient id="as1" x1="60" y1="6" x2="60" y2="142" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8ff0e2"/>
      <stop offset=".5" stop-color="#3ad8c6"/>
      <stop offset="1" stop-color="#2fe08f"/>
    </linearGradient>
    <linearGradient id="as2" x1="60" y1="26" x2="60" y2="122" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#b6fff0"/>
      <stop offset="1" stop-color="#45f0a5"/>
    </linearGradient>
    <radialGradient id="acore" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".28" stop-color="#c8ffe4"/>
      <stop offset=".55" stop-color="#3ff09a"/>
      <stop offset="1" stop-color="#3ff09a" stop-opacity="0"/>
    </radialGradient>{glow}
  </defs>
  <path d="{p1}" stroke="url(#as1)" stroke-width="2" opacity=".62"/>
  <path d="{p2}" stroke="url(#as2)" stroke-width="1.7" opacity=".85"/>
  <path d="{p3}" stroke="#8dffd0" stroke-width="1.3" opacity=".55"/>
  <path d="M60 6 60 30 M60 118 60 142" stroke="#9dfbe0" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>
  <circle cx="60" cy="74" r="17" fill="url(#acore)" opacity=".55"{' filter="url(#ag)"' if size_glow else ''}/>
  <circle cx="60" cy="74" r="6.4" fill="url(#acore)"/>
  <circle cx="60" cy="74" r="2.4" fill="#ffffff"/>
</svg>"""


write("logo.svg", logo_svg())
write("favicon.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 148">'
      f'<rect width="120" height="148" fill="#040c0d"/>' + logo_svg(False).split(">", 1)[1])


# ------------------------------------------------------- ESCENAS CASOS
W, H = 800, 520


def head(extra_defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'width="{W}" height="{H}" preserveAspectRatio="xMidYMid slice">\n<defs>{extra_defs}</defs>\n')


def scene_logistica():
    rnd = random.Random(11)
    d = """
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#071c22"/><stop offset=".45" stop-color="#0a2b30"/>
    <stop offset="1" stop-color="#04100f"/>
  </linearGradient>
  <radialGradient id="hz" cx="52%" cy="72%" r="55%">
    <stop offset="0" stop-color="#2c9a86" stop-opacity=".55"/>
    <stop offset="1" stop-color="#2c9a86" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffcf7a" stop-opacity="0"/>
    <stop offset=".5" stop-color="#ffd98f" stop-opacity=".85"/>
    <stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="trail2" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#6ff0d8" stop-opacity="0"/>
    <stop offset=".5" stop-color="#8ffbe6" stop-opacity=".7"/>
    <stop offset="1" stop-color="#6ff0d8" stop-opacity="0"/>
  </linearGradient>
  <filter id="bl"><feGaussianBlur stdDeviation="7"/></filter>
"""
    s = [head(d)]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#hz)"/>')
    # estrellas
    for _ in range(70):
        x, y = rnd.uniform(0, W), rnd.uniform(0, 240)
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(.4,1.1):.1f}" fill="#cfeee8" opacity="{rnd.uniform(.1,.5):.2f}"/>')
    # capas de edificios
    layers = [(0.30, 300, "#06181c", 0.55), (0.55, 250, "#07211f", 0.75), (0.85, 190, "#041416", 1.0)]
    for li, (op, base_y, col, wf) in enumerate(layers):
        x = -30
        while x < W + 40:
            bw = rnd.uniform(34, 92) * (0.8 + li * 0.25)
            bh = rnd.uniform(60, 210) * (1.0 - li * 0.16)
            y = base_y + li * 42 - bh
            s.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{bw:.0f}" height="{bh+260:.0f}" fill="{col}" opacity="{0.55+li*0.2:.2f}"/>')
            # ventanas
            cols = max(1, int(bw // 13))
            rows = max(1, int(bh // 16))
            for c in range(cols):
                for r in range(rows):
                    if rnd.random() > 0.42 - li * 0.08:
                        continue
                    wx = x + 6 + c * 13
                    wy = y + 9 + r * 16
                    if wx > x + bw - 8:
                        continue
                    tone = rnd.random()
                    fill = "#ffd493" if tone > 0.62 else ("#8ff0e0" if tone > 0.28 else "#cfe6ff")
                    s.append(f'<rect x="{wx:.0f}" y="{wy:.0f}" width="4.5" height="6" fill="{fill}" opacity="{rnd.uniform(.25,.9)*(1-li*0.12):.2f}"/>')
            x += bw + rnd.uniform(7, 20)
    # halo bajo
    s.append(f'<ellipse cx="410" cy="430" rx="330" ry="80" fill="#2fbfa2" opacity=".16" filter="url(#bl)"/>')
    # estelas de luz
    for i, (y, sw, grad) in enumerate([(452, 5, "trail"), (474, 7, "trail"), (496, 4, "trail2"), (432, 3, "trail2")]):
        s.append(f'<path d="M-40 {y} C 200 {y-16}, 520 {y+14}, 860 {y-8}" stroke="url(#{grad})" stroke-width="{sw}" fill="none" opacity=".75"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#hz)" opacity=".35"/>')
    s.append("</svg>")
    return "\n".join(s)


def scene_clinicas():
    rnd = random.Random(23)
    d = """
  <linearGradient id="bgc" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#04171c"/><stop offset=".55" stop-color="#06232a"/>
    <stop offset="1" stop-color="#030f12"/>
  </linearGradient>
  <radialGradient id="gl" cx="58%" cy="46%" r="52%">
    <stop offset="0" stop-color="#2fd7e0" stop-opacity=".42"/>
    <stop offset="1" stop-color="#2fd7e0" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="pan" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b3038" stop-opacity=".9"/>
    <stop offset="1" stop-color="#061a1f" stop-opacity=".95"/>
  </linearGradient>
  <filter id="bl2"><feGaussianBlur stdDeviation="6"/></filter>
"""
    s = [head(d)]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#bgc)"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gl)"/>')
    # rejilla
    for x in range(0, W + 1, 40):
        s.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="#7fe6de" stroke-width=".5" opacity=".07"/>')
    for y in range(0, H + 1, 40):
        s.append(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="#7fe6de" stroke-width=".5" opacity=".07"/>')
    # panel principal
    s.append('<rect x="240" y="96" width="420" height="266" rx="10" fill="url(#pan)" stroke="#54cfc8" stroke-opacity=".28"/>')
    s.append('<line x1="240" y1="134" x2="660" y2="134" stroke="#54cfc8" stroke-opacity=".22"/>')
    for i in range(3):
        s.append(f'<circle cx="{262+i*15}" cy="115" r="3.4" fill="#54cfc8" opacity="{.5-i*.12:.2f}"/>')
    # ECG
    pts, x, y = [], 258, 250
    while x < 644:
        step = rnd.choice([12, 16, 20])
        if rnd.random() < 0.22:
            pts += [(x, y), (x + 6, y - 62), (x + 12, y + 34), (x + 18, y)]
            x += 30
        else:
            pts.append((x, y + rnd.uniform(-7, 7)))
            x += step
    dpath = "M" + " L".join(f"{px:.0f} {py:.0f}" for px, py in pts)
    s.append(f'<path d="{dpath}" stroke="#5ff2d6" stroke-width="4" fill="none" opacity=".35" filter="url(#bl2)"/>')
    s.append(f'<path d="{dpath}" stroke="#8ffbe6" stroke-width="1.8" fill="none" opacity=".95"/>')
    # barras inferiores del panel
    for i in range(18):
        bh = rnd.uniform(8, 52)
        s.append(f'<rect x="{260+i*22:.0f}" y="{338-bh:.0f}" width="10" height="{bh:.0f}" rx="2" fill="#4fd9cd" opacity="{rnd.uniform(.18,.6):.2f}"/>')
    # paneles laterales
    for px, py, pw, ph in [(58, 148, 150, 96), (58, 262, 150, 74), (692, 168, 60, 180)]:
        s.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="8" fill="url(#pan)" stroke="#54cfc8" stroke-opacity=".2"/>')
    for i in range(5):
        s.append(f'<rect x="76" y="{170+i*14}" width="{rnd.uniform(40,112):.0f}" height="4" rx="2" fill="#63ded4" opacity="{rnd.uniform(.2,.5):.2f}"/>')
    for i in range(6):
        s.append(f'<rect x="704" y="{188+i*26}" width="36" height="10" rx="3" fill="#63ded4" opacity="{rnd.uniform(.15,.45):.2f}"/>')
    # anillos de escaneo
    for r, o in [(120, .18), (168, .12), (216, .07)]:
        s.append(f'<circle cx="450" cy="238" r="{r}" stroke="#7ff0e6" stroke-opacity="{o}" fill="none" stroke-dasharray="3 9"/>')
    # cruz médica sutil
    s.append('<g opacity=".10" fill="#b8fff4"><rect x="424" y="196" width="52" height="16" rx="4"/><rect x="442" y="178" width="16" height="52" rx="4"/></g>')
    # partículas
    for _ in range(60):
        s.append(f'<circle cx="{rnd.uniform(0,W):.0f}" cy="{rnd.uniform(0,H):.0f}" r="{rnd.uniform(.6,1.8):.1f}" fill="#9ff5ea" opacity="{rnd.uniform(.08,.35):.2f}"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gl)" opacity=".3"/>')
    s.append("</svg>")
    return "\n".join(s)


def scene_inmobiliaria():
    rnd = random.Random(37)
    d = """
  <linearGradient id="bgi" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#08222b"/><stop offset=".5" stop-color="#0a2c2c"/>
    <stop offset="1" stop-color="#03100f"/>
  </linearGradient>
  <radialGradient id="gi" cx="70%" cy="30%" r="60%">
    <stop offset="0" stop-color="#3fb59c" stop-opacity=".38"/>
    <stop offset="1" stop-color="#3fb59c" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fac" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0d2f33"/><stop offset="1" stop-color="#061b1e"/>
  </linearGradient>
  <linearGradient id="fac2" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#123a3c"/><stop offset="1" stop-color="#08242a"/>
  </linearGradient>
  <filter id="bl3"><feGaussianBlur stdDeviation="9"/></filter>
"""
    s = [head(d)]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#bgi)"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gi)"/>')
    for _ in range(50):
        s.append(f'<circle cx="{rnd.uniform(0,W):.0f}" cy="{rnd.uniform(0,200):.0f}" r="{rnd.uniform(.4,1.2):.1f}" fill="#d9f5ef" opacity="{rnd.uniform(.1,.4):.2f}"/>')
    # torres en perspectiva
    towers = [
        (30, 150, 150, "fac", -14),
        (196, 64, 168, "fac2", -8),
        (382, 118, 150, "fac", 6),
        (550, 40, 190, "fac2", 12),
    ]
    for tx, ty, tw, fill, skew in towers:
        th = H - ty + 40
        s.append(f'<g transform="translate({tx} {ty}) skewY({skew*0.18:.2f})">')
        s.append(f'<rect x="0" y="0" width="{tw}" height="{th}" fill="url(#{fill})" stroke="#5fd6c4" stroke-opacity=".16"/>')
        cols = int(tw // 26)
        rows = int((th - 40) // 30)
        for c in range(cols):
            for r in range(rows):
                if rnd.random() < 0.30:
                    continue
                wx, wy = 12 + c * 26, 18 + r * 30
                tone = rnd.random()
                fillc = "#8ff0e0" if tone > 0.55 else ("#cfe9ff" if tone > 0.25 else "#ffd9a0")
                s.append(f'<rect x="{wx}" y="{wy}" width="14" height="18" rx="1" fill="{fillc}" opacity="{rnd.uniform(.12,.72):.2f}"/>')
        # nervadura vertical
        s.append(f'<line x1="{tw*0.5:.0f}" y1="0" x2="{tw*0.5:.0f}" y2="{th}" stroke="#6fe0cc" stroke-opacity=".12"/>')
        s.append("</g>")
    # glow horizonte
    s.append('<ellipse cx="520" cy="150" rx="260" ry="120" fill="#43c8ae" opacity=".14" filter="url(#bl3)"/>')
    # suelo / reflejo
    s.append(f'<rect x="0" y="452" width="{W}" height="{H-452}" fill="#020c0c" opacity=".92"/>')
    for i in range(26):
        x = rnd.uniform(0, W)
        s.append(f'<rect x="{x:.0f}" y="452" width="3" height="{rnd.uniform(10,52):.0f}" fill="#7fe8d6" opacity="{rnd.uniform(.05,.22):.2f}"/>')
    s.append('<line x1="0" y1="452" x2="800" y2="452" stroke="#7fe8d6" stroke-opacity=".22"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gi)" opacity=".25"/>')
    s.append("</svg>")
    return "\n".join(s)


write("case-logistica.svg", scene_logistica())
write("case-clinicas.svg", scene_clinicas())
write("case-inmobiliaria.svg", scene_inmobiliaria())
print("OK")


def scene_ecommerce():
    rnd = random.Random(53)
    d = """
  <linearGradient id="bge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#06202a"/><stop offset=".5" stop-color="#082a2c"/>
    <stop offset="1" stop-color="#030e10"/>
  </linearGradient>
  <radialGradient id="ge" cx="50%" cy="34%" r="58%">
    <stop offset="0" stop-color="#37c5b4" stop-opacity=".4"/>
    <stop offset="1" stop-color="#37c5b4" stop-opacity="0"/>
  </radialGradient>
  <filter id="ble"><feGaussianBlur stdDeviation="8"/></filter>
"""
    s = [head(d)]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#bge)"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ge)"/>')
    # pasillo en perspectiva: estanterias
    vpx, vpy = 400, 250
    for side in (-1, 1):
        for i in range(6):
            k = 0.14 + i * 0.15
            x1 = vpx + side * (60 + i * 118)
            s.append(f'<path d="M{x1} {40+i*8} L{vpx + side*(30+i*40)} {vpy-60} L{vpx + side*(30+i*40)} {vpy+90} L{x1} {H-20-i*6} Z" '
                     f'fill="#08262b" opacity="{0.5-i*0.05:.2f}" stroke="#5fdcd0" stroke-opacity="{0.16-i*0.02:.2f}"/>')
            for r in range(4):
                yy = 80 + r * 92 - i * 4
                s.append(f'<path d="M{x1} {yy} L{vpx + side*(30+i*40)} {vpy - 40 + r*46}" stroke="#6fe6d8" stroke-opacity="{rnd.uniform(.08,.22):.2f}" stroke-width="1.4"/>')
    # cajas iluminadas
    for _ in range(46):
        bx, by = rnd.uniform(40, 760), rnd.uniform(90, 430)
        bw2 = rnd.uniform(12, 30)
        s.append(f'<rect x="{bx:.0f}" y="{by:.0f}" width="{bw2:.0f}" height="{bw2*0.72:.0f}" rx="2" '
                 f'fill="#0e3a3c" stroke="#7ff0dd" stroke-opacity="{rnd.uniform(.15,.5):.2f}"/>')
    # halo central
    s.append('<ellipse cx="400" cy="250" rx="230" ry="150" fill="#3fdcc4" opacity=".18" filter="url(#ble)"/>')
    # suelo
    s.append(f'<path d="M0 {H} L280 300 L520 300 L800 {H} Z" fill="#02100f" opacity=".85"/>')
    for i in range(14):
        s.append(f'<line x1="{-100+i*90}" y1="{H}" x2="{330+i*10}" y2="300" stroke="#6fe6d8" stroke-opacity="{rnd.uniform(.05,.16):.2f}"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ge)" opacity=".25"/>')
    s.append("</svg>")
    return "\n".join(s)


def scene_servicios():
    rnd = random.Random(71)
    d = """
  <linearGradient id="bgs" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#051a20"/><stop offset=".6" stop-color="#07272b"/>
    <stop offset="1" stop-color="#02100f"/>
  </linearGradient>
  <radialGradient id="gs" cx="34%" cy="28%" r="60%">
    <stop offset="0" stop-color="#3ec9b8" stop-opacity=".36"/>
    <stop offset="1" stop-color="#3ec9b8" stop-opacity="0"/>
  </radialGradient>
  <filter id="bls"><feGaussianBlur stdDeviation="7"/></filter>
"""
    s = [head(d)]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#bgs)"/>')
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gs)"/>')
    # red de nodos
    nodes = [(rnd.uniform(60, 740), rnd.uniform(60, 440)) for _ in range(26)]
    for i, (x1, y1) in enumerate(nodes):
        for j in range(i + 1, len(nodes)):
            x2, y2 = nodes[j]
            dd = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5
            if dd < 145:
                s.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#6fe6d8" stroke-opacity="{max(0.04, .3-dd/500):.2f}"/>')
    for (x1, y1) in nodes:
        r = rnd.uniform(2.2, 5.4)
        s.append(f'<circle cx="{x1:.0f}" cy="{y1:.0f}" r="{r*3:.1f}" fill="#5fe0cf" opacity=".12" filter="url(#bls)"/>')
        s.append(f'<circle cx="{x1:.0f}" cy="{y1:.0f}" r="{r:.1f}" fill="#a8fbe9" opacity="{rnd.uniform(.4,.9):.2f}"/>')
    # documentos flotantes
    for dx, dy, dw, dh, rot in [(120, 300, 120, 150, -8), (300, 250, 130, 165, 4), (560, 290, 118, 148, 10)]:
        s.append(f'<g transform="rotate({rot} {dx+dw/2} {dy+dh/2})">'
                 f'<rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" rx="6" fill="#082b30" stroke="#66e0d2" stroke-opacity=".3"/>')
        for k in range(6):
            s.append(f'<rect x="{dx+14}" y="{dy+22+k*20}" width="{rnd.uniform(30,dw-28):.0f}" height="5" rx="2.5" fill="#7ff0e0" opacity="{rnd.uniform(.18,.5):.2f}"/>')
        s.append("</g>")
    s.append(f'<rect width="{W}" height="{H}" fill="url(#gs)" opacity=".3"/>')
    s.append("</svg>")
    return "\n".join(s)


write("case-ecommerce.svg", scene_ecommerce())
write("case-servicios.svg", scene_servicios())
