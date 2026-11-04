'use strict';
const entry=require('../../data/i18n/contextual-terms.json').entries.find(row=>row.id==='undine-skill-2');
function correctSearchEntry(item) {
  const match=item.url?.match(/^\/([^/]+)\/heroes\/undine\/#character-skill-0-2$/),locale=match?.[1];
  if(!Object.hasOwn(entry.existingDisplayNames,locale))return item;
  const legacy=entry.existingDisplayNames[locale],name=entry.names[locale].value;
  if(item.title!==legacy&&item.title!==name)throw Error('Unreviewed Undine search title: '+item.url);
  let aliases=item.aliases||'';
  if(typeof aliases!=='string')throw Error('Unexpected Undine search aliases: '+item.url);
  for(const alias of new Set([legacy,entry.sourceAlias]))if(!aliases.includes(alias))aliases=(aliases+' '+alias).trim();
  return {...item,title:name,aliases};
}
module.exports={correctSearchEntry};
