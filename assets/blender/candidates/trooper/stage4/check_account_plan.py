"""Read current existing-account plan; never print or persist credentials."""
import tomllib,json,urllib.request,urllib.error
from pathlib import Path
cfg=tomllib.loads(Path('C:/Users/futsa/AppData/Roaming/xdg.config/.wrangler/config/default.toml').read_text())
token=cfg['oauth_token'];account='5fc5ec277dd3010f25a7c1a7b7e585b3';out={}
for endpoint in ['workers/account-settings','subscriptions']:
 req=urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/'+account+'/'+endpoint,headers={'Authorization':'Bearer '+token})
 try:
  with urllib.request.urlopen(req,timeout=20) as r:data=json.load(r)
  result=data.get('result')
  if endpoint.endswith('account-settings'):out[endpoint]={k:result.get(k) for k in ['default_usage_model','green_compute','default_limits'] if k in result}
  else:out[endpoint]=[{'state':x.get('state'),'rate_plan':{k:x.get('rate_plan',{}).get(k) for k in ['id','public_name','currency','scope']}} for x in result]
 except urllib.error.HTTPError as e:out[endpoint]={'httpStatus':e.code}
Path(__file__).with_name('account-plan-check.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
