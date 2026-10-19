import {useEffect,useRef,useState} from 'react';
import type {Result} from './core';
import {observeCanvasResolution} from './canvas-resolution';
import {chartStyleKey,defaultChartStyle,lineDash,normalizeChartStyle,type ChartStyle} from './chart-style';
import './histogram.css';

export function drawHistogram(ctx:CanvasRenderingContext2D,w:number,h:number,result:Result,name:string,includeSummary=true,style:ChartStyle={...defaultChartStyle}){
  const compact=(value:number)=>Number(value.toPrecision(4)).toString();
  const font=(size:number,bold=false)=>{ctx.font=`${bold?650:400} ${size}px "Segoe UI",Arial,sans-serif`;};
  const fitText=(text:string,maxWidth:number)=>{let value=text;while(value.length>1&&ctx.measureText(value).width>maxWidth)value=value.slice(0,-1);return value===text?value:value.slice(0,-1)+'…';};
  ctx.clearRect(0,0,w,h);ctx.fillStyle=style.background;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=style.tickColor;font(12,true);ctx.textAlign='left';ctx.textBaseline='top';
  if(includeSummary){
    const count=`  |  N = ${result.count.toLocaleString('en-US')}`;
    ctx.fillText(fitText(name+count,w-28),14,10);
    font(w<800?10:12);ctx.fillText(`Mean: ${result.average.toFixed(3)} μW/cm² (DN ${Math.round(result.mean)})   |   Peak: ${result.peak.toFixed(3)} μW/cm² (DN ${Math.round(result.max)})`,14,29);
  }
  const hist=result.hist,yMax=Math.max(1,...hist.counts)*1.25;
  font(style.tickSize);
  const left=Math.max(62,ctx.measureText(Math.round(yMax).toLocaleString('en-US')).width+style.yTitleSize+20),right=w-Math.max(24,ctx.measureText(String(hist.xlim[1])).width/2+8),top=(includeSummary?48:0)+style.powerTitleSize+style.tickSize+22,bottom=h-style.xTitleSize-style.tickSize-22,width=Math.max(1,right-left),height=Math.max(20,bottom-top);
  const x=(value:number)=>left+(value-hist.xlim[0])/(hist.xlim[1]-hist.xlim[0])*width;
  ctx.fillStyle=style.plotBackground;ctx.fillRect(left,top,width,height);
  ctx.strokeStyle=style.gridColor;ctx.lineWidth=style.gridWidth;ctx.setLineDash(lineDash(style.gridLine,style.gridWidth));font(style.tickSize);ctx.fillStyle=style.tickColor;
  for(let i=0;i<=4;i++){
    const value=yMax*i/4,y=bottom-height*i/4;
    if(style.gridVisible){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
    ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(Math.round(value).toLocaleString('en-US'),left-8,y);
  }
  ctx.setLineDash([]);const binWidth=width/hist.counts.length;ctx.fillStyle=style.barColor;ctx.globalAlpha=style.barOpacity;
  for(let i=0;i<hist.counts.length;i++){const bh=hist.counts[i]/yMax*height;ctx.fillRect(left+i*binWidth,bottom-bh,Math.max(.6,binWidth),bh);}ctx.globalAlpha=1;
  ctx.strokeStyle=style.axisColor;ctx.lineWidth=style.axisWidth;ctx.strokeRect(left,top,width,height);
  ctx.fillStyle=style.tickColor;font(style.tickSize);
  for(const tick of hist.ticks){const px=x(tick);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,top+5);ctx.moveTo(px,bottom);ctx.lineTo(px,bottom+5);ctx.stroke();ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(String(tick),px,bottom+7);ctx.textBaseline='bottom';ctx.fillText(compact(tick*result.factor),px,top-6);}
  ctx.fillStyle=style.titleColor;font(style.xTitleSize,true);ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(fitText(style.xTitle,width),(left+right)/2,h-4);
  font(style.powerTitleSize,true);ctx.fillText(fitText(style.powerTitle,width),(left+right)/2,top-style.tickSize-13);
  ctx.save();ctx.translate(style.yTitleSize/2+5,(top+bottom)/2);ctx.rotate(-Math.PI/2);font(style.yTitleSize,true);ctx.textBaseline='middle';ctx.fillText(fitText(style.yTitle,height),0,0);ctx.restore();
  font(style.markerSize,true);
  const labels=[`Mean ${result.average.toFixed(3)} μW/cm²`,`Peak ${result.peak.toFixed(3)} μW/cm²`];
  const horizontal=height<Math.max(...labels.map(label=>ctx.measureText(label).width))+12||Math.abs(x(result.mean)-x(result.max))<style.markerSize*3+10||x(result.mean)<left+style.markerSize*2||x(result.max)>right-style.markerSize*2;
  const label=(text:string,px:number,py:number,color:string,rotate:boolean)=>{
    ctx.save();ctx.translate(px,py);if(rotate)ctx.rotate(-Math.PI/2);font(style.markerSize,true);ctx.textAlign='center';ctx.textBaseline='middle';
    const display=fitText(text,rotate?height-8:width-12),length=ctx.measureText(display).width;
    if(style.labelBackground){ctx.globalAlpha=.96;ctx.fillStyle=style.plotBackground;ctx.fillRect(-length/2-3,-style.markerSize/2-3,length+6,style.markerSize+6);ctx.globalAlpha=1;}
    ctx.fillStyle=color;ctx.fillText(display,0,0);ctx.restore();
  };
  const marker=(dn:number,power:number,title:string,color:string,lineWidth:number,line:ChartStyle['meanLine'],row:number)=>{
    const px=x(dn);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(lineDash(line,lineWidth/1.5));ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.setLineDash([]);
    if(horizontal){const text=`${title} ${power.toFixed(3)} μW/cm²  |  DN ${Math.round(dn)}`;font(style.markerSize,true);const half=Math.min(width-12,ctx.measureText(text).width)/2,tx=Math.max(left+half+6,Math.min(right-half-6,px+half+12));label(text,tx,top+height*(row===0?.28:.72),color,false);}
    else {label(`${title} ${power.toFixed(3)} μW/cm²`,px-style.markerSize-3,(top+bottom)/2,color,true);label(`DN ${Math.round(dn)}`,px+style.markerSize+3,(top+bottom)/2,color,true);}
  };
  if(Math.abs(result.mean-result.max)<1e-10)marker(result.mean,result.average,'Mean = Peak',style.meanColor,style.meanWidth,style.meanLine,0);
  else{marker(result.mean,result.average,'Mean',style.meanColor,style.meanWidth,style.meanLine,0);marker(result.max,result.peak,'Peak',style.peakColor,style.peakWidth,style.peakLine,1);}
}

