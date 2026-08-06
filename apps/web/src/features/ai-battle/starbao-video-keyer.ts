const DEFAULT_BLACK_THRESHOLD = 24;

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
