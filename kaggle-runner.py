# เครื่องรัน Kaggle: วางในโน้ตบุ๊กใหม่ เปิด GPU + อินเทอร์เน็ต แล้วกด Run All
# Secrets (Add-ons > Secrets): BOT_URL (ลิงก์บอท), BOT_KEY (รหัสบอท), HF_TOKEN (จำเป็นสำหรับ FLUX.1-dev ที่ต้องขอสิทธิ์)
import os, io, gc, time, base64, requests, torch
from kaggle_secrets import UserSecretsClient
S = UserSecretsClient(); U = S.get_secret('BOT_URL').rstrip('/'); K = S.get_secret('BOT_KEY')
try: HF = S.get_secret('HF_TOKEN')
except Exception: HF = None
IMG = {'animagine-xl-4': 'cagliostrolab/animagine-xl-4.0', 'flux1-dev': 'black-forest-labs/FLUX.1-dev'}
ASR = {'typhoon-whisper-large': 'scb10x/typhoon-whisper-large-v3', 'typhoon-whisper-turbo': 'typhoon-ai/typhoon-whisper-turbo', 'whisper-v3-turbo': 'openai/whisper-large-v3-turbo'}
cur = (None, None)
def load(m):
    global cur
    if cur[0] == m: return cur[1]
    cur = (None, None); gc.collect(); torch.cuda.empty_cache()
    if m == 'flux1-dev':
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
def run(job):
    m, p = job['model'], load(job['model'])
    if m in IMG:
        im = p(prompt=job['input'][:2000], num_inference_steps=28 if m != 'flux1-dev' else 28, guidance_scale=6 if m != 'flux1-dev' else 3.5).images[0].convert('RGB')
        b = io.BytesIO(); im.save(b, 'JPEG', quality=92); return {'b64': base64.b64encode(b.getvalue()).decode()}
    a = '/tmp/in.bin'; open(a, 'wb').write(requests.get(job['input'].strip(), timeout=120).content)
    r = p(a, return_timestamps=True, generate_kwargs={'language': 'th'} if m.startswith('typhoon') else {})
    out = ''
    for i, c in enumerate(r.get('chunks') or [], 1):
        s, e = c['timestamp']; out += f"{i}\n{ts(s)} --> {ts(e if e else (s or 0) + 2)}\n{c['text'].strip()}\n\n"
    return {'out': out or r['text']}
MODELS = ','.join(list(IMG) + list(ASR)); print('พร้อมรับงาน:', MODELS)
while True:
    try:
        j = requests.get(f'{U}/api/k/next', params={'k': K, 'models': MODELS}, timeout=30).json().get('job')
    except Exception as e:
        print('ต่อบอทไม่ได้', e); time.sleep(20); continue
    if not j: time.sleep(10); continue
    print('งาน', j['id'], j['model'])
    try: res = {'ok': 1, **run(j)}
    except Exception as e: res = {'ok': 0, 'err': str(e)[:280]}
    requests.post(f'{U}/api/k/done', params={'k': K}, json={'id': j['id'], **res}, timeout=120)
