"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** The blank border scanners need around the code, in modules. */
const QUIET_ZONE = 4;

/** A QR code drawn as one SVG path. It stays sharp at any size and needs no canvas. */
export function QrCode({
  value,
  label,
  size = 176,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { count, path };
  }, [value]);

  const extent = count + QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className="max-w-full rounded-xl ring-1 ring-black/10"
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
