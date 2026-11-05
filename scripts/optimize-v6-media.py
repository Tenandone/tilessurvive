"""Explicit offline media build: python -m pip install Pillow; python scripts/optimize-v6-media.py --apply.
Does not change original game assets. Uses fixed source paths and non-destructive sibling outputs.
"""
from pathlib import Path
from PIL import Image
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
SOURCES={'furiosa':'img/game-26300/heroes/furiosa.png','alita':'img/game-26300/heroes/alita.png','lava':'img/game-41/heroes/lava.png','sarge':'img/game-41/heroes/sarge.webp','lucky':'img/game-41/heroes/lucky.webp','fluffy':'img/game-40/pets/fluffy.webp','barracks':'img/buildings/barracks.png','beginner':'img/guides/beginner-guide.png','world':'img/banners/official-world.webp','guides':'img/home/guides.png','database':'img/home/database.png','calculator':'img/home/calculator.png','halloween-mobile':'img/events/halloween-2026-original.webp'}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def build(apply=False):
 records=[]
 for name,source in SOURCES.items():
  src=ROOT/source;dst=ROOT/('img/v6/'+name+'.webp');assert src.is_file(),source
  if apply:
   dst.parent.mkdir(parents=True,exist_ok=True)
   with Image.open(src) as im:
    im.thumbnail((768,768) if name=='halloween-mobile' else (640,448),Image.Resampling.LANCZOS)
    im.save(dst,'WEBP',quality=82,method=6)
  assert dst.is_file(),str(dst)
  with Image.open(dst) as im:w,h=im.size
  records.append({'source':'/'+source,'sourceSHA256':digest(src),'path':'/'+dst.relative_to(ROOT).as_posix(),'sha256':digest(dst),'width':w,'height':h,'bytes':dst.stat().st_size})
 target=ROOT/'data/v6-assets.json';meta=json.loads(target.read_text(encoding='utf8'));meta['optimizedMedia']=records
 if apply:target.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps({'images':len(records),'bytes':sum(r['bytes'] for r in records),'apply':apply}))
if __name__=='__main__':build('--apply' in sys.argv)
