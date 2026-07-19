const EDGE_GAP = 15;

interface PetPanelLeftInput {
  petX: number;
  petWidth: number;
  panelWidth: number;
  viewportWidth: number;
  offsetX?: number;
}

export function resolvePetPanelLeft({
  petX,
  petWidth,
  panelWidth,
  viewportWidth,
  offsetX,
}: PetPanelLeftInput): number {
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - panelWidth - EDGE_GAP);
  const centeredLeft = petX + (petWidth - panelWidth) / 2;
  const preferredLeft = offsetX === undefined ? centeredLeft : petX + offsetX;

  return Math.min(maxLeft, Math.max(EDGE_GAP, preferredLeft));
}
