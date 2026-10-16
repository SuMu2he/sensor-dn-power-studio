import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {allocPixels,preprocess,analyze,makeResult,defaults,type ROI} from '../src/core';
const matlab=JSON.parse(readFileSync('verification/matlab-benchmark.json','utf8'));
const median=(a:number[])=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const results=[];
for(const f of matlab.Results){
  const {Width:width,Height:height,Bits:bits}=f,raw=allocPixels(width*height,bits);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)raw[y*width+x]=(13*x+7*y+17*Math.floor(x/127))%(2**bits);
  const info={width,height,bitDepth:bits,name:'benchmark.tif',extension:'.tif'},roi:ROI={kind:'rectangle',x:(width-1024)/2+.5,y:(height-768)/2+.5,width:1024,height:768};
  const pre:number[]=[],scan:number[]=[];let result;
  for(let k=0;k<4;k++){
    const start=performance.now(),{dn}=preprocess(raw,1.1,-8,bits),middle=performance.now(),stats=analyze(dn,info,roi,17);result=makeResult(stats,defaults,bits,'native');const end=performance.now();
    if(k){pre.push(middle-start);scan.push(end-middle);}
  }
  assert.equal(result!.count,f.Count);assert.equal(result!.sum,f.Sum);assert.equal(result!.mean,f.Mean);assert.equal(result!.max,f.Peak);
  const row={width,height,bits,pixels:width*height,javascriptPreprocessMs:median(pre),javascriptROIMs:median(scan),matlabPreprocessMs:f.PreprocessMs,matlabROIMs:f.ROIMs,processedPixelMiB:raw.byteLength/1048576,matlabProcessedPixelMiB:raw.length*8/1048576,count:result!.count};results.push(row);console.log(row);
}
mkdirSync('verification',{recursive:true});writeFileSync('verification/performance.json',JSON.stringify({runtime:process.version,scope:'Synthetic CPU kernels in Node.js; not browser end-to-end, decoding, drawing or exports. Median of three warm samples. ROI 1024x768, view rotated 17 degrees.',results},null,2));
