import {useEffect,useRef,useState,type ReactNode} from 'react';
import './app-dialogs.css';
import {poetryClient} from './poetry';

const quickStart=[
  'Import a grayscale image. Native integer DN and bit depth are preserved.',
  'Enter wavelength, pixel size, gain, QE and exposure in Parameters.',
  'In Image, adjust Ka and Kb, then draw a rectangle or polygon ROI.',
  'Select Calculate. Read the histogram, adjust Style or Expand the chart.',
  'Set a filename and Export the processed matrices, images and 4K histogram.',
];
const chapters:{id:string;label:string;title:string;body:ReactNode}[]=[
  {id:'import',label:'Import & DN',title:'1. Images and preprocessing',body:<>
    <p>Import PNG, TIFF, BMP or grayscale JPEG with Import, or drop a file onto the page. TIFF uses its first image. Color images, transparent pixels and unsupported formats produce a clear error. Try a synthetic sample provides an example without using experimental data.</p>
    <p>Preprocessing uses DN = clip(round(Ka × original DN + Kb), 0, 2<sup>bit depth</sup> − 1). Fractional values are rounded, and values outside the native range are clipped. The status turns red when clipping occurs. Every calculation and exported dataset uses these processed DN values.</p>
    <p>The five sidebar sections are Import, Parameters, Image, Results and Save. Image contains Preprocessing, ROI, Guides and View. Its Ka and Kb controls adjust the entire image before measurement. The sidebar scrolls independently when the window is short.</p>
    <p>Every editable numeric field accepts +, -, *, /, decimal numbers and parentheses, for example 630/2 or (540+100)/2. Scientific notation such as 1e-3 is also accepted. The expression remains visible while editing; press Enter or leave the field to show its result. Unsupported expressions, division by zero and out-of-range results are marked red and block Calculate and Export until corrected. Esc restores the last accepted value. Each parameter keeps its own bounds, and W/H are rounded to whole pixels. The original solid gray up/down arrows and the keyboard arrow keys adjust the value.</p>
  </>},
  {id:'roi',label:'ROI',title:'2. Rectangles and polygons',body:<>
    <p>Select Rectangle and drag on the image. Enter W and H in pixels, or drag an edge or corner handle. The chain button locks the current width-to-height ratio. Select Polygon and click vertices; finish by pressing Enter, double-clicking or clicking the first vertex. Esc cancels a new ROI; Backspace removes its most recent polygon vertex.</p>
    <p>The ROI has a bright green outline and larger size label without a background fill. Hover over an edge to see a four-way move cursor; drag to move the ROI. The eight rectangle handles show horizontal, vertical or diagonal resize cursors. Handles take priority over edges. Drag a polygon vertex to edit it. Delete clears the ROI. Pixel centers use MATLAB-compatible 1-based coordinates. Measurements select original source pixels inside the ROI, including when the view is rotated; display interpolation never changes measured DN.</p>
  </>},
  {id:'parameters',label:'Parameters',title:'3. Calibration and units',body:<>
    <p>Enter wavelength λ in nm, square-pixel side length in μm, gain in DN/e⁻, quantum efficiency in percent and exposure in ms. QE 55 means 55%. Values must be positive; QE must not exceed 100%. Gain is DN per electron, so electrons are calculated by dividing DN by gain.</p>
    <p>Photon energy E<sub>p</sub> = hc/λ is displayed in eV and J; A<sub>pixel</sub> = d<sub>pixel</sub>² is displayed in μm². Conversion uses N<sub>e</sub> = DN/K<sub>e-DN</sub>, N<sub>p</sub> = N<sub>e</sub>/QE, E = N<sub>p</sub>E<sub>p</sub>, and P = E/(t A<sub>pixel</sub>), with QE, time and area converted to compatible units. Results are sensor-plane irradiance in μW/cm².</p>
  </>},
  {id:'results',label:'Results & chart',title:'4. Results and the histogram',body:<>
    <p>Calculate updates the results without saving. Peak power density uses the maximum processed DN within the ROI. Mean power density uses the arithmetic mean of all selected pixels. Editing the image preprocessing, ROI, angle or calibration clears the previous result until you calculate again.</p>
    <p>The histogram shows pixel count against DN, with calibrated power density on the upper axis. Mean and peak lines show power density on the left and DN on the right. The summary above the chart is selectable text: select it and use Ctrl+C or the browser Copy command. All displayed DN results, including Mean DN in Results and chart annotations, are rounded to integers. Chart power-density labels use three decimal places. Calculations and the mean-line position retain the full-precision mean DN.</p>
    <p>The DN range selector, Style and Expand are at the top right of Histogram. The native range includes the bit depth, for example DN 0–255 (8 bit) or DN 0–65535 (16 bit). Data Range focuses on the selected data. Expand opens a separate, resizable chart with the same selectable summary and applied appearance. Its drawing resolution follows the window and display pixel density. Mean markers are blue dashed lines and bars are dark green by default. Label backgrounds improve contrast; small charts use horizontal callouts to avoid clipping. All four plot borders are drawn.</p>
  </>},
  {id:'appearance',label:'Appearance',title:'5. Chart appearance',body:<>
    <p>Select Style to open Chart Appearance. Adjust bar color and opacity; mean and peak line colors, widths and styles; marker labels; border and tick settings; three axis titles and font sizes; grid settings; and figure and plot backgrounds. Numeric style fields also accept arithmetic expressions. Widths and font sizes are displayed in pixels.</p>
    <p>Chart text uses Segoe UI, with Arial and the system sans-serif font as fallbacks. Marker labels, ticks, axis titles and the summary have font color controls and Bold / Italic checkboxes. Mean and peak font colors are independent of their line colors. Summary font size controls the filename, pixel count and numerical results together, from 8 to 32 px (default 12). Summary also includes separate Bold / Italic options for the filename and numerical results. These settings apply to the preview, main chart, expanded window and 4K histogram export; larger exported summaries wrap and leave room above the axes.</p>
    <p>The default bars are green at 0.7 opacity. Mean and peak lines have width 2.5; the mean is blue and dashed, and the peak is red and solid. Marker labels, ticks and all three axis titles use size 16. The black plot border has width 1.5. Ticks and titles are black; the light gray grid uses solid lines of width 1. Both backgrounds are white, and Label background is off.</p>
    <p>The preview updates while you edit. Apply saves the appearance in this browser and updates the main chart, open expanded charts and future 4K exports. Cancel, Escape or closing the dialog discards its unapplied changes. Reset restores the default appearance in the preview; select Apply to keep it. Appearance changes do not alter image DN, ROI selection or computed power density.</p>
  </>},
  {id:'view',label:'View & guides',title:'6. Image view and panel layout',body:<>
    <p>Hover over the image and scroll to zoom. Drag the background to pan. Double-click the background or select Fit to fit the full view. Angle rotates the view without cropping; Reset restores 0°. Contrast improves display contrast only. Measurements and exported images retain processed source DN.</p>
    <p>V and H add vertical and horizontal guides. Drag a guide to reposition it; right-click it to delete it. Clear removes all guides, and Guides shows or hides them.</p>
    <p>Drag the divider beside the parameter sidebar to change its width. Drag the divider above the histogram to adjust the image and chart heights. Double-click a divider or press Enter while it is focused to reset it. Arrow keys adjust it by 16 px, Shift+arrow by 50 px; Home and End move to its limits. Layout is remembered in this browser.</p>
  </>},
  {id:'export',label:'Export',title:'7. Files, numbering and resolution',body:<>
    <p>Save has three rows: the destination and Path; an editable filename prefix and the fixed Name label; and a full-width Export button. Path selects an output directory in browsers that support directory access. Otherwise Export downloads one ZIP. The default prefix is OriginalName_DN_ROI. Groups begin at _001; folder exports skip any number already occupied by one of the five files. ZIP numbering is remembered for this site in this browser and resets if its site data is cleared.</p>
    <p>Each export contains a two-dimensional gray TXT matrix, the same matrix in Excel, an original-orientation processed image with a green ROI, the same processed image without markings, and a 4K histogram PNG (3840 × 2160). Both experimental images retain their original full resolution and file format. No image resampling is introduced by the 4K chart setting.</p>
    <p>Matrices use the ROI bounding rectangle in original image coordinates. Positions outside a polygon are NaN; Excel writes those positions as text NaN. Finite DN entries are rounded and clipped integers. JPEG re-encoding is lossy; use lossless images or the matrices for exact pixel comparisons. All image processing and file generation take place locally in your browser. Only the decorative poetry is fetched from Jinrishici; image data and calibration parameters stay on your device.</p>
  </>},
];

