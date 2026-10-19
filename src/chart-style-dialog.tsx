import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Result} from './core';
import {Histogram} from './histogram';
import {defaultChartStyle,numericStyleLimits,normalizeChartStyle,type ChartStyle} from './chart-style';
import {NumberField,NumericValidationProvider,useNumericValidation} from './number-field';
import './chart-style.css';

type Props={style:ChartStyle;result:Result|null;name:string;onApply:(style:ChartStyle)=>void;onClose:()=>void};
export function ChartStyleDialog(props:Props){return <NumericValidationProvider><StyleEditor {...props}/></NumericValidationProvider>;}
function StyleEditor({style,result,name,onApply,onClose}:Props){
  const [draft,setDraft]=useState<ChartStyle>(()=>({...style})),[reset,setReset]=useState(0);
  const dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),{invalid}=useNumericValidation();
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;close.current?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab')return;
      const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([tabindex="-1"]),select:not(:disabled)')||[]),first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keyboard);return()=>{document.removeEventListener('keydown',keyboard);previous?.focus();};
  },[onClose]);
  const update=<K extends keyof ChartStyle>(key:K,value:ChartStyle[K])=>setDraft(previous=>({...previous,[key]:value}));
  const color=(key:keyof ChartStyle,label:string)=><label className="style-field" key={key}><span>{label}</span><input type="color" aria-label={label} value={String(draft[key])} onInput={event=>update(key,event.currentTarget.value)} onChange={event=>update(key,event.target.value)}/></label>;
  const number=(key:keyof ChartStyle,label:string,step=1)=>{const [min,max]=numericStyleLimits[key]!;return <div className="style-field" key={key}><label htmlFor={'style-'+key}>{label}</label><NumberField id={'style-'+key} label={label} value={Number(draft[key])} min={min} max={max} step={step} onCommit={value=>update(key,value)}/></div>;};
  const line=(key:'meanLine'|'peakLine'|'gridLine',label:string)=><label className="style-field" key={key}><span>{label}</span><select aria-label={label} value={draft[key]} onChange={event=>update(key,event.target.value as ChartStyle[typeof key])}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>;
  type ToggleKey={ [K in keyof ChartStyle]:ChartStyle[K] extends boolean?K:never }[keyof ChartStyle];
  const toggle=(key:ToggleKey,label:string,accessible=label)=><label className="style-toggle" key={key}><input type="checkbox" aria-label={accessible} checked={draft[key]} onChange={event=>update(key,event.target.checked)}/>{label}</label>;
  const fontOptions=(bold:ToggleKey,italic:ToggleKey,label:string)=><div className="style-font-row"><span>{label}</span><div>{toggle(bold,'Bold',`${label} bold`)}{toggle(italic,'Italic',`${label} italic`)}</div></div>;
  const title=(key:'xTitle'|'powerTitle'|'yTitle',label:string)=><label className="style-title-field" key={key}><span>{label}</span><input type="text" aria-label={label} value={draft[key]} maxLength={120} onChange={event=>update(key,event.target.value)}/></label>;
  const group=(label:string,children:ReactNode)=><fieldset><legend>{label}</legend>{children}</fieldset>;
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialog} className="chart-style-dialog" role="dialog" aria-modal="true" aria-labelledby="chart-style-title">
      <header className="modal-header"><div><p className="eyebrow">HISTOGRAM</p><h2 id="chart-style-title">Chart Appearance</h2></div><button ref={close} className="circle-button" aria-label="Close chart appearance" onClick={onClose}>×</button></header>
      <div className="chart-style-body">
        <div className="chart-style-fields" key={reset}>
          {group('Bars',<>{color('barColor','Bar color')}{number('barOpacity','Bar opacity',.05)}</>)}
          {group('Markers',<>{color('meanColor','Mean line color')}{number('meanWidth','Mean line width',.1)}{line('meanLine','Mean line style')}{color('peakColor','Peak line color')}{number('peakWidth','Peak line width',.1)}{line('peakLine','Peak line style')}{color('meanLabelColor','Mean font color')}{color('peakLabelColor','Peak font color')}{number('markerSize','Marker label size')}{fontOptions('markerBold','markerItalic','Marker labels')}{toggle('labelBackground','Label background')}</>)}
          {group('Axes',<>{color('axisColor','Border color')}{number('axisWidth','Border width',.1)}{color('tickColor','Tick font color')}{number('tickSize','Tick font size')}{fontOptions('tickBold','tickItalic','Tick labels')}</>)}
          {group('Titles',<>{color('titleColor','Title font color')}{fontOptions('titleBold','titleItalic','Axis titles')}{title('xTitle','DN axis title')}{number('xTitleSize','DN title font size')}{title('powerTitle','Power axis title')}{number('powerTitleSize','Power title font size')}{title('yTitle','Count axis title')}{number('yTitleSize','Count title font size')}</>)}
          {group('Summary',<>{color('summaryColor','Summary font color')}{fontOptions('fileBold','fileItalic','Filename')}{fontOptions('summaryBold','summaryItalic','Results')}</>)}
          {group('Grid',<>{toggle('gridVisible','Show grid')}{color('gridColor','Grid color')}{number('gridWidth','Grid line width',.1)}{line('gridLine','Grid line style')}</>)}
          {group('Background',<>{color('background','Figure background')}{color('plotBackground','Plot background')}</>)}
        </div>
        <div className="chart-style-preview"><h3>Preview</h3><Histogram result={result} name={name} style={draft}/></div>
      </div>
      <footer className="chart-style-actions"><button onClick={()=>{setDraft({...defaultChartStyle});setReset(value=>value+1);}}>Reset</button><span/><button onClick={onClose}>Cancel</button><button className="primary-button" disabled={invalid} onClick={()=>onApply(normalizeChartStyle(draft))}>Apply</button></footer>
    </section>
  </div>;
}
