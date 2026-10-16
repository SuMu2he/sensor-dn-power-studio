import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {decode as decodePng,encode as encodePng} from 'fast-png';
import {decode as decodeTiff} from 'tiff';
import {unzipSync,strFromU8} from 'fflate';
import {preprocess,analyze,makeResult,defaults,conversion,matrixRows,buildHistogram,geometry,allocPixels,type ROI,type ImageInfo} from '../src/core';
import {readImage,encodeImage,encodeTIFF,encodeBMP,markedImage} from '../src/image-io';
import {makeXlsx,makeTxt,createExport,makeExportZip} from '../src/export-data';
import {nextGroupStem} from '../src/export-naming';
const info=(width:number,height:number,bitDepth=8,extension='.png'):ImageInfo=>({width,height,bitDepth,extension,name:'test'+extension});
test('calibration, units and exposure scaling',()=>{const c=conversion(defaults);assert.ok(Math.abs(c.factor-.41294145435547536)<1e-12);assert.ok(Math.abs(c.energyJ-3.1530886621411566e-19)<1e-32);assert.ok(Math.abs(conversion({...defaults,exposure:10}).factor-c.factor/10)<1e-15);assert.throws(()=>conversion({...defaults,qe:101}));});
test('MATLAB-reference fixtures: pixels, boundaries, rotation, statistics, bins and NaN matrices',()=>{
  const path=new URL('./matlab-fixtures.json',import.meta.url);assert.ok(existsSync(path),'Generate the MATLAB fixtures before running this verification.');
  const fixtures=JSON.parse(readFileSync(path,'utf8'));
  for(const [index,f]of fixtures.Cases.entries()){
    const {dn,status}=preprocess(f.Raw,f.Ka,f.Kb,f.Bits),meta=info(f.Width,f.Height,f.Bits);
    const roi:ROI=f.ROI.Type==='rectangle'?{kind:'rectangle',x:f.ROI.Position[0],y:f.ROI.Position[1],width:f.ROI.Position[2],height:f.ROI.Position[3]}:{kind:'polygon',points:f.ROI.Position.map(([x,y]:number[])=>({x,y}))};
    assert.deepEqual([...dn],f.Processed.map((v:number)=>v===0?0:v),`processed ${index}`);assert.equal(status.low,f.Low);assert.equal(status.high,f.High);assert.equal(status.rounded,f.Rounded);
    if(f.Raw.every((v:number)=>Number.isInteger(v)&&v>=0&&v<=2**f.Bits-1)){const native=allocPixels(f.Raw.length,f.Bits);native.set(f.Raw);const fast=preprocess(native,f.Ka,f.Kb,f.Bits);assert.deepEqual([...fast.dn],[...dn]);assert.equal(fast.status.low,status.low);assert.equal(fast.status.high,status.high);assert.equal(fast.status.rounded,status.rounded);}
    const stats=analyze(dn,meta,roi,f.Angle),indices:number[]=[];
    for(let n=0;n<stats.ranges.length;n+=3)for(let x=stats.ranges[n+1];x<=stats.ranges[n+2];x++)indices.push(stats.ranges[n]*f.Width+x);
    assert.deepEqual(indices,f.Indices,`selected indices ${index} (${f.ROI.Type}, ${f.Angle}°)`);
    assert.equal(stats.count,f.Count);assert.equal(stats.sum,f.Sum||0);assert.equal(stats.mean,f.Mean||0);assert.equal(stats.max,f.Max||0);assert.equal(stats.min,f.Min||0);
    for(const mode of ['native','data'] as const)assert.deepEqual(buildHistogram(stats,f.Bits,mode).counts,mode==='native'?f.NativeCounts:f.DataCounts,`bins ${index}/${mode}`);
    const matrix=[...matrixRows(dn,f.Width,stats)].flatMap(row=>[...row]);assert.deepEqual(matrix,f.Matrix.map((v:number|null)=>v===null?NaN:v===0?0:v),`matrix ${index}`);
    const r=makeResult(stats,defaults,f.Bits,'native');assert.ok(Math.abs(r.peak-f.Peak)<=Math.max(1e-10,Math.abs(f.Peak)*1e-14));assert.ok(Math.abs(r.average-f.Average)<=Math.max(1e-10,Math.abs(f.Average)*1e-14));
  }
});
test('native bit-depth PNG/BMP/TIFF round trips',async()=>{
  for(const bits of [8,16,32]){
    const raw=bits===8?new Uint8Array([0,1,127,255,32,200]):bits===16?new Uint16Array([0,1,32768,65535,1000,50000]):new Uint32Array([0,1,2147483648,4294967295,1000,4000000000]);
    for(const ext of bits===32?['.tif']:bits===16?['.png','.tif']:['.png','.bmp','.tif']){
      const meta=info(3,2,bits,ext),bytes=await encodeImage(raw,meta),decoded=await readImage(bytes,'test'+ext);assert.equal(decoded.info.bitDepth,bits);assert.deepEqual([...decoded.raw],[...raw]);
    }
  }
  const binary=new Uint8Array([0,1,0,1,1,0]);for(const ext of ['.png','.bmp','.tif']){const decoded=await readImage(await encodeImage(binary,info(3,2,1,ext)),'binary'+ext);assert.deepEqual([...decoded.raw],[...binary]);assert.equal(decoded.info.bitDepth,1);}
});
test('MATLAB-generated compressed and palette files retain every sample',async()=>{
  const root=new URL('./image-fixtures/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
  for(const file of manifest){const decoded=await readImage(new Uint8Array(readFileSync(new URL(file.Name,root))),file.Name);assert.equal(decoded.info.width,file.Width,file.Name);assert.equal(decoded.info.height,file.Height,file.Name);assert.deepEqual([...decoded.raw],file.Pixels,file.Name);}
});
test('identity preprocessing preserves native integer buffers without aliasing the source',()=>{const raw=new Uint16Array([0,1,32768,65535]),result=preprocess(raw,1,0,16);assert.deepEqual([...result.dn],[...raw]);assert.notEqual(result.dn.buffer,raw.buffer);assert.ok(result.status.valid);assert.equal(result.status.rounded,0);});
test('export names begin at 001 and skip any partially occupied five-file group',async()=>{
  const names=new Set(['Image_DN_ROI_001_gray.xlsx','Image_DN_ROI_002_histogram.png']);
  const directory={getFileHandle:async(name:string)=>{if(names.has(name))return {} as FileSystemFileHandle;throw new DOMException('Not found','NotFoundError');}};
  assert.equal(await nextGroupStem(directory,'Image_DN_ROI','.tif'),'Image_DN_ROI_003');assert.equal(await nextGroupStem(null,'Image_DN_ROI','.tif'),'Image_DN_ROI_001');assert.equal(await nextGroupStem(null,'Image_DN_ROI','.tif',12),'Image_DN_ROI_012');await assert.rejects(()=>nextGroupStem(null,'../unsafe','.png'),/prefix/);
});
test('color and transparency are rejected; green marks preserve full-resolution base pixels',async()=>{
  const color=encodePng({width:1,height:1,depth:8,channels:3,data:new Uint8Array([1,2,3])});await assert.rejects(()=>readImage(color,'color.png'),/grayscale/);
  const alpha=encodePng({width:1,height:1,depth:8,channels:2,data:new Uint8Array([10,0])});await assert.rejects(()=>readImage(alpha,'alpha.png'),/Transparent/);
  const dn=Uint16Array.from({length:100},(_,i)=>i*655),meta=info(10,10,16,'.tif'),roi:ROI={kind:'rectangle',x:2.5,y:2.5,width:4,height:4};
  const mark=markedImage(dn,meta,roi,31),decoded=decodeTiff(encodeTIFF(mark.data,10,10,3,16))[0];assert.equal(decoded.width,10);assert.equal(decoded.height,10);assert.equal(decoded.bitsPerSample,16);assert.ok([...decoded.data].includes(65535));assert.equal(decoded.data[0],dn[0]);
});
test('all five exports, source-oriented NaNs, compressed numeric XLSX and ZIP',async()=>{
  const meta=info(5,5),dn=Uint8Array.from({length:25},(_,i)=>i),roi:ROI={kind:'polygon',points:[{x:.5,y:.5},{x:5.5,y:.5},{x:.5,y:5.5}]},stats=analyze(dn,meta,roi,0);
  assert.equal(stats.count,15);const text=strFromU8(makeTxt(dn,5,stats));assert.equal(text.trim().split('\n').length,5);assert.ok(text.includes('\tNaN'));
  const xlsx=makeXlsx(dn,5,stats),parts=unzipSync(xlsx),xml=strFromU8(parts['xl/worksheets/sheet1.xml']);assert.ok(xml.includes('A1:E5'));assert.ok(xml.includes('<t>NaN</t>'));assert.ok(xml.includes('<c r="A1"><v>0</v></c>'));
  const files=await createExport(dn,meta,stats,roi,0,'Sample_DN_ROI_001',new Uint8Array([1,2,3]),()=>{});assert.equal(files.length,5);assert.ok(files.every(f=>f.name.startsWith('Sample_DN_ROI_001_')));const zip=unzipSync(makeExportZip(files));assert.equal(Object.keys(zip).length,5);assert.deepEqual([...decodePng(zip['Sample_DN_ROI_001_without_ROI.png']).data],[...dn]);
  mkdirSync('test-artifacts',{recursive:true});writeFileSync('test-artifacts/roi.xlsx',xlsx);writeFileSync('test-artifacts/roi.txt',makeTxt(dn,5,stats));writeFileSync('test-artifacts/exports.zip',makeExportZip(files));
});
test('viewport preview and rectangle geometry remain independent of quantitative arrays',()=>{
  const p={x:3.5,y:8.5},g=geometry(400,300,37),restored=g.inverse(g.forward(p));assert.ok(Math.abs(restored.x-p.x)<1e-12&&Math.abs(restored.y-p.y)<1e-12);
  const dn=new Uint8Array(100).fill(42),stats=analyze(dn,info(10,10),{kind:'rectangle',x:.5,y:.5,width:10,height:10},0);assert.equal(stats.mean,42);assert.equal(buildHistogram(stats,8,'data').counts.reduce((a,b)=>a+b),100);
});
