"""Reproduce or verify fixed font partitions. Normal Node builds never run Python.

Requires fontTools 4.68.0 and Brotli 1.2.1. Use --verify for a read-only audit;
--apply generates into a temporary directory, verifies every hash, then copies.
Original WOFF2 files and the pinned inventory are never modified by this script.
"""
import argparse,hashlib,json,pathlib,sys,tempfile,shutil
parser=argparse.ArgumentParser()
parser.add_argument('--font-tools',help='Optional existing Python dependency directory')
parser.add_argument('--apply',action='store_true')
parser.add_argument('--verify',action='store_true')
parser.add_argument('--reproduce',action='store_true',help='Regenerate into temporary files and compare pinned hashes without writing public files')
parser.add_argument('--report',help='Optional JSON audit output')
args=parser.parse_args()
if args.font_tools:sys.path.insert(0,args.font_tools)
import fontTools,brotli
from fontTools.ttLib import TTFont
from fontTools import subset
assert fontTools.__version__=='4.68.0','Use the pinned fontTools version'
assert brotli.__version__=='1.2.1','Use the pinned Brotli version'
root=pathlib.Path(__file__).resolve().parent.parent
manifest=json.loads((root/'data/v61-font-subsets.json').read_text(encoding='utf-8'))
sha=lambda data:hashlib.sha256(data).hexdigest()
def points(value):
    result=set()
    for part in value.split(','):
        values=part[2:].split('-');a=int(values[0],16);b=int(values[-1],16)
        for cp in range(a,b+1):assert cp not in result;result.add(cp)
    return result
groups={g['id']:points(g['unicodeRange']) for g in manifest['groups']}
assert set(range(0x20,0x7f))|{0xa0} <= groups['home-base'],'Dynamic ASCII/NBSP must stay in home partition'
assert len(set.union(*groups.values()))==sum(map(len,groups.values()))==13131
for g in manifest['groups']:assert sha(','.join(map(str,sorted(groups[g['id']]))).encode())==g['inventorySHA256']
def outline(font,name):
    glyph=font['glyf'][name];coords,ends,flags=glyph.getCoordinates(font['glyf'])
    return (list(coords),list(ends),list(flags),font['hmtx'][name],bytes(glyph.program.getBytecode()) if hasattr(glyph,'program') else b'')
def pairs(font):
    rows=[]
    for lookup in font['GPOS'].table.LookupList.Lookup:
        assert lookup.LookupType==2,'New positioning logic requires review'
        for subtable in lookup.SubTable:
            assert subtable.Format==1,'New kerning format requires review'
            for left,pairset in zip(subtable.Coverage.glyphs,subtable.PairSet):
                for pair in pairset.PairValueRecord:
                    rows.append((left,pair.SecondGlyph,vars(pair.Value1) if pair.Value1 else {},vars(pair.Value2) if pair.Value2 else {}))
    return rows
report={'status':'PASS','originalsModified':False,'fixedInventory':True,'fontTools':fontTools.__version__,'faces':[]}
with tempfile.TemporaryDirectory(prefix='tilessurvive-font-subsets-') as temp:
    pending=[]
    for face in manifest['faces']:
        source=root/face['source']['path'];sourceBytes=source.read_bytes();assert sha(sourceBytes)==face['source']['sha256']
        original=TTFont(source,recalcTimestamp=False);cmap=original.getBestCmap();assert set(cmap)==set.union(*groups.values())
        assert sha(','.join(map(str,sorted(cmap))).encode())==face['source']['cmapSHA256']
        glyphGroup={}
        for name,cpSet in groups.items():
            for cp in cpSet:
                if cmap[cp] in glyphGroup:assert glyphGroup[cmap[cp]]==name,'A glyph alias crosses partitions'
                glyphGroup[cmap[cp]]=name
        originalPairs=pairs(original);cross=[(a,b) for a,b,_,_ in originalPairs if a in glyphGroup and b in glyphGroup and glyphGroup[a]!=glyphGroup[b]]
        assert not cross,'Original kerning pair crosses font faces'
        faceReport={'weight':face['weight'],'cmap':len(cmap),'originalBytes':len(sourceBytes),'crossPartitionKerningPairs':len(cross),'subsets':[]}
        for entry in face['subsets']:
            cpSet=groups[entry['group']];published=root/entry['path'];target=pathlib.Path(temp)/published.name if args.apply or args.reproduce else published
            if args.apply or args.reproduce:
                options=subset.Options();options.flavor='woff2';options.hinting=True;options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
                font=TTFont(source,recalcTimestamp=False);worker=subset.Subsetter(options=options);worker.populate(unicodes=sorted(cpSet));worker.subset(font);font.flavor='woff2';font.save(target)
            data=target.read_bytes();assert len(data)==entry['bytes'] and sha(data)==entry['sha256'],'Derivative differs from reviewed hash: '+entry['path']
            derived=TTFont(target,recalcTimestamp=False);mapped=derived.getBestCmap();assert set(mapped)==cpSet
            for cp,name in mapped.items():assert outline(original,cmap[cp])==outline(derived,name),'Glyph/metric/hint changed'
            for nameID in [0,1,2,4,6]:assert {n.toUnicode() for n in original['name'].names if n.nameID==nameID}=={n.toUnicode() for n in derived['name'].names if n.nameID==nameID},'Copyright/family name changed'
            names={cmap[cp] for cp in cpSet};expectedPairs=[p for p in originalPairs if p[0] in names and p[1] in names];actualPairs=pairs(derived)
            # Generated post names are stable for every mapped original glyph.
            assert sorted(map(repr,actualPairs))==sorted(map(repr,expectedPairs)),'Kerning values changed'
            faceReport['subsets'].append({'group':entry['group'],'bytes':len(data),'codepoints':len(cpSet),'glyphOutlineAdvanceHintsEqual':True,'kerningPairsEqual':True,'copyrightFamilyEqual':True})
            if args.apply:pending.append((target,published))
        assert source.read_bytes()==sourceBytes
        report['faces'].append(faceReport)
    if args.apply:
        for source,target in pending:target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
if args.report:pathlib.Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
