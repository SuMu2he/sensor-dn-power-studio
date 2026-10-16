export class ComputeClient{
  private worker=new Worker(new URL('./compute.worker.ts',import.meta.url),{type:'module'});
  private next=0;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;progress?:(message:string)=>void}>();
  constructor(){
    this.worker.onmessage=event=>{const {id,value,error,progress}=event.data,task=this.pending.get(id);if(!task)return;if(progress){task.progress?.(progress);return;}this.pending.delete(id);if(error)task.reject(new Error(error));else task.resolve(value);};
    this.worker.onerror=event=>{for(const task of this.pending.values())task.reject(new Error(event.message||'The computation worker stopped unexpectedly.'));this.pending.clear();};
  }
  call<T=any>(method:string,args:any={},transfer:Transferable[]=[],progress?:(message:string)=>void):Promise<T>{
    return new Promise((resolve,reject)=>{const id=++this.next;this.pending.set(id,{resolve,reject,progress});this.worker.postMessage({id,method,args},transfer);});
  }
  close(){this.worker.terminate();for(const task of this.pending.values())task.reject(new Error('The application was closed.'));this.pending.clear();}
}
