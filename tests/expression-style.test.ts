import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateExpression,numericValue} from '../src/numeric-expression';
import {defaultChartStyle,normalizeChartStyle,lineDash} from '../src/chart-style';
import {rectangleHandleCursor} from '../src/roi-cursor';

test('numeric expressions preserve arithmetic precedence, signs, decimals and scientific notation',()=>{
  for(const [expression,expected] of [['630/2',315],['(540+100)/2',320],['2+3*4',14],['(2+3)*4',20],['8/4/2',1],['-2 * -(3+1)',8],['.5 + 1.25',1.75],['1e-3 * 1000',1],['2--3',5],[' 6 / ( 1 + 2 ) ',2],['2.74*2.74',7.5076]] as const)assert.ok(Math.abs(evaluateExpression(expression)-expected)<1e-12,expression);
  assert.equal(Object.is(evaluateExpression('-0'),-0),false);
});
test('invalid expressions never execute code or produce a nonfinite accepted value',()=>{
  for(const expression of ['', '1/0','0/0','1/(2-2)','1e999','1e308*10','2^3','2**3','sqrt(4)','Math.random()','alert(1)','1;2','[1]','(1+2','1+2)','2(3)','1e','1 +','('.repeat(40)+'1'+')'.repeat(40),'1'.repeat(257)])assert.throws(()=>evaluateExpression(expression),Error,expression);
  assert.throws(()=>numericValue('101',Number.MIN_VALUE,100));
  assert.throws(()=>numericValue('0',Number.MIN_VALUE));
  assert.throws(()=>numericValue('-3',1,Infinity,true));
  assert.equal(numericValue('99/2',1,Infinity,true),50);
});
test('stored chart settings retain valid values, reject wrong types and clamp unsafe dimensions',()=>{
  const custom=normalizeChartStyle({barColor:'#102030',barOpacity:.4,meanLine:'dotted',axisWidth:999,tickSize:-10,xTitle:'Custom DN',gridVisible:false,markerSize:NaN,peakWidth:'#123456',labelBackground:'#123456',plotBackground:'javascript:alert(1)',yTitle:'X'.repeat(200),unrelated:true});
  assert.equal(custom.barColor,'#102030');assert.equal(custom.barOpacity,.4);assert.equal(custom.meanLine,'dotted');assert.equal(custom.axisWidth,6);assert.equal(custom.tickSize,8);assert.equal(custom.xTitle,'Custom DN');assert.equal(custom.gridVisible,false);assert.equal(custom.markerSize,defaultChartStyle.markerSize);assert.equal(custom.peakWidth,defaultChartStyle.peakWidth);assert.equal(custom.labelBackground,defaultChartStyle.labelBackground);assert.equal(custom.plotBackground,'#ffffff');assert.equal(custom.yTitle.length,120);assert.equal('unrelated' in custom,false);
  assert.deepEqual(normalizeChartStyle(null),defaultChartStyle);assert.deepEqual(normalizeChartStyle({meanLine:'broken'}),defaultChartStyle);assert.deepEqual(lineDash('solid'),[]);assert.ok(lineDash('dashed').length===2);
});
test('rectangle handle directions distinguish every edge and diagonal from movement',()=>{
  assert.deepEqual(Array.from({length:8},(_,index)=>rectangleHandleCursor(index)),['nwse-resize','ns-resize','nesw-resize','ew-resize','nwse-resize','ns-resize','nesw-resize','ew-resize']);
});
