export interface Rect { x: number; y: number; width: number; height: number }
export interface WindowAnchor { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom'; horizontalGap: number; verticalGap: number }

export function captureAnchor(bounds: Rect, area: Rect): WindowAnchor {
  const left = bounds.x - area.x;
  const right = area.x + area.width - bounds.x - bounds.width;
  const top = bounds.y - area.y;
  const bottom = area.y + area.height - bounds.y - bounds.height;
  return { horizontal: left <= right ? 'left' : 'right', vertical: top <= bottom ? 'top' : 'bottom', horizontalGap: Math.max(0, Math.min(left, right)), verticalGap: Math.max(0, Math.min(top, bottom)) };
}

export function anchoredBounds(anchor: WindowAnchor, size: { width: number; height: number }, area: Rect): Rect {
  const x = anchor.horizontal === 'left' ? area.x + anchor.horizontalGap : area.x + area.width - size.width - anchor.horizontalGap;
  const y = anchor.vertical === 'top' ? area.y + anchor.verticalGap : area.y + area.height - size.height - anchor.verticalGap;
  return { ...size, x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - size.width))), y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - size.height))) };
}
