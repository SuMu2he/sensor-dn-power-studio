import type {Result} from './core';
import {chartFont,defaultChartStyle,lineDash,type ChartStyle} from './chart-style';

export function drawHistogram(ctx:CanvasRenderingContext2D,w:number,h:number,result:Result,name:string,includeSummary=true,style:ChartStyle={...defaultChartStyle}){
  const compact=(value:number)=>Number(value.toPrecision(4)).toString();
  const font=(size:number,bold=false,italic=false)=>{ctx.font=chartFont(size,bold,italic);};
  const fitText=(text:string,maxWidth:number)=>{let value=text;while(value.length>1&&ctx.measureText(value).width>maxWidth)value=value.slice(0,-1);return value===text?value:value.slice(0,-1)+'…';};
  ctx.clearRect(0,0,w,h);ctx.fillStyle=style.background;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=style.summaryColor;font(12,style.fileBold,style.fileItalic);ctx.textAlign='left';ctx.textBaseline='top';
  if(includeSummary){
    const count=`  |  N = ${result.count.toLocaleString('en-US')}`;
    ctx.fillText(fitText(name+count,w-28),14,10);
    font(w<800?10:12,style.summaryBold,style.summaryItalic);ctx.fillText(`Mean: ${result.average.toFixed(3)} μW/cm² (DN ${Math.round(result.mean)})   |   Peak: ${result.peak.toFixed(3)} μW/cm² (DN ${Math.round(result.max)})`,14,29);
  }
  const hist=result.hist,yMax=Math.max(1,...hist.counts)*1.25;
  font(style.tickSize,style.tickBold,style.tickItalic);
  const left=Math.max(62,ctx.measureText(Math.round(yMax).toLocaleString('en-US')).width+style.yTitleSize+20),right=w-Math.max(24,ctx.measureText(String(hist.xlim[1])).width/2+8),top=(includeSummary?48:0)+style.powerTitleSize+style.tickSize+22,bottom=h-style.xTitleSize-style.tickSize-22,width=Math.max(1,right-left),height=Math.max(20,bottom-top);
  const x=(value:number)=>left+(value-hist.xlim[0])/(hist.xlim[1]-hist.xlim[0])*width;
  ctx.fillStyle=style.plotBackground;ctx.fillRect(left,top,width,height);
  ctx.strokeStyle=style.gridColor;ctx.lineWidth=style.gridWidth;ctx.setLineDash(lineDash(style.gridLine,style.gridWidth));font(style.tickSize,style.tickBold,style.tickItalic);ctx.fillStyle=style.tickColor;
  for(let i=0;i<=4;i++){
    const value=yMax*i/4,y=bottom-height*i/4;
    if(style.gridVisible){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
    ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(Math.round(value).toLocaleString('en-US'),left-8,y);
  }
  ctx.setLineDash([]);const binWidth=width/hist.counts.length;ctx.fillStyle=style.barColor;ctx.globalAlpha=style.barOpacity;
  for(let i=0;i<hist.counts.length;i++){const bh=hist.counts[i]/yMax*height;ctx.fillRect(left+i*binWidth,bottom-bh,Math.max(.6,binWidth),bh);}ctx.globalAlpha=1;
  ctx.strokeStyle=style.axisColor;ctx.lineWidth=style.axisWidth;ctx.strokeRect(left,top,width,height);
  ctx.fillStyle=style.tickColor;font(style.tickSize,style.tickBold,style.tickItalic);
  for(const tick of hist.ticks){const px=x(tick);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,top+5);ctx.moveTo(px,bottom);ctx.lineTo(px,bottom+5);ctx.stroke();ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(String(tick),px,bottom+7);ctx.textBaseline='bottom';ctx.fillText(compact(tick*result.factor),px,top-6);}
  ctx.fillStyle=style.titleColor;font(style.xTitleSize,style.titleBold,style.titleItalic);ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(fitText(style.xTitle,width),(left+right)/2,h-4);
  font(style.powerTitleSize,style.titleBold,style.titleItalic);ctx.fillText(fitText(style.powerTitle,width),(left+right)/2,top-style.tickSize-13);
  ctx.save();ctx.translate(style.yTitleSize/2+5,(top+bottom)/2);ctx.rotate(-Math.PI/2);font(style.yTitleSize,style.titleBold,style.titleItalic);ctx.textBaseline='middle';ctx.fillText(fitText(style.yTitle,height),0,0);ctx.restore();
  font(style.markerSize,style.markerBold,style.markerItalic);
  const labels=[`Mean ${result.average.toFixed(3)} μW/cm²`,`Peak ${result.peak.toFixed(3)} μW/cm²`];
  const horizontal=height<Math.max(...labels.map(label=>ctx.measureText(label).width))+12||Math.abs(x(result.mean)-x(result.max))<style.markerSize*3+10||x(result.mean)<left+style.markerSize*2||x(result.max)>right-style.markerSize*2;
  const label=(text:string,px:number,py:number,color:string,rotate:boolean)=>{
    ctx.save();ctx.translate(px,py);if(rotate)ctx.rotate(-Math.PI/2);font(style.markerSize,style.markerBold,style.markerItalic);ctx.textAlign='center';ctx.textBaseline='middle';
    const display=fitText(text,rotate?height-8:width-12),length=ctx.measureText(display).width;
    if(style.labelBackground){ctx.globalAlpha=.96;ctx.fillStyle=style.plotBackground;ctx.fillRect(-length/2-3,-style.markerSize/2-3,length+6,style.markerSize+6);ctx.globalAlpha=1;}
    ctx.fillStyle=color;ctx.fillText(display,0,0);ctx.restore();
  };
  const marker=(dn:number,power:number,title:string,color:string,labelColor:string,lineWidth:number,line:ChartStyle['meanLine'],row:number)=>{
    const px=x(dn);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(lineDash(line,lineWidth/1.5));ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.setLineDash([]);
    if(horizontal){const text=`${title} ${power.toFixed(3)} μW/cm²  |  DN ${Math.round(dn)}`;font(style.markerSize,style.markerBold,style.markerItalic);const half=Math.min(width-12,ctx.measureText(text).width)/2,tx=Math.max(left+half+6,Math.min(right-half-6,px+half+12));label(text,tx,top+height*(row===0?.28:.72),labelColor,false);}
    else {label(`${title} ${power.toFixed(3)} μW/cm²`,px-style.markerSize-3,(top+bottom)/2,labelColor,true);label(`DN ${Math.round(dn)}`,px+style.markerSize+3,(top+bottom)/2,labelColor,true);}
  };
  if(Math.abs(result.mean-result.max)<1e-10)marker(result.mean,result.average,'Mean = Peak',style.meanColor,style.meanLabelColor,style.meanWidth,style.meanLine,0);
  else{marker(result.mean,result.average,'Mean',style.meanColor,style.meanLabelColor,style.meanWidth,style.meanLine,0);marker(result.max,result.peak,'Peak',style.peakColor,style.peakLabelColor,style.peakWidth,style.peakLine,1);}
}

