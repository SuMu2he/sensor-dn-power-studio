/** Keep a canvas sharp in its own window, including browser zoom and monitor changes. */
export function observeCanvasResolution(canvas:HTMLCanvasElement,paint:(ctx:CanvasRenderingContext2D,width:number,height:number)=>void){
  const win=canvas.ownerDocument.defaultView!;
  let resolution:MediaQueryList|null=null;
  const draw=()=>{
    const {width,height}=canvas.getBoundingClientRect();if(width<=0||height<=0)return;
    const dpr=win.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));
    const ctx=canvas.getContext('2d')!;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    paint(ctx,width,height);
  };
  const watchResolution=()=>{
    resolution?.removeEventListener('change',onResolutionChange);
    resolution=win.matchMedia(`(resolution: ${win.devicePixelRatio||1}dppx)`);
    resolution.addEventListener('change',onResolutionChange);
  };
  const onResolutionChange=()=>{watchResolution();draw();};
  const observer=new win.ResizeObserver(draw);observer.observe(canvas);
  win.addEventListener('resize',draw);win.visualViewport?.addEventListener('resize',draw);
  watchResolution();draw();
  return()=>{observer.disconnect();resolution?.removeEventListener('change',onResolutionChange);win.removeEventListener('resize',draw);win.visualViewport?.removeEventListener('resize',draw);};
}
