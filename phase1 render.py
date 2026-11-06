"""ตัวเรนเดอร์ตรวจโมเดล: โปรเจกชันเองด้วย numpy (ortho / perspective) + shading + wireframe"""
import numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from phase1_strand import build_strand, check

def cam_basis(yaw, pitch):
    cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
    fwd = np.array([-sy*cp, -sp, -cy*cp])          # ทิศที่กล้องมอง (กล้องอยู่ฝั่ง +z เมื่อ yaw=0)
    right = np.array([cy, 0, -sy]); up = np.cross(right, fwd)
    return right, up, fwd

def project(V, yaw, pitch, persp, center, dist=4.0):
    r, u, f = cam_basis(yaw, pitch); Q = V - center
    x, y, d = Q @ r, Q @ u, Q @ f
    if persp:
        s = dist / (dist + d); return np.c_[x*s, y*s], d
    return np.c_[x, y], d

def draw(ax, m, yaw, pitch, persp, wire, title, crop=None):
    V, F = m["V"], m["F"]; center = (V.min(0)+V.max(0))/2
    xy, d = project(V, yaw, pitch, persp, center)
    tri = xy[F]; depth = d[F].mean(1); order = np.argsort(-depth)
    n = np.cross(V[F[:, 1]]-V[F[:, 0]], V[F[:, 2]]-V[F[:, 0]]); n /= np.linalg.norm(n, axis=1, keepdims=True)+1e-12
    L = np.array([0.4, 0.5, 0.8]); L /= np.linalg.norm(L)
    sh = 0.28 + 0.72*np.clip(n @ L, 0, 1)
    fc = np.clip(sh[:, None]*np.array([0.95, 0.63, 0.81]), 0, 1)
    if wire: fc = np.tile([0.16, 0.19, 0.32, 1.0], (len(F), 1))
    pc = PolyCollection(tri[order], facecolors=fc[order], edgecolors=(0.55, 0.8, 1, 0.9) if wire else "none",
                        linewidths=0.4 if wire else 0, antialiaseds=True)
    ax.add_collection(pc); ax.set_aspect("equal"); ax.set_axis_off(); ax.set_facecolor("#10162a")
    if crop is None:
        lo, hi = xy.min(0), xy.max(0); pad = 0.06*(hi-lo).max()
        ax.set_xlim(lo[0]-pad, hi[0]+pad); ax.set_ylim(lo[1]-pad, hi[1]+pad)
    else:
        c, r = crop; cp, _ = project(c[None, :], yaw, pitch, persp, center)
        ax.set_xlim(cp[0, 0]-r, cp[0, 0]+r); ax.set_ylim(cp[0, 1]-r, cp[0, 1]+r)
    ax.set_title(title, color="white", fontsize=11)

if __name__ == "__main__":
    m = build_strand(); print(check(m))
    views = [("Front", 0, 0, False), ("Side", np.pi/2, 0, False), ("Perspective", np.radians(38), np.radians(14), True)]
    fig, axs = plt.subplots(2, 3, figsize=(15, 11), facecolor="#10162a")
    for i, (nm, yaw, pit, per) in enumerate(views):
        draw(axs[0, i], m, yaw, pit, per, False, nm); draw(axs[1, i], m, yaw, pit, per, True, nm+" · wireframe")
    plt.tight_layout(); plt.savefig("phase1_views.png", dpi=105, facecolor="#10162a")
    P = m["P"]; fig, axs = plt.subplots(2, 3, figsize=(15, 9.5), facecolor="#10162a")
    for i, (nm, k) in enumerate([("Root (cap + cross-section)", 1), ("Middle", 32), ("Tip (tapered point)", 58)]):
        for j, w in enumerate([False, True]):
            draw(axs[j, i], m, np.radians(38), np.radians(14), True, w, nm + (" · wireframe" if w else ""), crop=(P[k], 0.09))
    plt.tight_layout(); plt.savefig("phase1_closeups.png", dpi=105, facecolor="#10162a")
