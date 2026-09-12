"""Prepare a reviewable runtime candidate, without changing the game's live source."""
from pathlib import Path
import difflib,json,hashlib
Q=Path(__file__).resolve().parent;GAME=Q.parents[4];source=GAME/'src/client/standard-trooper.ts';before=source.read_text(encoding='utf-8');after=before
changes=[
 ("const role = source.name as keyof typeof palette;", "const role = (source.name === 'Study_Cloth' ? 'Cloth' : source.name) as keyof typeof palette;"),
 ("HEAVY_HIT_DURATION }", "HEAVY_HIT_DURATION, reloadDuration }"),
 ('standard_trooper_v4.glb','standard_trooper_v5.glb'),
 ('for (const clip of assets.character.animations) this.clips.set(clip.name, clip);',"for (const authored of assets.character.animations) {\n      const clip = authored.clone();\n      clip.name = clip.name.replace(/^Trial_/, '');\n      this.clips.set(clip.name, clip);\n    }"),
 ("name.startsWith('Switch_'))", "name.startsWith('Switch_') || name.startsWith('Reload_'))"),
 ("    else {\n      const fire = this.clips.get(`Fire_${profile}`)!;", "    else if (p.reload > 0) {\n      mode = `normal_${profile}_reload_${moving ? runClip : 'idle'}`;\n      clip = `Upper_Reload_${profile}`;\n      const duration = reloadDuration(p.weapons[p.slot], p.ammo[p.slot]);\n      at = T.MathUtils.clamp(1 - p.reload / duration, 0, 1) * this.clips.get(clip)!.duration;\n      lower = `Lower_${moving ? runClip : profile === 'Rocket' ? 'Weapon_Idle_Rocket' : 'Idle'}`;\n    }\n    else {\n      const fire = this.clips.get(`Fire_${profile}`)!;")]
for old,new in changes:
 assert after.count(old)==1,(old,after.count(old));after=after.replace(old,new)
(Q/'standard-trooper-adopted.ts.txt').write_text(after,encoding='utf-8')
(Q/'runtime-change.patch').write_text(''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='before/standard-trooper.ts',tofile='after/standard-trooper.ts')),encoding='utf-8')
candidate=after.replace("'../shared/","'/src/shared/").replace("loader.loadAsync(`${base}standard_trooper_v5.glb`)","loader.loadAsync('/assets/blender/candidates/trooper/stage4/trooper_stage4_candidate.glb')")
(Q/'standard-trooper-proposed.ts').write_text(candidate,encoding='utf-8')
(Q/'runtime-before-hash.json').write_text(json.dumps({'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}))
print('Prepared candidate runtime; game source unchanged')
