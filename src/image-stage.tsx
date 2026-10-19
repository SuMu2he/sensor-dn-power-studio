import {forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import {geometry,roiVertices,pointInPolygon,polygonArea,type Point,type ROI,type ImageInfo} from './core';
import {rectangleHandleCursor} from './roi-cursor';
export type Guide={id:number;kind:'v'|'h';value:number};
export type Preview={rgba:Uint8ClampedArray;width:number;height:number;min:number;max:number};
export type Tile={rgba:Uint8ClampedArray;width:number;height:number;x:number;y:number};
export type StageHandle={fit:()=>void;center:()=>Point};
type Props={info:ImageInfo|null;preview:Preview|null;roi:ROI|null;angle:number;tool:'select'|'rectangle'|'polygon';lock:boolean;aspect:number;guides:Guide[];showGuides:boolean;onROI:(roi:ROI|null)=>void;onTool:(tool:'select'|'rectangle'|'polygon')=>void;onBegin:()=>void;onError:(error:string)=>void;onGuides:(guides:Guide[])=>void;onGuideMenu:(id:number,x:number,y:number)=>void;onZoom:(zoom:number)=>void;requestTile:(bounds:{x:number;y:number;width:number;height:number})=>Promise<Tile>};
const distance=(p:Point,q:Point)=>Math.hypot(p.x-q.x,p.y-q.y);
function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
const rectHandles=(r:Extract<ROI,{kind:'rectangle'}>)=>[{x:r.x,y:r.y},{x:r.x+r.width/2,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height/2},{x:r.x+r.width,y:r.y+r.height},{x:r.x+r.width/2,y:r.y+r.height},{x:r.x,y:r.y+r.height},{x:r.x,y:r.y+r.height/2}];
class Stage{
  private ctx:CanvasRenderingContext2D;private observer:ResizeObserver;private frame=0;private w=1;private h=1;private s=1;private tx=0;private ty=0;private fitted=true;
  private image:HTMLCanvasElement|null=null;private tile:{canvas:HTMLCanvasElement;x:number;y:number;width:number;height:number}|null=null;private tileNonce=0;private tileTimer=0;
  private down:{mode:'draw'|'pan'|'move'|'resize'|'vertex'|'guide';start:Point;screen:Point;roi:ROI|null;index:number;tx:number;ty:number}|null=null;
  private draft:ROI|null=null;private poly:Point[]=[];private hover:Point={x:0,y:0};private guideDraft:Guide[]|null=null;
  constructor(private canvas:HTMLCanvasElement,private props:()=>Props){
    this.ctx=canvas.getContext('2d')!;this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
    canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointercancel',this.pointerUp);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('dblclick',this.doubleClick);canvas.addEventListener('keydown',this.key);canvas.addEventListener('contextmenu',this.contextMenu);
  }
  destroy(){this.observer.disconnect();cancelAnimationFrame(this.frame);clearTimeout(this.tileTimer);for(const [name,fn]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['wheel',this.wheel],['dblclick',this.doubleClick],['keydown',this.key],['contextmenu',this.contextMenu]] as const)this.canvas.removeEventListener(name,fn as EventListener);}
  update(){if(this.props().tool!=='polygon')this.poly=[];this.paint();}
  setPreview(preview:Preview|null){this.tileNonce++;this.tile=null;if(preview){this.image=document.createElement('canvas');this.image.width=preview.width;this.image.height=preview.height;this.image.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba),preview.width,preview.height),0,0);}else this.image=null;this.paint();this.scheduleTile();}
  center(){return {x:(this.w/2-this.tx)/this.s,y:(this.h/2-this.ty)/this.s};}
  fit=()=>{const p=this.props();if(!p.info)return;const g=geometry(p.info.width,p.info.height,p.angle),gw=g.xlim[1]-g.xlim[0],gh=g.ylim[1]-g.ylim[0];this.s=Math.min((this.w-80)/gw,(this.h-66)/gh);this.s=Math.max(.0001,this.s);this.tx=(this.w-gw*this.s)/2-g.xlim[0]*this.s;this.ty=(this.h-gh*this.s)/2-g.ylim[0]*this.s-5;this.fitted=true;p.onZoom(this.s*100);this.paint();this.scheduleTile();};
  private resize(){const rect=this.canvas.getBoundingClientRect(),center=this.center(),dpr=devicePixelRatio||1;this.w=rect.width;this.h=rect.height;this.canvas.width=Math.max(1,Math.round(this.w*dpr));this.canvas.height=Math.max(1,Math.round(this.h*dpr));if(this.fitted)this.fit();else{this.tx=this.w/2-center.x*this.s;this.ty=this.h/2-center.y*this.s;this.paint();this.scheduleTile();}}
  private screen(e:MouseEvent){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  private world(p:Point){return {x:(p.x-this.tx)/this.s,y:(p.y-this.ty)/this.s};}
  private pixel(p:Point){return {x:p.x*this.s+this.tx,y:p.y*this.s+this.ty};}
  private paint(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
  private scheduleTile(){clearTimeout(this.tileTimer);this.tileTimer=window.setTimeout(()=>this.requestTile(),120);}
  private async requestTile(){
    const p=this.props();if(!p.info||!p.preview||!this.image||this.s<=p.preview.width/p.info.width*1.15){this.tile=null;return;}
    const g=geometry(p.info.width,p.info.height,p.angle),corners=[{x:0,y:0},{x:this.w,y:0},{x:this.w,y:this.h},{x:0,y:this.h}].map(v=>g.inverse(this.world(v)));
    let x=Math.max(0,Math.floor(Math.min(...corners.map(v=>v.x)))-2),y=Math.max(0,Math.floor(Math.min(...corners.map(v=>v.y)))-2);
    let width=Math.min(p.info.width-x,Math.ceil(Math.max(...corners.map(v=>v.x)))-x+2),height=Math.min(p.info.height-y,Math.ceil(Math.max(...corners.map(v=>v.y)))-y+2);
    if(width<=0||height<=0)return;
    if(width>2200){x+=Math.floor((width-2200)/2);width=2200;}if(height>1800){y+=Math.floor((height-1800)/2);height=1800;}
    const nonce=++this.tileNonce;
    try{const tile=await p.requestTile({x,y,width,height});if(nonce!==this.tileNonce)return;const canvas=document.createElement('canvas');canvas.width=tile.width;canvas.height=tile.height;canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(tile.rgba),tile.width,tile.height),0,0);this.tile={canvas,x:tile.x,y:tile.y,width:tile.width,height:tile.height};this.paint();}catch{/* A superseded view does not alter measurement state. */}
  }
  private hit(point:Point){
    const p=this.props(),r=p.roi;
    if(r){const vertices=r.kind==='rectangle'?rectHandles(r):r.points;for(let i=0;i<vertices.length;i++)if(distance(point,this.pixel(vertices[i]))<8)return {mode:r.kind==='rectangle'?'resize':'vertex',index:i} as const;
      const vv=roiVertices(r);for(let i=0;i<vv.length;i++)if(segmentDistance(point,this.pixel(vv[i]),this.pixel(vv[(i+1)%vv.length]))<7)return {mode:'move',index:0} as const;
      if(pointInPolygon(this.world(point),vv))return {mode:'move',index:0} as const;
    }
    if(p.showGuides)for(const guide of p.guides){const d=guide.kind==='v'?Math.abs(point.x-this.pixel({x:guide.value,y:0}).x):Math.abs(point.y-this.pixel({x:0,y:guide.value}).y);if(d<5)return {mode:'guide',index:guide.id} as const;}
    return {mode:'pan',index:0} as const;
  }
  private pointerDown=(e:PointerEvent)=>{
    if(e.button!==0||!this.props().info)return;e.preventDefault();this.canvas.focus();const p=this.props(),screen=this.screen(e),point=this.world(screen);this.hover=point;
    if(p.tool==='polygon'){
      if(this.poly.length>=3&&distance(screen,this.pixel(this.poly[0]))<10){this.finishPolygon();return;}
      if(e.detail>1)return;
      this.poly.push(point);p.onBegin();this.paint();return;
    }
    const hit=p.tool==='rectangle'?{mode:'draw' as const,index:0}:this.hit(screen);
    this.down={...hit,start:point,screen,roi:p.roi?structuredClone(p.roi):null,tx:this.tx,ty:this.ty};this.canvas.setPointerCapture(e.pointerId);
    if(hit.mode!=='pan'&&hit.mode!=='guide')p.onBegin();
    if(hit.mode==='draw')this.draft={kind:'rectangle',x:point.x,y:point.y,width:1,height:1};
    if(hit.mode==='guide')this.guideDraft=p.guides.map(g=>({...g}));
  };
  private pointerMove=(e:PointerEvent)=>{
    const screen=this.screen(e),point=this.world(screen),p=this.props();this.hover=point;
    if(!this.down){const hit=this.hit(screen);this.canvas.style.cursor=p.tool!=='select'?'crosshair':hit.mode==='resize'?rectangleHandleCursor(hit.index):hit.mode==='pan'?'grab':hit.mode==='guide'?(p.guides.find(guide=>guide.id===hit.index)?.kind==='v'?'col-resize':'row-resize'):'move';if(this.poly.length)this.paint();return;}
    const d=this.down,dx=point.x-d.start.x,dy=point.y-d.start.y;
    if(d.mode==='pan'){this.tx=d.tx+screen.x-d.screen.x;this.ty=d.ty+screen.y-d.screen.y;this.fitted=false;this.canvas.style.cursor='grabbing';this.scheduleTile();}
    else if(d.mode==='guide'){this.guideDraft=p.guides.map(g=>g.id===d.index?{...g,value:g.kind==='v'?point.x:point.y}:g);}
    else if(d.mode==='draw'){
      let width=Math.max(1,Math.round(Math.abs(dx))),height=Math.max(1,Math.round(Math.abs(dy)));if(p.lock)height=Math.max(1,Math.round(width/p.aspect));
      this.draft={kind:'rectangle',x:Math.round(Math.min(d.start.x,point.x)-.5)+.5,y:Math.round(Math.min(d.start.y,point.y)-.5)+.5,width,height};
    }else if(d.roi){
      if(d.mode==='move')this.draft=d.roi.kind==='rectangle'?{...d.roi,x:d.roi.x+dx,y:d.roi.y+dy}:{kind:'polygon',points:d.roi.points.map(v=>({x:v.x+dx,y:v.y+dy}))};
      else if(d.mode==='vertex'&&d.roi.kind==='polygon')this.draft={kind:'polygon',points:d.roi.points.map((v,i)=>i===d.index?point:v)};
      else if(d.mode==='resize'&&d.roi.kind==='rectangle'){
        this.canvas.style.cursor=rectangleHandleCursor(d.index);
        const r=d.roi;let x1=r.x,x2=r.x+r.width,y1=r.y,y2=r.y+r.height;
        if([0,6,7].includes(d.index))x1=point.x;if([2,3,4].includes(d.index))x2=point.x;if([0,1,2].includes(d.index))y1=point.y;if([4,5,6].includes(d.index))y2=point.y;
        let width=Math.max(1,Math.round(Math.abs(x2-x1))),height=Math.max(1,Math.round(Math.abs(y2-y1)));
        if(p.lock){if([1,5].includes(d.index))width=Math.max(1,Math.round(height*p.aspect));else height=Math.max(1,Math.round(width/p.aspect));if([1,5].includes(d.index)){x1=r.x+r.width/2-width/2;x2=x1+width;}else if([3,7].includes(d.index)){y1=r.y+r.height/2-height/2;y2=y1+height;}}
        let x=Math.min(x1,x2),y=Math.min(y1,y2);
        if(p.lock&&[0,6,7].includes(d.index))x=x2-width;if(p.lock&&[0,1,2].includes(d.index))y=y2-height;
        this.draft={kind:'rectangle',x,y,width,height};
      }
    }this.paint();
  };
  private pointerUp=(e:PointerEvent)=>{
    if(!this.down)return;const p=this.props(),d=this.down;
    if(this.draft){p.onROI(this.draft);if(d.mode==='draw')p.onTool('select');}if(this.guideDraft)p.onGuides(this.guideDraft);
    this.down=null;this.draft=null;this.guideDraft=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);this.canvas.style.cursor=d.mode==='resize'?rectangleHandleCursor(d.index):d.mode==='move'||d.mode==='vertex'?'move':p.tool==='select'?'grab':'crosshair';this.paint();
  };
  private wheel=(e:WheelEvent)=>{if(!this.props().info)return;e.preventDefault();const screen=this.screen(e),point=this.world(screen);this.s=Math.min(120,Math.max(.0001,this.s*(e.deltaY<0?1.18:1/1.18)));this.tx=screen.x-point.x*this.s;this.ty=screen.y-point.y*this.s;this.fitted=false;this.props().onZoom(this.s*100);this.paint();this.scheduleTile();};
  private doubleClick=(e:MouseEvent)=>{e.preventDefault();if(this.props().tool==='polygon')this.finishPolygon();else if(this.hit(this.screen(e)).mode==='pan')this.fit();};
  private finishPolygon(){const p=this.props();if(this.poly.length<3||polygonArea(this.poly)<=Number.EPSILON){p.onError('A polygon needs at least three vertices and a nonzero area.');return;}p.onROI({kind:'polygon',points:[...this.poly]});this.poly=[];p.onTool('select');this.paint();}
  private key=(e:KeyboardEvent)=>{const p=this.props();if(e.key==='Escape'){this.poly=[];this.down=null;this.draft=null;p.onTool('select');this.paint();}else if(e.key==='Enter'&&p.tool==='polygon'){e.preventDefault();this.finishPolygon();}else if(e.key==='Backspace'&&p.tool==='polygon'){e.preventDefault();this.poly.pop();this.paint();}else if(e.key==='Delete'){e.preventDefault();p.onROI(null);}};
  private contextMenu=(e:MouseEvent)=>{const hit=this.hit(this.screen(e));if(hit.mode==='guide'){e.preventDefault();this.props().onGuideMenu(hit.index,e.clientX,e.clientY);}};
  private draw(){
    const ctx=this.ctx,p=this.props(),dpr=devicePixelRatio||1;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.fillStyle='#e6ece5';ctx.fillRect(0,0,this.w,this.h);
    if(!p.info||!this.image)return;
    const g=geometry(p.info.width,p.info.height,p.angle);
    ctx.save();ctx.translate(this.tx,this.ty);ctx.scale(this.s,this.s);ctx.translate(g.cx,g.cy);ctx.rotate(-p.angle*Math.PI/180);ctx.translate(-g.cx,-g.cy);ctx.imageSmoothingEnabled=this.s<1;ctx.drawImage(this.image,.5,.5,p.info.width,p.info.height);
    if(this.tile){const t=this.tile;ctx.imageSmoothingEnabled=false;ctx.drawImage(t.canvas,t.x+.5,t.y+.5,t.width,t.height);}ctx.restore();
    ctx.strokeStyle='#3d594c';ctx.lineWidth=.8;ctx.fillStyle='#52665a';ctx.font='10px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
    const target=90/this.s,power=10**Math.floor(Math.log10(target)),step=power*([1,2,5,10].find(n=>n*power>=target)||10),min=this.world({x:30,y:0}),max=this.world({x:this.w-14,y:this.h-28});
    for(let v=Math.ceil(min.x/step)*step;v<=max.x;v+=step){const x=this.pixel({x:v,y:0}).x;ctx.fillText(String(Math.round(v)),x,this.h-29);}
    ctx.textAlign='right';ctx.textBaseline='middle';for(let v=Math.ceil(min.y/step)*step;v<=max.y;v+=step){const y=this.pixel({x:0,y:v}).y;ctx.fillText(String(Math.round(v)),31,y);}
    ctx.font='11px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('X-Pixel',this.w/2,this.h-3);ctx.save();ctx.translate(10,this.h/2);ctx.rotate(-Math.PI/2);ctx.fillText('Y-Pixel',0,0);ctx.restore();
    if(p.showGuides){ctx.strokeStyle='#27bfd1';ctx.lineWidth=1;for(const guide of this.guideDraft||p.guides){ctx.beginPath();if(guide.kind==='v'){const x=this.pixel({x:guide.value,y:0}).x;ctx.moveTo(x,0);ctx.lineTo(x,this.h-34);}else{const y=this.pixel({x:0,y:guide.value}).y;ctx.moveTo(35,y);ctx.lineTo(this.w,y);}ctx.stroke();}}
    const r=this.draft||p.roi;
    if(r){const vv=roiVertices(r).map(v=>this.pixel(v));ctx.beginPath();vv.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.strokeStyle='#14251faa';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#a8ff2e';ctx.lineWidth=2.2;ctx.stroke();ctx.fillStyle='rgba(168,255,46,.025)';ctx.fill();const handles=(r.kind==='rectangle'?rectHandles(r):r.points).map(v=>this.pixel(v));ctx.fillStyle='#a8ff2e';ctx.strokeStyle='#243b25';ctx.lineWidth=1;for(const v of handles){ctx.fillRect(v.x-4,v.y-4,8,8);ctx.strokeRect(v.x-4,v.y-4,8,8);}const label=r.kind==='rectangle'?`ROI · ${r.width} × ${r.height} px`:'ROI';ctx.font='bold 14px "Segoe UI",sans-serif';ctx.textAlign='left';ctx.textBaseline='bottom';const labelWidth=ctx.measureText(label).width,lx=Math.max(4,Math.min(this.w-labelWidth-8,vv[0].x)),ly=Math.max(24,vv[0].y-7);ctx.fillStyle='#14251fce';ctx.fillRect(lx-3,ly-19,labelWidth+7,21);ctx.fillStyle='#a8ff2e';ctx.fillText(label,lx,ly);}
    if(this.poly.length){ctx.strokeStyle='#a8ff2e';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();const points=[...this.poly,this.hover].map(v=>this.pixel(v));points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();ctx.setLineDash([]);for(const v of points.slice(0,-1)){ctx.fillStyle='#a8ff2e';ctx.fillRect(v.x-4,v.y-4,8,8);}}
  }
}
export const ImageStage=forwardRef<StageHandle,Props>(function ImageStage(props,ref){
  const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(props),stage=useRef<Stage|null>(null);latest.current=props;
  useImperativeHandle(ref,()=>({fit:()=>stage.current?.fit(),center:()=>stage.current?.center()||{x:0,y:0}}),[]);
  useEffect(()=>{const s=new Stage(canvas.current!,()=>latest.current);stage.current=s;return()=>{stage.current=null;s.destroy();};},[]);
  useEffect(()=>stage.current?.setPreview(props.preview),[props.preview]);
  useEffect(()=>stage.current?.fit(),[props.info,props.angle]);
  useEffect(()=>stage.current?.update(),[props.roi,props.guides,props.showGuides,props.tool]);
  return <canvas ref={canvas} tabIndex={0} aria-label="Image and editable ROI canvas" className="image-canvas"/>;
});
