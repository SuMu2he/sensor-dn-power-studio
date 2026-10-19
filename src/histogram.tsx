import {useEffect,useRef,useState} from 'react';
import type {Result} from './core';
import {observeCanvasResolution} from './canvas-resolution';
import {chartStyleKey,defaultChartStyle,normalizeChartStyle,type ChartStyle} from './chart-style';
import {drawHistogram} from './histogram-draw';
export {drawHistogram} from './histogram-draw';
import './histogram.css';

export function Histogram({result,name,style=defaultChartStyle as ChartStyle}:{result:Result|null;name:string;style?:ChartStyle}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>observeCanvasResolution(ref.current!,(ctx,width,height)=>{
    if(result)drawHistogram(ctx,width,height,result,name,false,style);
    else{ctx.fillStyle=style.background;ctx.fillRect(0,0,width,height);ctx.fillStyle=style.tickColor;ctx.font='12px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('Select an ROI, then Calculate to view its distribution.',width/2,height/2);}
  }),[result,name,style]);
  return <div className="histogram-view" style={{background:style.background,color:style.tickColor,gridTemplateRows:`${result?'auto ':''}minmax(${Math.max(190,style.markerSize*7+60,style.tickSize*2+style.xTitleSize+style.powerTitleSize+100)}px,1fr)`}}>
    {result&&<div className="histogram-summary" role="group" aria-label="Histogram results" style={{color:style.summaryColor,fontSize:style.summarySize}}><p className="histogram-file" style={{fontWeight:style.fileBold?700:400,fontStyle:style.fileItalic?'italic':'normal'}}>{name} <span>| N = {result.count.toLocaleString('en-US')}</span></p><p className="histogram-measures" style={{fontWeight:style.summaryBold?700:400,fontStyle:style.summaryItalic?'italic':'normal'}}><span>Mean: {result.average.toFixed(3)} μW/cm² (DN {Math.round(result.mean)})</span>{' | '}<span>Peak: {result.peak.toFixed(3)} μW/cm² (DN {Math.round(result.max)})</span></p></div>}
    <div className="histogram-plot"><canvas ref={ref} aria-label="ROI grayscale histogram" className="histogram-canvas"/></div>
  </div>;
}
export function histogramBlob(result:Result,name:string,style:ChartStyle={...defaultChartStyle}):Promise<Blob>{
  const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=2160;
  const ctx=canvas.getContext('2d')!;ctx.scale(3,3);drawHistogram(ctx,1280,720,result,name,true,style);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not render the histogram.')),'image/png'));
}
const snapshotPrefix='sensor-dn-histogram:';
export function openHistogram(result:Result,name:string,style:ChartStyle={...defaultChartStyle}){
  const id=crypto.randomUUID(),key=snapshotPrefix+id;
  // A new same-origin window receives its own session snapshot. No experiment data is uploaded.
  try{sessionStorage.setItem(key,JSON.stringify({result,name,style}));}catch{throw Error('Allow browser session storage to open a separate histogram window.');}
  const url=new URL(import.meta.env.BASE_URL,window.location.href);url.searchParams.set('histogram',id);
  const win=window.open(url.href,'_blank','width=1280,height=720');
  if(!win){sessionStorage.removeItem(key);throw Error('Allow pop-ups for this site to open a separate histogram window.');}
  const cleanup=()=>{sessionStorage.removeItem(key);window.removeEventListener('message',loaded);clearTimeout(timer);};
  const loaded=(event:MessageEvent)=>{if(event.source===win&&event.origin===location.origin&&event.data?.type==='histogram-loaded'&&event.data?.id===id)cleanup();};
  const timer=window.setTimeout(cleanup,30000);window.addEventListener('message',loaded);
}
export function HistogramWindow({id}:{id:string}){
  const [snapshot]=useState<{result:Result;name:string;style:ChartStyle}|null>(()=>{
    try{const saved=JSON.parse(sessionStorage.getItem(snapshotPrefix+id)||'null');return saved&&typeof saved.name==='string'&&Number.isFinite(saved.result?.count)&&Array.isArray(saved.result?.hist?.counts)?{...saved,style:normalizeChartStyle(saved.style)}:null;}catch{return null;}
  });
  const [windowStyle,setWindowStyle]=useState<ChartStyle>(()=>snapshot?.style||{...defaultChartStyle});
  useEffect(()=>{const refresh=(event:StorageEvent)=>{if(event.key===chartStyleKey){try{setWindowStyle(normalizeChartStyle(JSON.parse(event.newValue||'null')));}catch{setWindowStyle({...defaultChartStyle});}}};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
  useEffect(()=>{document.title='Grayscale and Optical Power Density';window.opener?.postMessage({type:'histogram-loaded',id},location.origin);},[id]);
  return <main className="standalone-histogram" style={{background:windowStyle.background}}>{snapshot?<Histogram result={snapshot.result} name={snapshot.name} style={windowStyle}/>:<p className="chart-unavailable">This chart is no longer available. Close this window and select Expand again.</p>}</main>;
}
