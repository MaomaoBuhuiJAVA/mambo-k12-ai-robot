export const SPRITE_SHEET_GRID = {
  columns: 8,
  rows: 4,
  frameWidth: 182,
  frameHeight: 180,
} as const;

const CHECKERBOARD_CELL_SIZE = 16;
const CHECKERBOARD_COLOR_TOLERANCE = 28;
type Rgb = readonly [number, number, number];
type CheckerboardPalette = readonly [Rgb, Rgb];

export const ENEMY_ANIMATION_RANGES = {
  spawn: { start: 0, end: 23, frameRate: 12, repeat: 0 },
  defeat: { start: 0, end: 23, frameRate: 12, repeat: 0 },
  exit: { start: 24, end: 31, frameRate: 12, repeat: 0 },
} as const;

export type EnemyAnimationState = keyof typeof ENEMY_ANIMATION_RANGES;

export function isMagentaBackgroundPixel(red: number, green: number, blue: number): boolean {
  const magentaChroma = red + blue - green * 2;
  return red >= 90 && blue >= 90 && green <= 160 && magentaChroma >= 8 && Math.abs(red - blue) <= 42;
}

export function isCheckerboardBackgroundPixel(
  red: number,
  green: number,
  blue: number,
  expectedColor: Rgb,
): boolean {
  return Math.max(
    Math.abs(red - expectedColor[0]),
    Math.abs(green - expectedColor[1]),
    Math.abs(blue - expectedColor[2]),
  ) <= CHECKERBOARD_COLOR_TOLERANCE;
}

export function hasTransparentSpriteSheetPixels(pixels: Uint8ClampedArray): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index]! < 255) return true;
  }
  return false;
}

export function createTransparentSpriteSheetCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;

  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  if (hasTransparentSpriteSheetPixels(frame.data)) return canvas;
  const magentaBackground = hasMagentaBackground(frame.data, canvas.width, canvas.height);
  const checkerboardPalette = magentaBackground ? null : inferCheckerboardPalette(frame.data, canvas.width, canvas.height);

  for (let row = 0; row < SPRITE_SHEET_GRID.rows; row += 1) {
    for (let column = 0; column < SPRITE_SHEET_GRID.columns; column += 1) {
      removeConnectedBackground(
        frame.data,
        canvas.width,
        column * SPRITE_SHEET_GRID.frameWidth,
        row * SPRITE_SHEET_GRID.frameHeight,
        SPRITE_SHEET_GRID.frameWidth,
        SPRITE_SHEET_GRID.frameHeight,
        magentaBackground,
        checkerboardPalette,
      );
    }
  }

  context.putImageData(frame, 0, 0);
  return canvas;
}

function removeConnectedBackground(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  originX: number,
  originY: number,
  frameWidth: number,
  frameHeight: number,
  magentaBackground: boolean,
  checkerboardPalette: CheckerboardPalette | null,
) {
  const visited = new Uint8Array(frameWidth * frameHeight);
  const queue = new Int32Array(frameWidth * frameHeight);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueueIfBackground = (localX: number, localY: number) => {
    if (localX < 0 || localX >= frameWidth || localY < 0 || localY >= frameHeight) return;
    const localIndex = localY * frameWidth + localX;
    if (visited[localIndex]) return;

    const pixelIndex = ((originY + localY) * imageWidth + originX + localX) * 4;
    if (pixels[pixelIndex + 3] === 0) {
      visited[localIndex] = 1;
      return;
    }

    const isBackground = magentaBackground
      ? isMagentaCompositeBackgroundPixel(pixels[pixelIndex]!, pixels[pixelIndex + 1]!, pixels[pixelIndex + 2]!)
      : checkerboardPalette !== null && isCheckerboardBackgroundPixel(
        pixels[pixelIndex]!,
        pixels[pixelIndex + 1]!,
        pixels[pixelIndex + 2]!,
        checkerboardPalette[checkerboardColorIndex(originX + localX, originY + localY)],
      );
    if (!isBackground) return;
    visited[localIndex] = 1;
    queue[queueEnd] = localIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < frameWidth; x += 1) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, frameHeight - 1);
  }
  for (let y = 1; y < frameHeight - 1; y += 1) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(frameWidth - 1, y);
  }

  while (queueStart < queueEnd) {
    const localIndex = queue[queueStart]!;
    queueStart += 1;
    const localX = localIndex % frameWidth;
    const localY = Math.floor(localIndex / frameWidth);
    const pixelIndex = ((originY + localY) * imageWidth + originX + localX) * 4;
    pixels[pixelIndex] = 0;
    pixels[pixelIndex + 1] = 0;
    pixels[pixelIndex + 2] = 0;
    pixels[pixelIndex + 3] = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX !== 0 || offsetY !== 0) enqueueIfBackground(localX + offsetX, localY + offsetY);
      }
    }
  }

  if (magentaBackground) {
    for (let pass = 0; pass < 3; pass += 1) {
      removeBackgroundFringe(pixels, imageWidth, originX, originY, frameWidth, frameHeight);
    }
  }
}

