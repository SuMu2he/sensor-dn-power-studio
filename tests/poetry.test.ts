import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoetryClient,parseOnlinePoem,POETRY_ENDPOINT} from '../src/poetry';

const response=(content:string)=>new Response(JSON.stringify({content,author:'Author',origin:'Title'}),{headers:{'Content-Type':'application/json'}});
function historyStore(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}

test('online poetry validates text fields and attribution',()=>{
  assert.deepEqual(parseOnlinePoem({content:'  Poem  ',author:' Author ',origin:' Title '}),{content:'Poem',attribution:'Author《Title》',origin:'online'});
  for(const value of [null,{},[],{content:''},{content:'Poem'},{content:1,author:'A'},{content:'x'.repeat(73),author:'A'}])assert.equal(parseOnlinePoem(value),null);
  assert.equal(parseOnlinePoem({content:'Poem',origin:'Title'})?.attribution,'《Title》');
});

test('prefetch is shared, consumed once, uncached and anonymous',async()=>{
  const requests:{url:string;options:RequestInit|undefined}[]=[];
  const client=createPoetryClient({storage:null,fetchImpl:async(url,options)=>{requests.push({url:String(url),options});return response('Poem '+requests.length);}});
  await Promise.all([client.prefetch(),client.prefetch()]);assert.equal(requests.length,1);
  assert.equal(client.takePrepared()?.content,'Poem 1');assert.equal(client.takePrepared(),null);
  assert.equal((await client.next())?.content,'Poem 2');assert.equal(requests.length,2);
  for(const request of requests){const url=new URL(request.url);assert.equal(url.origin+url.pathname,POETRY_ENDPOINT);assert.ok(url.searchParams.has('_'));assert.equal(request.options?.cache,'no-store');assert.equal(request.options?.credentials,'omit');assert.equal(request.options?.referrerPolicy,'no-referrer');assert.equal(request.options?.body,undefined);}
  assert.notEqual(requests[0].url,requests[1].url);
});

test('recent online poems survive reloads and duplicates have bounded retries',async()=>{
  const storage=historyStore();
  const first=createPoetryClient({storage,fetchImpl:async()=>response('Already seen')});await first.next();
  let calls=0;
  const reloaded=createPoetryClient({storage,fetchImpl:async()=>response(++calls===1?'Already seen':'Fresh poem')});
  assert.equal((await reloaded.next())?.content,'Fresh poem');assert.equal(calls,2);
  calls=0;const repeated=createPoetryClient({storage,fetchImpl:async()=>{calls++;return response('Already seen');}});
  assert.equal(await repeated.next(),null);assert.equal(calls,3);
});

test('rapid dialog consumers receive different online poems',async()=>{
  let calls=0;const client=createPoetryClient({storage:null,fetchImpl:async()=>response('Poem '+ ++calls)});
  const [a,b]=await Promise.all([client.next(),client.next()]);assert.ok(a&&b);assert.notEqual(a.content,b.content);assert.equal(calls,2);
});

test('network, HTTP, JSON, timeout and storage failures preserve offline operation',async()=>{
  const failureFetches:typeof fetch[]=[async()=>{throw Error('Offline');},async()=>new Response('',{status:503}),async()=>new Response('not JSON'),async()=>new Response('{}')];
  for(const fetchImpl of failureFetches){const client=createPoetryClient({fetchImpl,storage:null});assert.equal(await client.next(),null);assert.equal(client.fallback().origin,'offline');}
  let aborted=false;
  const timeout=createPoetryClient({storage:null,timeoutMs:10,fetchImpl:async(_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true}))});
  assert.equal(await timeout.next(),null);assert.ok(aborted);
  const client=createPoetryClient({storage:{getItem:()=>{throw Error('Storage denied');},setItem:()=>{throw Error('Storage denied');}},fetchImpl:async()=>response('Online despite storage denial')});
  assert.equal((await client.next())?.origin,'online');
  assert.equal(new Set(Array.from({length:12},()=>client.fallback().content)).size,12);
});
