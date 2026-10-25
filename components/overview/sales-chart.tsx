'use client';

/** Revenue chart of the Overview hero: the current period as a filled curve, the previous period dashed, hover to read values. */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { compactNumber, money } from '@/lib/format';
import type { SalesSeries } from '@/lib/overview';

type XY = [number, number];
const PAD = { top: 26, bottom: 30 };

/** Monotone cubic path (Fritsch–Carlson): smooth, but never overshoots between samples. */
function smoothPath(pts: XY[]) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], slope: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  t[n - 1] = slope[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / slope[i], b = t[i + 1] / slope[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * slope[i]; t[i + 1] = k * b * slope[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`; }
  return d;
}

export function SalesChart({series,comparisonLabel}:{series:SalesSeries;comparisonLabel:string}){
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const { points } = series, n = points.length;
  const height = width && width < 560 ? 210 : 270;
  const plotH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...points.map((p) => Math.max(p.value ?? 0, p.previous))) * 1.12;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * width : 0);
  const y = (v: number) => PAD.top + (1 - v / max) * plotH;
  const filled: XY[] = [];
  points.forEach((p, i) => { if (p.value !== null) filled.push([x(i), y(p.value)]); });
  const previous: XY[] = points.map((p, i) => [x(i), y(p.previous)]);
  const baseY = PAD.top + plotH;
  const line = smoothPath(filled);
  const area = filled.length > 1 ? `${line} L${filled[filled.length - 1][0]},${baseY} L${filled[0][0]},${baseY} Z` : '';
  const ticks = points.map((_, i) => i).filter((i) => (n <= 8 ? true : n === 24 ? i % 6 === 0 : i % 5 === 0 || i === n - 1));
  const empty = series.total === 0 && series.previousTotal === 0;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * (n - 1)))));
  };
  const hp = hover === null ? null : points[hover];
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover), 92), Math.max(92, width - 92));

  return <div className="ov-chart" ref={wrap} onPointerMove={move} onPointerLeave={() => setHover(null)} style={{height}}>
    {width>0&&<svg width={width} height={height} role="img" aria-label={`Grafik omzet, total ${money(series.total)}`}>
      <defs>
        <linearGradient id="ov-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff7a45" stopOpacity=".55"/><stop offset="100%" stopColor="#ff5a2c" stopOpacity="0"/></linearGradient>
        <linearGradient id="ov-stroke" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#ffb35c"/><stop offset="100%" stopColor="#ff6a3d"/></linearGradient>
      </defs>
      {[.25,.5,.75,1].map(g=><g key={g}>
        <line x1="0" x2={width} y1={y(max*g/1.12)} y2={y(max*g/1.12)} stroke="rgba(255,255,255,.08)"/>
        <text x="16" y={y(max*g/1.12)-6} className="ov-chart-axis">{compactNumber(max*g/1.12)}</text>
      </g>)}
      {!empty&&<path d={smoothPath(previous)} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.6" strokeDasharray="5 6"/>}
      {area&&<path d={area} fill="url(#ov-area)"/>}
      {line&&<path d={line} fill="none" stroke="url(#ov-stroke)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
      {filled.length>0&&hover===null&&<circle cx={filled[filled.length-1][0]} cy={filled[filled.length-1][1]} r="5" fill="#fff" stroke="#ff6a3d" strokeWidth="3"/>}
      {ticks.map(i=><text key={i} x={i===0?16:i===n-1?width-16:x(i)} y={height-9} textAnchor={i===0?'start':i===n-1?'end':'middle'} className="ov-chart-axis">{points[i].label}</text>)}
      {hover!==null&&hp&&<g>
        <line x1={x(hover)} x2={x(hover)} y1={PAD.top-6} y2={baseY} stroke="rgba(255,255,255,.35)"/>
        <circle cx={x(hover)} cy={y(hp.previous)} r="4" fill="#12161d" stroke="rgba(255,255,255,.7)" strokeWidth="2"/>
        {hp.value!==null&&<circle cx={x(hover)} cy={y(hp.value)} r="5.5" fill="#fff" stroke="#ff6a3d" strokeWidth="3"/>}
      </g>}
    </svg>}
    {hover!==null&&hp&&<div className="ov-chart-tip" style={{left:tipLeft}}>
      <b>{hp.label}</b>
      <span><i className="now"/>{hp.value===null?'Belum ada':money(hp.value)}</span>
      <span><i className="was"/>{comparisonLabel}: {money(hp.previous)}</span>
    </div>}
  </div>;
}
