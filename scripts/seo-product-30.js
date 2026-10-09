/* Final static metadata and intrinsic-image pass. No URL, canonical, hreflang,
 * referral or asset changes. Must follow product and banner generation. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const copy={
 ko:{hero:'스킬·능력치·성장',pet:'펫 획득·능력치·육성',topup:'타일서바이벌 충전 방법과 이용 조건, 계정 확인 사항을 살펴보고 LootBar 전용 링크로 이동하세요.',guide:'타일서바이벌 계정 연동, 2차 인증과 단계별 셀프 충전 절차를 확인하세요. LootBar 이용 전 준비 사항과 문의 안내를 제공합니다.',promotion:'타일서바이벌 전용 링크 이용 방법과 프로모션 참여·지급 조건을 확인하세요. 적용 혜택은 상품·지역·결제 조건에 따라 LootBar에서 확인할 수 있습니다.'},
 en:{hero:'Skills, Stats & Growth',pet:'Pet Acquisition, Stats & Growth',topup:'Review Tiles Survive top-up options, account requirements and conditions, then continue through the dedicated LootBar link.',guide:'Follow the Tiles Survive self-service top-up steps, including account linking, two-factor authentication and preparation before using LootBar.',promotion:'Check how the dedicated Tiles Survive link works and the promotion participation and reward conditions. Confirm applicable product, region and payment benefits on LootBar.'},
 ja:{hero:'スキル・ステータス・育成',pet:'ペットの入手・能力・育成',topup:'Tiles Surviveのチャージ方法、利用条件、アカウントの確認事項を調べて、LootBar専用リンクへ進めます。',guide:'Tiles Surviveのアカウント連携、二段階認証、セルフチャージの手順を確認できます。LootBar利用前の準備と問い合わせ案内を掲載しています。',promotion:'Tiles Survive専用リンクの利用方法とプロモーションの参加・配布条件を確認できます。商品・地域・決済条件ごとの特典はLootBarで確認してください。'},
 ru:{hero:'Навыки, характеристики и развитие',pet:'Получение, характеристики и развитие питомца',topup:'Изучите способы пополнения Tiles Survive, требования к аккаунту и условия использования, затем перейдите по специальной ссылке LootBar.',guide:'Пошаговая инструкция самостоятельного пополнения Tiles Survive: привязка аккаунта, двухфакторная аутентификация и подготовка перед использованием LootBar.',promotion:'Узнайте, как использовать специальную ссылку Tiles Survive, участвовать в акции и получать награды. Условия для товара, региона и оплаты проверяйте на LootBar.'},
 'zh-tw':{hero:'技能、屬性與養成',pet:'寵物取得、屬性與培養',topup:'查看Tiles Survive儲值方式、使用條件與帳號確認事項，再透過LootBar專屬連結前往儲值。',guide:'查看Tiles Survive帳號連結、雙重驗證與自助儲值的詳細步驟，了解使用LootBar前的準備事項及聯絡方式。',promotion:'了解Tiles Survive專屬連結的使用方式、活動參加與發放條件。商品、地區及付款條件適用的優惠請在LootBar確認。'}
};
const dimensions=new Map(),warnings=[];let pages=0,metadataPages=0,dimensionAttributes=0;
function sizeOf(file){
 if(dimensions.has(file))return dimensions.get(file);
 let result;
 try{
  const bytes=fs.readFileSync(file);
  if(file.toLowerCase().endsWith('.svg')){
   const svg=bytes.toString('utf8'),match=svg.match(/\bviewBox\s*=\s*["']\s*([-+.\d]+)[ ,]+([-+.\d]+)[ ,]+([-+.\d]+)[ ,]+([-+.\d]+)\s*["']/i);
   if(match&&Number(match[3])>0&&Number(match[4])>0)result={width:Number(match[3]),height:Number(match[4])};
   else{const width=svg.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i),height=svg.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);if(width&&height)result={width:Number(width[1]),height:Number(height[1])};}
  }else result=imageSize(bytes);
 }catch(error){warnings.push({file:path.relative(root,file),error:error.message});}
 dimensions.set(file,result);return result;
}
for(const lang of langs)for(const file of walk(path.join(root,lang)).filter(f=>f.endsWith('.html'))){
 const before=fs.readFileSync(file,'utf8'),doc=parseHTML(before).document,route='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''),canonical=doc.querySelector('link[rel=canonical]')?.href;
 const canonicalPage=canonical==='https://tilessurvive.net'+route&&!/noindex/.test(doc.querySelector('meta[name=robots]')?.content||'');
 const slug=route.slice(lang.length+2),name=doc.querySelector('h1')?.textContent.replace(/\s+/g,' ').trim();let title,description;
 if(canonicalPage){
  if(/^heroes\/[^/]+\/$/.test(slug))title=name+' '+(lang==='ru'?'— ':'· ')+copy[lang].hero+' | TilesSurvive.net';
  if(/^database\/pet-system\/[^/]+\/$/.test(slug)){
   title=name+' · '+copy[lang].pet+' | TilesSurvive.net';
   const original=doc.querySelector('meta[name=description]')?.content||'';
   description=original.includes(name)?original:name+' — '+original;
  }
  if(slug==='top-up/')description=copy[lang].topup;
  if(slug==='guides/discount-topup/')description=copy[lang].guide;
  if(slug==='guides/discount-topup-promotion/')description=copy[lang].promotion;
 }
 if(title||description){
  metadataPages++;
  if(title){doc.querySelector('title').textContent=title;for(const selector of ['meta[property="og:title"]','meta[name="twitter:title"]'])doc.querySelector(selector)?.setAttribute('content',title);}
  if(description){doc.querySelector('meta[name=description]')?.setAttribute('content',description);for(const selector of ['meta[property="og:description"]','meta[name="twitter:description"]'])doc.querySelector(selector)?.setAttribute('content',description);}
  for(const s of doc.querySelectorAll('script[type="application/ld+json"]')){
   const data=JSON.parse(s.textContent);const update=obj=>{if(!obj||typeof obj!=='object')return;const types=Array.isArray(obj['@type'])?obj['@type']:[obj['@type']];if(types.some(type=>type==='WebPage'||type==='Article')&&(!obj.url||obj.url===canonical)){if(title){if(obj.name)obj.name=title;if(obj.headline)obj.headline=title;}if(description&&obj.description)obj.description=description;}for(const value of Object.values(obj)){if(Array.isArray(value))value.forEach(update);else if(value&&typeof value==='object')update(value);}};update(data);s.textContent=JSON.stringify(data).replaceAll('<','\\u003c');
  }
 }
 const baseURL=new URL(doc.querySelector('base[href]')?.getAttribute('href')||route,'https://tilessurvive.net');
 for(const img of doc.querySelectorAll('img[src]')){
  if(Number(img.getAttribute('width'))>0&&Number(img.getAttribute('height'))>0)continue;
  const url=new URL(img.getAttribute('src'),baseURL);if(url.origin!=='https://tilessurvive.net')continue;
  const local=path.join(root,decodeURIComponent(url.pathname));if(!fs.existsSync(local)){warnings.push({page:route,src:img.getAttribute('src'),error:'Local asset not found'});continue;}
  const size=sizeOf(local);if(!size||!(size.width>0&&size.height>0)){warnings.push({page:route,src:img.getAttribute('src'),error:'No intrinsic dimensions available'});continue;}
  img.setAttribute('width',String(size.width));img.setAttribute('height',String(size.height));dimensionAttributes++;
 }
 const after='<!DOCTYPE html>\n'+doc.documentElement.outerHTML+'\n';if(before!==after){fs.writeFileSync(file,after);pages++;}
}
console.log(JSON.stringify({seoPagesChanged:pages,metadataPages,intrinsicImagePairsAdded:dimensionAttributes,measuredImageFiles:dimensions.size,warnings}));
if(warnings.length)process.exitCode=1;
