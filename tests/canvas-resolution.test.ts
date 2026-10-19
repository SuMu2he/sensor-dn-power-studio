import test from 'node:test';
import assert from 'node:assert/strict';
import {observeCanvasResolution} from '../src/canvas-resolution';

test('chart follows its owning window size and DPR, then releases all listeners',()=>{
  let width=100.5,height=80.25,resize:()=>void=()=>{},mediaChange:()=>void=()=>{},disconnected=false;
  const windowListeners=new Map<string,()=>void>(),viewportListeners=new Map<string,()=>void>();
  const mediaListeners=new Set<()=>void>(),transforms:number[][]=[],paints:number[][]=[];
  const owner={
    devicePixelRatio:1.25,
    ResizeObserver:class{constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){disconnected=true;}},
    addEventListener:(name:string,handler:()=>void)=>windowListeners.set(name,handler),
    removeEventListener:(name:string)=>windowListeners.delete(name),
    visualViewport:{addEventListener:(name:string,handler:()=>void)=>viewportListeners.set(name,handler),removeEventListener:(name:string)=>viewportListeners.delete(name)},
    matchMedia:()=>({addEventListener:(_name:string,handler:()=>void)=>{mediaListeners.add(handler);mediaChange=handler;},removeEventListener:(_name:string,handler:()=>void)=>mediaListeners.delete(handler)}),
  };
  const canvas={ownerDocument:{defaultView:owner},width:0,height:0,getBoundingClientRect:()=>({width,height}),getContext:()=>({setTransform:(...values:number[])=>transforms.push(values)})};
  const stop=observeCanvasResolution(canvas as unknown as HTMLCanvasElement,(_ctx,w,h)=>paints.push([w,h]));
  assert.equal(canvas.width,126);assert.equal(canvas.height,100);
  width=1920;height=1080;resize();assert.equal(canvas.width,2400);assert.equal(canvas.height,1350);
  owner.devicePixelRatio=2;mediaChange();assert.equal(canvas.width,3840);assert.equal(canvas.height,2160);
  assert.deepEqual(transforms.at(-1),[2,0,0,2,0,0]);assert.deepEqual(paints.at(-1),[1920,1080]);
  width=800;height=600;windowListeners.get('resize')!();assert.equal(canvas.width,1600);assert.equal(canvas.height,1200);
  const count=paints.length;width=0;resize();assert.equal(paints.length,count,'A hidden canvas must not allocate or draw.');
  stop();assert.ok(disconnected);assert.equal(windowListeners.size,0);assert.equal(viewportListeners.size,0);assert.equal(mediaListeners.size,0);
});
