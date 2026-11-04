"""Audit retained hero image joins; re-decode Lava from a plaintext UnityFS source.

No network, keys, source modifications, or automatic publication. Integer path IDs
stay strings in the report because Unity IDs exceed JavaScript's safe integers.
"""
import argparse, hashlib, json, pathlib, sys

def digest(b):
    return hashlib.sha256(b).hexdigest()

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--corpus', required=True)
    p.add_argument('--hero-fields', required=True)
    p.add_argument('--unity-libs', required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args()
    corpus, out = pathlib.Path(a.corpus), pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    heroes = json.loads(pathlib.Path(a.hero_fields).read_text(encoding='utf-8'))
    wanted = {v for h in heroes for v in h.values() if isinstance(v, str) and v.startswith('sp_avatar')}
    matches = {k: [] for k in wanted}
    for manifest in (corpus/'integration-41/unity/bodies').glob('*/objects.jsonl'):
        for line in manifest.open(encoding='utf-8'):
            if 'sp_avatar' not in line:
                continue
            row = json.loads(line)
            if row.get('name') not in wanted or row.get('class') not in ('Sprite', 'Texture2D'):
                continue
            image = row.get('image', {})
            matches[row['name']].append({'manifest': manifest.relative_to(corpus).as_posix(),
                'pathId': str(row.get('pathId')), 'className': row.get('class'),
                'image': image, 'imageStatus': row.get('imageStatus')})
    joins = [{'heroId': h['InternalId'], 'sourceId': h['Id'], 'references': [
        {'field': k, 'resource': v, 'matches': matches[v]} for k,v in h.items()
        if isinstance(v,str) and v in matches]} for h in heroes]
    source_sha = '71a57e867850c9b23a29ac5f77a0c0899cc56e7556c2ad3a977faca54a5c715e'
    source = corpus/'integration-41/snapshot/blobs'/source_sha
    raw = source.read_bytes()
    assert digest(raw) == source_sha
    offset = raw.find(b'UnityFS\0')
    assert offset == 47
    body_sha = digest(raw[offset:])
    assert body_sha == '07ae4843eeacef3eb7fabee74700507b611352af05aa24b9c089f72df1bab7fe'
    sys.path.insert(0, str(pathlib.Path(a.unity_libs).resolve()))
    import UnityPy
    from UnityPy.helpers import TypeTreeHelper
    TypeTreeHelper.read_typetree_boost = False
    objects = []
    for obj in UnityPy.load(raw[offset:]).objects:
        if obj.type.name not in ('Sprite', 'Texture2D'):
            continue
        data = obj.parse_as_object()
        if data.m_Name != 'sp_avatar_survivor_full_lava':
            continue
        im = data.image.convert('RGBA')
        pixel_sha = digest(im.tobytes())
        assert im.size == (840, 712)
        assert pixel_sha == 'a0b176d74deb87af2ad65ff1cc7f3abef3f5c82bc4c9ee40ef2271722fb1336f'
        target = out/('lava-'+obj.type.name+'.png')
        im.save(target)
        objects.append({'pathId':str(obj.path_id), 'className':obj.type.name,
            'resource':data.m_Name, 'width':im.width, 'height':im.height,
            'sha256':digest(target.read_bytes()), 'pixelSha256':pixel_sha,
            'output':str(target.resolve())})
    assert len(objects) == 2
    report = {'schemaVersion':1, 'verifiedOn':'2026-11-05', 'heroForms':len(heroes),
        'uniqueResourceNames':len(wanted), 'missingNames':sorted(k for k,v in matches.items() if not v),
        'joins':joins, 'lava':{'heroId':25300242, 'field':'CharacterImage',
            'sourceSha256':source_sha, 'bodySha256':body_sha, 'plaintextUnityFSOffset':offset,
            'sourceAcquisitionScope':'APPROVED_STATIC_GAME_RESOURCE (retained inventory record)',
            'rights':'Game artwork; no separate redistribution license verified. Not competitor-sourced.',
            'freshlyDecoded':objects}}
    (out/'image-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2),encoding='utf-8')
    print(json.dumps({'heroForms':len(heroes),'resources':len(wanted),'missing':len(report['missingNames']), 'lava':objects}))

if __name__ == '__main__':
    main()
