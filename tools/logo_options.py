"""Draws 5 logo options for "They Think It's Checkmate": two pawns with
football heads and football-patterned bodies, one taking a penalty against
the other in goal, with a stand of cartoon fans behind.

Writes docs/design/logo-options/option-1.svg ... option-5.svg.
Run: python3 tools/logo_options.py
"""
import math
import os
import random
from make_logo import ball

INK = "#1b2430"
LIGHT = dict(base="#f4efe2", spot="#1b2430", line="#1b2430", ink=INK)
DARK = dict(base="#24476b", spot="#0c1826", line="#0c1826", ink="#0b1420")
CLARET, SKY = "#7a263a", "#1bb1e7"


def pawn_path(cx, base, s):
    w = lambda v: v * s
    return (f"M{cx-w(78):.1f} {base:.1f}q0 {-w(26):.1f} {w(18):.1f} {-w(30):.1f}"
            f"c{w(24):.1f} {-w(6):.1f} {w(34):.1f} {-w(30):.1f} {w(36):.1f} {-w(76):.1f}"
            f"l{w(2):.1f} {-w(30):.1f}h{w(44):.1f}l{w(2):.1f} {w(30):.1f}"
            f"c{w(2):.1f} {w(46):.1f} {w(12):.1f} {w(70):.1f} {w(36):.1f} {w(76):.1f}"
            f"q{w(18):.1f} {w(4):.1f} {w(18):.1f} {w(30):.1f}z")


def hexes(x0, y0, x1, y1, h, base, spot, line, sw):
    """Football-style tessellation: hexagons, every third one filled dark."""
    out = []
    dx, dy = math.sqrt(3) * h, 1.5 * h
    for row in range(int((y1 - y0) / dy) + 3):
        for col in range(int((x1 - x0) / dx) + 3):
            cx = x0 + col * dx + (dx / 2 if row % 2 else 0) - dx
            cy = y0 + row * dy - dy
            q = col - (row - (row & 1)) // 2
            fill = spot if (q - row) % 3 == 0 else base
            pts = " ".join(f"{cx+h*math.cos(math.radians(30+60*k)):.1f},{cy+h*math.sin(math.radians(30+60*k)):.1f}" for k in range(6))
            out.append(f'<polygon points="{pts}" fill="{fill}" stroke="{line}" stroke-width="{sw:.1f}"/>')
    return "".join(out)


def ppawn(cx, base, s, kit, uid, gloves=False, shadow=True):
    """A pawn with a football head and a football-patterned body."""
    w = lambda v: v * s
    d = pawn_path(cx, base, s)
    collar = (cx - w(46), base - w(146), w(92), w(20))
    out = []
    if shadow:
        out.append(f'<ellipse cx="{cx}" cy="{base+w(4):.1f}" rx="{w(86):.1f}" ry="{w(12):.1f}" fill="#000" opacity=".25"/>')
    out.append(f'<clipPath id="c{uid}"><path d="{d}"/><rect x="{collar[0]:.1f}" y="{collar[1]:.1f}" width="{collar[2]:.1f}" height="{collar[3]:.1f}" rx="{w(10):.1f}"/></clipPath>')
    out.append(f'<g clip-path="url(#c{uid})">' + hexes(cx - w(90), base - w(160), cx + w(90), base + w(5), w(15), kit["base"], kit["spot"], kit["line"], w(2.4))
               + f'<path d="M{cx-w(40):.1f} {base-w(120):.1f}q{-w(4):.1f} {w(60):.1f} {-w(40):.1f} {w(100):.1f}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="{w(10):.1f}" stroke-linecap="round"/></g>')
    out.append(f'<path d="{d}" fill="none" stroke="{kit["ink"]}" stroke-width="{w(9):.1f}" stroke-linejoin="round"/>')
    out.append(f'<rect x="{collar[0]:.1f}" y="{collar[1]:.1f}" width="{collar[2]:.1f}" height="{collar[3]:.1f}" rx="{w(10):.1f}" fill="none" stroke="{kit["ink"]}" stroke-width="{w(9):.1f}"/>')
    out.append(ball(cx, base - w(196), w(56), f"h{uid}", kit["ink"]))
    if gloves:
        for sx in (-1, 1):
            gx, gy = cx + sx * w(84), base - w(170)
            out.append(f'<g transform="rotate({sx*18} {gx:.1f} {gy:.1f})"><rect x="{gx-w(20):.1f}" y="{gy-w(26):.1f}" width="{w(40):.1f}" height="{w(46):.1f}" rx="{w(14):.1f}" fill="#ff8a1f" stroke="{kit["ink"]}" stroke-width="{w(7):.1f}"/>'
                       f'<path d="M{gx-w(8):.1f} {gy-w(26):.1f}v{w(16):.1f}M{gx+w(4):.1f} {gy-w(26):.1f}v{w(16):.1f}" stroke="{kit["ink"]}" stroke-width="{w(4):.1f}"/></g>')
    return "".join(out)


