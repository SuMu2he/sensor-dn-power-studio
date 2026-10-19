export type LineStyle='solid'|'dashed'|'dotted';
export type ChartStyle={barColor:string;barOpacity:number;meanColor:string;meanWidth:number;meanLine:LineStyle;peakColor:string;peakWidth:number;peakLine:LineStyle;axisColor:string;axisWidth:number;tickColor:string;tickSize:number;titleColor:string;xTitle:string;powerTitle:string;yTitle:string;xTitleSize:number;powerTitleSize:number;yTitleSize:number;markerSize:number;labelBackground:boolean;gridVisible:boolean;gridColor:string;gridWidth:number;gridLine:LineStyle;background:string;plotBackground:string};
export const defaultChartStyle:Readonly<ChartStyle>={barColor:'#315f4b',barOpacity:1,meanColor:'#1756a9',meanWidth:2.2,meanLine:'dashed',peakColor:'#bd3046',peakWidth:2,peakLine:'solid',axisColor:'#65796c',axisWidth:1,tickColor:'#43584a',tickSize:10,titleColor:'#2e4938',xTitle:'Grayscale Value (DN)',powerTitle:'Optical Power Density (μW/cm²)',yTitle:'Pixel Count',xTitleSize:12,powerTitleSize:12,yTitleSize:12,markerSize:11,labelBackground:true,gridVisible:true,gridColor:'#dce4de',gridWidth:.8,gridLine:'solid',background:'#ffffff',plotBackground:'#ffffff'};
export const chartStyleKey='sensor-dn-chart-style-v1';
export const numericStyleLimits:Partial<Record<keyof ChartStyle,[number,number]>>={barOpacity:[.05,1],meanWidth:[.5,8],peakWidth:[.5,8],axisWidth:[.5,6],tickSize:[8,24],xTitleSize:[8,32],powerTitleSize:[8,32],yTitleSize:[8,32],markerSize:[8,24],gridWidth:[.25,4]};
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
  return style;
}
export function readChartStyle():ChartStyle {try{return normalizeChartStyle(JSON.parse(localStorage.getItem(chartStyleKey)||'null'));}catch{return {...defaultChartStyle};}}
export function saveChartStyle(style:ChartStyle){try{localStorage.setItem(chartStyleKey,JSON.stringify(normalizeChartStyle(style)));}catch{/* Styling remains available when storage is disabled. */}}
export const lineDash=(style:LineStyle,width=1)=>style==='dashed'?[7*width,4*width]:style==='dotted'?[width,3*width]:[];
