export type NormalizedPoint = {
  x: number;
  y: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

const INTERACTIVE_SELECTOR = "button,a,input,[role='button']";

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizedPointToViewport(point: NormalizedPoint, viewport: ViewportSize): NormalizedPoint {
  return {
    x: clampUnit(point.x) * Math.max(0, viewport.width),
    y: clampUnit(point.y) * Math.max(0, viewport.height),
  };
}

function isDisabledHtmlControl(element: HTMLElement): boolean {
  return (
    (element instanceof HTMLButtonElement || element instanceof HTMLInputElement)
    && element.disabled
  );
}

export function findGestureInteractiveTarget(target: Element | null): HTMLElement | null {
  const interactive = target?.closest(INTERACTIVE_SELECTOR);
  if (
    !(interactive instanceof HTMLElement)
    || isDisabledHtmlControl(interactive)
    || interactive.getAttribute("aria-disabled") === "true"
  ) return null;
  return interactive;
}
