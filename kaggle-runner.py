# เครื่องรัน Kaggle: วางในโน้ตบุ๊กใหม่ เปิด GPU + อินเทอร์เน็ต แล้วกด Run All
# Secrets (Add-ons > Secrets): BOT_URL (ลิงก์บอท), BOT_KEY (รหัสบอท), HF_TOKEN (FLUX.1-dev ต้องขอสิทธิ์ · FLUX.2 klein 4B ไม่บังคับ)
# รุ่นนี้เพิ่ม flux2-klein-4b = วาดจากภาพต้นแบบ (ทำให้ตัวละครหน้าเหมือนเดิมทุกช็อต) · ใบอนุญาต Apache 2.0
# วิธีส่งงาน (ช่องโจทย์): บรรทัดแรก  ref:#เลขงาน  (ใส่ได้ 4 ตัว เช่น ref:#12,#15 หรือลิงก์รูป) แล้วบรรทัดถัดไปคือฉาก/ท่าทาง
#   เสริมได้: size:576x1024 · seed:7 · steps:4   ไม่ใส่ ref = สร้างภาพจากข้อความล้วน
import os, io, gc, re, sys, time, base64, subprocess, importlib, importlib.util, requests, torch
from PIL import Image, ImageOps
from kaggle_secrets import UserSecretsClient
S = UserSecretsClient(); U = S.get_secret('BOT_URL').rstrip('/'); K = S.get_secret('BOT_KEY')
try: HF = S.get_secret('HF_TOKEN')
except Exception: HF = None
IMG = {'animagine-xl-4': 'cagliostrolab/animagine-xl-4.0', 'flux1-dev': 'black-forest-labs/FLUX.1-dev'}
EDIT = {'flux2-klein-4b': 'black-forest-labs/FLUX.2-klein-4B'}
ASR = {'typhoon-whisper-large': 'scb10x/typhoon-whisper-large-v3', 'typhoon-whisper-turbo': 'typhoon-ai/typhoon-whisper-turbo', 'whisper-v3-turbo': 'openai/whisper-large-v3-turbo'}
cur = (None, None)
def has_klein():  # เช็กโดยไม่ import diffusers (ถ้า import ไปแล้วค่อยอัปเดต โปรแกรมจะไม่เห็นรุ่นใหม่)
    try:
        importlib.invalidate_caches(); sp = importlib.util.find_spec('diffusers')
        return bool(sp and sp.origin and 'Flux2KleinPipeline' in open(sp.origin, encoding='utf-8').read())
    except Exception: return False
def ensure_deps():  # diffusers ที่ติดมากับ Kaggle อาจเก่าเกินไปสำหรับ FLUX.2 klein → อัปเดตครั้งเดียวตอนเริ่ม
    if has_klein(): return
    print('อัปเดต diffusers ให้รองรับ FLUX.2 klein (ครั้งเดียว) …')
    pip = lambda *a: subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', *a], check=False)
    pip('diffusers', 'transformers', 'accelerate', 'sentencepiece', 'protobuf')
    if not has_klein(): pip('git+https://github.com/huggingface/diffusers.git')
    print('diffusers พร้อมใช้ FLUX.2 klein' if has_klein() else 'เตือน: diffusers ยังไม่รองรับ FLUX.2 klein (งาน flux2-klein-4b จะพลาด)')
def load(m):
    global cur
    if cur[0] == m: return cur[1]
    cur = (None, None); gc.collect(); torch.cuda.empty_cache()
    if m in EDIT:
        from diffusers import Flux2KleinPipeline
        p = Flux2KleinPipeline.from_pretrained(EDIT[m], torch_dtype=torch.bfloat16, token=HF); p.enable_model_cpu_offload()
    elif m == 'flux1-dev':
        from diffusers import FluxPipeline
        p = FluxPipeline.from_pretrained(IMG[m], torch_dtype=torch.bfloat16, token=HF); p.enable_model_cpu_offload()
    elif m in IMG:
        from diffusers import AutoPipelineForText2Image
        p = AutoPipelineForText2Image.from_pretrained(IMG[m], torch_dtype=torch.float16, token=HF).to('cuda')
    else:
        from transformers import pipeline
        p = pipeline('automatic-speech-recognition', model=ASR[m], device=0, torch_dtype=torch.float16, chunk_length_s=30)
    cur = (m, p); return p
