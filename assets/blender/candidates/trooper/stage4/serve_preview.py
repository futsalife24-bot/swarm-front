from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[4]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def translate_path(self,path):
  if path.startswith('/three/'):
   target=(GAME/'node_modules/three'/path.removeprefix('/three/').split('?')[0]).resolve()
   if target.is_relative_to((GAME/'node_modules/three').resolve()):return str(target)
  return super().translate_path(path)
 def do_POST(self):
  allowed={'/recording':'normal-speed-showcase.webm','/validation':'browser-validation.json','/front':'preview-front.png','/back':'preview-back.png'}
  if self.path not in allowed:self.send_error(404);return
  n=int(self.headers.get('Content-Length','0'))
  if n>150_000_000:self.send_error(413);return
  (ROOT/allowed[self.path]).write_bytes(self.rfile.read(n));self.send_response(200);self.end_headers();self.wfile.write(b'OK')
print('Candidate-only preview http://127.0.0.1:8768',flush=True)
ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
