import {createContext,useCallback,useContext,useEffect,useId,useMemo,useState,type ReactNode} from 'react';
import {numericValue} from './numeric-expression';

const Validation=createContext({invalid:false,report:(_id:string,_invalid:boolean)=>{}});
export function NumericValidationProvider({children}:{children:ReactNode}) {
  const [fields,setFields]=useState<Set<string>>(()=>new Set());
  const report=useCallback((id:string,invalid:boolean)=>setFields(previous=>{if(previous.has(id)===invalid)return previous;const next=new Set(previous);if(invalid)next.add(id);else next.delete(id);return next;}),[]);
  return <Validation.Provider value={useMemo(()=>({invalid:fields.size>0,report}),[fields,report])}>{children}</Validation.Provider>;
}
export const useNumericValidation=()=>useContext(Validation);

export function NumberField({value,onCommit,label,min=-Infinity,max=Infinity,step=1,disabled=false,id,integer=false}:{value:number;onCommit:(value:number)=>void;label:string;min?:number;max?:number;step?:number|'any';disabled?:boolean;id?:string;integer?:boolean}) {
  const key=useId(),{report}=useNumericValidation();
  const [text,setText]=useState(String(value)),[showError,setShowError]=useState(false);
  useEffect(()=>{setText(String(value));setShowError(false);},[value]);
  let candidate=value,problem='';try{candidate=numericValue(text,min,max,integer);}catch(error){problem=(error as Error).message;}
  useEffect(()=>{report(key,!disabled&&!!problem);return()=>report(key,false);},[report,key,disabled,problem]);
  const commit=()=>{if(problem){setShowError(true);return;}if(candidate!==value)onCommit(candidate);setText(String(candidate));setShowError(false);};
  const apply=(next:number)=>{const number=integer?Math.round(next):next;if(!Number.isFinite(number)||number<min||number>max)return;setText(String(number));setShowError(false);if(number!==value)onCommit(number);};
  const actualStep=step==='any'?1:step;
  return <span className={'number-field'+(showError&&problem?' has-error':'')}>
    <input id={id} className="expression-input" type="text" inputMode="text" aria-label={label} aria-invalid={showError&&!!problem} aria-describedby={showError&&problem?key:undefined} title="Supports +, -, *, / and parentheses. Press Enter or leave the field to calculate." value={text} disabled={disabled} onChange={event=>setText(event.target.value)} onBlur={commit} onKeyDown={event=>{
      if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
      else if(event.key==='Escape'){setText(String(value));setShowError(false);}
      else if((event.key==='ArrowUp'||event.key==='ArrowDown')&&!problem){event.preventDefault();apply(Number((candidate+(event.key==='ArrowUp'?actualStep:-actualStep)).toPrecision(14)));}
    }}/>
    <input className="native-stepper" type="number" aria-label={`Adjust ${label}`} tabIndex={-1} value={candidate} min={Number.isFinite(min)?min:undefined} max={Number.isFinite(max)?max:undefined} step={actualStep} disabled={disabled||!!problem} onChange={event=>{if(event.target.value!=='')apply(Number(event.target.value));}}/>
    {showError&&problem&&<span className="number-error" id={key} role="alert">{problem}</span>}
  </span>;
}
