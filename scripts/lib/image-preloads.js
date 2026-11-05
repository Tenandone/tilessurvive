'use strict';
// Remove only named, inherited image hints after an owner has replaced its
// artwork. A matching displayed image/source/poster keeps its preload intact.
const origin='https://tilessurvive.net';
function localPath(value){try{const url=new URL(value,origin+'/');return url.origin===origin?url.pathname:null;}catch{return null;}}
function removeUnusedImagePreloads(document,candidates){
 const allowed=new Set(candidates),used=new Set();
 const remember=value=>{const path=localPath(value);if(path)used.add(path);};
 for(const node of document.querySelectorAll('img[src],input[type="image"][src],video[poster],svg image[href],svg image[xlink\\:href]'))remember(node.getAttribute('src')||node.getAttribute('poster')||node.getAttribute('href')||node.getAttribute('xlink:href'));
 for(const node of document.querySelectorAll('img[srcset],picture source[srcset]'))for(const item of node.getAttribute('srcset').split(','))remember(item.trim().split(/\s+/)[0]);
 let removed=0;
 for(const link of document.querySelectorAll('link[rel~="preload"][as="image"][href]')){const path=localPath(link.getAttribute('href'));if(allowed.has(path)&&!used.has(path)){
  const previous=link.previousSibling,next=link.nextSibling;
  // A standalone hint's indentation would otherwise remain as trailing spaces
  // on an empty line. Touch only that preceding indent, never neighboring text.
  if(previous?.nodeType===3&&next?.nodeType===3&&/(?:^|\r?\n)[\t ]+$/.test(previous.data)&&/^[\t ]*(?:\r?\n|$)/.test(next.data))previous.data=previous.data.replace(/[\t ]+$/,'');
  link.remove();removed++;
 }}
 return removed;
}
module.exports={removeUnusedImagePreloads};
