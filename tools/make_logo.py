"""Draws the game logo: two pawns with footballs for heads on a pitch.

Writes public/icons/logo.svg (rounded, for favicon and menus) and
public/icons/logo-maskable.svg (full bleed, artwork inside the safe zone).
PNG sizes are rendered from these with a headless browser; see public/icons/README.md.
Run: python3 tools/make_logo.py
"""
import os
import math
def pent(cx,cy,r,rot):
    return " ".join(f"{cx+r*math.cos(math.radians(rot+72*k)):.1f},{cy+r*math.sin(math.radians(rot+72*k)):.1f}" for k in range(5))
def ball(cx,cy,R,cid,ink="#1b2430"):
    out=[f'<clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath>',
         f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#fff"/>',f'<g clip-path="url(#{cid})">']
    p=0.34*R
    out.append(f'<polygon points="{pent(cx,cy,p,-90)}" fill="{ink}"/>')
    for k in range(5):
        a=math.radians(-90+72*k); vx,vy=cx+p*math.cos(a),cy+p*math.sin(a)
        b=-90+36+72*k; ox,oy=cx+1.02*R*math.cos(math.radians(b)),cy+1.02*R*math.sin(math.radians(b))
        out.append(f'<polygon points="{pent(ox,oy,0.36*R,b+180)}" fill="{ink}"/>')
        ex,ey=cx+0.72*R*math.cos(a),cy+0.72*R*math.sin(a)
        out.append(f'<path d="M{vx:.1f} {vy:.1f}L{ex:.1f} {ey:.1f}" stroke="{ink}" stroke-width="{R*0.07:.1f}"/>')
        for s in (-1,1):
            bb=math.radians(b if s>0 else b-72)
            # line from ex,ey toward nearest vertex of neighbour outer pentagon
            nb=-90+36+72*k if s>0 else -90-36+72*k
            ox2,oy2=cx+1.02*R*math.cos(math.radians(nb)),cy+1.02*R*math.sin(math.radians(nb))
            tx,ty=ox2+(ex-ox2)*0.36*R/math.hypot(ex-ox2,ey-oy2),oy2+(ey-oy2)*0.36*R/math.hypot(ex-ox2,ey-oy2)
            out.append(f'<path d="M{ex:.1f} {ey:.1f}L{tx:.1f} {ty:.1f}" stroke="{ink}" stroke-width="{R*0.07:.1f}"/>')
    out.append('</g>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="{ink}" stroke-width="{R*0.1:.1f}"/>')
    # shine
    out.append(f'<path d="M{cx-R*0.62:.1f} {cy-R*0.25:.1f}A{R*0.68:.1f} {R*0.68:.1f} 0 0 1 {cx-R*0.2:.1f} {cy-R*0.64:.1f}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="{R*0.08:.1f}" stroke-linecap="round"/>')
    return "\n".join(out)
def pawn(cx,base,s,body,ink,cid):
    # base at y=base, scale s (1 = ~ 180px tall body)
    w=lambda v: v*s
    d=(f"M{cx-w(78)} {base}"
       f"q0 {-w(26)} {w(18)} {-w(30)}"
       f"c{w(24)} {-w(6)} {w(34)} {-w(30)} {w(36)} {-w(76)}"
       f"l{w(2)} {-w(30)}"
       f"h{w(44)}"
       f"l{w(2)} {w(30)}"
       f"c{w(2)} {w(46)} {w(12)} {w(70)} {w(36)} {w(76)}"
       f"q{w(18)} {w(4)} {w(18)} {w(30)}z")
    out=[f'<ellipse cx="{cx}" cy="{base+w(4)}" rx="{w(86)}" ry="{w(12)}" fill="#000" opacity=".25"/>',
         f'<path d="{d}" fill="{body}" stroke="{ink}" stroke-width="{w(9)}" stroke-linejoin="round"/>',
         f'<rect x="{cx-w(46)}" y="{base-w(146)}" width="{w(92)}" height="{w(20)}" rx="{w(10)}" fill="{body}" stroke="{ink}" stroke-width="{w(9)}"/>',
         ball(cx,base-w(146)-w(50),w(56),cid,ink)]
    return "\n".join(out)
def logo(full=False):
    S=512
    stripes="".join(f'<rect x="0" y="{i*64}" width="512" height="64" fill="{"#2f9a4c" if i%2 else "#278a42"}"/>' for i in range(8))
    lines=('<g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="8">'
           '<path d="M0 300H512"/><circle cx="256" cy="300" r="92"/>'
           '<path d="M96 0V58H416V0"/><path d="M176 0V22H336V0"/></g>'
           '<circle cx="256" cy="300" r="9" fill="#fff"/>')
    g=pawn(166,452,1.22,"#f4efe2","#1b2430","b1")+pawn(346,452,1.22,"#1f3b5a","#0f1b29","b2")
    inner=stripes+lines+g
    if full:
        # maskable: shrink artwork into the safe zone
        inner=stripes+f'<g transform="translate(51 51) scale(.8)">{lines}{g}</g>'
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{inner}</svg>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath>'
            f'<g clip-path="url(#r)">{inner}</g></svg>')
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
open(os.path.join(OUT, "logo.svg"), "w").write(logo())
open(os.path.join(OUT, "logo-maskable.svg"), "w").write(logo(True))
