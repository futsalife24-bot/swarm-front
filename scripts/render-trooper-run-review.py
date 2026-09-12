"""Encode the measured Three.js frames; no generated or retouched character art."""
from pathlib import Path
from PIL import Image
import io, subprocess, sys

directory=Path('dist-validation/trooper-run')
frames=[Image.open(p).convert('RGB') for p in sorted((directory/'frames').glob('*.png'))]
assert len(frames)==40
small=[im.resize((540,480)) for im in frames]
small[0].save(directory/'run-slow.gif',save_all=True,append_images=small[1:],duration=40,loop=0)
data=bytearray()
for im in frames:
 buffer=io.BytesIO();im.save(buffer,format='JPEG',quality=95);data.extend(buffer.getvalue())
subprocess.run([sys.argv[1],'-y','-f','image2pipe','-c:v','mjpeg','-r','78','-i','pipe:0','-c:v','libvpx','-b:v','1800k',str(directory/'run.webm')],input=data,check=True)
