"""Synthetic parser/gate regressions. No original client content is embedded."""
import json, sqlite3, struct, unittest
from compare import validate,compare
from unity_bytes import lz4_block,textasset

def db():
 c=sqlite3.connect(':memory:');c.executescript('''CREATE TABLE payloads(parse_status TEXT);CREATE TABLE normalized_issues(issue TEXT);CREATE TABLE identities(root_class TEXT,internal_id INTEGER,values_sha TEXT,selected INTEGER);CREATE TABLE typed_edges(selected INTEGER,reference_tag INTEGER,target_class TEXT,target_id INTEGER);INSERT INTO payloads VALUES('PARSED');''');return c

class AuditTests(unittest.TestCase):
 def test_new_removed_changed_not_silently_accepted(self):
  a,b=db(),db();a.executemany('insert into identities values(?,?,?,1)',[('A',1,'old'),('A',2,'gone')]);b.executemany('insert into identities values(?,?,?,1)',[('A',1,'new'),('A',3,'added')]);self.assertEqual(compare(a,b)['counts'],{'added':1,'removed':1,'changed':1})
 def test_same_ids_in_different_classes_are_distinct(self):
  a,b=db(),db();a.execute("insert into identities values('A',1,'same',1)");b.execute("insert into identities values('B',1,'same',1)");self.assertEqual(compare(a,b)['counts'],{'added':1,'removed':1,'changed':0})
 def test_duplicate_identical_rows_not_new_records(self):
  a,b=db(),db();a.execute("insert into identities values('A',1,'same',1)");b.executemany('insert into identities values(?,?,?,1)',[('A',1,'same')]*2);self.assertEqual(compare(a,b)['counts'],{'added':0,'removed':0,'changed':0})
 def test_conflicting_selected_alias_fails_closed(self):
  a=db();a.executemany('insert into identities values(?,?,?,1)',[('A',1,'a'),('A',1,'b')]);self.assertEqual(validate(a)['conflictingSelectedIdentities'],1)
  with self.assertRaises(ValueError):compare(db(),a)
 def test_unselected_variant_cannot_resolve_selected_orphan(self):
  a=db();a.execute("insert into identities values('A',1,'x',0)");a.execute("insert into typed_edges values(1,0,'A',1)");self.assertEqual(validate(a)['danglingSelectedTypedReferences'],1)
 def test_nonzero_tag_is_not_misclassified_as_type0_orphan(self):
  a=db();a.execute("insert into typed_edges values(1,1,'OtherNamespace',9)");self.assertEqual(validate(a)['danglingSelectedTypedReferences'],0)
 def test_parse_and_normalized_failure_block(self):
  a=db();a.execute("insert into payloads values('BLOCKED')");a.execute("insert into normalized_issues values('x')");r=validate(a);self.assertEqual(r['blockedPayloads'],1);self.assertEqual(r['normalizedDifferences'],1)
 def test_lz4_literals_and_overlapping_match(self):
  self.assertEqual(lz4_block(bytes([0x30])+b'abc',3),b'abc');self.assertEqual(lz4_block(bytes([0x11])+b'a'+bytes([1,0]),6),b'aaaaaa')
 def test_lz4_invalid_offset_and_excess_output_rejected(self):
  for data,n in [(bytes([0,0,0]),4),(bytes([0x30])+b'abc',2)]:
   with self.assertRaises(ValueError):lz4_block(data,n)
 def test_textasset_alignment_and_exact_consumption(self):
  def aligned(v):return struct.pack('<I',len(v))+v+b'\0'*((-len(v))%4)
  raw=aligned(b'Example.lua')+aligned(b'return 1');self.assertEqual(textasset(raw),('Example.lua',b'return 1'))
  with self.assertRaises(ValueError):textasset(raw+b'EXTRA')
if __name__=='__main__':unittest.main(verbosity=2)
