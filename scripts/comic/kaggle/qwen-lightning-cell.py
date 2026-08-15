# scripts/comic/kaggle/qwen-lightning-cell.py
# VALIDATED free-Kaggle path (2026-08): Qwen-Image GGUF Q3 + Lightning 4-step on a T4.
# API-quality flat B&W, ~1.5 min/panel, $0. Paste this ENTIRE file into ONE Kaggle notebook
# cell (fresh notebook, Settings: GPU T4 x2 + Internet On) and Run. It installs ComfyUI +
# the GGUF node, downloads the models + Lightning LoRA, launches ComfyUI, and prints a public
# URL. Then drive it from the local machine with gen-comfy.mjs + wf/qwen-t2i-lightning.api.json.
# (URLs are string-split so a phone/paste can't autolink-corrupt them.)
import os, subprocess, sys, time
os.chdir('/kaggle/working'); H = 'ht' + 'tps://'
def sh(*a): return subprocess.run(list(a))
if not os.path.isdir('ComfyUI'):
    sh('git', 'clone', '--depth', '1', H + 'github.com/comfyanonymous/ComfyUI')
os.chdir('ComfyUI')
if not os.path.isdir('custom_nodes/ComfyUI-GGUF'):
    sh('git', 'clone', '--depth', '1', H + 'github.com/city96/ComfyUI-GGUF', 'custom_nodes/ComfyUI-GGUF')
sh(sys.executable, '-m', 'pip', '-q', 'install', '-r', 'requirements.txt', 'gguf', 'pycloudflared', 'huggingface_hub')
from huggingface_hub import hf_hub_download, list_repo_files
def grab(repo, needle, sub, outname=None):
    cs = [f for f in list_repo_files(repo) if needle.lower() in f.lower() and f.lower().endswith(('.gguf', '.safetensors'))]
    cs.sort(key=lambda f: (0 if 'bf16' in f.lower() else 1, len(f)))  # 여러 변형 매칭 시 bf16 우선(워크플로 기대명)
    if not cs:
        print('!! no match', repo, needle); return
    src = cs[0]
    f = hf_hub_download(repo, src); os.makedirs('models/' + sub, exist_ok=True)
    # 파일명을 워크플로(wf/qwen-t2i-lightning.api.json)가 참조하는 정확한 이름으로 강제 — 대소문자·변형
    # 불일치 시 ComfyUI 가 노드에서 모델을 못 찾아 /prompt 500. outname 로 심링크명을 고정한다.
    d = 'models/' + sub + '/' + (outname or os.path.basename(src))
    if os.path.lexists(d):
        os.remove(d)
    os.symlink(f, d)
    print('ok', os.path.getsize(f) // 1048576, 'MB', src, '->', os.path.basename(d))
grab('city96/Qwen-Image-gguf', 'Q3_K_S', 'unet', 'qwen-image-Q3_K_S.gguf')
grab('chatpig/qwen2.5-vl-7b-it-gguf', 'Q4_K_M', 'text_encoders', 'qwen2.5-vl-7b-it-q4_k_m.gguf')
grab('chatpig/qwen2.5-vl-7b-it-gguf', 'mmproj', 'text_encoders')
grab('Comfy-Org/Qwen-Image_ComfyUI', 'qwen_image_vae', 'vae', 'qwen_image_vae.safetensors')
grab('lightx2v/Qwen-Image-Lightning', '4steps', 'loras', 'Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors')  # 4-step LoRA
subprocess.run(['pkill', '-f', 'main.py']); time.sleep(2)
subprocess.Popen([sys.executable, '-u', 'main.py', '--listen', '0.0.0.0', '--port', '8188', '--lowvram'],
                 stdout=open('/kaggle/working/comfy.log', 'w'), stderr=subprocess.STDOUT)
time.sleep(70)
log = open('/kaggle/working/comfy.log').read()
print('comfy up?', ('To see the GUI' in log) or ('Starting server' in log))
if ('Error' in log) or ('Traceback' in log):
    print(log[-1500:])
from pycloudflared import try_cloudflare
print('URL:', try_cloudflare(port=8188).tunnel)