function inferCheckerboardPalette(pixels: Uint8ClampedArray, width: number, height: number): CheckerboardPalette {
  const channels: [[number[], number[], number[]], [number[], number[], number[]]] = [
    [[], [], []],
    [[], [], []],
  ];

  const sample = (x: number, y: number) => {
    const pixelIndex = (y * width + x) * 4;
    const target = channels[checkerboardColorIndex(x, y)];
    target[0].push(pixels[pixelIndex]!);
    target[1].push(pixels[pixelIndex + 1]!);
    target[2].push(pixels[pixelIndex + 2]!);
  };

  for (let x = 0; x < width; x += 2) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 2) {
    sample(0, y);
    sample(width - 1, y);
  }

  return [
    [median(channels[0][0]), median(channels[0][1]), median(channels[0][2])],
    [median(channels[1][0]), median(channels[1][1]), median(channels[1][2])],
  ];
}

function checkerboardColorIndex(x: number, y: number): 0 | 1 {
  return ((Math.floor(x / CHECKERBOARD_CELL_SIZE) + Math.floor(y / CHECKERBOARD_CELL_SIZE)) % 2) as 0 | 1;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function removeBackgroundFringe(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  originX: number,
  originY: number,
  frameWidth: number,
  frameHeight: number,
) {
  const clearPixels: number[] = [];

  for (let localY = 1; localY < frameHeight - 1; localY += 1) {
    for (let localX = 1; localX < frameWidth - 1; localX += 1) {
      const pixelIndex = ((originY + localY) * imageWidth + originX + localX) * 4;
      if (pixels[pixelIndex + 3] === 0) continue;

      let touchesTransparentPixel = false;
      for (let offsetY = -1; offsetY <= 1 && !touchesTransparentPixel; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborIndex = ((originY + localY + offsetY) * imageWidth + originX + localX + offsetX) * 4;
          if (pixels[neighborIndex + 3] === 0) {
            touchesTransparentPixel = true;
            break;
          }
        }
      }
      if (!touchesTransparentPixel) continue;

      const isBackgroundLike = isMagentaFringePixel(
        pixels[pixelIndex]!,
        pixels[pixelIndex + 1]!,
        pixels[pixelIndex + 2]!,
      );
      if (isBackgroundLike) clearPixels.push(pixelIndex);
    }
  }

  for (const pixelIndex of clearPixels) {
    pixels[pixelIndex] = 0;
    pixels[pixelIndex + 1] = 0;
    pixels[pixelIndex + 2] = 0;
    pixels[pixelIndex + 3] = 0;
  }
}

function isMagentaFringePixel(red: number, green: number, blue: number): boolean {
  const magentaChroma = red + blue - green * 2;
  return magentaChroma >= 12 && red >= 30 && blue >= 30 && green <= 130;
}

function hasMagentaBackground(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  for (let x = 0; x < width; x += 16) {
    for (const y of [0, height - 1]) {
      const pixelIndex = (y * width + x) * 4;
      if (pixels[pixelIndex]! >= 220 && pixels[pixelIndex + 1]! <= 80 && pixels[pixelIndex + 2]! >= 220) return true;
    }
  }
  return false;
}

function isMagentaCompositeBackgroundPixel(red: number, green: number, blue: number): boolean {
  const distanceToMagenta = Math.hypot(255 - red, green, 255 - blue);
  const magentaChroma = red + blue - green * 2;
  return distanceToMagenta <= 255 && magentaChroma >= 12 && red >= 80 && blue >= 80 && green <= 200;
}
