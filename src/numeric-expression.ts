/** A bounded arithmetic parser. No JavaScript evaluation or named functions. */
export function evaluateExpression(source:string):number {
  const text=source.trim();
  if(!text||text.length>256)throw Error('Enter a number or a short arithmetic expression.');
  let at=0,depth=0;
  const space=()=>{while(/\s/.test(text[at]||'')&&at<text.length)at++;};
  const finite=(value:number)=>{if(!Number.isFinite(value))throw Error('The result must be finite.');return value;};
  function primary():number {
    space();if(++depth>32)throw Error('Too many nested operations.');
    let value:number;
    if(text[at]==='+'||text[at]==='-'){const sign=text[at++];value=primary()*(sign==='-'?-1:1);}
    else if(text[at]==='('){at++;value=sum();space();if(text[at++]!==')')throw Error('Check the parentheses.');}
    else {const token=text.slice(at).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);if(!token)throw Error('Use numbers, +, -, *, / and parentheses.');at+=token[0].length;value=finite(Number(token[0]));}
    depth--;return finite(value);
  }
  function product():number {let value=primary();for(;;){space();const op=text[at];if(op!=='*'&&op!=='/')break;at++;const right=primary();if(op==='/'&&right===0)throw Error('Division by zero is not allowed.');value=finite(op==='*'?value*right:value/right);}return value;}
  function sum():number {let value=product();for(;;){space();const op=text[at];if(op!=='+'&&op!=='-')break;at++;const right=product();value=finite(op==='+'?value+right:value-right);}return value;}
  const result=sum();space();if(at!==text.length)throw Error('Use numbers, +, -, *, / and parentheses.');return Object.is(result,-0)?0:result;
}

export function numericValue(text:string,min=-Infinity,max=Infinity,integer=false):number {
  const result=evaluateExpression(text),value=integer?Math.round(result):result;
  if(value<min||value>max)throw Error(Number.isFinite(min)&&Number.isFinite(max)?`Result must be between ${min} and ${max}.`:Number.isFinite(min)?`Result must be at least ${min}.`:`Result must be at most ${max}.`);
  return value;
}
