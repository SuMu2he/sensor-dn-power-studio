# Summary sizing, footer and dialog controls

## Changes

- Summary font size controls filename, pixel count and numerical summary together.
  It accepts arithmetic expressions, defaults to 12 px, and is limited to 8-32 px.
- The size is persisted with the existing appearance settings and is shared by
  Style preview, main chart, expanded windows and 4K histogram PNG output.
- Exported summaries wrap at large sizes and reserve space above the power axis.
- Footer text is always `Ver.1.3 | Author Mingze Sun | Powered by OpenAI Codex`,
  including after calculation/export and at narrower desktop widths.
- Help and About use 40 x 40 px circular close buttons with centered 24 x 24 px
  vector crosses. Higher-specificity sizing prevents the general header-button
  styles from shrinking their width.

## Validation

- All 22 tests, TypeScript and the production build pass. Extended typography
  tests cover legacy settings, size persistence, limits, common renderer font size
  and wrapped summaries staying above the power-axis title.
- Browser preview and main chart both display 20 px after entering `12+8`.
- An already-open expanded window receives the applied change from 20 to 32 px.
- Refresh retains the applied 32 px setting.
- The actual shared `histogramBlob` browser function generates a 3840 x 2160 PNG
  with 32 px summary text from the public synthetic sample; the PNG was displayed
  and visually checked for complete text and separation from the axes.
- Both close buttons measure 40 x 40 px with 50% radius; SVG centers coincide
  with the button centers (offset 0, 0). Clicking each closes its dialog.
- At a 760 px viewport, footer credits remain visible and within the viewport;
  the About close button remains 40 x 40 px.

The verification uses only the public synthetic example. Experimental images are
not part of this update. App version remains Ver.1.3 as explicitly requested.
