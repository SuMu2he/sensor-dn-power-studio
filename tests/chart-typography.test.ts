import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultChartStyle,normalizeChartStyle,readChartStyle,saveChartStyle,chartStyleKey} from '../src/chart-style';
import {drawHistogram} from '../src/histogram-draw';
import {analyze,makeResult,defaults} from '../src/core';

test('old saved appearances keep their custom values and inherit matching text colors',()=>{
  const upgraded=normalizeChartStyle({barOpacity:.43,tickSize:19,meanColor:'#112233',peakColor:'#445566',tickColor:'#778899'});
  assert.equal(upgraded.barOpacity,.43);assert.equal(upgraded.tickSize,19);
  assert.equal(upgraded.meanLabelColor,'#112233');assert.equal(upgraded.peakLabelColor,'#445566');assert.equal(upgraded.summaryColor,'#778899');
  assert.equal(upgraded.markerItalic,false);assert.equal(upgraded.markerBold,true);assert.equal(upgraded.summarySize,12);
  const invalid=normalizeChartStyle({markerBold:'false',tickItalic:1,summaryColor:'red',fileItalic:null});
  assert.equal(invalid.markerBold,true);assert.equal(invalid.tickItalic,false);assert.equal(invalid.summaryColor,'#000000');assert.equal(invalid.fileItalic,false);
  assert.equal(normalizeChartStyle({summarySize:999}).summarySize,32);assert.equal(normalizeChartStyle({summarySize:0}).summarySize,8);
});

test('applied typography survives a browser-storage round trip without replacing older preferences',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  try{
    assert.deepEqual(readChartStyle(),defaultChartStyle);
    values.set(chartStyleKey,JSON.stringify({barColor:'#112233',markerSize:21,labelBackground:true}));
    const style={...readChartStyle(),summarySize:18,markerItalic:true,tickBold:true,titleBold:false,summaryItalic:true,fileBold:false,meanLabelColor:'#123456'};
    saveChartStyle(style);assert.deepEqual(readChartStyle(),style);
    assert.equal(style.barColor,'#112233');assert.equal(style.markerSize,21);assert.equal(style.labelBackground,true);
    values.delete(chartStyleKey);assert.equal(readChartStyle().barOpacity,.7);assert.equal(readChartStyle().tickSize,16);
  }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('shared histogram drawing applies font styles and colors without changing numerical labels or line colors',()=>{
  const dn=new Uint8Array([10,20,30,50,80,100,150,200]),info={width:8,height:1,bitDepth:8,extension:'.png',name:'test.png'};
  const result=makeResult(analyze(dn,info,{kind:'rectangle',x:.5,y:.5,width:8,height:1},0),defaults,8,'native');
  const before=JSON.stringify(result),text:{value:string;font:string;color:unknown;x:number;y:number}[]=[],strokes:unknown[]=[];
  const stack:{font:string;fillStyle:unknown;strokeStyle:unknown}[]=[];
  const ctx={
    font:'',fillStyle:'' as unknown,strokeStyle:'' as unknown,
    clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},translate(){},rotate(){},setLineDash(){},
    stroke(){strokes.push(this.strokeStyle);},
    save(){stack.push({font:this.font,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle});},
    restore(){Object.assign(this,stack.pop());},
    measureText(value:string){return {width:value.length*Number(this.font.match(/(\d+)px/)?.[1]||12)*.52};},
    fillText(value:string,x:number,y:number){text.push({value,font:this.font,color:this.fillStyle,x,y});},
  };
  const style={...defaultChartStyle,summarySize:18,meanLabelColor:'#123456',peakLabelColor:'#654321',markerBold:false,markerItalic:true,tickBold:true,tickItalic:true,titleBold:false,titleItalic:true,summaryColor:'#246810',fileBold:false,fileItalic:true,summaryBold:true,summaryItalic:true};
  drawHistogram(ctx as unknown as CanvasRenderingContext2D,1280,720,result,info.name,true,style);
  const find=(prefix:string)=>{const item=text.find(item=>item.value.startsWith(prefix));assert.ok(item,prefix);return item;};
  assert.equal(find('test.png').font,'italic 400 18px "Segoe UI",Arial,sans-serif');
  assert.equal(find('Mean:').font,'italic 700 18px "Segoe UI",Arial,sans-serif');assert.equal(find('Mean:').color,'#246810');
  assert.equal(find('Grayscale').font,'italic 400 16px "Segoe UI",Arial,sans-serif');
  assert.equal(find('Optical').color,'#000000');assert.equal(find('Pixel Count').font,find('Grayscale').font);
  assert.equal(find('Mean ').font,'italic 400 16px "Segoe UI",Arial,sans-serif');assert.equal(find('Mean ').color,'#123456');
  assert.equal(find('Peak ').color,'#654321');assert.equal(find('0').font,'italic 700 16px "Segoe UI",Arial,sans-serif');
  assert.ok(find('Mean:').value.includes(`Mean: ${result.average.toFixed(3)} μW/cm² (DN ${Math.round(result.mean)})`));
  assert.ok(strokes.includes(style.meanColor));assert.ok(strokes.includes(style.peakColor));assert.equal(JSON.stringify(result),before);
  text.length=0;
  drawHistogram(ctx as unknown as CanvasRenderingContext2D,480,720,result,info.name,true,{...style,summarySize:32});
  const summaryLines=text.filter(item=>item.font.includes('32px'));
  assert.ok(summaryLines.length>2,'large summary should wrap');
  assert.ok(summaryLines.every(item=>item.y+32<find('Optical').y),'summary must stay above the power-axis title');
  assert.ok(summaryLines.every(item=>item.value.length*32*.52<=452),'summary lines stay within the image');
});
