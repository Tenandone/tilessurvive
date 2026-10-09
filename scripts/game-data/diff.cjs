'use strict';
const fs = require('node:fs'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { assertPrivate, inputWithin, newPrivateDirectory } = require('./paths.cjs');
const {sha}=require('./record.cjs');
function diffSnapshots({ beforeDir, afterDir, outputDir }) {
  const before=assertPrivate(beforeDir), after=assertPrivate(afterDir);
  const oldSummary=JSON.parse(fs.readFileSync(inputWithin(before,'snapshot.json'))), newSummary=JSON.parse(fs.readFileSync(inputWithin(after,'snapshot.json')));
  if(oldSummary.schemaVersion!==1 || newSummary.schemaVersion!==1) throw Error('Unsupported snapshot schema');
  for(const [directory,summary] of [[before,oldSummary],[after,newSummary]]) if(sha(fs.readFileSync(inputWithin(directory,'snapshot.sqlite')))!==summary.snapshotIndexSha256) throw Error('Snapshot index hash mismatch');
  if(oldSummary.blockedTables || newSummary.blockedTables) throw Error('Incomplete snapshots cannot produce a deletion diff');
  if(JSON.stringify([...oldSummary.scope].sort())!==JSON.stringify([...newSummary.scope].sort())) throw Error('Snapshot table scope differs; absent tables must not be reported as deleted');
  const db=new DatabaseSync(inputWithin(after,'snapshot.sqlite'),{readOnly:true});
  try {
    db.prepare('ATTACH DATABASE ? AS previous').run(inputWithin(before,'snapshot.sqlite'));
    const out=newPrivateDirectory(outputDir), counts={ added:0, modified:0, deleted:0, activationUnknown:0, unchanged:0 };
    const fd=fs.openSync(path.join(out,'changes.jsonl'),'wx');
    try {
      const queries=[
        ['added','SELECT a.*, NULL AS old_values_sha256, NULL AS old_conditions_sha256 FROM records a LEFT JOIN previous.records b USING(record_key) WHERE b.record_key IS NULL'],
        ['modified','SELECT a.*, b.values_sha256 AS old_values_sha256, b.conditions_sha256 AS old_conditions_sha256 FROM records a JOIN previous.records b USING(record_key) WHERE a.values_sha256<>b.values_sha256 OR a.conditions_sha256<>b.conditions_sha256 OR a.activation<>b.activation OR a.identity_status<>b.identity_status'],
        ['deleted','SELECT b.*, b.values_sha256 AS old_values_sha256, b.conditions_sha256 AS old_conditions_sha256 FROM previous.records b LEFT JOIN records a USING(record_key) WHERE a.record_key IS NULL']
      ];
      for(const [kind,query] of queries) for(const row of db.prepare(query+' ORDER BY record_key').iterate()) {
        const change={ recordKey:row.record_key, kind, sourceId:row.source_id, previousValuesSha256:row.old_values_sha256, valuesSha256:kind==='deleted'?null:row.values_sha256, previousConditionsSha256:row.old_conditions_sha256, conditionsSha256:kind==='deleted'?null:row.conditions_sha256, identityStatus:row.identity_status, activationStatus:'UNKNOWN', meaning:kind==='deleted'?'Absent from this matched-scope snapshot; not proof of game removal':'Configuration changed; release and account eligibility remain unconfirmed' };
        fs.writeSync(fd,JSON.stringify(change)+'\n'); counts[kind]++; counts.activationUnknown++;
      }
      counts.unchanged=db.prepare('SELECT COUNT(*) AS count FROM records a JOIN previous.records b USING(record_key) WHERE a.values_sha256=b.values_sha256 AND a.conditions_sha256=b.conditions_sha256 AND a.activation=b.activation AND a.identity_status=b.identity_status').get().count;
    } finally { fs.closeSync(fd); }
    const summary={ schemaVersion:1, beforeManifestSha256:oldSummary.manifestSha256, afterManifestSha256:newSummary.manifestSha256, scope:newSummary.scope, counts, activationUnknownTotal:db.prepare("SELECT COUNT(*) AS count FROM records WHERE activation='UNKNOWN'").get().count, automaticPublication:false };
    fs.writeFileSync(path.join(out,'diff.json'),JSON.stringify(summary,null,2)+'\n'); return {outputDir:out,...summary};
  } finally { db.close(); }
}
module.exports={ diffSnapshots };
