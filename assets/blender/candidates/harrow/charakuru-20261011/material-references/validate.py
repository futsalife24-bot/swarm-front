from pathlib import Path
import json, hashlib
from PIL import Image, PngImagePlugin
root=Path(__file__).resolve().parent
prompts=json.loads((root/'prompts.json').read_text(encoding='utf-8'))
report=[]
for name,prompt in prompts.items():
    path=root/(name+'.png')
    with Image.open(path) as im:
        im.load()
        assert im.mode=='RGBA' and im.width==im.height
        assert im.getchannel('A').getextrema()==(0,255)
        metadata=PngImagePlugin.PngInfo()
        for key,value in im.info.items():
            if isinstance(value,str): metadata.add_text(key,value)
        metadata.add_text('prompt',prompt)
        size=im.size; bounds=im.getchannel('A').getbbox()
        im.save(path,pnginfo=metadata)
    report.append({'file':path.name,'size':size,'alpha_bounds':bounds,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(root/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
