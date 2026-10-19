import {useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';

const STORAGE_KEY='sensor-dn-panel-layout-v1';
const DEFAULT_SIDEBAR=334,DEFAULT_HISTOGRAM=325,SPLITTER_SIZE=12;
const MIN_SIDEBAR=280,MAX_SIDEBAR=600,MIN_ANALYSIS=360;
const MIN_IMAGE=280,MIN_HISTOGRAM=220;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,Math.round(value)));
type Settings={sidebarWidth:number;histogramHeight:number};

function readSettings():Settings{
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    return {
      sidebarWidth:Number.isFinite(saved?.sidebarWidth)&&saved.sidebarWidth>0?saved.sidebarWidth:DEFAULT_SIDEBAR,
      histogramHeight:Number.isFinite(saved?.histogramHeight)&&saved.histogramHeight>0?saved.histogramHeight:DEFAULT_HISTOGRAM,
    };
  }catch{return {sidebarWidth:DEFAULT_SIDEBAR,histogramHeight:DEFAULT_HISTOGRAM};}
}

/** Panel sizing is independent of image, ROI and calculation state. */
export function usePanelLayout(){
  const workspaceRef=useRef<HTMLElement>(null),analysisRef=useRef<HTMLDivElement>(null);
  const [settings,setSettings]=useState(readSettings);
  const [available,setAvailable]=useState({width:Math.max(760,window.innerWidth)-24,height:Math.max(0,window.innerHeight-102)});
  useLayoutEffect(()=>{
    const workspace=workspaceRef.current!,analysis=analysisRef.current!;
    const measure=()=>{
      const style=getComputedStyle(workspace);
      const width=workspace.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=analysis.clientHeight;
      setAvailable(previous=>previous.width===width&&previous.height===height?previous:{width,height});
    };
    const observer=new ResizeObserver(measure);
    observer.observe(workspace);observer.observe(analysis);measure();
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{/* Storage may be disabled. */}};
    const timer=window.setTimeout(save,200);
    window.addEventListener('pagehide',save);
    return()=>{clearTimeout(timer);window.removeEventListener('pagehide',save);};
  },[settings]);
  const update=useCallback((key:keyof Settings,value:number)=>{
    setSettings(previous=>previous[key]===value?previous:{...previous,[key]:value});
  },[]);
  const sidebarMax=Math.max(MIN_SIDEBAR,Math.min(MAX_SIDEBAR,available.width-SPLITTER_SIZE-MIN_ANALYSIS));
  const sidebarWidth=clamp(settings.sidebarWidth,MIN_SIDEBAR,sidebarMax);
  // Very short windows scroll the analysis column instead of collapsing a plot.
  const height=Math.max(available.height,MIN_IMAGE+SPLITTER_SIZE+MIN_HISTOGRAM);
  const imageMax=height-SPLITTER_SIZE-MIN_HISTOGRAM;
  const histogramHeight=clamp(settings.histogramHeight,MIN_HISTOGRAM,height-SPLITTER_SIZE-MIN_IMAGE);
  const imageHeight=height-SPLITTER_SIZE-histogramHeight;
  const resizeSidebar=useCallback((value:number)=>update('sidebarWidth',clamp(value,MIN_SIDEBAR,sidebarMax)),[sidebarMax,update]);
  const resizeImage=useCallback((value:number)=>update('histogramHeight',height-SPLITTER_SIZE-clamp(value,MIN_IMAGE,imageMax)),[height,imageMax,update]);
  const resetSidebar=useCallback(()=>update('sidebarWidth',DEFAULT_SIDEBAR),[update]);
  const resetImage=useCallback(()=>update('histogramHeight',DEFAULT_HISTOGRAM),[update]);
  const style={'--sidebar-width':`${sidebarWidth}px`,'--image-height':`${imageHeight}px`,'--splitter-size':`${SPLITTER_SIZE}px`} as CSSProperties;
  return {workspaceRef,analysisRef,style,sidebarWidth,sidebarMax,imageHeight,imageMax,resizeSidebar,resizeImage,resetSidebar,resetImage,sidebarMin:MIN_SIDEBAR,imageMin:MIN_IMAGE};
}

type SplitterProps={orientation:'vertical'|'horizontal';label:string;controls:string;value:number;min:number;max:number;onChange:(value:number)=>void;onReset:()=>void};

export function PanelSplitter({orientation,label,controls,value,min,max,onChange,onReset}:SplitterProps){
  const drag=useRef<{pointerId:number;start:number;value:number}|null>(null);
  const [dragging,setDragging]=useState(false);
  const stop=()=>{drag.current=null;setDragging(false);};
  useEffect(()=>{
    if(!dragging)return;
    const className=`resizing-panels-${orientation}`;
    document.body.classList.add(className);
    const cancel=()=>{drag.current=null;setDragging(false);};
    window.addEventListener('blur',cancel);
    return()=>{document.body.classList.remove(className);window.removeEventListener('blur',cancel);};
  },[dragging,orientation]);
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    const position=orientation==='vertical'?event.clientX:event.clientY;
    onChange(clamp(current.value+position-current.start,min,max));
  };
  return <div className="panel-splitter" role="separator" tabIndex={0} aria-label={label} aria-orientation={orientation} aria-controls={controls} aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} pixels`} data-dragging={dragging||undefined}
    title="Drag to resize. Double-click or press Enter to reset. Use arrow keys to adjust."
    onPointerDown={event=>{
      if(event.button!==0||!event.isPrimary)return;
      event.preventDefault();event.currentTarget.focus({preventScroll:true});
      drag.current={pointerId:event.pointerId,start:orientation==='vertical'?event.clientX:event.clientY,value};
      event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
    }}
    onPointerMove={move}
    onPointerUp={event=>{move(event);stop();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
    onPointerCancel={stop} onLostPointerCapture={stop}
    onDoubleClick={onReset}
    onKeyDown={event=>{
      const negative=orientation==='vertical'?'ArrowLeft':'ArrowUp',positive=orientation==='vertical'?'ArrowRight':'ArrowDown';
      if(event.key===negative||event.key===positive){event.preventDefault();onChange(clamp(value+(event.key===positive?1:-1)*(event.shiftKey?50:16),min,max));}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();onChange(event.key==='Home'?min:max);}
      else if(event.key==='Enter'){event.preventDefault();onReset();}
      else if(event.key==='Escape'&&drag.current){event.preventDefault();onChange(drag.current.value);stop();}
    }}/>;
}
