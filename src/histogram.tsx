import {useEffect,useRef} from 'react';
import type {Result} from './core';
const compact=(v:number)=>Number(v.toPrecision(4)).toString();
export function drawHistogram(ctx:CanvasRenderingContext2D,w:number,h:number,result:Result,name:string){
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  const font=(size:number,bold=false)=>{ctx.font=`${bold?650:400} ${size}px "Segoe UI",Arial,sans-serif`;};
  ctx.fillStyle='#24382f';font(12,true);ctx.textAlign='left';ctx.textBaseline='top';
  const label=name.length>110?name.slice(0,107)+'…':name;ctx.fillText(`${label}  |  N = ${result.count.toLocaleString('en-US')}`,14,10);
  font(w<800?10:12);ctx.fillText(`Mean: ${result.average.toFixed(3)} μW/cm² (DN ${Math.round(result.mean)})   |   Peak: ${result.peak.toFixed(3)} μW/cm² (DN ${Math.round(result.max)})`,14,29);
  const left=64,right=w-24,top=91,bottom=h-47,width=right-left,height=Math.max(20,bottom-top),hist=result.hist;
  const yMax=Math.max(1,...hist.counts)*1.25,x=(v:number)=>left+(v-hist.xlim[0])/(hist.xlim[1]-hist.xlim[0])*width;
  ctx.strokeStyle='#e2e8e3';ctx.lineWidth=1;font(10);ctx.fillStyle='#637168';
  for(let i=0;i<=4;i++){const v=yMax*i/4,y=bottom-height*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(Math.round(v).toLocaleString('en-US'),left-8,y);}
  const binWidth=width/hist.counts.length;ctx.fillStyle='#527b6b';for(let i=0;i<hist.counts.length;i++){const bh=hist.counts[i]/yMax*height;ctx.fillRect(left+i*binWidth,bottom-bh,Math.max(.6,binWidth),bh);}
  ctx.strokeStyle='#7d8c82';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.moveTo(left,top);ctx.lineTo(right,top);ctx.stroke();
  ctx.fillStyle='#3b4d42';font(10);for(const tick of hist.ticks){const px=x(tick);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,top+5);ctx.moveTo(px,bottom);ctx.lineTo(px,bottom+5);ctx.stroke();ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(String(tick),px,bottom+8);ctx.textBaseline='bottom';ctx.fillText(compact(tick*result.factor),px,top-7);}
  font(11,true);ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('Grayscale Value (DN)',(left+right)/2,h-17);ctx.textBaseline='bottom';ctx.fillText('Optical Power Density (μW/cm²)',(left+right)/2,top-26);
  ctx.save();ctx.translate(16,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.textBaseline='middle';ctx.fillText('Pixel Count',0,0);ctx.restore();
  const marker=(dn:number,power:number,title:string,color:string,dashed:boolean)=>{
    const px=x(dn);ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.setLineDash(dashed?[6,5]:[]);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;font(10,true);
    for(const [dx,text]of [[-10,`${title} ${power.toFixed(3)} μW/cm²`],[13,`DN ${Math.round(dn)}`]] as const){ctx.save();ctx.translate(px+dx,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,0);ctx.restore();}
  };
  if(Math.abs(result.mean-result.max)<1e-10)marker(result.mean,result.average,'Mean = Peak','#835282',false);
  else{marker(result.mean,result.average,'Mean','#bd7625',true);marker(result.max,result.peak,'Peak','#bf4e58',false);}
}
export function Histogram({result,name}:{result:Result|null;name:string}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const canvas=ref.current!;const draw=()=>{const {width,height}=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);if(result)drawHistogram(ctx,width,height,result,name);else{ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#8b988f';ctx.font='12px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('Select an ROI, then Calculate to view its distribution.',width/2,height/2);}};const observer=new ResizeObserver(draw);observer.observe(canvas);draw();return()=>observer.disconnect();},[result,name]);
  return <canvas ref={ref} aria-label="ROI grayscale histogram" className="histogram-canvas"/>;
}
export function histogramBlob(result:Result,name:string):Promise<Blob>{
  const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1220;const ctx=canvas.getContext('2d')!;ctx.scale(2400/1280,1220/650);drawHistogram(ctx,1280,650,result,name);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not render the histogram.')),'image/png'));
}
export function openHistogram(result:Result,name:string){
  const win=window.open('','_blank','width=1280,height=720');if(!win)throw Error('Allow pop-ups for this site to open a separate histogram window.');
  win.document.title='Grayscale and Optical Power Density';win.document.body.style.cssText='margin:0;background:white;';const canvas=win.document.createElement('canvas');canvas.width=1280;canvas.height=650;canvas.style.cssText='width:100%;height:auto;display:block';win.document.body.append(canvas);drawHistogram(canvas.getContext('2d')!,1280,650,result,name);
}