def matchball(cx, cy, r, uid):
    return f'<ellipse cx="{cx}" cy="{cy+r*0.95:.1f}" rx="{r*1.1:.1f}" ry="{r*0.28:.1f}" fill="#000" opacity=".25"/>' + ball(cx, cy, r, f"m{uid}")


def fans(x0, x1, y0, y1, rows, seed, s=1.0, night=False):
    """A stand of cartoon fans, some with arms up or scarves held high."""
    rnd = random.Random(seed)
    shirts = [CLARET, SKY, CLARET, "#ffffff", "#0057b8", CLARET, SKY, "#ffd400"]
    skins = ["#f2c9a0", "#d9a273", "#a8693f", "#6b4027", "#f7d7b8"]
    hair = ["#2b1d14", "#5a3a1e", "#e3c06a", "#1b1b1b", "#9a4a22", None]
    stand = "#33404d" if not night else "#151d29"
    tier = "#3f4e5d" if not night else "#1d2838"
    out = [f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{stand}"/>']
    rh = (y1 - y0) / rows
    for r in range(rows):
        out.append(f'<rect x="{x0}" y="{y0+(r+1)*rh-rh*0.28:.1f}" width="{x1-x0}" height="{rh*0.28:.1f}" fill="{tier}"/>')
    for r in range(rows):
        base = y0 + (r + 1) * rh - rh * 0.22
        step = 21 * s
        x = x0 + (step / 2 if r % 2 else 0) + rnd.uniform(-3, 3)
        while x < x1 + step:
            hx = x + rnd.uniform(-2, 2) * s
            hr = 6.2 * s
            hy = base - 11 * s - rnd.uniform(0, 3) * s
            shirt = rnd.choice(shirts)
            act = rnd.random()
            if act < 0.22:  # arms up
                for sx in (-1, 1):
                    out.append(f'<path d="M{hx+sx*6*s:.1f} {base-6*s:.1f}l{sx*5*s:.1f} {-17*s:.1f}" stroke="{shirt}" stroke-width="{3.4*s:.1f}" stroke-linecap="round"/>'
                               f'<circle cx="{hx+sx*11*s:.1f}" cy="{base-24*s:.1f}" r="{2.2*s:.1f}" fill="{skins[0]}"/>')
            elif act < 0.34:  # scarf held high
                col = rnd.choice([CLARET, SKY])
                out.append(f'<path d="M{hx-13*s:.1f} {base-26*s:.1f}h{26*s:.1f}" stroke="{col}" stroke-width="{5*s:.1f}"/>'
                           f'<path d="M{hx-13*s:.1f} {base-26*s:.1f}h{26*s:.1f}" stroke="{SKY if col==CLARET else CLARET}" stroke-width="{5*s:.1f}" stroke-dasharray="{4*s:.1f} {4*s:.1f}"/>')
            out.append(f'<path d="M{hx-9*s:.1f} {base:.1f}a{9*s:.1f} {9*s:.1f} 0 0 1 {18*s:.1f} 0z" fill="{shirt}"/>')
            skin = rnd.choice(skins)
            out.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{hr:.1f}" fill="{skin}"/>')
            hc = rnd.choice(hair)
            if hc:
                out.append(f'<path d="M{hx-hr:.1f} {hy-0.5*s:.1f}a{hr:.1f} {hr:.1f} 0 0 1 {2*hr:.1f} 0q{-hr:.1f} {-2.6*s:.1f} {-2*hr:.1f} 0z" fill="{hc}"/>')
            if not night:
                out.append(f'<circle cx="{hx-2.2*s:.1f}" cy="{hy:.1f}" r="{0.9*s:.1f}" fill="#1b1b1b"/><circle cx="{hx+2.2*s:.1f}" cy="{hy:.1f}" r="{0.9*s:.1f}" fill="#1b1b1b"/>'
                           f'<ellipse cx="{hx:.1f}" cy="{hy+2.8*s:.1f}" rx="{1.6*s:.1f}" ry="{1.3*s:.1f}" fill="#5b1620"/>')
            elif rnd.random() < 0.15:
                out.append(f'<circle cx="{hx+8*s:.1f}" cy="{hy-10*s:.1f}" r="{1.8*s:.1f}" fill="#fff8d0"/>')
            x += step + rnd.uniform(-2, 3) * s
    return "".join(out)


def goal(x0, x1, ytop, yg, uid, post="#ffffff"):
    w = x1 - x0
    net = [f'<clipPath id="n{uid}"><rect x="{x0}" y="{ytop}" width="{w}" height="{yg-ytop}"/></clipPath><g clip-path="url(#n{uid})" stroke="#fff" stroke-opacity=".5" stroke-width="1.6">']
    sp = max(9, w / 22)
    k = -int((yg - ytop) / sp) - 1
    while k * sp < w + (yg - ytop):
        net.append(f'<path d="M{x0+k*sp:.1f} {ytop}l{yg-ytop} {yg-ytop}M{x0+k*sp:.1f} {yg}l{yg-ytop} {ytop-yg}"/>')
        k += 1
    net.append("</g>")
    pw = max(5, w / 34)
    return ("".join(net)
            + f'<rect x="{x0+pw*0.6:.1f}" y="{ytop+pw*0.6:.1f}" width="{w-pw*1.2:.1f}" height="{yg-ytop-pw*0.6:.1f}" fill="#000" opacity=".12"/>'
            + f'<path d="M{x0} {yg}V{ytop}H{x1}V{yg}" fill="none" stroke="#1b2430" stroke-opacity=".35" stroke-width="{pw+3:.1f}" stroke-linejoin="round"/>'
            + f'<path d="M{x0} {yg}V{ytop}H{x1}V{yg}" fill="none" stroke="{post}" stroke-width="{pw:.1f}" stroke-linejoin="round"/>')


def stripes(y0, y1, n, a="#278a42", b="#2f9a4c"):
    h = (y1 - y0) / n
    return "".join(f'<rect x="0" y="{y0+i*h:.1f}" width="512" height="{h+0.5:.1f}" fill="{b if i%2 else a}"/>' for i in range(n))


def chess_pitch(y0, y1, a="#278a42", b="#33a150", vy=-260, cols=10, rows=7):
    """The pitch mown as a chessboard, in perspective."""
    out = []
    xs = lambda y, i: 256 + (i - cols / 2) * (512 / cols) * 1.5 * (y - vy) / (512 - vy)
    ys = [y0 + (y1 - y0) * ((i / rows) ** 1.35) for i in range(rows + 1)]
    for r in range(rows):
        for c in range(cols):
            p = [(xs(ys[r], c), ys[r]), (xs(ys[r], c + 1), ys[r]), (xs(ys[r + 1], c + 1), ys[r + 1]), (xs(ys[r + 1], c), ys[r + 1])]
            out.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in p)}" fill="{a if (r+c)%2 else b}"/>')
    return "".join(out)