export function AppDialog({kind,onClose}:{kind:'help'|'about';onClose:()=>void}){
  const dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
  const [poem,setPoem]=useState(()=>poetryClient.takePrepared()??poetryClient.fallback());
  useEffect(()=>{
    let active=true;
    if(poem.origin==='online')void poetryClient.prefetch();
    else void poetryClient.next().then(next=>{if(active&&next){setPoem(next);void poetryClient.prefetch();}});
    return()=>{active=false;};
  },[]);
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
      <header className="modal-header"><div><p className="eyebrow">{kind==='help'?'QUICK START & COMPLETE MANUAL':'APPLICATION INFORMATION'}</p><h2 id="app-dialog-title">{title}</h2></div><button ref={close} className="dialog-close circle-button" aria-label="Close dialog" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 5 14 14M19 5 5 19"/></svg></button></header>
      {kind==='help'?<>
        <div className="help-quickstart"><h3>Quick start</h3><ol>{quickStart.map((step,i)=><li key={step}><b>{i+1}</b><span>{step}</span></li>)}</ol></div>
        <nav className="help-navigation" aria-label="Manual chapters">{chapters.map(chapter=><a key={chapter.id} href={`#manual-${chapter.id}`} onClick={event=>{event.preventDefault();document.getElementById(`manual-${chapter.id}`)?.scrollIntoView({block:'start'});}}>{chapter.label}</a>)}</nav>
        <div className="help-manual" tabIndex={0} aria-label="Detailed user guide">{chapters.map(chapter=><section key={chapter.id} id={`manual-${chapter.id}`}><h3>{chapter.title}</h3>{chapter.body}</section>)}</div>
      </>:<div className="about-content">
        <div className="about-logo"><img src={import.meta.env.BASE_URL+'icon.svg'} alt=""/><strong>Sensor DN Power Studio</strong></div>
        <dl className="about-metadata">
          <div><dt>Application name</dt><dd>Sensor DN Power Studio</dd></div>
          <div><dt>Version</dt><dd>Ver.1.3</dd></div>
          <div><dt>Last updated</dt><dd>2026.10.19</dd></div>
          <div><dt>Author / Maintainer</dt><dd>Mingze Sun</dd></div>
          <div><dt>Powered by</dt><dd>OpenAI Codex</dd></div>
        </dl>
      </div>}
      <footer className="dialog-quote" lang="zh-CN" data-quote-source={poem.origin} title={poem.origin==='online'?'Jinrishici · online poetry':'Offline poetry fallback'}><p>{poem.content}</p><cite>{poem.attribution}</cite></footer>
    </section>
  </div>;
}

export function LinkIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8a4.5 4.5 0 0 0 6.4.1l2.3-2.3a4.5 4.5 0 0 0-6.4-6.4l-1.3 1.3"/><path d="M13.8 10.2a4.5 4.5 0 0 0-6.4-.1l-2.3 2.3a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3"/></svg>;
}
