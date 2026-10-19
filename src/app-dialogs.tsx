import {useEffect,useRef,useState,type ReactNode} from 'react';
import './app-dialogs.css';

const poems=[
  ['明月松间照，清泉石上流。','王维《山居秋暝》'],
  ['行到水穷处，坐看云起时。','王维《终南别业》'],
  ['欲穷千里目，更上一层楼。','王之涣《登鹳雀楼》'],
  ['采菊东篱下，悠然见南山。','陶渊明《饮酒·其五》'],
  ['会当凌绝顶，一览众山小。','杜甫《望岳》'],
  ['长风破浪会有时，直挂云帆济沧海。','李白《行路难·其一》'],
  ['竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。','苏轼《定风波·莫听穿林打叶声》'],
  ['人间有味是清欢。','苏轼《浣溪沙·细雨斜风作晓寒》'],
  ['斯是陋室，惟吾德馨。','刘禹锡《陋室铭》'],
  ['问渠那得清如许？为有源头活水来。','朱熹《观书有感·其一》'],
  ['不畏浮云遮望眼，自缘身在最高层。','王安石《登飞来峰》'],
  ['纸上得来终觉浅，绝知此事要躬行。','陆游《冬夜读书示子聿》'],
] as const;
let previousPoem=-1;
function nextPoem(){
  const offset=Math.floor(Math.random()*(poems.length-(previousPoem<0?0:1)));
  const index=previousPoem<0?offset:offset>=previousPoem?offset+1:offset;
  previousPoem=index;return poems[index];
}

const quickStart=[
  'Import a grayscale image. Native integer DN and bit depth are preserved.',
  'Adjust Ka and Kb. DN values are rounded and clipped to the image range.',
  'Draw an ROI. Enter the wavelength, pixel size, gain, QE and exposure.',
  'Select Calculate. Read the peak, mean and histogram, or Expand the chart.',
  'Set a filename and Export the processed matrices, images and 4K histogram.',
];
const chapters:{id:string;label:string;title:string;body:ReactNode}[]=[
  {id:'import',label:'Import & DN',title:'1. Images and preprocessing',body:<>
    <p>Import PNG, TIFF, BMP or grayscale JPEG with Import, or drop a file onto the page. TIFF uses its first image. Color images, transparent pixels and unsupported formats produce a clear error. Try a synthetic sample provides an example without using experimental data.</p>
    <p>Preprocessing uses DN = clip(round(Ka × original DN + Kb), 0, 2<sup>bit depth</sup> − 1). Fractional values are rounded, and values outside the native range are clipped. The status turns red when clipping occurs. Every calculation and exported dataset uses these processed DN values.</p>
  </>},
  {id:'roi',label:'ROI',title:'2. Rectangles and polygons',body:<>
    <p>Select Rectangle and drag on the image. Enter W and H in pixels, or drag an edge or corner handle. The chain button locks the current width-to-height ratio. Select Polygon and click vertices; finish by pressing Enter, double-clicking or clicking the first vertex. Esc cancels a new ROI; Backspace removes its most recent polygon vertex.</p>
    <p>Drag an existing ROI or a polygon vertex to edit it. Delete clears the ROI. Pixel centers use MATLAB-compatible 1-based coordinates. Measurements select original source pixels inside the ROI, including when the view is rotated; display interpolation never changes measured DN.</p>
  </>},
  {id:'parameters',label:'Parameters',title:'3. Calibration and units',body:<>
    <p>Enter wavelength λ in nm, square-pixel side length in μm, gain in DN/e⁻, quantum efficiency in percent and exposure in ms. QE 55 means 55%. Values must be positive; QE must not exceed 100%. Gain is DN per electron, so electrons are calculated by dividing DN by gain.</p>
    <p>Photon energy E<sub>p</sub> = hc/λ is displayed in eV and J; A<sub>pixel</sub> = d<sub>pixel</sub>² is displayed in μm². Conversion uses N<sub>e</sub> = DN/K<sub>e-DN</sub>, N<sub>p</sub> = N<sub>e</sub>/QE, E = N<sub>p</sub>E<sub>p</sub>, and P = E/(t A<sub>pixel</sub>), with QE, time and area converted to compatible units. Results are sensor-plane irradiance in μW/cm².</p>
  </>},
  {id:'results',label:'Results & chart',title:'4. Results and the histogram',body:<>
    <p>Calculate updates the results without saving. Peak power density uses the maximum processed DN within the ROI. Mean power density uses the arithmetic mean of all selected pixels. Editing the image preprocessing, ROI, angle or calibration clears the previous result until you calculate again.</p>
    <p>The histogram shows pixel count against DN, with calibrated power density on the upper axis. Mean and peak lines show power density on the left and DN on the right. The summary above the chart is selectable text: select it and use Ctrl+C or the browser Copy command. Display labels use three decimal places for power density and rounded integer DN; calculation precision and the mean-line position are retained.</p>
    <p>DN 0–maximum uses the image bit depth; Data Range focuses on the selected data. Expand opens a separate, resizable chart with the same selectable summary. Its drawing resolution follows the window and display pixel density.</p>
  </>},
  {id:'view',label:'View & guides',title:'5. Image view and panel layout',body:<>
    <p>Hover over the image and scroll to zoom. Drag the background to pan. Double-click the background or select Fit to fit the full view. Angle rotates the view without cropping; Reset restores 0°. Contrast improves display contrast only. Measurements and exported images retain processed source DN.</p>
    <p>V and H add vertical and horizontal guides. Drag a guide to reposition it; right-click it to delete it. Clear removes all guides, and Guides shows or hides them.</p>
    <p>Drag the divider beside the parameter sidebar to change its width. Drag the divider above the histogram to adjust the image and chart heights. Double-click a divider or press Enter while it is focused to reset it. Arrow keys adjust it by 16 px, Shift+arrow by 50 px; Home and End move to its limits. Layout is remembered in this browser.</p>
  </>},
  {id:'export',label:'Export',title:'6. Files, numbering and resolution',body:<>
    <p>Path selects an output directory in browsers that support directory access. Otherwise Export downloads one ZIP. The default prefix is OriginalName_DN_ROI. Groups begin at _001; folder exports skip any number already occupied by one of the five files. ZIP numbering is remembered for this site in this browser and resets if its site data is cleared.</p>
    <p>Each export contains a two-dimensional gray TXT matrix, the same matrix in Excel, an original-orientation processed image with a green ROI, the same processed image without markings, and a 4K histogram PNG (3840 × 2160). Both experimental images retain their original full resolution and file format. No image resampling is introduced by the 4K chart setting.</p>
    <p>Matrices use the ROI bounding rectangle in original image coordinates. Positions outside a polygon are NaN; Excel writes those positions as text NaN. Finite DN entries are rounded and clipped integers. JPEG re-encoding is lossy; use lossless images or the matrices for exact pixel comparisons. All processing and file generation take place locally in your browser.</p>
  </>},
];

