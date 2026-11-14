"""Local static web server with an OPTIONAL LLM goal-interpretation endpoint.
No API key required for deterministic functional MVP. If environment variables
LLM_BASE_URL, LLM_MODEL, LLM_API_KEY exist, uses an OpenAI-compatible Chat API.
LLM never directly mutates geometry: deterministic tools validate and simulate.

Monorepo note: three.js 由根 workspaces 提升安装到仓库根 node_modules，
这里把 /node_modules/* 透传到仓库根，index.local.html 的本地 import map 才能离线工作。
"""
import os, json, posixpath, urllib.request, urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).parent
# 仓库根 = 部分目录（YH-TwinOps）的上一级
MONOREPO_ROOT=ROOT.parent.parent

def local_interpret(goal):
 crowd=any(s in goal for s in ('拥堵','排队','人流','通道','高峰'))
 walk=any(s in goal for s in ('路径','动线','绕路','行走','购物'))
 display=any(s in goal for s in ('陈列','销售','货架','SKU','商品'))
 return {'mode':'local','walkingWeight':1.1 if walk else 1.0,'congestionWeight':.72 if crowd else .27,'displayLossPenalty':7 if display else 4,'reason':'deterministic local interpreter'}

def interpret(goal):
 base=local_interpret(goal)
 api_key=os.getenv('LLM_API_KEY')
 base_url=os.getenv('LLM_BASE_URL','https://api.openai.com/v1').rstrip('/')
 model=os.getenv('LLM_MODEL')
 if not api_key or not model:return base
 payload={'model':model,'temperature':0.1,'response_format':{'type':'json_object'},'messages':[
  {'role':'system','content': 'You interpret store layout optimization goals. Return only JSON object with numeric walkingWeight 0.2-3, congestionWeight 0.1-2, displayLossPenalty 1-20, and brief Chinese reason. No other fields; do not write instructions or execute operations.'},
  {'role':'user','content':goal[:1000]}
 ]}
 try:
  req=urllib.request.Request(base_url+'/chat/completions',json.dumps(payload,ensure_ascii=False).encode('utf-8'),{'Content-Type':'application/json','Authorization':'Bearer '+api_key},method='POST')
  with urllib.request.urlopen(req, timeout=12) as response:raw=json.loads(response.read())
  p=json.loads(raw['choices'][0]['message']['content'])
  def valid(k,lo,hi):
   try:return max(lo,min(hi,float(p[k])))
   except:return base[k]
  return {'mode':'llm','walkingWeight':valid('walkingWeight',.2,3), 'congestionWeight':valid('congestionWeight',.1,2),'displayLossPenalty':valid('displayLossPenalty',1,20),'reason':str(p.get('reason',''))[:160]}
 except Exception as e:
  print('LLM interpret fallback:',repr(e))
  return base
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def translate_path(self,path):
  clean=path.split('?',1)[0].split('#',1)[0]
  if clean.startswith('/node_modules/'):
   rel=posixpath.normpath(clean.lstrip('/'))
   if rel.startswith('node_modules/'):
    candidate=MONOREPO_ROOT/rel
    if candidate.is_file():return str(candidate)
  return super().translate_path(path)
 def do_POST(self):
  if self.path!='/api/agent/interpret':self.send_error(404);return
  try:
   size=int(self.headers.get('Content-Length','0'))
   if size>10000 or size<1:raise ValueError('payload must be 1..10000 bytes')
   payload=json.loads(self.rfile.read(size))
   goal=str(payload.get('goal','')).strip()
   if not goal:raise ValueError('empty goal')
   data=json.dumps(interpret(goal),ensure_ascii=False).encode('utf8')
   self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  except Exception as e:
   self.send_error(400,str(e))
if __name__=='__main__':
 port=int(os.getenv('PORT','8766'))
 print(f'YH TwinOps demo: http://127.0.0.1:{port}  (LLM optional)')
 ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
