import { markerBox, markerPolygon } from "./markers";
import type { Prim, Size } from "./types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/** Ścieżka wycinka koła lub pierścienia; kąty w stopniach od godziny 12, zgodnie z ruchem wskazówek. */
export function wedgePath(cx: number, cy: number, r: number, innerR: number, start: number, end: number): string {
  const sweep = end - start;
  if (sweep >= 359.999) {
    // Pełny okrąg trzeba narysować dwoma łukami.
    const outer = `M ${n(cx)} ${n(cy - r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy + r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy - r)} Z`;
    if (innerR <= 0) return outer;
    return outer + ` M ${n(cx)} ${n(cy - innerR)} A ${n(innerR)} ${n(innerR)} 0 1 0 ${n(cx)} ${n(cy + innerR)} A ${n(innerR)} ${n(innerR)} 0 1 0 ${n(cx)} ${n(cy - innerR)} Z`;
  }
  const pt = (rad: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.sin(a) * rad, cy - Math.cos(a) * rad];
  };
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = pt(r, start);
  const [x2, y2] = pt(r, end);
  if (innerR <= 0) {
    return `M ${n(cx)} ${n(cy)} L ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x2)} ${n(y2)} Z`;
  }
  const [x3, y3] = pt(innerR, end);
  const [x4, y4] = pt(innerR, start);
  return `M ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x2)} ${n(y2)} L ${n(x3)} ${n(y3)} A ${n(innerR)} ${n(innerR)} 0 ${large} 0 ${n(x4)} ${n(y4)} Z`;
}

export function primsToSvg(prims: Prim[], size: Size, fontFamily = "Segoe UI, Calibri, Arial, sans-serif"): string {
  const parts: string[] = [];
  for (const p of prims) {
    switch (p.kind) {
      case "rect":
        parts.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}"` : ""}/>`);
        break;
      case "line":
        parts.push(
          `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.color}" stroke-width="${p.width}"${p.dash ? ' stroke-dasharray="3 2"' : ""} stroke-linecap="round"/>`,
        );
        break;
      case "marker": {
        const paint = p.hollow ? `fill="none" stroke="${p.fill}" stroke-width="1.5"` : `fill="${p.fill}" stroke="#FFFFFF" stroke-width="0.75"`;
        const shape = p.shape ?? "circle";
        if (shape === "circle") {
          parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" ${paint}/>`);
        } else {
          const box = markerBox(shape, p.r);
          const pts = markerPolygon(shape).map(([u, v]) => `${n(p.cx - box.w / 2 + u * box.w)},${n(p.cy - box.h / 2 + v * box.h)}`);
          parts.push(`<polygon points="${pts.join(" ")}" ${paint} stroke-linejoin="round"/>`);
        }
        break;
      }
      case "triangle": {
        const pts =
          p.direction === "down"
            ? [p.x, p.y, p.x + p.w, p.y, p.x + p.w / 2, p.y + p.h]
            : [p.x + p.w / 2, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h];
        parts.push(`<polygon points="${pts.map(n).join(" ")}" fill="${p.fill}"/>`);
        break;
      }
      case "wedge":
        parts.push(`<path d="${wedgePath(p.cx, p.cy, p.r, p.innerR, p.start, p.end)}" fill="${p.fill}" fill-rule="evenodd" stroke="#FFFFFF" stroke-width="1"/>`);
        break;
      case "text": {
        if (p.background) {
          parts.push(
            p.shape === "ellipse"
              ? `<ellipse cx="${n(p.x + p.w / 2)}" cy="${n(p.y + p.h / 2)}" rx="${n(p.w / 2)}" ry="${n(p.h / 2)}" fill="${p.background}" stroke="#404040" stroke-width="0.75"/>`
              : `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.background}"/>`,
          );
        }
        const lines = p.text.split("\n");
        const lh = p.size * 1.3;
        const anchor = p.align === "left" ? "start" : p.align === "right" ? "end" : "middle";
        const x = p.align === "left" ? p.x : p.align === "right" ? p.x + p.w : p.x + p.w / 2;
        const blockH = lines.length * lh;
        const y0 = p.valign === "top" ? p.y : p.valign === "bottom" ? p.y + p.h - blockH : p.y + (p.h - blockH) / 2;
        lines.forEach((ln, i) => {
          parts.push(
            `<text x="${n(x)}" y="${n(y0 + lh * i + lh / 2)}" font-size="${n(p.size)}" fill="${p.color}" text-anchor="${anchor}" dominant-baseline="central"${p.bold ? ' font-weight="bold"' : ""}>${esc(ln)}</text>`,
          );
        });
        break;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size.width)}" height="${n(size.height)}" viewBox="0 0 ${n(size.width)} ${n(size.height)}" font-family="${esc(fontFamily)}">` +
    parts.join("") +
    `</svg>`
  );
}
