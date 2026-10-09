/* Reviewed editorial differences only. Numeric tables, stage choices and effect
 * paragraphs are never normalized here. Keep the per-route exact mapping visible. */
const rules=require('./content-301-rules.json');
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
function expectedSkillText(value,relative){
 let expected=norm(value);
 if(!/^(ko|en|ja|ru|zh-tw)\/heroes\/(knotty|undine)\/index\.html$/.test(relative))return expected;
 for(const rule of rules.filter(r=>r.route===relative&&r.selector==='p.ts-evidence-label'&&['remove-repeated-evidence-label','concise-player-condition'].includes(r.rule))){
  // These captions only identify the screenshot or state an unknown skill level.
  // The replacement still states that values may not be maximum-level values.
  if(!expected.includes(norm(rule.before)))continue;
  if(/\d/.test(rule.before)||/\d/.test(rule.after||''))throw Error('A numerical skill allowance requires separate review');
  expected=expected.replaceAll(norm(rule.before),norm(rule.after));
 }
 return norm(expected);
}
function exactEditorialReplacement(relative,value){
 const match=rules.find(r=>r.route===relative&&norm(r.before)===norm(value));
 return match?{matched:true,value:norm(match.after)}:{matched:false,value:norm(value)};
}
module.exports={expectedSkillText,exactEditorialReplacement};
