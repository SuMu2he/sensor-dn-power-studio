/** Quantitative pixel processing. Coordinates are MATLAB-compatible pixel centers (1-based). */
export type Pixels = Uint8Array | Uint16Array | Uint32Array;
export type Point = {x:number;y:number};
export type ROI = {kind:'rectangle';x:number;y:number;width:number;height:number} | {kind:'polygon';points:Point[]};
export type Parameters = {wavelength:number;pixel:number;gain:number;qe:number;exposure:number};
export const defaults:Parameters = {wavelength:630,pixel:2.74,gain:.018492,qe:55,exposure:1};
export type ImageInfo = {width:number;height:number;bitDepth:number;name:string;extension:string};
export type PreprocessStatus = {low:number;high:number;rounded:number;maximum:number;valid:boolean;message:string};
export type Histogram = {counts:number[];centers:number[];xlim:[number,number];ticks:number[]};
export type Stats = {count:number;sum:number;min:number;max:number;mean:number;bounds:[number,number,number,number];ranges:Int32Array;frequency:Uint32Array|null;histNative?:Histogram;histData?:Histogram};
export type Result = {count:number;min:number;max:number;mean:number;sum:number;peak:number;average:number;totalPowerW:number;areaUm2:number;factor:number;energyJ:number;energyEV:number;hist:Histogram;computeMs:number;cacheHit:boolean};
export const roundDN = (x:number)=>x<0?-Math.round(-x):Math.round(x);
export const allocPixels = (n:number,bits:number):Pixels=>bits<=8?new Uint8Array(n):bits<=16?new Uint16Array(n):new Uint32Array(n);
export function validateParameters(p:Parameters){
  if(Object.values(p).some(v=>!Number.isFinite(v)||v<=0)||p.qe>100) throw Error('Parameters must be positive and finite; QE must be at most 100%.');
}
export function conversion(p:Parameters){
  validateParameters(p);
  const energyJ=6.62607015e-34*299792458/(p.wavelength*1e-9);
  const factor=energyJ/p.gain/(p.qe/100)/(p.exposure*1e-3)/(p.pixel*p.pixel*1e-12)/1e4*1e6;
  return {energyJ,energyEV:energyJ/1.602176634e-19,factor,areaUm2:p.pixel*p.pixel};
}
export function preprocess(raw:ArrayLike<number>,ka:number,kb:number,bits:number){
  if(!Number.isFinite(ka)||!Number.isFinite(kb)) throw Error('Ka and Kb must be finite numbers.');
  const maximum=2**bits-1,dn=allocPixels(raw.length,bits);
  if(ka===1&&kb===0&&((bits===8&&raw instanceof Uint8Array)||(bits===16&&raw instanceof Uint16Array)||(bits===32&&raw instanceof Uint32Array))){dn.set(raw as Pixels);return {dn,status:{low:0,high:0,rounded:0,maximum,valid:true,message:'Data valid'} satisfies PreprocessStatus};}
  let low=0,high=0,rounded=0;
  const storageMax=raw instanceof Uint8Array?255:raw instanceof Uint16Array?65535:raw instanceof Uint32Array?4294967295:null;
  if(storageMax!==null&&Number.isFinite(ka*storageMax+kb)){
    // Unsigned integer sources are finite. Check their transform envelope once.
    for(let i=0;i<raw.length;i++){
      const adjusted=ka*raw[i]+kb;
      if(adjusted<0){low++;if(Math.trunc(adjusted)!==adjusted)rounded++;}
      else if(adjusted>maximum){high++;dn[i]=maximum;if(Math.trunc(adjusted)!==adjusted)rounded++;}
      else{const integer=Math.round(adjusted);dn[i]=integer;if(integer!==adjusted)rounded++;}
    }
  }else for(let i=0;i<raw.length;i++){
      const adjusted=ka*raw[i]+kb;
      if(!Number.isFinite(adjusted)) throw Error('The preprocessing coefficients produced nonfinite DN values.');
      const integer=roundDN(adjusted);
      if(adjusted<0)low++;if(adjusted>maximum)high++;if(integer!==adjusted)rounded++;
      dn[i]=Math.min(maximum,Math.max(0,integer));
  }
  let message='Data valid';
  if(low&&high)message=`Data error: values below 0 and above ${maximum} were clipped.`;
  else if(low)message='Data error: values below 0 were clipped.';
  else if(high)message=`Data error: values above ${maximum} were clipped.`;
  return {dn,status:{low,high,rounded,maximum,valid:!low&&!high,message} satisfies PreprocessStatus};
}
export function geometry(width:number,height:number,angle:number){
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=(width+1)/2,cy=(height+1)/2;
  const forward=(p:Point):Point=>({x:cx+c*(p.x-cx)+s*(p.y-cy),y:cy-s*(p.x-cx)+c*(p.y-cy)});
  const inverse=(p:Point):Point=>({x:cx+c*(p.x-cx)-s*(p.y-cy),y:cy+s*(p.x-cx)+c*(p.y-cy)});
  const corners=[{x:.5,y:.5},{x:width+.5,y:.5},{x:width+.5,y:height+.5},{x:.5,y:height+.5}].map(forward);
  return {c,s,cx,cy,forward,inverse,corners,xlim:[Math.min(...corners.map(p=>p.x)),Math.max(...corners.map(p=>p.x))],ylim:[Math.min(...corners.map(p=>p.y)),Math.max(...corners.map(p=>p.y))]};
}
export function roiVertices(roi:ROI):Point[]{
  if(roi.kind==='polygon')return roi.points;
  return [{x:roi.x,y:roi.y},{x:roi.x+roi.width,y:roi.y},{x:roi.x+roi.width,y:roi.y+roi.height},{x:roi.x,y:roi.y+roi.height}];
}
export function polygonArea(points:Point[]){let a=0;for(let i=0;i<points.length;i++){const j=(i+1)%points.length;a+=points[i].x*points[j].y-points[j].x*points[i].y;}return Math.abs(a)/2;}
export function pointInPolygon(p:Point,vertices:Point[],tol=1e-10){
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[j],b=vertices[i],dx=b.x-a.x,dy=b.y-a.y;
    if(Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<=tol*Math.max(1,Math.hypot(dx,dy))&&p.x>=Math.min(a.x,b.x)-tol&&p.x<=Math.max(a.x,b.x)+tol&&p.y>=Math.min(a.y,b.y)-tol&&p.y<=Math.max(a.y,b.y)+tol)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
/** Build row spans rather than a full-frame logical mask or per-pixel index array. */
export function selectionRanges(width:number,height:number,roi:ROI,angle:number):Int32Array{
  const vv=roiVertices(roi);
  if(vv.length<3||!vv.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||polygonArea(vv)<=Number.EPSILON)throw Error('The ROI must have a nonzero area.');
  const g=geometry(width,height,angle),vertices=vv.map(g.inverse);
  const scale=Math.max(1,width,height,...vv.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));
  const tol=32*2**(Math.floor(Math.log2(scale))-52),out:number[]=[];
  const first=Math.max(1,Math.floor(Math.min(...vertices.map(p=>p.y)))),last=Math.min(height,Math.ceil(Math.max(...vertices.map(p=>p.y))));
  const rectangleContains=(x:number,y:number)=>{
    if(roi.kind!=='rectangle')return false;
    const p=g.forward({x,y});
    return p.x>=roi.x-tol&&p.x<roi.x+roi.width-tol&&p.y>=roi.y-tol&&p.y<roi.y+roi.height-tol;
  };
  for(let y=first;y<=last;y++){
    const crosses:number[]=[],boundary:[number,number][]=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length];
      if((a.y>y)!==(b.y>y))crosses.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
      if(Math.abs(a.y-y)<=tol)boundary.push([a.x,a.x]);
      if(Math.abs(a.y-b.y)<=tol&&Math.abs(a.y-y)<=tol)boundary.push([Math.min(a.x,b.x),Math.max(a.x,b.x)]);
    }
    crosses.sort((a,b)=>a-b);
    const intervals:[number,number][]=[...boundary];
    for(let i=0;i+1<crosses.length;i+=2)intervals.push([crosses[i],crosses[i+1]]);
    const integers:[number,number][]=[];
    for(const [a,b]of intervals){
      let lo=Math.max(1,Math.ceil(a-tol)),hi=Math.min(width,Math.floor(b+tol));
      if(roi.kind==='rectangle'){
        while(lo<=hi&&!rectangleContains(lo,y))lo++;
        while(hi>=lo&&!rectangleContains(hi,y))hi--;
      }
      if(lo<=hi)integers.push([lo,hi]);
    }
    integers.sort((a,b)=>a[0]-b[0]);
    const merged:[number,number][]=[];
    for(const interval of integers){const prev=merged[merged.length-1];if(prev&&interval[0]<=prev[1]+1)prev[1]=Math.max(prev[1],interval[1]);else merged.push([...interval]);}
    for(const [lo,hi]of merged)out.push(y-1,lo-1,hi-1);
  }
  return new Int32Array(out);
}
export function analyze(dn:Pixels,info:ImageInfo,roi:ROI,angle:number):Stats{
  const ranges=selectionRanges(info.width,info.height,roi,angle);
  if(!ranges.length)throw Error('The ROI contains no image pixel centers.');
  const frequency=info.bitDepth<=16?new Uint32Array(2**info.bitDepth):null;
  let count=0,sum=0,min=Infinity,max=-Infinity,minX=info.width,maxX=0,minY=info.height,maxY=0;
  for(let n=0;n<ranges.length;n+=3){
    const y=ranges[n],lo=ranges[n+1],hi=ranges[n+2];
    minX=Math.min(minX,lo);maxX=Math.max(maxX,hi);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(let i=y*info.width+lo,end=y*info.width+hi;i<=end;i++){
      const v=dn[i];count++;sum+=v;if(v<min)min=v;if(v>max)max=v;if(frequency)frequency[v]++;
    }
  }
  const stats:Stats={count,sum,min,max,mean:sum/count,bounds:[minX,minY,maxX-minX+1,maxY-minY+1],ranges,frequency};
  if(!frequency){stats.histNative=buildHistogram(stats,info.bitDepth,'native',dn,info.width);stats.histData=buildHistogram(stats,info.bitDepth,'data',dn,info.width);}
  return stats;
}
export function buildHistogram(stats:Stats,bits:number,mode:'native'|'data',dn?:Pixels,width?:number):Histogram{
  if(!stats.frequency){const cached=mode==='native'?stats.histNative:stats.histData;if(cached)return cached;}
  const native=mode==='native',maximum=2**bits-1;
  const xlim:[number,number]=native?[-.5,maximum+.5]:[stats.min-.5,stats.max+.5];
  const bins=native?(bits<=8?maximum+1:256):Math.min(256,Math.max(1,stats.max-stats.min+1));
  const counts=new Array<number>(bins).fill(0),step=(xlim[1]-xlim[0])/bins;
  const add=(v:number,n:number)=>{const bin=Math.max(0,Math.min(bins-1,Math.floor((v-xlim[0])/step)));counts[bin]+=n;};
  if(stats.frequency){for(let v=stats.min;v<=stats.max;v++)if(stats.frequency[v])add(v,stats.frequency[v]);}
  else if(dn&&width){for(let n=0;n<stats.ranges.length;n+=3){const row=stats.ranges[n]*width;for(let x=stats.ranges[n+1];x<=stats.ranges[n+2];x++)add(dn[row+x],1);}}
  let ticks:number[];
  if(native&&bits===8)ticks=[0,32,64,96,128,160,192,224,255];
  else {const a=native?0:stats.min,b=native?maximum:stats.max;ticks=[...new Set(Array.from({length:7},(_,i)=>Math.round(a+(b-a)*i/6)))];}
  return {counts,centers:counts.map((_,i)=>xlim[0]+(i+.5)*step),xlim,ticks};
}
export function makeResult(stats:Stats,p:Parameters,bits:number,mode:'native'|'data',computeMs=0,cacheHit=false):Result{
  const c=conversion(p);
  return {count:stats.count,min:stats.min,max:stats.max,mean:stats.mean,sum:stats.sum,peak:stats.max*c.factor,average:stats.mean*c.factor,totalPowerW:stats.sum*c.factor*1e-6*c.areaUm2*1e-8,areaUm2:stats.count*c.areaUm2,factor:c.factor,energyJ:c.energyJ,energyEV:c.energyEV,hist:buildHistogram(stats,bits,mode),computeMs,cacheHit};
}
/** Only the requested source-oriented bounding matrix is materialized, with NaN outside. */
export function* matrixRows(dn:Pixels,width:number,stats:Stats):Generator<Float64Array>{
  const [x0,y0,w,h]=stats.bounds;let n=0;
  for(let y=y0;y<y0+h;y++){
    const row=new Float64Array(w);row.fill(NaN);
    while(n<stats.ranges.length&&stats.ranges[n]===y){for(let x=stats.ranges[n+1];x<=stats.ranges[n+2];x++)row[x-x0]=dn[y*width+x];n+=3;}
    yield row;
  }
}
export function makePreview(dn:Pixels,info:ImageInfo,contrast:boolean){
  const ratio=Math.min(1,1600/info.width,1200/info.height),width=Math.max(1,Math.round(info.width*ratio)),height=Math.max(1,Math.round(info.height*ratio));
  let min=0,max=2**info.bitDepth-1;
  if(contrast){min=Infinity;max=-Infinity;for(let i=0;i<dn.length;i++){if(dn[i]<min)min=dn[i];if(dn[i]>max)max=dn[i];}}
  if(min===max)max=min+1;
  const rgba=new Uint8ClampedArray(width*height*4),factor=255/(max-min);
  for(let y=0;y<height;y++){const sourceY=Math.min(info.height-1,Math.floor((y+.5)*info.height/height));for(let x=0;x<width;x++){
    const sourceX=Math.min(info.width-1,Math.floor((x+.5)*info.width/width)),v=Math.min(255,Math.max(0,Math.round((dn[sourceY*info.width+sourceX]-min)*factor))),i=(y*width+x)*4;
    rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;
  }}return {rgba,width,height,min,max};
}