def ts(t):
    t = max(0, t or 0); return '%02d:%02d:%02d,%03d' % (t // 3600, t % 3600 // 60, t % 60, int(t % 1 * 1000))
def parse(txt):  # แยกบรรทัดหัว (ref / size / seed / steps) ออกจากพรอมต์ · หัวต้องอยู่บนสุดก่อนข้อความฉาก
    opt, rest = {}, []
    for ln in str(txt or '').splitlines():
        if not rest:
            if not ln.strip(): continue
            m = re.match(r'^\s*(ref|size|seed|steps)\s*[:：]\s*(.+?)\s*$', ln, re.I)
            if m: opt[m.group(1).lower()] = m.group(2); continue
        rest.append(ln)
    return opt, '\n'.join(rest).strip()
def get_ref(t, lim):  # t = '#12' / '12' (ภาพผลงานจากบอท) หรือลิงก์ http(s)
    r = requests.get(t, timeout=60) if t.startswith('http') else requests.get(U + '/api/img', params={'id': t.lstrip('#'), 'k': K}, timeout=60)
    if r.status_code != 200: raise RuntimeError('ดึงภาพอ้างอิง %s ไม่ได้ (HTTP %s)' % (t, r.status_code))
    try: im = ImageOps.exif_transpose(Image.open(io.BytesIO(r.content))).convert('RGB')
    except Exception: raise RuntimeError('ภาพอ้างอิง %s เปิดไม่ได้ (ไม่ใช่ไฟล์รูป?)' % t)
    im.thumbnail((lim, lim)); return im
def fit(w, h, cap=1024 * 1024):  # ย่อให้ไม่เกิน ~1 ล้านพิกเซล และปัดเป็นพหุคูณของ 16
    s = (cap / (w * h)) ** 0.5 if w * h > cap else 1
    return max(256, int(w * s) // 16 * 16), max(256, int(h * s) // 16 * 16)
def edit(p, prompt, refs, W, H, steps, seed):
    kw = dict(prompt=prompt, guidance_scale=1.0, num_inference_steps=steps)
    if refs: kw['image'] = refs if len(refs) > 1 else refs[0]
    for k in (1.0, 0.7):  # เต็มขนาดก่อน ถ้าแรมการ์ดจอไม่พอ ลองใหม่ที่ 70%
        w, h = fit(int(W * k), int(H * k))
        try: return p(height=h, width=w, generator=torch.Generator(device='cuda').manual_seed(seed), **kw).images[0]
        except torch.cuda.OutOfMemoryError:
            gc.collect(); torch.cuda.empty_cache()
            if k < 1: raise
def run(job):
    m, p = job['model'], load(job['model'])
    if m in EDIT:
        opt, prompt = parse(job['input'])
        if not prompt: raise RuntimeError('ไม่มีพรอมต์ — ใส่คำอธิบายฉากต่อจากบรรทัด ref')
        toks = re.findall(r'https?://\S+|#?\d+', opt.get('ref', ''))[:4]
        refs = [get_ref(t, 1024 if len(toks) <= 2 else 768) for t in toks]
        sz = re.match(r'(\d+)\s*[x×*]\s*(\d+)', opt.get('size', ''))
        W, H = (int(sz.group(1)), int(sz.group(2))) if sz else (refs[0].size if refs else (1024, 1024))
        seed = int(opt['seed']) if opt.get('seed', '').isdigit() else int.from_bytes(os.urandom(3), 'big')
        steps = min(8, max(1, int(opt['steps']))) if opt.get('steps', '').isdigit() else 4
        im = edit(p, prompt[:2000], refs, W, H, steps, seed).convert('RGB')
        b = io.BytesIO(); im.save(b, 'JPEG', quality=92); return {'b64': base64.b64encode(b.getvalue()).decode()}
    if m in IMG:
        im = p(prompt=job['input'][:2000], num_inference_steps=28 if m != 'flux1-dev' else 28, guidance_scale=6 if m != 'flux1-dev' else 3.5).images[0].convert('RGB')
        b = io.BytesIO(); im.save(b, 'JPEG', quality=92); return {'b64': base64.b64encode(b.getvalue()).decode()}
    a = '/tmp/in.bin'; open(a, 'wb').write(requests.get(job['input'].strip(), timeout=120).content)
    r = p(a, return_timestamps=True, generate_kwargs={'language': 'th'} if m.startswith('typhoon') else {})
    out = ''
    for i, c in enumerate(r.get('chunks') or [], 1):
        s, e = c['timestamp']; out += f"{i}\n{ts(s)} --> {ts(e if e else (s or 0) + 2)}\n{c['text'].strip()}\n\n"
    return {'out': out or r['text']}
if __name__ == '__main__':
    ensure_deps()
    MODELS = ','.join(list(IMG) + list(EDIT) + list(ASR)); print('พร้อมรับงาน:', MODELS)
    while True:
        try:
            j = requests.get(f'{U}/api/k/next', params={'k': K, 'models': MODELS}, timeout=30).json().get('job')
        except Exception as e:
            print('ต่อบอทไม่ได้', e); time.sleep(20); continue
        if not j: time.sleep(10); continue
        print('งาน', j['id'], j['model'])
        try: res = {'ok': 1, **run(j)}
        except Exception as e: res = {'ok': 0, 'err': str(e)[:280]}
        gc.collect(); torch.cuda.empty_cache()
        requests.post(f'{U}/api/k/done', params={'k': K}, json={'id': j['id'], **res}, timeout=120)
