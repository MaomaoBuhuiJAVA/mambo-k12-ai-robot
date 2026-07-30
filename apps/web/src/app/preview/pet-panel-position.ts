const EDGE_GAP = 15;
const PET_GAP = 12;

interface PetPanelLeftInput {
  petX: number;
  petWidth: number;
  panelWidth: number;
  viewportWidth: number;
  offsetX?: number;
}

interface PetPanelPositionInput extends PetPanelLeftInput {
  petY: number;
  petHeight: number;
  panelHeight: number;
  viewportHeight: number;
}

export type PetPanelPosition = {
  left: number;
  top: number;
  height: number;
  placement: "above" | "below" | "left" | "right";
};

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

export function resolvePetPanelPosition({
  petX,
  petY,
  petWidth,
  petHeight,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
}: PetPanelPositionInput): PetPanelPosition {
  const availableAbove = Math.max(0, petY - PET_GAP - EDGE_GAP);
  const availableBelow = Math.max(0, viewportHeight - petY - petHeight - PET_GAP - EDGE_GAP);
  const leftSpace = Math.max(0, petX - PET_GAP - EDGE_GAP);
  const rightSpace = Math.max(0, viewportWidth - petX - petWidth - PET_GAP - EDGE_GAP);

  if (Math.max(availableAbove, availableBelow) < panelHeight && (leftSpace >= panelWidth || rightSpace >= panelWidth)) {
    const placement = rightSpace >= panelWidth && rightSpace >= leftSpace ? "right" : "left";
    const left = placement === "right"
      ? petX + petWidth + PET_GAP
      : petX - PET_GAP - panelWidth;
    const height = Math.min(panelHeight, Math.max(0, viewportHeight - EDGE_GAP * 2));
    const maxTop = Math.max(EDGE_GAP, viewportHeight - height - EDGE_GAP);

    return {
      left,
      top: Math.min(maxTop, Math.max(EDGE_GAP, petY)),
      height,
      placement,
    };
  }

  const placement = availableAbove >= panelHeight || availableAbove >= availableBelow ? "above" : "below";
  const height = Math.min(panelHeight, placement === "above" ? availableAbove : availableBelow);
  const top = placement === "above"
    ? petY - PET_GAP - height
    : petY + petHeight + PET_GAP;

  return {
    left: resolvePetPanelLeft({ petX, petWidth, panelWidth, viewportWidth }),
    top,
    height,
    placement,
  };
}