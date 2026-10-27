/**
 * 窗口定位的纯函数：保存相对屏幕边缘的距离，避免窗口反复变形后逐渐漂移。
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface WindowAnchor {
  horizontal: 'left' | 'right';
  vertical: 'top' | 'bottom';
  horizontalGap: number;
  verticalGap: number;
}

export function sidePanelBounds(rail: Rect, area: Rect, size = { width: 320, height: 310 }): Rect {
  const right = rail.x + rail.width + 10,
    left = rail.x - size.width - 10;
  const x = right + size.width <= area.x + area.width ? right : left;
  const y = rail.y + rail.height / 2 - size.height / 2;
  return {
    ...size,
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - size.width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - size.height))),
  };
}

/** 以最近的水平/垂直边缘作为锚点，记录正向间距以支持负坐标显示器。 */
export function captureAnchor(bounds: Rect, area: Rect): WindowAnchor {
  const left = bounds.x - area.x;
  const right = area.x + area.width - bounds.x - bounds.width;
  const top = bounds.y - area.y;
  const bottom = area.y + area.height - bounds.y - bounds.height;
  return {
    horizontal: left <= right ? 'left' : 'right',
    vertical: top <= bottom ? 'top' : 'bottom',
    horizontalGap: Math.max(0, Math.min(left, right)),
    verticalGap: Math.max(0, Math.min(top, bottom)),
  };
}

/** 尺寸变化后恢复原锚点间距，并将最终坐标约束到当前工作区。 */
export function anchoredBounds(
  anchor: WindowAnchor,
  size: { width: number; height: number },
  area: Rect,
): Rect {
  const x =
    anchor.horizontal === 'left'
      ? area.x + anchor.horizontalGap
      : area.x + area.width - size.width - anchor.horizontalGap;
  const y =
    anchor.vertical === 'top'
      ? area.y + anchor.verticalGap
      : area.y + area.height - size.height - anchor.verticalGap;
  return {
    ...size,
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - size.width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - size.height))),
  };
}
