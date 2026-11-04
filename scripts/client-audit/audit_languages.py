"""Re-run retained data-only language decoder in memory; never execute game code.

The decoder is supplied explicitly and must be the reviewed local Python parser,
not a game binary. No key, plaintext dictionary or client code is exported.
"""
import argparse, collections, hashlib, importlib.util, json, sqlite3, sys, zipfile
from pathlib import Path
sys.dont_write_bytecode=True

def main():
    p=argparse.ArgumentParser();p.add_argument('--corpus',required=True);p.add_argument('--decoder',required=True);p.add_argument('--inventory-db',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    root=Path(a.corpus).resolve();out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2]
    assert out not in (repo,root) and repo not in out.parents and root not in out.parents
    assert not out.exists(),'Preserve previous audit'
    decoder=Path(a.decoder).resolve();spec=importlib.util.spec_from_file_location('retained_language_decoder',decoder);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    sha=lambda b:hashlib.sha256(b).hexdigest();m=json.loads((root/'selected-source-manifest.json').read_text(encoding='utf8'));apk=Path(m['sourcePack']['filePath']).parent/'base.apk'
    with zipfile.ZipFile(apk) as z:metadata=z.read('assets/bin/Data/Managed/Metadata/global-metadata.dat');key=module.language_key(metadata)
    db=sqlite3.connect('file:'+Path(a.inventory_db).resolve().as_posix()+'?mode=ro',uri=True)
    dictionaries={};rows=[];folder=root/'authorized-decryption'
    for file in sorted((folder/'raw-language').glob('*.enc')):
        ciphertext=file.read_bytes();plain=module.xor_bytes(ciphertext,key);strings=module.parse_language(plain)
        stored_json=folder/'decoded-language'/(file.stem+'.json');stored_bin=stored_json.with_suffix('.bin')
        assert module.xor_bytes(module.encode_language(strings),key)==ciphertext
        assert json.loads(stored_json.read_text(encoding='utf8'))==strings and stored_bin.read_bytes()==plain
        dictionaries[file.stem]=strings
        members=[{'container':x[0],'member':x[1]} for x in db.execute('select container,member from zip_members where sha256=?',(sha(ciphertext),))]
        rows.append({'name':file.stem,'ciphertextPath':str(file),'ciphertextSHA256':sha(ciphertext),'plaintextSHA256':sha(plain),'decodedJSONSHA256':sha(stored_json.read_bytes()),'entries':len(strings),'roundTrip':True,'storedDictionaryMatches':True,'packageByteMatches':members,'sameSHAWithoutPackageMatch':'Retained loose-language source only; upstream package origin not asserted' if not members else None})
    assert dictionaries and 'loading-en' in dictionaries and 'ingame-apk-en' in dictionaries,'Required reference language cohorts absent'
    for r in rows:
        en=dictionaries['loading-en' if r['name'].startswith('loading-') else 'ingame-apk-en'];current=dictionaries[r['name']];r.update({'missingEnglishKeys':sorted(set(en)-set(current)),'extraEnglishKeys':sorted(set(current)-set(en)),'emptyValueCount':sum(v=='' for v in current.values())})
    result={'status':'PASS','decoderPath':str(decoder),'decoderSHA256':sha(decoder.read_bytes()),'sourceAPK':str(apk),'sourceAPKSHA256':sha(apk.read_bytes()),'metadataSHA256':sha(metadata),'files':len(rows),'entriesAcrossCohorts':sum(r['entries'] for r in rows),'rows':rows,'method':'Fresh read of original encrypted payloads and APK metadata; retained reviewed data-only decoder; full binary and encrypted round trip; exact existing JSON and binary comparison. No client execution/network/key logging.','limits':['Repeated keys across language/cohort copies are not distinct gameplay records.','Loading-only AR/VI/NO is not evidence for a complete in-game glossary.','A key absent from English may be a literal/obsolete/test identifier; field consumers and release status must be checked.']}
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({k:result[k] for k in ('status','files','entriesAcrossCohorts')}))
if __name__=='__main__':main()
