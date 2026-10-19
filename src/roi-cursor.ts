/** Clockwise handles: top-left, top, top-right, right, bottom-right, bottom, bottom-left, left. */
export const rectangleHandleCursor=(index:number)=>['nwse-resize','ns-resize','nesw-resize','ew-resize','nwse-resize','ns-resize','nesw-resize','ew-resize'][index]||'move';
