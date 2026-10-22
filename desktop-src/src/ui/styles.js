// Page styles. Rendered as a <style> inside the page, so they mount and unmount with it. Every
// colour is a theme variable (or a color-mix of theme variables).
export const CSS = /* css */ `
.htm-root {
  --htm-c0: var(--ui-orange, var(--ui-red));
  --htm-c1: var(--ui-purple, var(--ui-accent));
  --htm-c2: var(--ui-cyan, var(--ui-blue));
  --htm-c3: var(--ui-text-secondary);
  --htm-live: var(--ui-green, var(--ui-accent));
  --htm-warn: var(--ui-yellow, var(--ui-orange));
  --htm-bad: var(--ui-red, var(--ui-orange));
  --htm-demo: var(--ui-purple, var(--ui-accent));
  --htm-glass: color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 72%, transparent);
  --htm-glass-strong: color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 88%, transparent);
  --htm-line: color-mix(in oklab, var(--ui-stroke-secondary) 75%, transparent);
  --htm-line-soft: color-mix(in oklab, var(--ui-stroke-secondary) 40%, transparent);
  --htm-ease: cubic-bezier(.2, .75, .15, 1);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  color: var(--ui-text-primary);
  font-family: var(--font-sans, inherit);
  font-size: 12px;
  outline: none;
  user-select: none;
}
.htm-root *, .htm-root *::before, .htm-root *::after { box-sizing: border-box; }
.htm-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.htm-canvas[data-hover="true"] { cursor: pointer; }
.htm-canvas:active { cursor: grabbing; }
.htm-shade {
  position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(to bottom, color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 55%, transparent), transparent 120px),
    linear-gradient(to top, color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 50%, transparent), transparent 110px),
    radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 45%, transparent) 100%);
}

/* Shared bits ------------------------------------------------------------------------------ */
.htm-panel {
  background: var(--htm-glass);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  border: 1px solid var(--htm-line);
  border-radius: 12px;
  box-shadow: 0 18px 50px -28px color-mix(in oklab, var(--ui-bg-editor, var(--ui-base)) 60%, var(--ui-text-primary) 4%);
}
.htm-label {
  font: 500 9.5px/1.25 var(--font-mono, ui-monospace, monospace);
  letter-spacing: .15em;
  text-transform: uppercase;
  color: var(--ui-text-tertiary);
}
.htm-mono { font-family: var(--font-mono, ui-monospace, monospace); }
.htm-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.htm-muted { color: var(--ui-text-tertiary); }
.htm-soft { color: var(--ui-text-secondary); }
.htm-code {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 16px; padding: 0 4px;
  font: 600 9.5px/1 var(--font-mono, ui-monospace, monospace); letter-spacing: .04em;
  color: var(--ui-text-secondary);
  border: 1px solid var(--htm-line); border-radius: 4px;
  background: color-mix(in oklab, var(--ui-text-primary) 4%, transparent);
}
.htm-btn {
  appearance: none; border: 0; background: transparent; color: inherit; font: inherit;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; min-width: 30px; padding: 0 9px; border-radius: 8px; cursor: pointer;
  color: var(--ui-text-secondary);
  transition: background .18s var(--htm-ease), color .18s var(--htm-ease), transform .18s var(--htm-ease);
}
.htm-btn:hover { background: var(--ui-control-hover-background, color-mix(in oklab, var(--ui-text-primary) 8%, transparent)); color: var(--ui-text-primary); }
.htm-btn:active { transform: scale(.96); }
.htm-btn:focus-visible, .htm-row:focus-visible, .htm-chip:focus-visible, .htm-tab:focus-visible, .htm-link:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--ui-accent) 70%, transparent); outline-offset: 1px;
}
.htm-btn[aria-pressed="true"] { color: var(--ui-text-primary); background: color-mix(in oklab, var(--ui-accent) 16%, transparent); }
.htm-btn--primary {
  background: var(--ui-accent); color: var(--ui-bg-editor, var(--ui-base));
  font-weight: 600; padding: 0 14px; height: 34px;
}
.htm-btn--primary:hover { background: color-mix(in oklab, var(--ui-accent) 86%, var(--ui-text-primary)); color: var(--ui-bg-editor, var(--ui-base)); }
.htm-btn--ghost { border: 1px solid var(--htm-line); height: 34px; padding: 0 14px; }
.htm-btn .codicon { font-size: 14px; }
.htm-link {
  appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer;
  color: var(--ui-text-secondary); text-decoration: underline; text-decoration-color: var(--htm-line); text-underline-offset: 2px;
}
.htm-link:hover { color: var(--ui-text-primary); text-decoration-color: currentColor; }
.htm-sep { width: 1px; height: 18px; background: var(--htm-line); margin: 0 4px; }

/* Top bar ---------------------------------------------------------------------------------- */
.htm-top {
  position: absolute; top: 14px; left: 16px; right: 16px; z-index: 3;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; pointer-events: none;
}
.htm-top > * { pointer-events: auto; }
.htm-brand { display: flex; flex-direction: column; gap: 7px; padding: 2px 2px; }
.htm-brand-row { display: flex; align-items: center; gap: 10px; }
.htm-title {
  font: 600 13px/1 var(--font-mono, ui-monospace, monospace); letter-spacing: .32em; text-transform: uppercase;
  color: var(--ui-text-primary);
}
.htm-subtitle { color: var(--ui-text-tertiary); font-size: 11.5px; }
.htm-status {
  display: inline-flex; align-items: center; gap: 7px; height: 22px; padding: 0 9px 0 8px;
  border-radius: 999px; border: 1px solid var(--htm-line); background: var(--htm-glass);
  font: 600 9.5px/1 var(--font-mono, ui-monospace, monospace); letter-spacing: .14em; text-transform: uppercase;
  color: var(--ui-text-secondary); white-space: nowrap;
}
.htm-status b { font-weight: 600; color: var(--ui-text-primary); }
.htm-status-rate { color: var(--ui-text-tertiary); letter-spacing: .06em; }
.htm-dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.htm-dot[data-pulse="true"]::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1px solid currentColor;
  animation: htm-ping 1.8s var(--htm-ease) infinite;
}
@keyframes htm-ping { 0% { transform: scale(.4); opacity: .9; } 80%, 100% { transform: scale(1.5); opacity: 0; } }
.htm-tone-live { color: var(--htm-live); }
.htm-tone-warn { color: var(--htm-warn); }
.htm-tone-bad { color: var(--htm-bad); }
.htm-tone-demo { color: var(--htm-demo); }
.htm-tone-idle { color: var(--ui-text-tertiary); }

.htm-global { padding: 13px 14px 12px; display: flex; flex-direction: column; gap: 6px; }
.htm-global-value { font: 300 30px/1 var(--font-sans, inherit); letter-spacing: -.01em; }
.htm-global-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }

/* Rails ------------------------------------------------------------------------------------ */
.htm-rail {
  position: absolute; top: 96px; bottom: 82px; z-index: 2;
  display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto; overflow-x: hidden; scrollbar-width: none; overscroll-behavior: contain;
  pointer-events: none; padding: 1px;
}
.htm-rail::-webkit-scrollbar { display: none; }
.htm-rail > * { pointer-events: auto; flex: none; }
.htm-rail--left { left: 16px; width: 276px; }
.htm-rail--right { right: 16px; width: 324px; }
.htm-card { padding: 13px 14px; display: flex; flex-direction: column; gap: 10px; }
.htm-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 16px; }
.htm-big { font: 300 30px/1 var(--font-sans, inherit); letter-spacing: -.01em; }
.htm-big-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.htm-kv { display: flex; gap: 12px; flex-wrap: wrap; color: var(--ui-text-tertiary); font-size: 11px; }
.htm-kv b { color: var(--ui-text-secondary); font-weight: 500; }

.htm-chips { display: flex; flex-direction: column; gap: 2px; }
.htm-chip {
  appearance: none; border: 0; background: transparent; font: inherit; color: inherit; text-align: left;
  position: relative; display: grid; grid-template-columns: 16px 1fr auto 38px; align-items: center; gap: 8px;
  padding: 6px 7px; margin: 0 -7px; border-radius: 7px; cursor: pointer;
  transition: background .18s var(--htm-ease), opacity .18s var(--htm-ease);
}
.htm-chip:hover { background: var(--ui-row-hover-background, color-mix(in oklab, var(--ui-text-primary) 6%, transparent)); }
.htm-chip[aria-pressed="false"] { opacity: .42; }
.htm-chip[aria-pressed="false"] .htm-chip-name { text-decoration: line-through; text-decoration-color: var(--ui-text-tertiary); }
.htm-chip-name { font-weight: 500; }
.htm-chip-count { color: var(--ui-text-secondary); }
.htm-chip-share { color: var(--ui-text-tertiary); text-align: right; font-size: 10.5px; }
.htm-chip-bar { position: absolute; left: 31px; right: 7px; bottom: 2px; height: 2px; border-radius: 2px; background: var(--htm-line-soft); overflow: hidden; }
.htm-chip-bar > i { display: block; height: 100%; border-radius: inherit; transition: width .6s var(--htm-ease); }

.htm-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ui-text-secondary); font-size: 11.5px; }

.htm-tabs { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: color-mix(in oklab, var(--ui-text-primary) 5%, transparent); }
.htm-tab {
  appearance: none; border: 0; background: transparent; font: inherit; color: var(--ui-text-tertiary); cursor: pointer;
  flex: 1; height: 22px; border-radius: 6px; font-size: 11px; font-weight: 500;
  transition: background .18s var(--htm-ease), color .18s var(--htm-ease);
}
.htm-tab[aria-selected="true"] { background: var(--htm-glass-strong); color: var(--ui-text-primary); box-shadow: 0 0 0 1px var(--htm-line); }
.htm-rank { display: flex; flex-direction: column; gap: 1px; }
.htm-row {
  appearance: none; border: 0; background: transparent; font: inherit; color: inherit; text-align: left; width: 100%;
  position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px;
  padding: 5px 7px; margin: 0 -7px; width: calc(100% + 14px); border-radius: 7px; cursor: pointer;
}
.htm-row:hover { background: var(--ui-row-hover-background, color-mix(in oklab, var(--ui-text-primary) 6%, transparent)); }
.htm-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.htm-row-bar { position: absolute; left: 7px; right: 7px; bottom: 1px; height: 2px; }
.htm-row-bar > i { display: block; height: 100%; border-radius: 2px; background: color-mix(in oklab, var(--ui-accent) 55%, transparent); transition: width .6s var(--htm-ease); }
.htm-stack { display: flex; height: 100%; width: 100%; border-radius: 2px; overflow: hidden; background: var(--htm-line-soft); }
.htm-stack > i { display: block; height: 100%; transition: width .6s var(--htm-ease); }
.htm-empty-note { color: var(--ui-text-tertiary); font-size: 11.5px; line-height: 1.5; padding: 4px 0; }
.htm-caption { color: var(--ui-text-tertiary); font-size: 10.5px; line-height: 1.45; }

/* Feed ------------------------------------------------------------------------------------- */
.htm-feed { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto !important; padding-bottom: 6px; }
.htm-feed-head { padding: 13px 14px 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.htm-feed-list { overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; padding: 0 6px; scrollbar-width: thin; scrollbar-color: var(--htm-line) transparent; }
.htm-event {
  appearance: none; border: 0; background: transparent; font: inherit; color: inherit; text-align: left; width: 100%;
  display: grid; grid-template-columns: 14px 1fr auto; gap: 9px; align-items: start;
  padding: 7px 8px; border-radius: 8px; cursor: pointer; position: relative;
  transition: background .18s var(--htm-ease);
}
.htm-event:hover, .htm-event[data-active="true"] { background: var(--ui-row-hover-background, color-mix(in oklab, var(--ui-text-primary) 6%, transparent)); }
.htm-event[data-fresh="true"] { animation: htm-row-in .55s var(--htm-ease) both; }
@keyframes htm-row-in {
  0% { opacity: 0; transform: translateY(-8px); background: color-mix(in oklab, var(--htm-row-color) 22%, transparent); }
  45% { opacity: 1; transform: none; background: color-mix(in oklab, var(--htm-row-color) 14%, transparent); }
  100% { background: transparent; }
}
.htm-event-glyph { padding-top: 2px; }
.htm-event-name { font-size: 12px; line-height: 1.3; font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.htm-event-route { display: flex; align-items: center; gap: 5px; margin-top: 4px; color: var(--ui-text-tertiary); font-size: 10.5px; min-width: 0; }
.htm-event-route span.htm-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.htm-event-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-top: 1px; }
.htm-event-age { font: 500 10px/1 var(--font-mono, ui-monospace, monospace); color: var(--ui-text-tertiary); }
.htm-badge {
  font: 600 9.5px/1 var(--font-mono, ui-monospace, monospace); padding: 2px 5px; border-radius: 4px;
  color: var(--ui-text-secondary); background: color-mix(in oklab, var(--ui-text-primary) 7%, transparent);
}
.htm-badge--demo { color: var(--htm-demo); background: color-mix(in oklab, var(--htm-demo) 14%, transparent); letter-spacing: .08em; }
.htm-paused-note {
  margin: 0 8px 6px; padding: 6px 9px; border-radius: 7px; font-size: 11px; color: var(--ui-text-secondary);
  background: color-mix(in oklab, var(--htm-warn) 12%, transparent); display: flex; align-items: center; gap: 6px;
}

/* Detail panels ---------------------------------------------------------------------------- */
.htm-detail { animation: htm-rise .38s var(--htm-ease) both; }
.htm-detail-title { font-size: 17px; line-height: 1.25; font-weight: 600; letter-spacing: -.005em; }
.htm-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.htm-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.htm-pair > div { display: flex; flex-direction: column; gap: 5px; padding: 9px 10px; border-radius: 9px; background: color-mix(in oklab, var(--ui-text-primary) 4%, transparent); }
.htm-pair-value { font: 300 22px/1 var(--font-sans, inherit); }
.htm-route { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
.htm-route-end { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.htm-route-end strong { font-weight: 500; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.htm-route-arrow { color: var(--ui-text-tertiary); }
.htm-facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 11.5px; }
.htm-facts dt { color: var(--ui-text-tertiary); }
.htm-facts dd { margin: 0; color: var(--ui-text-secondary); }
.htm-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.htm-chart { display: block; width: 100%; overflow: visible; }
.htm-chart text { font: 500 9px var(--font-mono, ui-monospace, monospace); fill: var(--ui-text-tertiary); }
.htm-multiples { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.htm-multiple { display: flex; flex-direction: column; gap: 3px; }
.htm-multiple-head { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--ui-text-secondary); }
.htm-skeleton { height: 64px; border-radius: 8px; background: linear-gradient(90deg, var(--htm-line-soft), color-mix(in oklab, var(--ui-text-primary) 8%, transparent), var(--htm-line-soft)); background-size: 200% 100%; animation: htm-shimmer 1.4s linear infinite; }
@keyframes htm-shimmer { to { background-position: -200% 0; } }

/* Dock ------------------------------------------------------------------------------------- */
.htm-dock {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 3;
  display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 12px;
}
.htm-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: color-mix(in oklab, var(--ui-text-primary) 5%, transparent); }
.htm-seg .htm-btn { height: 26px; font-size: 11px; font-weight: 500; padding: 0 9px; }
.htm-seg .htm-btn[aria-pressed="true"] { background: var(--htm-glass-strong); box-shadow: 0 0 0 1px var(--htm-line); }

.htm-attrib {
  position: absolute; left: 18px; bottom: 20px; z-index: 2; max-width: 30%;
  color: var(--ui-text-quaternary, var(--ui-text-tertiary)); font-size: 10px; line-height: 1.4;
}
.htm-attrib a { color: inherit; }

/* Overlays --------------------------------------------------------------------------------- */
.htm-center {
  position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; pointer-events: none; padding: 24px;
}
.htm-center > * { pointer-events: auto; }
.htm-dialog { width: min(440px, 100%); padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 14px; animation: htm-rise .5s var(--htm-ease) both; background: var(--htm-glass-strong); }
.htm-dialog h2 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
.htm-dialog p { margin: 0; color: var(--ui-text-secondary); line-height: 1.55; font-size: 12.5px; }
.htm-facts-list { display: flex; flex-direction: column; gap: 9px; margin: 2px 0; padding: 0; list-style: none; }
.htm-facts-list li { display: grid; grid-template-columns: 16px 1fr; gap: 9px; color: var(--ui-text-secondary); font-size: 12px; line-height: 1.5; }
.htm-facts-list .codicon { color: var(--ui-text-tertiary); margin-top: 2px; }
.htm-dialog-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.htm-banner {
  position: absolute; left: 50%; transform: translateX(-50%); z-index: 4;
  display: inline-flex; align-items: center; gap: 9px; padding: 7px 8px 7px 12px; border-radius: 999px;
  font-size: 11.5px; color: var(--ui-text-secondary); white-space: nowrap; animation: htm-rise .4s var(--htm-ease) both;
}
.htm-banner--top { top: 62px; }
.htm-banner--bottom { bottom: 66px; padding: 6px 14px; }
.htm-demo-strip {
  font: 600 9.5px/1 var(--font-mono, ui-monospace, monospace); letter-spacing: .16em; text-transform: uppercase;
  color: var(--htm-demo);
  background:
    repeating-linear-gradient(-45deg, color-mix(in oklab, var(--htm-demo) 13%, transparent) 0 6px, transparent 6px 12px),
    var(--htm-glass);
  border: 1px solid color-mix(in oklab, var(--htm-demo) 40%, transparent);
}
.htm-listening { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2; pointer-events: none;
  display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 999px; color: var(--ui-text-secondary); font-size: 12px; }

.htm-tip {
  position: absolute; left: 0; top: 0; z-index: 5; pointer-events: none; padding: 9px 11px; min-width: 150px; max-width: 280px;
  border-radius: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 11.5px;
  background: var(--htm-glass-strong); transition: opacity .12s;
}
.htm-tip-title { font-weight: 600; font-size: 12.5px; display: flex; align-items: center; gap: 7px; }
.htm-callout { position: absolute; left: 0; top: 0; z-index: 1; pointer-events: none; display: flex; align-items: center; gap: 0; transition: opacity .2s; }
.htm-callout-dot { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--ui-accent); background: var(--ui-bg-editor, var(--ui-base)); transform: translate(-50%, -50%); flex: none; }
.htm-callout-line { width: 26px; height: 1px; background: var(--ui-accent); transform: translateY(-50%); margin-left: -4px; }
.htm-callout-tag {
  transform: translateY(-50%); padding: 4px 8px; border-radius: 6px; font: 600 10px/1 var(--font-mono, ui-monospace, monospace);
  letter-spacing: .12em; text-transform: uppercase; color: var(--ui-text-primary); background: var(--htm-glass-strong); border: 1px solid color-mix(in oklab, var(--ui-accent) 55%, transparent);
}

@keyframes htm-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.htm-rise { animation: htm-rise .6s var(--htm-ease) both; }
.htm-banner.htm-rise, .htm-banner { animation-name: htm-rise-x; }
@keyframes htm-rise-x { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* Rolling digits */
.htm-roll { display: inline-flex; align-items: baseline; }
.htm-roll-digit { display: inline-block; height: 1em; line-height: 1em; overflow: hidden; position: relative; }
.htm-roll-strip { display: flex; flex-direction: column; transition: transform .9s var(--htm-ease); }
.htm-roll-strip > span { height: 1em; line-height: 1em; }

/* Responsive: the page also runs in split tiles. */
.htm-root[data-size="compact"] .htm-rail--left { width: 244px; }
.htm-root[data-size="compact"] .htm-rail--right { width: 284px; }
.htm-root[data-size="compact"] .htm-attrib { display: none; }
.htm-root[data-size="narrow"] .htm-rail { top: 84px; bottom: 74px; }
.htm-root[data-size="narrow"] .htm-rail--left, .htm-root[data-size="narrow"] .htm-rail--right { left: 12px; right: 12px; width: auto; }
.htm-root[data-size="narrow"] .htm-rail[data-open="false"] { display: none; }
.htm-root[data-size="narrow"] .htm-attrib { display: none; }
.htm-root[data-size="narrow"] .htm-subtitle { display: none; }
.htm-root[data-size="narrow"] .htm-top { left: 12px; right: 12px; }

.htm-root[data-motion="reduced"] *, .htm-root[data-motion="reduced"] *::before, .htm-root[data-motion="reduced"] *::after {
  animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important;
}
@media (prefers-reduced-motion: reduce) {
  .htm-root *, .htm-root *::before, .htm-root *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}
`
