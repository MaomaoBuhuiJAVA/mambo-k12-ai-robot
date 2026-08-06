const DEFAULT_BLACK_THRESHOLD = 24;
const CHECKERBOARD_CHROMA_TOLERANCE = 24;
const CHECKERBOARD_LUMA_TOLERANCE = 24;

export function keyEdgeConnectedBlackPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  blackThreshold = DEFAULT_BLACK_THRESHOLD,
) {
  const pixelCount = width * height;
  if (pixels.length !== pixelCount * 4) {
    throw new RangeError("Pixel data does not match the frame dimensions.");
  }

  const connectedToEdge = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let readIndex = 0;
  let writeIndex = 0;

  const isNearBlack = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    return pixels[offset] <= blackThreshold
      && pixels[offset + 1] <= blackThreshold
      && pixels[offset + 2] <= blackThreshold;
  };

  const addIfBackground = (pixelIndex: number) => {
    if (connectedToEdge[pixelIndex] || !isNearBlack(pixelIndex)) return;
    connectedToEdge[pixelIndex] = 1;
    queue[writeIndex] = pixelIndex;
    writeIndex += 1;
  };

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x);
    addIfBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackground(y * width);
    addIfBackground(y * width + width - 1);
  }

  while (readIndex < writeIndex) {
    const pixelIndex = queue[readIndex];
    readIndex += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const offset = pixelIndex * 4;
    pixels[offset + 3] = 0;

    if (x > 0) addIfBackground(pixelIndex - 1);
    if (x < width - 1) addIfBackground(pixelIndex + 1);
    if (y > 0) addIfBackground(pixelIndex - width);
    if (y < height - 1) addIfBackground(pixelIndex + width);
  }
}

export function keyEdgeConnectedCheckerboardPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const pixelCount = width * height;
  if (pixels.length !== pixelCount * 4) {
    throw new RangeError("Pixel data does not match the frame dimensions.");
  }

  const edgeLuma = collectEdgeLuma(pixels, width, height);
  if (edgeLuma.length === 0) return;

  const midpoint = median(edgeLuma);
  const darkValues = edgeLuma.filter((value) => value <= midpoint);
  const lightValues = edgeLuma.filter((value) => value > midpoint);
  const darkLuma = median(darkValues);
  const lightLuma = median(lightValues.length > 0 ? lightValues : darkValues);
  const connectedToEdge = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let readIndex = 0;
  let writeIndex = 0;

  const isNearCheckerboard = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const luma = (red + green + blue) / 3;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    return chroma <= CHECKERBOARD_CHROMA_TOLERANCE
      && (Math.abs(luma - darkLuma) <= CHECKERBOARD_LUMA_TOLERANCE
        || Math.abs(luma - lightLuma) <= CHECKERBOARD_LUMA_TOLERANCE);
  };

  const addIfBackground = (pixelIndex: number) => {
    if (connectedToEdge[pixelIndex] || !isNearCheckerboard(pixelIndex)) return;
    connectedToEdge[pixelIndex] = 1;
    queue[writeIndex] = pixelIndex;
    writeIndex += 1;
  };

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x);
    addIfBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackground(y * width);
    addIfBackground(y * width + width - 1);
  }

  while (readIndex < writeIndex) {
    const pixelIndex = queue[readIndex];
    readIndex += 1;
    const offset = pixelIndex * 4;
    pixels[offset + 3] = 0;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) addIfBackground(pixelIndex - 1);
    if (x < width - 1) addIfBackground(pixelIndex + 1);
    if (y > 0) addIfBackground(pixelIndex - width);
    if (y < height - 1) addIfBackground(pixelIndex + width);
  }
}

function collectEdgeLuma(pixels: Uint8ClampedArray, width: number, height: number): number[] {
  const values: number[] = [];
  const add = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) <= CHECKERBOARD_CHROMA_TOLERANCE) {
      values.push((red + green + blue) / 3);
    }
  };

  for (let x = 0; x < width; x += 1) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }
  return values;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}