def lines_front(yg, box_top_w=300, six_w=170, depth=48, alpha=".85"):
    return (f'<g fill="none" stroke="#fff" stroke-opacity="{alpha}" stroke-width="5" stroke-linejoin="round">'
            f'<path d="M0 {yg}H512"/>'
            f'<path d="M{256-six_w/2} {yg}L{256-six_w/2-14} {yg+depth}H{256+six_w/2+14}L{256+six_w/2} {yg}"/>'
            f'<path d="M{256-box_top_w/2} {yg}L{256-box_top_w/2-60} {yg+depth*3.2}H{256+box_top_w/2+60}L{256+box_top_w/2} {yg}"/></g>')


def frame(inner, rounded=True, bg="#278a42"):
    clip = '<clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath>' if rounded else ""
    g = f'<g clip-path="url(#r)">' if rounded else "<g>"
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{clip}{g}<rect width="512" height="512" fill="{bg}"/>{inner}</g></svg>'


def spot(cx, cy):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="11" ry="4" fill="#fff" opacity=".9"/>'


def option1():
    """Spot kick: from behind the taker, keeper on his line, full stand behind."""
    s = [fans(0, 512, 0, 178, 6, 1),
         '<rect x="0" y="170" width="512" height="14" fill="#c7ccd2"/><rect x="0" y="178" width="512" height="6" fill="#7a263a"/>',
         stripes(184, 512, 6), lines_front(292),
         goal(146, 366, 188, 292, 1),
         ppawn(256, 290, 0.42, DARK, "k1", gloves=True),
         spot(296, 418), matchball(296, 400, 19, 1),
         ppawn(178, 500, 0.8, LIGHT, "t1")]
    return frame("".join(s))


