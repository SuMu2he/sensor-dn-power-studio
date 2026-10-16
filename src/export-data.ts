import {Zip,ZipDeflate,strToU8,zipSync} from 'fflate';
import {matrixRows,type Pixels,type ImageInfo,type Stats,type ROI} from './core';
import {encodeImage,markedImage} from './image-io';
export type ExportFile={name:string;bytes:Uint8Array};
export function joinBytes(chunks:Uint8Array[]){const output=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){output.set(c,at);at+=c.length;}return output;}
function columnName(index:number){let s='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
/** XLSX uses incremental worksheet compression, not one JS object per pixel. */
export function makeXlsx(dn:Pixels,width:number,stats:Stats):Uint8Array{
  const [, ,columns,rows]=stats.bounds;
  if(columns>16384||rows>1048576)throw Error('The ROI bounding matrix exceeds the XLSX row or column limit.');
  const chunks:Uint8Array[]=[];let error:Error|null=null;
  const zip=new Zip((err,data)=>{if(err)error=err;else chunks.push(data);});
  const add=(name:string,xml:string)=>{const file=new ZipDeflate(name,{level:3});zip.add(file);file.push(strToU8(xml),true);};
  add('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  add('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ROI_DN" sheetId="1" r:id="rId1"/></sheets></workbook>');
  add('xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  const sheet=new ZipDeflate('xl/worksheets/sheet1.xml',{level:3});zip.add(sheet);
  sheet.push(strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(columns-1)}${rows}"/><sheetData>`));
  const names=Array.from({length:columns},(_,i)=>columnName(i));let y=1;
  for(const row of matrixRows(dn,width,stats)){
    let xml=`<row r="${y}">`;
    for(let x=0;x<row.length;x++){const ref=names[x]+y;xml+=Number.isNaN(row[x])?`<c r="${ref}" t="inlineStr"><is><t>NaN</t></is></c>`:`<c r="${ref}"><v>${row[x]}</v></c>`;}
    sheet.push(strToU8(xml+'</row>'));y++;
  }
  sheet.push(strToU8('</sheetData></worksheet>'),true);zip.end();
  if(error)throw error;return joinBytes(chunks);
}
export function makeTxt(dn:Pixels,width:number,stats:Stats){const rows:Uint8Array[]=[];for(const row of matrixRows(dn,width,stats))rows.push(strToU8(Array.from(row,v=>Number.isNaN(v)?'NaN':String(v)).join('\t')+'\n'));return joinBytes(rows);}
export function exportSuffixes(extension:string){return ['_gray.txt','_gray.xlsx','_with_ROI'+extension,'_without_ROI'+extension,'_histogram.png'];}
export function validatePrefix(prefix:string){if(!prefix.trim()||/[<>:"/\\|?*\x00-\x1f]/.test(prefix))throw Error('Enter a filename prefix without path separators or reserved characters.');return prefix.trim();}
export async function createExport(dn:Pixels,info:ImageInfo,stats:Stats,roi:ROI,angle:number,stem:string,histogram:Uint8Array,onProgress:(s:string)=>void){
  onProgress('Writing ROI text matrix…');const text=makeTxt(dn,info.width,stats);
  onProgress('Compressing Excel worksheet…');const xlsx=makeXlsx(dn,info.width,stats);
  onProgress('Encoding the processed full image…');const plain=await encodeImage(dn,info);
  onProgress('Encoding the full image with ROI…');const marked=markedImage(dn,info,roi,angle);
  const markedBytes=await encodeImage(marked.data,marked.info,3);
  const suffixes=exportSuffixes(info.extension),data=[text,xlsx,markedBytes,plain,histogram];
  return data.map((bytes,i)=>({name:stem+suffixes[i],bytes}));
}
export function makeExportZip(files:ExportFile[]){const entries:Record<string,[Uint8Array,{level:0|3}]>={};for(const f of files)entries[f.name]=[f.bytes,{level:f.name.endsWith('.txt')?3:0}];return zipSync(entries);}
