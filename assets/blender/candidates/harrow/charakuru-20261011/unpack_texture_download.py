"""受信ZIPを検査し、FBXと画像だけを新規制作ディレクトリへ展開する。"""
import sys, json, hashlib, zipfile
from pathlib import Path, PurePosixPath
from PIL import Image
source=Path(sys.argv[1]); dest=Path(sys.argv[2])
assert not dest.exists(), 'Destination must be new'
assert zipfile.is_zipfile(source), 'Expected ZIP signature'
with zipfile.ZipFile(source) as z:
    assert z.testzip() is None, 'ZIP CRC failed'
    entries=z.infolist()
    assert 1<len(entries)<20
    for i in entries:
        p=PurePosixPath(i.filename)
        assert not p.is_absolute() and '..' not in p.parts and '\\' not in i.filename and ':' not in i.filename
        assert p.suffix.lower() in ('.fbx','.png','.jpg','.jpeg')
        assert i.file_size < 100_000_000
    dest.mkdir(parents=True)
    for i in entries:
        p=dest.joinpath(*PurePosixPath(i.filename).parts); p.parent.mkdir(parents=True,exist_ok=True)
        data=z.read(i)
        if p.suffix.lower()=='.fbx': assert data.startswith(b'Kaydara FBX Binary  ')
        p.write_bytes(data)
    images=[]
    for p in dest.rglob('*'):
        if p.suffix.lower() in ('.png','.jpg','.jpeg'):
            with Image.open(p) as im:
                im.load(); assert im.size==(4096,4096)
                images.append({'file':str(p.relative_to(dest)),'size':im.size})
    assert len(images)==1
report={'source':str(source),'archive_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'files':[{'name':i.filename,'bytes':i.file_size,'sha256':hashlib.sha256(dest.joinpath(*PurePosixPath(i.filename).parts).read_bytes()).hexdigest()} for i in entries],'images':images}
(dest/'download.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