def option2():
    """Face-off: big pawns eye to eye, goal frame behind the keeper."""
    s = [fans(0, 512, 0, 150, 5, 2, s=0.95),
         '<rect x="0" y="146" width="512" height="10" fill="#c7ccd2"/>',
         stripes(156, 512, 5),
         '<path d="M0 330H512" stroke="#fff" stroke-opacity=".85" stroke-width="6"/>',
         goal(250, 560, 120, 330, 2),
         ppawn(372, 328, 0.7, DARK, "k2", gloves=True),
         spot(196, 470), matchball(196, 446, 26, 2),
         ppawn(118, 500, 0.92, LIGHT, "t2")]
    return frame("".join(s))


def option3():
    """The dive: keeper goes the wrong way, ball flies into the top corner."""
    k = ppawn(0, 0, 0.42, DARK, "k3", gloves=True, shadow=False)
    streaks = "".join(f'<path d="M{262+i*9} {392-i*4}Q{300+i*6} {300-i*10} {336} {222+i*6}" fill="none" stroke="#fff" stroke-opacity="{.55-i*.15:.2f}" stroke-width="{5-i}" stroke-linecap="round" stroke-dasharray="14 10"/>' for i in range(3))
    s = [fans(0, 512, 0, 178, 6, 3),
         '<rect x="0" y="170" width="512" height="14" fill="#c7ccd2"/><rect x="0" y="178" width="512" height="6" fill="#1bb1e7"/>',
         stripes(184, 512, 6), lines_front(292),
         goal(146, 366, 188, 292, 3),
         f'<g transform="translate(206 262) rotate(-62)">{k}</g>',
         '<ellipse cx="214" cy="292" rx="34" ry="6" fill="#000" opacity=".2"/>',
         streaks, ball(338, 214, 15, "m3"),
         spot(262, 418),
         ppawn(244, 506, 0.76, LIGHT, "t3")]
    return frame("".join(s))