export function AppDialog({kind,onClose}:{kind:'help'|'about';onClose:()=>void}){
  const dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
  const [poem]=useState(nextPoem);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;close.current?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab')return;
      const elements=dialog.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]');
      if(!elements?.length)return;
      const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.removeEventListener('keydown',keyboard);previous?.focus();};
  },[onClose]);
  const title=kind==='help'?'Help & User Guide':'About Sensor DN Power Studio';
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialog} className={`dialog-card ${kind}-dialog`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
      <header className="modal-header"><div><p className="eyebrow">{kind==='help'?'QUICK START & COMPLETE MANUAL':'APPLICATION INFORMATION'}</p><h2 id="app-dialog-title">{title}</h2></div><button ref={close} className="dialog-close circle-button" aria-label="Close dialog" onClick={onClose}>×</button></header>
      {kind==='help'?<>
        <div className="help-quickstart"><h3>Quick start</h3><ol>{quickStart.map((step,i)=><li key={step}><b>{i+1}</b><span>{step}</span></li>)}</ol></div>
        <nav className="help-navigation" aria-label="Manual chapters">{chapters.map(chapter=><a key={chapter.id} href={`#manual-${chapter.id}`} onClick={event=>{event.preventDefault();document.getElementById(`manual-${chapter.id}`)?.scrollIntoView({block:'start'});}}>{chapter.label}</a>)}</nav>
        <div className="help-manual" tabIndex={0} aria-label="Detailed user guide">{chapters.map(chapter=><section key={chapter.id} id={`manual-${chapter.id}`}><h3>{chapter.title}</h3>{chapter.body}</section>)}</div>
      </>:<div className="about-content">
        <div className="about-logo"><img src={import.meta.env.BASE_URL+'icon.svg'} alt=""/><strong>Sensor DN Power Studio</strong></div>
        <dl className="about-metadata">
          <div><dt>Application name</dt><dd>Sensor DN Power Studio</dd></div>
          <div><dt>Version</dt><dd>Ver.1.1</dd></div>
          <div><dt>Last updated</dt><dd>2026.10.19</dd></div>
          <div><dt>Author / Maintainer</dt><dd>Mingze Sun</dd></div>
          <div><dt>Powered by</dt><dd>OpenAI Codex</dd></div>
        </dl>
      </div>}
      <footer className="dialog-quote" lang="zh-CN"><p>{poem[0]}</p><cite>{poem[1]}</cite></footer>
    </section>
  </div>;
}

export function LinkIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8a4.5 4.5 0 0 0 6.4.1l2.3-2.3a4.5 4.5 0 0 0-6.4-6.4l-1.3 1.3"/><path d="M13.8 10.2a4.5 4.5 0 0 0-6.4-.1l-2.3 2.3a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3"/></svg>;
}
