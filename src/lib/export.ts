/** Client-side export helpers: CSV/JSON download, SVG chart snapshot, clipboard. */

export function downloadBlob(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (name: string, text: string, type = "text/csv;charset=utf-8") => downloadBlob(name, text, type);

/**
 * Save the Recharts <svg> inside `container` as a standalone, high-resolution SVG
 * with the dark background baked in. Returns false if no chart was found.
 */
export function downloadChartSvg(container: HTMLElement | null, name: string, title?: string) {
  const svg = container?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
  if (!svg) return false;
  const { width, height } = svg.getBoundingClientRect();
  const pad = title ? 36 : 0;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const out = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  out.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  out.setAttribute("width", String(width * 2));
  out.setAttribute("height", String((height + pad) * 2));
  out.setAttribute("viewBox", `0 0 ${width} ${height + pad}`);
  out.setAttribute("font-family", "Plus Jakarta Sans, system-ui, sans-serif");
  const bg = document.createElementNS(out.namespaceURI, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  out.appendChild(bg);
  if (title) {
    const t = document.createElementNS(out.namespaceURI, "text");
    t.setAttribute("x", "16");
    t.setAttribute("y", "24");
    t.setAttribute("fill", "#1b2541");
    t.setAttribute("font-size", "14");
    t.setAttribute("font-weight", "600");
    t.textContent = title;
    out.appendChild(t);
  }
  const g = document.createElementNS(out.namespaceURI, "g");
  g.setAttribute("transform", `translate(0 ${pad})`);
  clone.removeAttribute("class");
  g.appendChild(clone);
  out.appendChild(g);
  downloadBlob(name, new XMLSerializer().serializeToString(out), "image/svg+xml");
  return true;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
