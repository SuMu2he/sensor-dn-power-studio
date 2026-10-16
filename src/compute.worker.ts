import {preprocess,analyze,makeResult,makePreview,type Pixels,type ImageInfo,type ROI,type Stats,type Parameters} from './core';
import {readImage,type RawPixels} from './image-io';
import {createExport,makeExportZip} from './export-data';
let raw:RawPixels|null=null,dn:Pixels|null=null,info:ImageInfo|null=null,revision=0;
let cache:{key:string;stats:Stats}|null=null;
let displayMin=0,displayMax=255;
const context=self as unknown as {postMessage:(value:unknown,transfer?:Transferable[])=>void;onmessage:((event:MessageEvent)=>void)|null};
function bytesBuffer(bytes:Uint8Array){return bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer as ArrayBuffer:bytes.slice().buffer;}
function select(roi:ROI,angle:number){
  if(!dn||!info)throw Error('Import a grayscale image first.');
  const key=JSON.stringify([revision,roi,angle]);
  if(cache?.key===key)return {stats:cache.stats,cacheHit:true};
  const stats=analyze(dn,info,roi,angle);cache={key,stats};return {stats,cacheHit:false};
}
async function handle(id:number,method:string,args:any){
  const transfers:Transferable[]=[];let value:any;
  if(method==='load'){
    const start=performance.now(),loaded=await readImage(new Uint8Array(args.bytes),args.name);
    raw=loaded.raw;info=loaded.info;const decoded=performance.now();
    const processed=preprocess(raw,args.ka,args.kb,info.bitDepth);dn=processed.dn;revision++;cache=null;
    const finished=performance.now(),preview=makePreview(dn,info,args.contrast);displayMin=preview.min;displayMax=preview.max;transfers.push(preview.rgba.buffer);
    value={info,status:processed.status,preview,pixelBytes:raw.byteLength+dn.byteLength,decodeMs:decoded-start,preprocessMs:finished-decoded};
  }else if(method==='preprocess'){
    if(!raw||!info)throw Error('Import a grayscale image first.');
    const start=performance.now(),processed=preprocess(raw,args.ka,args.kb,info.bitDepth);dn=processed.dn;revision++;cache=null;
    const preview=makePreview(dn,info,args.contrast);displayMin=preview.min;displayMax=preview.max;transfers.push(preview.rgba.buffer);
    value={status:processed.status,preview,pixelBytes:raw.byteLength+dn.byteLength,preprocessMs:performance.now()-start};
  }else if(method==='preview'){
    if(!dn||!info)throw Error('Import a grayscale image first.');
    value=makePreview(dn,info,args.contrast);displayMin=value.min;displayMax=value.max;transfers.push(value.rgba.buffer);
  }else if(method==='tile'){
    if(!dn||!info)throw Error('Import a grayscale image first.');
    const x=Math.max(0,Math.floor(args.x)),y=Math.max(0,Math.floor(args.y)),width=Math.min(Math.floor(args.width),info.width-x),height=Math.min(Math.floor(args.height),info.height-y),rgba=new Uint8ClampedArray(width*height*4),factor=255/(displayMax-displayMin);
    for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const i=(yy*width+xx)*4,v=Math.min(255,Math.max(0,Math.round((dn[(y+yy)*info.width+x+xx]-displayMin)*factor)));rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;}
    value={x,y,width,height,rgba};transfers.push(rgba.buffer);
  }else if(method==='calculate'){
    const start=performance.now(),selected=select(args.roi,args.angle);
    value=makeResult(selected.stats,args.parameters as Parameters,info!.bitDepth,args.mode,performance.now()-start,selected.cacheHit);
  }else if(method==='pixel'){
    value=dn&&info&&args.x>=1&&args.x<=info.width&&args.y>=1&&args.y<=info.height?dn[(args.y-1)*info.width+args.x-1]:null;
  }else if(method==='export'){
    const selected=select(args.roi,args.angle);
    const files=await createExport(dn!,info!,selected.stats,args.roi,args.angle,args.stem,new Uint8Array(args.histogram),text=>context.postMessage({id,progress:text}));
    if(args.zip){const bytes=makeExportZip(files),buffer=bytesBuffer(bytes);value={zip:buffer,names:files.map(f=>f.name)};transfers.push(buffer);}
    else{value={files:files.map(f=>{const buffer=bytesBuffer(f.bytes);transfers.push(buffer);return {name:f.name,buffer};})};}
  }else throw Error('Unknown computation request.');
  context.postMessage({id,value},transfers);
}
let queue=Promise.resolve();
context.onmessage=(event:MessageEvent)=>{const {id,method,args}=event.data;queue=queue.then(()=>handle(id,method,args)).catch(error=>context.postMessage({id,error:error instanceof Error?error.message:String(error)}));};
