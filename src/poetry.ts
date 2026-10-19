export type Poem={content:string;attribution:string;origin:'online'|'offline'};
export const POETRY_ENDPOINT='https://v1.jinrishici.com/all.json';
const HISTORY_KEY='sensor-dn-poetry-history-v1',HISTORY_LIMIT=40;
const fallbackPoems=[
  ['明月松间照，清泉石上流。','王维《山居秋暝》'],
  ['行到水穷处，坐看云起时。','王维《终南别业》'],
  ['欲穷千里目，更上一层楼。','王之涣《登鹳雀楼》'],
  ['采菊东篱下，悠然见南山。','陶渊明《饮酒·其五》'],
  ['会当凌绝顶，一览众山小。','杜甫《望岳》'],
  ['长风破浪会有时，直挂云帆济沧海。','李白《行路难·其一》'],
  ['竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。','苏轼《定风波·莫听穿林打叶声》'],
  ['人间有味是清欢。','苏轼《浣溪沙·细雨斜风作晓寒》'],
  ['斯是陋室，惟吾德馨。','刘禹锡《陋室铭》'],
  ['问渠那得清如许？为有源头活水来。','朱熹《观书有感·其一》'],
  ['不畏浮云遮望眼，自缘身在最高层。','王安石《登飞来峰》'],
  ['纸上得来终觉浅，绝知此事要躬行。','陆游《冬夜读书示子聿》'],
] as const;

/** Treat the API response as text data. JSX renders it without HTML interpretation. */
export function parseOnlinePoem(value:unknown):Poem|null{
  if(!value||typeof value!=='object')return null;
  const data=value as Record<string,unknown>;
  const content=typeof data.content==='string'?data.content.trim():'';
  const author=typeof data.author==='string'?data.author.trim():'';
  const title=typeof data.origin==='string'?data.origin.trim():'';
  if(!content||content.length>72||(!author&&!title)||author.length>80||title.length>120)return null;
  return {content,attribution:author+(title?`《${title}》`:''),origin:'online'};
}

type HistoryStore=Pick<Storage,'getItem'|'setItem'>;
function browserStorage():HistoryStore|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}

export function createPoetryClient({fetchImpl=fetch,storage=browserStorage(),timeoutMs=2800}:{fetchImpl?:typeof fetch;storage?:HistoryStore|null;timeoutMs?:number}={}){
  let recent:string[]=[];
  try{const saved=JSON.parse(storage?.getItem(HISTORY_KEY)||'[]');if(Array.isArray(saved))recent=saved.filter((item):item is string=>typeof item==='string'&&item.length>0&&item.length<=72).slice(-HISTORY_LIMIT);}catch{/* Unavailable history never blocks the dialogs. */}
  let ready:Poem|null=null,pending:Promise<Poem|null>|null=null;
  const remember=(content:string)=>{
    recent=[...recent.filter(item=>item!==content),content].slice(-HISTORY_LIMIT);
    try{storage?.setItem(HISTORY_KEY,JSON.stringify(recent));}catch{/* Private browsing or full storage. */}
  };
  const requestOnline=async():Promise<Poem|null>=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      for(let attempt=0;attempt<3;attempt++){
        const url=new URL(POETRY_ENDPOINT);url.searchParams.set('_',`${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const response=await fetchImpl(url.href,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
        if(!response.ok)return null;
        const poem=parseOnlinePoem(await response.json());if(!poem)return null;
        if(!recent.includes(poem.content))return poem;
      }
      return null;
    }catch{return null;}finally{clearTimeout(timer);}
  };
  const prefetch=():Promise<Poem|null>=>{
    if(ready)return Promise.resolve(ready);
    if(!pending)pending=requestOnline().then(poem=>{ready=poem;return poem;}).finally(()=>{pending=null;});
    return pending;
  };
  const takePrepared=():Poem|null=>{
    const poem=ready;ready=null;
    if(!poem||recent.includes(poem.content))return null;
    remember(poem.content);return poem;
  };
  const next=async():Promise<Poem|null>=>{
    // Rapidly switching dialogs may have another consumer waiting on the same prefetch.
    for(let attempt=0;attempt<2;attempt++){
      if(!await prefetch())return null;
      const poem=takePrepared();if(poem)return poem;
    }
    return null;
  };
  const fallback=():Poem=>{
    const available=fallbackPoems.filter(([content])=>!recent.slice(-(fallbackPoems.length-1)).includes(content));
    const [content,attribution]=available[Math.floor(Math.random()*available.length)];
    remember(content);return {content,attribution,origin:'offline'};
  };
  return {prefetch,takePrepared,next,fallback};
}

export const poetryClient=createPoetryClient();