export function Histogram({result,name,style=defaultChartStyle as ChartStyle}:{result:Result|null;name:string;style?:ChartStyle}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>observeCanvasResolution(ref.current!,(ctx,width,height)=>{
    if(result)drawHistogram(ctx,width,height,result,name,false,style);
    else{ctx.fillStyle=style.background;ctx.fillRect(0,0,width,height);ctx.fillStyle=style.tickColor;ctx.font='12px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('Select an ROI, then Calculate to view its distribution.',width/2,height/2);}
  }),[result,name,style]);
  return <div className="histogram-view" style={{background:style.background,color:style.tickColor,gridTemplateRows:`${result?'auto ':''}minmax(${Math.max(190,style.markerSize*7+60,style.tickSize*2+style.xTitleSize+style.powerTitleSize+100)}px,1fr)`}}>
    {result&&<div className="histogram-summary" role="group" aria-label="Histogram results"><p className="histogram-file">{name} <span>| N = {result.count.toLocaleString('en-US')}</span></p><p className="histogram-measures"><span>Mean: {result.average.toFixed(3)} μW/cm² (DN {Math.round(result.mean)})</span>{' | '}<span>Peak: {result.peak.toFixed(3)} μW/cm² (DN {Math.round(result.max)})</span></p></div>}
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
