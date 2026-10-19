export type LineStyle='solid'|'dashed'|'dotted';
export type ChartStyle={
  barColor:string;barOpacity:number;
  meanColor:string;meanWidth:number;meanLine:LineStyle;peakColor:string;peakWidth:number;peakLine:LineStyle;
  meanLabelColor:string;peakLabelColor:string;markerSize:number;markerBold:boolean;markerItalic:boolean;labelBackground:boolean;
  axisColor:string;axisWidth:number;tickColor:string;tickSize:number;tickBold:boolean;tickItalic:boolean;
  titleColor:string;titleBold:boolean;titleItalic:boolean;xTitle:string;powerTitle:string;yTitle:string;xTitleSize:number;powerTitleSize:number;yTitleSize:number;
  summaryColor:string;summarySize:number;fileBold:boolean;fileItalic:boolean;summaryBold:boolean;summaryItalic:boolean;
  gridVisible:boolean;gridColor:string;gridWidth:number;gridLine:LineStyle;background:string;plotBackground:string;
};
export const defaultChartStyle:Readonly<ChartStyle>={
  barColor:'#367d5e',barOpacity:.7,
  meanColor:'#1756a9',meanWidth:2.5,meanLine:'dashed',peakColor:'#bd3046',peakWidth:2.5,peakLine:'solid',
  meanLabelColor:'#1756a9',peakLabelColor:'#bd3046',markerSize:16,markerBold:true,markerItalic:false,labelBackground:false,
  axisColor:'#000000',axisWidth:1.5,tickColor:'#000000',tickSize:16,tickBold:false,tickItalic:false,
  titleColor:'#000000',titleBold:true,titleItalic:false,xTitle:'Grayscale Value (DN)',powerTitle:'Optical Power Density (μW/cm²)',yTitle:'Pixel Count',xTitleSize:16,powerTitleSize:16,yTitleSize:16,
  summaryColor:'#000000',summarySize:12,fileBold:true,fileItalic:false,summaryBold:false,summaryItalic:false,
  gridVisible:true,gridColor:'#dce4de',gridWidth:1,gridLine:'solid',background:'#ffffff',plotBackground:'#ffffff',
};
export const chartStyleKey='sensor-dn-chart-style-v1';
export const numericStyleLimits:Partial<Record<keyof ChartStyle,[number,number]>>={barOpacity:[.05,1],meanWidth:[.5,8],peakWidth:[.5,8],axisWidth:[.5,6],tickSize:[8,24],xTitleSize:[8,32],powerTitleSize:[8,32],yTitleSize:[8,32],markerSize:[8,24],summarySize:[8,32],gridWidth:[.25,4]};
export function normalizeChartStyle(value:unknown):ChartStyle {
  const style={...defaultChartStyle};if(!value||typeof value!=='object')return style;
  const source=value as Record<string,unknown>;
  for(const key of Object.keys(style) as (keyof ChartStyle)[]){
    const next=source[key],limits=numericStyleLimits[key];
    if(limits){if(typeof next==='number'&&Number.isFinite(next))(style as Record<string,unknown>)[key]=Math.max(limits[0],Math.min(limits[1],next));continue;}
    if(typeof style[key]==='boolean'){if(typeof next==='boolean')(style as Record<string,unknown>)[key]=next;continue;}
    if(typeof next!=='string')continue;
    if(key.endsWith('Line')){if(['solid','dashed','dotted'].includes(next))(style as Record<string,unknown>)[key]=next;}
    else if(key.endsWith('Title'))(style as Record<string,unknown>)[key]=next.slice(0,120);
    else if(/^#[0-9a-f]{6}$/i.test(next))(style as Record<string,unknown>)[key]=next;
  }
  // Older saved settings used the line colors for labels and the tick color for the summary.
  for(const [newKey,oldKey] of [['meanLabelColor','meanColor'],['peakLabelColor','peakColor'],['summaryColor','tickColor']] as const){
    if(!(newKey in source)&&typeof source[oldKey]==='string'&&/^#[0-9a-f]{6}$/i.test(source[oldKey]))style[newKey]=source[oldKey];
  }
  return style;
}
export function readChartStyle():ChartStyle {try{return normalizeChartStyle(JSON.parse(localStorage.getItem(chartStyleKey)||'null'));}catch{return {...defaultChartStyle};}}
export function saveChartStyle(style:ChartStyle){try{localStorage.setItem(chartStyleKey,JSON.stringify(normalizeChartStyle(style)));}catch{/* Styling remains available when storage is disabled. */}}
export const lineDash=(style:LineStyle,width=1)=>style==='dashed'?[7*width,4*width]:style==='dotted'?[width,3*width]:[];
export const chartFont=(size:number,bold=false,italic=false)=>`${italic?'italic ':''}${bold?700:400} ${size}px "Segoe UI",Arial,sans-serif`;