def option4():
    """Club crest: the penalty inside a roundel with the name around it."""
    inner = [fans(0, 512, 60, 226, 6, 4, s=1.0),
             '<rect x="0" y="222" width="512" height="10" fill="#c7ccd2"/>',
             chess_pitch(232, 512, vy=-120, cols=8, rows=6),
             '<path d="M0 316H512" stroke="#fff" stroke-width="5" stroke-opacity=".85"/>',
             goal(170, 342, 236, 316, 4),
             ppawn(256, 314, 0.33, DARK, "k4", gloves=True),
             spot(290, 400), matchball(290, 384, 15, 4),
             ppawn(196, 470, 0.62, LIGHT, "t4")]
    s = ['<rect width="512" height="512" fill="#7a263a"/>',
         '<circle cx="256" cy="256" r="244" fill="#1b2430"/>',
         '<circle cx="256" cy="256" r="236" fill="none" stroke="#e8c26a" stroke-width="5"/>',
         '<clipPath id="crest"><circle cx="256" cy="256" r="176"/></clipPath>',
         '<g clip-path="url(#crest)"><g transform="translate(256 256) scale(.75) translate(-256 -280)">' + "".join(inner) + '</g></g>',
         '<circle cx="256" cy="256" r="176" fill="none" stroke="#e8c26a" stroke-width="6"/>',
         '<path id="arcTop" d="M60 256A196 196 0 0 1 452 256" fill="none"/>',
         '<path id="arcBot" d="M78 262A178 178 0 0 0 434 262" fill="none"/>',
         '<text font-family="Oswald, \'Arial Narrow\', sans-serif" font-weight="700" font-size="44" letter-spacing="3" fill="#f4efe2"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">THEY THINK IT\'S</textPath></text>',
         '<text font-family="Oswald, \'Arial Narrow\', sans-serif" font-weight="700" font-size="40" letter-spacing="6" fill="#e8c26a" dominant-baseline="hanging"><textPath href="#arcBot" startOffset="50%" text-anchor="middle">CHECKMATE</textPath></text>',
         '<g fill="#e8c26a"><circle cx="58" cy="256" r="7"/><circle cx="454" cy="256" r="7"/></g>']
    return frame("".join(s), bg="#7a263a")


def option5():
    """Under the lights: night match, floodlights, pitch mown as a chessboard."""
    glow = '<radialGradient id="glow"><stop offset="0" stop-color="#fffbe0" stop-opacity=".95"/><stop offset=".25" stop-color="#fff3b0" stop-opacity=".45"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>'
    sky = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1530"/><stop offset="1" stop-color="#25406b"/></linearGradient>'
    lights = ""
    for x in (122, 390):
        lights += (f'<path d="M{x} 110V60" stroke="#0d1420" stroke-width="7"/>'
                   f'<rect x="{x-30}" y="34" width="60" height="30" rx="4" fill="#0d1420"/>'
                   + "".join(f'<circle cx="{x-20+c*13.3:.1f}" cy="{42+r*14}" r="5" fill="#fffbe0"/>' for r in range(2) for c in range(4))
                   + f'<circle cx="{x}" cy="49" r="110" fill="url(#glow)"/>')
    beams = '<path d="M122 64L-20 512H200z M390 64L532 512H312z" fill="#fff6c8" opacity=".07"/>'
    stars = "".join(f'<circle cx="{x}" cy="{y}" r="1.4" fill="#fff" opacity=".7"/>' for x, y in [(150, 22), (210, 46), (300, 18), (360, 40), (250, 30), (395, 14), (120, 50)])
    s = [f'<defs>{glow}{sky}</defs><rect width="512" height="512" fill="url(#sky)"/>', stars, lights,
         fans(0, 512, 120, 250, 5, 5, s=0.9, night=True),
         '<path d="M0 120L40 100H472L512 120z" fill="#0d1420"/>',
         '<rect x="0" y="246" width="512" height="8" fill="#7a263a"/>',
         chess_pitch(254, 512, vy=-200),
         '<path d="M0 330H512" stroke="#fff" stroke-width="5" stroke-opacity=".9"/>',
         goal(160, 352, 244, 330, 5),
         ppawn(256, 328, 0.37, DARK, "k5", gloves=True),
         spot(292, 428), matchball(292, 410, 18, 5),
         ppawn(186, 506, 0.76, LIGHT, "t5"),
         beams]
    return frame("".join(s), bg="#0b1530")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "docs", "design", "logo-options")
    os.makedirs(out, exist_ok=True)
    for i, f in enumerate([option1, option2, option3, option4, option5], 1):
        open(os.path.join(out, f"option-{i}.svg"), "w").write(f())
