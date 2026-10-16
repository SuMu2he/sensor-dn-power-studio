import {decode as decodePNG,encode as encodePNG} from 'fast-png';
import {decode as decodeTIFF} from 'tiff';
import {unzlibSync,zlibSync} from 'fflate';
import {allocPixels,geometry,roiVertices,roundDN,type Pixels,type ImageInfo,type ROI} from './core';
export type RawPixels=Pixels|Float32Array;
export type LoadedImage={raw:RawPixels;info:ImageInfo};
function grayscale(data:ArrayLike<number>,width:number,height:number,bits:number,channels:number,alpha=false):RawPixels{
  const count=width*height,max=2**bits-1;
  if(channels<1||channels>4||data.length<count*channels)throw Error('Unsupported or incomplete image data.');
  const float=data instanceof Float32Array,raw=float?new Float32Array(count):allocPixels(count,bits);
  for(let i=0;i<count;i++){
    const k=i*channels,v=data[k];
    if(channels>=3&&(v!==data[k+1]||v!==data[k+2]))throw Error('Please import a grayscale image. RGB colors are not converted automatically.');
    if(alpha&&data[k+channels-1]!==max)throw Error('Transparent images cannot be treated as calibrated grayscale data.');
    if(!Number.isFinite(v))throw Error('The image contains nonfinite DN values.');
    raw[i]=v;
  }return raw;
}
export async function readImage(bytes:Uint8Array,name:string):Promise<LoadedImage>{
  const extension=(name.match(/\.[^.]+$/)?.[0]||'').toLowerCase();
  let raw:RawPixels,width:number,height:number,bitDepth:number;
  if(bytes[0]===137&&bytes[1]===80){
    const image=decodePNG(bytes,{checkCrc:true});({width,height}=image);bitDepth=image.depth;
    let samples=image.data;
    if(bitDepth<8){const unpacked=new Uint8Array(width*height*image.channels),stride=Math.ceil(width*image.channels*bitDepth/8),mask=2**bitDepth-1;for(let y=0;y<height;y++)for(let x=0;x<width*image.channels;x++)unpacked[y*width*image.channels+x]=(image.data[y*stride+Math.floor(x*bitDepth/8)]>>(8-bitDepth-x*bitDepth%8))&mask;samples=unpacked;}
    if(image.palette){
      const palette=image.palette;
      if(palette.some(c=>c[0]!==c[1]||c[0]!==c[2]||(c.length>3&&c[3]!==255)))throw Error('Please import an opaque grayscale palette image.');
      raw=new Uint8Array(width*height);for(let i=0;i<raw.length;i++)raw[i]=palette[samples[i]][0];bitDepth=8;
    }else{
      raw=grayscale(samples,width,height,bitDepth,image.channels,image.channels===2||image.channels===4);
      if(image.transparency){const t=image.transparency;for(let i=0;i<width*height;i++){const k=i*image.channels;if(samples[k]===t[0]&&(image.channels<3||(samples[k+1]===t[1]&&samples[k+2]===t[2])))throw Error('Transparent images cannot be treated as calibrated grayscale data.');}}
    }
  }else if((bytes[0]===73&&bytes[1]===73)||(bytes[0]===77&&bytes[1]===77)){
    const special=readSpecialTIFF(bytes);
    if(special){({width,height,raw,bitDepth}=special);}
    else{
      const image=decodeTIFF(bytes,{pages:[0]})[0];
      ({width,height}=image);bitDepth=image.bitsPerSample;
      if(![1,8,16,32].includes(bitDepth))throw Error(`Unsupported TIFF depth: ${bitDepth} bits.`);
      if(image.palette){
        if(image.palette.some(c=>c[0]!==c[1]||c[0]!==c[2]))throw Error('Please import a grayscale palette image.');
        raw=new Uint8Array(width*height);for(let i=0;i<raw.length;i++)raw[i]=Math.round(image.palette[image.data[i]][0]/257);bitDepth=8;
      }else raw=grayscale(image.data,width,height,bitDepth,image.components,image.alpha);
    }
  }else if(bytes[0]===66&&bytes[1]===77){({width,height,raw,bitDepth}=decodeBMP(bytes));}
  else if(bytes[0]===255&&bytes[1]===216){
    const bitmap=await createImageBitmap(new Blob([bytes as BlobPart],{type:'image/jpeg'}));
    width=bitmap.width;height=bitmap.height;bitDepth=8;
    const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(bitmap,0,0);bitmap.close();raw=grayscale(ctx.getImageData(0,0,width,height).data,width,height,8,4,true);
  }else throw Error('Supported image formats: grayscale PNG, TIFF, BMP and JPEG.');
  if(!width||!height||raw.length!==width*height)throw Error('The image dimensions are invalid.');
  return {raw,info:{width,height,bitDepth,name,extension:extension||'.png'}};
}
export function decodeBMP(bytes:Uint8Array){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),offset=d.getUint32(10,true),dib=d.getUint32(14,true);
  if(dib<40)throw Error('This BMP header is not supported.');
  const width=d.getInt32(18,true),signedH=d.getInt32(22,true),height=Math.abs(signedH),bits=d.getUint16(28,true),compression=d.getUint32(30,true);
  if(width<=0||height<=0||![1,4,8,24,32].includes(bits)||compression!==0)throw Error('Only uncompressed 1/4/8/24/32-bit BMP files are supported.');
  const bitDepth=bits===1?1:8,raw=allocPixels(width*height,bitDepth),stride=Math.ceil(width*bits/32)*4;
  const paletteCount=bits<=8?(d.getUint32(46,true)||2**bits):0,palette:number[]=[];
  for(let i=0;i<paletteCount;i++){const k=14+dib+i*4,b=bytes[k],g=bytes[k+1],r=bytes[k+2];if(r!==g||g!==b)throw Error('Please import a grayscale BMP palette.');palette.push(r);}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const row=offset+(signedH>0?height-1-y:y)*stride;let v:number;
    if(bits<=8){const index=bits===1?(bytes[row+(x>>3)]>>(7-(x&7)))&1:bits===4?(bytes[row+(x>>1)]>>(x%2?0:4))&15:bytes[row+x];v=bits===1?Math.round(palette[index]/255):palette[index];}
    else{const k=row+x*(bits/8),b=bytes[k],g=bytes[k+1],r=bytes[k+2];if(r!==g||g!==b)throw Error('Please import a grayscale BMP image.');v=r;}
    raw[y*width+x]=v;
  }return {raw,width,height,bitDepth};
}
export function encodeBMP(data:Pixels,width:number,height:number,channels:number,bits:number){
  const binary=channels===1&&bits===1,depth=channels===3?24:binary?1:8,paletteBytes=channels===1?(binary?8:1024):0;
  const stride=Math.ceil(width*depth/32)*4,offset=54+paletteBytes,out=new Uint8Array(offset+stride*height),d=new DataView(out.buffer);
  out[0]=66;out[1]=77;d.setUint32(2,out.length,true);d.setUint32(10,offset,true);d.setUint32(14,40,true);d.setInt32(18,width,true);d.setInt32(22,height,true);d.setUint16(26,1,true);d.setUint16(28,depth,true);d.setUint32(34,stride*height,true);
  if(channels===1)for(let i=0;i<(binary?2:256);i++){const v=binary?i*255:i,k=54+i*4;out[k]=out[k+1]=out[k+2]=v;}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const row=offset+(height-1-y)*stride,i=y*width+x;if(channels===3){out[row+x*3]=data[i*3+2];out[row+x*3+1]=data[i*3+1];out[row+x*3+2]=data[i*3];}else if(binary)out[row+(x>>3)]|=data[i]<<(7-(x&7));else out[row+x]=data[i];}
  return out;
}
/** Baseline, uncompressed TIFF: preserve unsigned 8/16/32-bit samples, including RGB marks. */
export function encodeTIFF(data:Pixels,width:number,height:number,channels:number,bits:number){
  const depth=channels===1&&bits===1?1:Math.max(8,bits),byteCount=depth===1?Math.ceil(width/8)*height:data.length*(depth/8),tags:[number,number,number[]][]=[
    [256,4,[width]],[257,4,[height]],[258,3,Array(channels).fill(depth)],[259,3,[1]],[262,3,[channels===1?1:2]],
    [273,4,[0]],[277,3,[channels]],[278,4,[height]],[279,4,[byteCount]],[284,3,[1]],[339,3,Array(channels).fill(1)]
  ];
  let extra=8+2+tags.length*12+4;
  const offsets=new Map<number,number>();
  for(const [tag,type,values]of tags)if(values.length*(type===3?2:4)>4){offsets.set(tag,extra);extra+=values.length*(type===3?2:4);}
  const pixelOffset=(extra+3)&~3,out=new Uint8Array(pixelOffset+byteCount),d=new DataView(out.buffer);
  out[0]=73;out[1]=73;d.setUint16(2,42,true);d.setUint32(4,8,true);d.setUint16(8,tags.length,true);
  tags.find(t=>t[0]===273)![2][0]=pixelOffset;
  tags.forEach(([tag,type,values],i)=>{const p=10+i*12;d.setUint16(p,tag,true);d.setUint16(p+2,type,true);d.setUint32(p+4,values.length,true);const location=offsets.get(tag)??p+8;if(offsets.has(tag))d.setUint32(p+8,location,true);values.forEach((v,j)=>{if(type===3)d.setUint16(location+j*2,v,true);else d.setUint32(location+j*4,v,true);});});
  if(depth===1){const stride=Math.ceil(width/8);for(let y=0;y<height;y++)for(let x=0;x<width;x++)out[pixelOffset+y*stride+(x>>3)]|=data[y*width+x]<<(7-(x&7));}
  else for(let i=0;i<data.length;i++){if(depth===8)out[pixelOffset+i]=data[i];else if(depth===16)d.setUint16(pixelOffset+i*2,data[i],true);else d.setUint32(pixelOffset+i*4,data[i],true);}
  return out;
}
/** Preserve unsigned 32-bit samples and decode PackBits, including MATLAB's default TIFFs. */
function readSpecialTIFF(bytes:Uint8Array){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),le=bytes[0]===73;
  if(d.getUint16(2,le)!==42)throw Error('BigTIFF is not supported. Please use a standard TIFF.');
  const ifd=d.getUint32(4,le),fields=new Map<number,number[]>(),n=d.getUint16(ifd,le);
  for(let i=0;i<n;i++){const p=ifd+2+i*12,tag=d.getUint16(p,le),type=d.getUint16(p+2,le),count=d.getUint32(p+4,le);if(![3,4].includes(type))continue;const size=type===3?2:4,start=count*size>4?d.getUint32(p+8,le):p+8;fields.set(tag,Array.from({length:count},(_,j)=>type===3?d.getUint16(start+j*size,le):d.getUint32(start+j*size,le)));}
  const val=(tag:number,fallback:number)=>fields.get(tag)?.[0]??fallback;
  const bits=val(258,8),format=val(339,1),compression=val(259,1);
  if(!(bits===32&&format===1)&&compression!==32773)return null;
  const width=val(256,0),height=val(257,0),channels=val(277,1),rows=val(278,height),type=val(262,1);
  if(val(284,1)!==1||val(274,1)!==1||fields.has(322))throw Error('This TIFF requires untiled, interleaved samples in the original orientation.');
  if(![1,5,8,32946,32773].includes(compression)||![1,8,16,32].includes(bits))throw Error('Unsupported TIFF compression or sample depth.');
  const offsets=fields.get(273)!,lengths=fields.get(279)!,data=bits===32&&format===3?new Float32Array(width*height*channels):allocPixels(width*height*channels,bits);let target=0;
  for(let strip=0;strip<offsets.length;strip++){
    const source=bytes.subarray(offsets[strip],offsets[strip]+lengths[strip]);
    const count=Math.min(width*channels*rows,data.length-target),expected=bits===1?Math.ceil(width*channels/8)*Math.ceil(count/(width*channels)):count*bits/8;
    const decoded=compression===1?source:compression===8||compression===32946?unzlibSync(source):compression===5?unpackLzw(source,expected):unpackBits(source);
    const view=new DataView(decoded.buffer,decoded.byteOffset,decoded.byteLength);
    for(let k=0;k<count;k++){
      if(bits===1){const yy=Math.floor(k/(width*channels)),xx=k%(width*channels);data[target+k]=(decoded[yy*Math.ceil(width*channels/8)+(xx>>3)]>>(7-(xx&7)))&1;}
      else data[target+k]=bits===8?view.getUint8(k):bits===16?view.getUint16(k*2,le):format===3?view.getFloat32(k*4,le):view.getUint32(k*4,le);
    }
    if(val(317,1)===2)for(let k=0;k<count;k++)if(k%(width*channels)>=channels)data[target+k]=data[target+k]+data[target+k-channels];
    target+=count;
  }
  if(type===0)for(let i=0;i<data.length;i++)data[i]=2**bits-1-data[i];
  if(type===3){const palette=fields.get(320)!;if(!palette)throw Error('The TIFF palette is missing.');const count=2**bits,raw=new Uint8Array(width*height);for(let i=0;i<raw.length;i++){const v=data[i];if(palette[v]!==palette[v+count]||palette[v]!==palette[v+2*count])throw Error('Please import a grayscale TIFF palette.');raw[i]=Math.round(palette[v]/257);}return {width,height,raw,bitDepth:8};}
  return {width,height,raw:grayscale(data,width,height,bits,channels,channels===2||channels===4),bitDepth:bits};
}
function unpackBits(bytes:Uint8Array){const out:number[]=[];for(let i=0;i<bytes.length;){const h=(bytes[i++]<<24)>>24;if(h>=0){for(let j=0;j<=h;j++)out.push(bytes[i++]);}else if(h!==-128){const v=bytes[i++];for(let j=0;j<1-h;j++)out.push(v);}}return new Uint8Array(out);}
function unpackLzw(bytes:Uint8Array,expected:number){
  const output=new Uint8Array(expected),prefix=new Int32Array(4096),suffix=new Uint8Array(4096),stack=new Uint8Array(4097);
  let position=0,bits=9,next=258,old=-1,first=0,written=0;
  const read=()=>{if(position+bits>bytes.length*8)return 257;let value=0;for(let k=0;k<bits;k++){value=(value<<1)|((bytes[position>>3]>>(7-(position&7)))&1);position++;}return value;};
  while(written<expected){const code=read();if(code===257)break;if(code===256){bits=9;next=258;old=-1;continue;}let current=code,top=0;
    if(current>=next){if(current!==next||old<0)throw Error('Invalid TIFF LZW data.');stack[top++]=first;current=old;}
    while(current>=256){if(current>=next||top>=4096)throw Error('Invalid TIFF LZW dictionary.');stack[top++]=suffix[current];current=prefix[current];}
    first=current;stack[top++]=first;while(top&&written<expected)output[written++]=stack[--top];
    if(old>=0&&next<4096){prefix[next]=old;suffix[next]=first;next++;if(next===(1<<bits)-1&&bits<12)bits++;}old=code;
  }
  if(written<expected)throw Error('The TIFF LZW strip is incomplete.');return output;
}
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function lowDepthPNG(data:Pixels,width:number,height:number,bits:number){
  const stride=Math.ceil(width*bits/8),scan=new Uint8Array((stride+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)scan[y*(stride+1)+1+Math.floor(x*bits/8)]|=data[y*width+x]<<(8-bits-(x*bits%8));
  const header=new Uint8Array(13),d=new DataView(header.buffer);d.setUint32(0,width);d.setUint32(4,height);header[8]=bits;
  const chunks=[['IHDR',header],['IDAT',zlibSync(scan)],['IEND',new Uint8Array()]] as const;
  const result:number[]=[137,80,78,71,13,10,26,10];
  for(const [type,body]of chunks){const chunk=new Uint8Array(12+body.length),v=new DataView(chunk.buffer);v.setUint32(0,body.length);for(let k=0;k<4;k++)chunk[4+k]=type.charCodeAt(k);chunk.set(body,8);v.setUint32(8+body.length,crc32(chunk.subarray(4,8+body.length)));for(const b of chunk)result.push(b);}
  return new Uint8Array(result);
}
export async function encodeImage(data:Pixels,info:ImageInfo,channels=1):Promise<Uint8Array>{
  const {width,height,bitDepth:bits,extension:ext}=info;
  if(ext==='.tif'||ext==='.tiff')return encodeTIFF(data,width,height,channels,bits);
  if(ext==='.bmp')return encodeBMP(data,width,height,channels,bits);
  if(ext==='.jpg'||ext==='.jpeg'){
    const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d')!,rgba=new Uint8ClampedArray(width*height*4);
    for(let i=0;i<width*height;i++){rgba[i*4]=data[i*channels];rgba[i*4+1]=data[i*channels+(channels===3?1:0)];rgba[i*4+2]=data[i*channels+(channels===3?2:0)];rgba[i*4+3]=255;}
    ctx.putImageData(new ImageData(rgba,width,height),0,0);return new Uint8Array(await (await canvas.convertToBlob({type:'image/jpeg',quality:.98})).arrayBuffer());
  }
  if(bits<8&&channels===1)return lowDepthPNG(data,width,height,bits);
  return encodePNG({width,height,channels,depth:Math.max(8,bits) as 8|16,data:data as Uint8Array|Uint16Array});
}
export function markedImage(dn:Pixels,info:ImageInfo,roi:ROI,angle:number){
  const bits=Math.max(8,info.bitDepth),data=allocPixels(dn.length*3,bits),scale=info.bitDepth<8?255/(2**info.bitDepth-1):1;
  for(let i=0;i<dn.length;i++)data[i*3]=data[i*3+1]=data[i*3+2]=dn[i]*scale;
  const g=geometry(info.width,info.height,angle),vertices=roiVertices(roi).map(g.inverse),green=2**bits-1;
  for(let n=0;n<vertices.length;n++){
    const a=vertices[n],b=vertices[(n+1)%vertices.length],samples=Math.max(2,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*2)+1);
    for(let k=0;k<samples;k++){const x=roundDN(a.x+(b.x-a.x)*k/(samples-1)),y=roundDN(a.y+(b.y-a.y)*k/(samples-1));for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const xx=x+dx,yy=y+dy;if(xx>=1&&xx<=info.width&&yy>=1&&yy<=info.height){const i=((yy-1)*info.width+xx-1)*3;data[i]=0;data[i+1]=green;data[i+2]=0;}}}
  }return {data,info:{...info,bitDepth:bits}};
}
