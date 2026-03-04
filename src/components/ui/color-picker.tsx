"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type HSL = { h: number; s: number; l: number; a?: number };

/** Parse hex (#rgb, #rrggbb, #rrggbbaa) to 0-255 RGB. */
function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (!match) {
    const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (short) {
      return {
        r: parseInt(short[1] + short[1], 16),
        g: parseInt(short[2] + short[2], 16),
        b: parseInt(short[3] + short[3], 16),
        a: 255,
      };
    }
    return null;
  }
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
    a: match[4] !== undefined ? parseInt(match[4], 16) : 255,
  };
}

/** RGB 0-255 to HSL: h 0-360, s 0-100, l 0-100, a 0-1. */
function rgbToHsl(r: number, g: number, b: number, a = 1): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: Math.round(a * 100),
  };
}

/** HSL to RGB 0-255. */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/** HSL to hex (no alpha for tag compatibility). */
function hslToHex(h: number, s: number, l: number, a = 100): string {
  const { r, g, b } = hslToRgb(h, s, l);
  const rr = Math.round(r).toString(16).padStart(2, "0");
  const gg = Math.round(g).toString(16).padStart(2, "0");
  const bb = Math.round(b).toString(16).padStart(2, "0");
  if (a >= 100) return `#${rr}${gg}${bb}`;
  const aa = Math.round((a / 100) * 255).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}${aa}`;
}

/** Clamp number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  showAlpha?: boolean;
}

export function ColorPicker({ value, onChange, className, showAlpha = true }: ColorPickerProps) {
  const rgb = hexToRgb(value);
  const [hsl, setHsl] = React.useState<HSL>(() =>
    rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b, rgb.a / 255) : { h: 0, s: 80, l: 50, a: 100 }
  );

  // Sync from external value when it changes (e.g. preset)
  React.useEffect(() => {
    const next = hexToRgb(value);
    if (next) setHsl(rgbToHsl(next.r, next.g, next.b, next.a / 255));
  }, [value]);

  const updateFromHsl = React.useCallback(
    (next: HSL) => {
      setHsl(next);
      onChange(hslToHex(next.h, next.s, next.l, next.a ?? 100));
    },
    [onChange]
  );

  const satLightRef = React.useRef<HTMLDivElement>(null);
  const hueRef = React.useRef<HTMLDivElement>(null);
  const alphaRef = React.useRef<HTMLDivElement>(null);

  const handleSatLightMove = (e: React.MouseEvent | MouseEvent) => {
    const el = satLightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    const s = Math.round(x * 100);
    const l = Math.round(y * 100);
    updateFromHsl({ ...hsl, s, l });
  };

  const handleHueMove = (e: React.MouseEvent | MouseEvent) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const h = Math.round(x * 360);
    updateFromHsl({ ...hsl, h });
  };

  const handleAlphaMove = (e: React.MouseEvent | MouseEvent) => {
    const el = alphaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const a = Math.round(x * 100);
    updateFromHsl({ ...hsl, a: showAlpha ? a : 100 });
  };

  const [dragging, setDragging] = React.useState<"sat" | "hue" | "alpha" | null>(null);

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (dragging === "sat") handleSatLightMove(e);
      else if (dragging === "hue") handleHueMove(e);
      else if (dragging === "alpha") handleAlphaMove(e);
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, hsl]);

  const hueColor = `hsl(${hsl.h}, 100%, 50%)`;
  const solidColor = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Saturation / Lightness */}
      <div
        ref={satLightRef}
        className="relative h-36 w-full rounded-lg overflow-hidden border border-border cursor-crosshair select-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSatLightMove(e);
          setDragging("sat");
        }}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${hsl.s}%`,
            top: `${100 - hsl.l}%`,
            transform: "translate(-50%, -50%)",
            backgroundColor: solidColor,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Eyedropper placeholder (optional; API not in all browsers) */}
        <div className="w-8 h-8 rounded-lg border border-border bg-muted/50 flex items-center justify-center shrink-0" title="Eyedropper (unsupported in this browser)" />
        <div className="flex-1 space-y-2">
          {/* Hue */}
          <div
            ref={hueRef}
            className="relative h-2.5 w-full rounded-full cursor-pointer border border-border select-none overflow-visible"
            style={{
              background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleHueMove(e);
              setDragging("hue");
            }}
          >
            <div
              className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none -translate-y-1/2"
              style={{ left: `${(hsl.h / 360) * 100}%`, transform: "translate(-50%, -50%)", backgroundColor: hueColor }}
            />
          </div>
          {/* Alpha */}
          {showAlpha && (
            <div
              ref={alphaRef}
              className="relative h-2.5 w-full rounded-full cursor-pointer border border-border select-none overflow-visible bg-muted/50"
              style={{
                background: `linear-gradient(to right, transparent, ${solidColor})`,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleAlphaMove(e);
                setDragging("alpha");
              }}
            >
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none -translate-y-1/2"
                style={{ left: `${((hsl.a ?? 100) / 100) * 100}%`, transform: "translate(-50%, -50%)", backgroundColor: solidColor }}
              />
            </div>
          )}
        </div>
      </div>

      {/* HSL inputs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground shrink-0">HSL</span>
        <input
          type="number"
          min={0}
          max={360}
          value={hsl.h}
          onChange={(e) => updateFromHsl({ ...hsl, h: clamp(Number(e.target.value), 0, 360) })}
          className="w-14 h-8 rounded border border-border bg-background px-2 text-xs tabular-nums"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={hsl.s}
          onChange={(e) => updateFromHsl({ ...hsl, s: clamp(Number(e.target.value), 0, 100) })}
          className="w-14 h-8 rounded border border-border bg-background px-2 text-xs tabular-nums"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={hsl.l}
          onChange={(e) => updateFromHsl({ ...hsl, l: clamp(Number(e.target.value), 0, 100) })}
          className="w-14 h-8 rounded border border-border bg-background px-2 text-xs tabular-nums"
        />
        {showAlpha && (
          <input
            type="text"
            value={`${hsl.a ?? 100}%`}
            onChange={(e) => {
              const v = e.target.value.replace(/%/, "");
              const n = clamp(Number(v), 0, 100);
              if (!Number.isNaN(n)) updateFromHsl({ ...hsl, a: n });
            }}
            className="w-12 h-8 rounded border border-border bg-background px-2 text-xs tabular-nums"
          />
        )}
      </div>
    </div>
  );
}
