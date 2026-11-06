"""PHASE 1 — เส้นผม 3D หนึ่งเส้น สร้างจาก Vertex / Face ล้วน (ไม่ใช้ primitive สำเร็จรูป)
ขั้นตอน: เส้นกลาง (centerline) -> เฟรมหมุนต่อเนื่อง (parallel transport + twist)
-> หน้าตัดวงรี (ความหนา/แบนปรับตามความยาว) -> ปลายเรียวเป็นจุด -> ปิดโคนด้วย cap
-> ตรวจ manifold / ปริมาตร / หน้าเสื่อม -> ส่งออก OBJ ชื่อ HairStrand_001"""
import numpy as np

def centerline(n=64, length=1.0, wave=0.07, waves=1.6, curl=0.10, phase=0.0, droop=0.0):
    """จุดบนแนวโค้งของเส้นผม: โคนที่ y=0 ห้อยลง -y มีคลื่นสองแกนและม้วนปลายเล็กน้อย"""
    t = np.linspace(0, 1, n)
    env = 0.25 + 0.75 * t                      # คลื่นเบาที่โคน แรงขึ้นที่ปลาย
    x = wave * env * np.sin(2*np.pi*waves*t + phase)
    z = wave * 0.8 * env * np.sin(2*np.pi*waves*t + phase + 1.1)
    y = -length * t + droop * t**2
    k = np.clip((t - 0.78) / 0.22, 0, 1)       # ปลายม้วนเป็นเกลียวเล็กๆ
    x += curl * k**1.5 * np.sin(k * 2.6)
    z += curl * k**1.5 * (1 - np.cos(k * 2.6))
    return t, np.stack([x, y, z], 1)

def frames(P, twist_turns=0.6):
    """เฟรม T,N,B แบบ rotation-minimizing (ไม่บิดเอง) แล้วเติมการบิดตัวตามต้องการ"""
    T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0.0, 0.0, 1.0])
    N = np.cross(T[0], ref); N /= np.linalg.norm(N)
    Ns = [N]
    for i in range(1, len(P)):
        v = np.cross(T[i-1], T[i]); s = np.linalg.norm(v)
        if s < 1e-9:
            Ns.append(Ns[-1]); continue
        v /= s; ang = np.arctan2(s, np.dot(T[i-1], T[i]))
        n = Ns[-1]                              # หมุน n รอบแกน v ด้วย Rodrigues
        n = n*np.cos(ang) + np.cross(v, n)*np.sin(ang) + v*np.dot(v, n)*(1-np.cos(ang))
        n -= T[i]*np.dot(n, T[i]); n /= np.linalg.norm(n)
        Ns.append(n)
    N = np.array(Ns); B = np.cross(T, N)
    t = np.linspace(0, 1, len(P)); tw = 2*np.pi*twist_turns*t
    Nt = N*np.cos(tw)[:, None] + B*np.sin(tw)[:, None]
    Bt = -N*np.sin(tw)[:, None] + B*np.cos(tw)[:, None]
    return T, Nt, Bt

def radius_profile(t, r_root=0.022, flat=0.62):
    """ความหนาตลอดเส้น: โคนหนา -> เรียวช้าๆ -> ปลายแหลม; flat = สัดส่วนความแบนของหน้าตัด"""
    taper = (1 - t) ** 0.55                     # -> 0 ที่ปลาย
    swell = 1 + 0.10 * np.sin(np.pi * np.clip(t * 1.4, 0, 1))
    r = r_root * taper * swell
    return r, r * (flat + (1 - flat) * (1 - t))  # ความหนาด้านบางจะแบนกว่าที่โคน

def build_strand(name="HairStrand_001", rings=64, sides=10, **kw):
    t, P = centerline(rings, **kw)
    T, N, B = frames(P, twist_turns=kw.get("twist", 0.6) if False else 0.6)
    ra, rb = radius_profile(t)
    ang = np.linspace(0, 2*np.pi, sides, endpoint=False)
    V = []
    last = rings - 1                            # วงสุดท้ายแทนด้วยจุดปลายแหลม
    for i in range(last):
        for a in ang:
            V.append(P[i] + N[i]*ra[i]*np.cos(a) + B[i]*rb[i]*np.sin(a))
    root_c = len(V); V.append(P[0])             # จุดศูนย์กลาง cap โคน
    tip = len(V); V.append(P[last] + T[last]*ra[last-1]*1.8)   # ปลายแหลมยื่นออกเล็กน้อย
    V = np.array(V)
    F = []
    for i in range(last - 1):
        for j in range(sides):
            a, b = i*sides + j, i*sides + (j+1) % sides
            c, d = (i+1)*sides + j, (i+1)*sides + (j+1) % sides
            F += [(a, c, b), (b, c, d)]
    for j in range(sides):                      # cap โคน
        F.append((root_c, j, (j+1) % sides))
    base = (last-1)*sides
    for j in range(sides):                      # ปลายเรียวเป็นจุด
        F.append((base + j, tip, base + (j+1) % sides))
    F = np.array(F)
    if signed_volume(V, F) < 0: F = F[:, ::-1]  # ให้หน้าชี้ออกนอกเสมอ
    return {"name": name, "V": V, "F": F, "P": P, "t": t}

def signed_volume(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    return float(np.sum(np.einsum('ij,ij->i', a, np.cross(b, c))) / 6)

def check(m):
    V, F = m["V"], m["F"]
    e = {}
    for f in F:
        for i in range(3):
            k = (f[i], f[(i+1) % 3]); e[k] = e.get(k, 0) + 1
    open_edges = sum(1 for (a, b), c in e.items() if (b, a) not in e or c != 1)
    area = np.linalg.norm(np.cross(V[F[:, 1]]-V[F[:, 0]], V[F[:, 2]]-V[F[:, 0]]), axis=1)/2
    return {"vertices": len(V), "faces": len(F), "watertight": open_edges == 0,
            "volume": signed_volume(V, F), "degenerate_faces": int((area < 1e-12).sum()),
            "min_area": float(area.min()), "length": float(np.sum(np.linalg.norm(np.diff(m["P"], axis=0), axis=1)))}

def write_obj(m, path):
    with open(path, "w") as f:
        f.write(f"# {m['name']} — built from vertices/faces\no {m['name']}\n")
        for v in m["V"]: f.write("v %.5f %.5f %.5f\n" % tuple(v))
        for a, b, c in m["F"]: f.write("f %d %d %d\n" % (a+1, b+1, c+1))

if __name__ == "__main__":
    m = build_strand()
    print(check(m)); write_obj(m, "/mnt/user-data/outputs/hair/hair_strand_001.obj")
