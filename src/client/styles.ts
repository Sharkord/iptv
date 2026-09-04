import type { CSSProperties } from "react";

const CSS = `
.iptv-panel { color: var(--foreground); font-size: 13px; display: flex; flex-direction: column; max-height: min(560px, 80vh); }
.iptv-panel *, .iptv-panel *::before, .iptv-panel *::after { box-sizing: border-box; }

.iptv-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px; }
.iptv-head-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); }
.iptv-head-count {
  margin-left: auto; display: flex; align-items: center; font-size: 11px;
  color: var(--muted-foreground); font-variant-numeric: tabular-nums;
}

.iptv-onair {
  display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center;
  margin: 0 14px 10px; padding: 8px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--muted);
}
.iptv-onair-art { width: 44px; height: 44px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; background: var(--card); color: var(--muted-foreground); }
.iptv-onair-art img { width: 100%; height: 100%; object-fit: contain; }
.iptv-onair-label { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted-foreground); }
.iptv-onair-name { margin-top: 2px; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.iptv-live { width: 7px; height: 7px; border-radius: 50%; background: var(--destructive); animation: iptv-pulse 1.8s ease-in-out infinite; }
@keyframes iptv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.iptv-filters { display: flex; align-items: center; gap: 8px; padding: 0 14px 10px; }
/* the group name can be long and the trigger is w-fit, so it is capped here */
.iptv-filters [data-slot="select-trigger"] { max-width: 44%; }

.iptv-alert { padding: 0 14px 10px; }

.iptv-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px; padding: 0 14px 12px; overflow-y: auto; align-content: start;
  /* min-height overrides a flex item's auto minimum, without which the grid
     grows to fit every tile and is clipped by the panel instead of scrolling */
  flex: 1 1 auto; min-height: 0;
}
.iptv-grid::-webkit-scrollbar { width: 8px; }
.iptv-grid::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

.iptv-tile {
  display: flex; flex-direction: column; gap: 6px; padding: 6px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--card); color: inherit; font: inherit; text-align: left;
  cursor: pointer; transition: border-color 0.15s ease, transform 0.1s ease;
  /* the whole playlist is in the DOM, so the browser is told to skip laying out
     and painting the tiles that are scrolled out of view */
  content-visibility: auto; contain-intrinsic-size: auto 132px;
}
.iptv-tile:hover:not(:disabled) { border-color: var(--ring); transform: translateY(-1px); }
.iptv-tile:disabled { opacity: 0.5; cursor: not-allowed; }
.iptv-tile-on { border-color: var(--destructive); }

.iptv-thumb {
  aspect-ratio: 16 / 10; border-radius: 5px; overflow: hidden; display: grid; place-items: center;
  background: var(--muted); color: var(--muted-foreground);
}
.iptv-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 6px; }
.iptv-tile-name { font-size: 11.5px; line-height: 1.25; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.iptv-tile-group { font-size: 10px; color: var(--muted-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.iptv-note { padding: 0 14px 12px; font-size: 12px; color: var(--muted-foreground); overflow-wrap: anywhere; }
.iptv-note-error { color: var(--destructive); }

.iptv-dot { position: absolute; right: 6px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--destructive); animation: iptv-pulse 1.8s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .iptv-panel *, .iptv-live, .iptv-dot { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

const STYLE_ID = "iptv-browser-styles";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const element = document.createElement("style");

  element.id = STYLE_ID;
  element.textContent = CSS;

  document.head.append(element);
}

const panelStyle: CSSProperties = {
  width: "min(600px, calc(100vw - 20px))",
  padding: 0,
  overflow: "hidden",
};

export { panelStyle };
