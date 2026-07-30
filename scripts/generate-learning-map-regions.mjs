import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const mapWidth = 1536;
const mapHeight = 1024;
const root = process.cwd();
const maskSource = resolve(root, "apps/web/public/assets/learning-map/primary-school-regions.svg");
const artworkSource = resolve(root, "apps/web/public/assets/learning-map/starbao-learning-islands.png");
const outputDirectory = resolve(root, "apps/web/public/assets/learning-map/primary-regions");
const minimumComponentArea = 1000;

const regionMatchers = [
  { id: "forest", matches: (component) => component.minX < 500 && component.minY < 100 },
  { id: "castle", matches: (component) => component.minX > 800 && component.minY < 100 },
  { id: "technology", matches: (component) => component.minX > 1000 && component.minY > 250 },
  { id: "desert", matches: (component) => component.minX > 500 && component.minY > 500 },
  { id: "volcano", matches: (component) => component.minX < 500 && component.minY > 400 },
];

function findComponents(alpha, width, height) {
  const pixelCount = width * height;
  const componentIds = new Int16Array(pixelCount);
  componentIds.fill(-1);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (componentIds[start] !== -1 || alpha[start] < 128) {
      continue;
    }

    const componentIndex = components.length;
    const queue = [start];
    let cursor = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    componentIds[start] = componentIndex;

    while (cursor < queue.length) {
      const pixel = queue[cursor];
      cursor += 1;

      const x = pixel % width;
      const y = (pixel - x) / width;
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const adjacentPixels = [pixel - 1, pixel + 1, pixel - width, pixel + width];
      for (const adjacent of adjacentPixels) {
        if (adjacent < 0 || adjacent >= pixelCount || componentIds[adjacent] !== -1 || alpha[adjacent] < 128) {
          continue;
        }

        const adjacentX = adjacent % width;
        const adjacentY = (adjacent - adjacentX) / width;
        if (Math.abs(adjacentX - x) + Math.abs(adjacentY - y) !== 1) {
          continue;
        }

        componentIds[adjacent] = componentIndex;
        queue.push(adjacent);
      }
    }

    components.push({
      area,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  return { componentIds, components };
}

function simplifyClosedPath(points) {
  const uniquePoints = points.slice(0, -1);

  return uniquePoints.filter((point, index) => {
    const previous = uniquePoints[(index - 1 + uniquePoints.length) % uniquePoints.length];
    const next = uniquePoints[(index + 1) % uniquePoints.length];

    return !(
      (previous.x === point.x && point.x === next.x)
      || (previous.y === point.y && point.y === next.y)
    );
  });
}

function traceComponentPath(component, componentIds, width) {
  const edgeMap = new Map();
  const pointKey = (x, y) => `${x}:${y}`;
  const belongsToComponent = (x, y) => (
    x >= component.minX
    && x <= component.maxX
    && y >= component.minY
    && y <= component.maxY
    && componentIds[y * width + x] === component.index
  );
  const addEdge = (fromX, fromY, toX, toY) => {
    const key = pointKey(fromX, fromY);
    const edges = edgeMap.get(key) ?? [];
    edges.push({ x: toX, y: toY });
    edgeMap.set(key, edges);
  };

  for (let y = component.minY; y <= component.maxY; y += 1) {
    for (let x = component.minX; x <= component.maxX; x += 1) {
      if (!belongsToComponent(x, y)) {
        continue;
      }

      if (!belongsToComponent(x, y - 1)) {
        addEdge(x, y, x + 1, y);
      }
      if (!belongsToComponent(x + 1, y)) {
        addEdge(x + 1, y, x + 1, y + 1);
      }
      if (!belongsToComponent(x, y + 1)) {
        addEdge(x + 1, y + 1, x, y + 1);
      }
      if (!belongsToComponent(x - 1, y)) {
        addEdge(x, y + 1, x, y);
      }
    }
  }

  const pathSegments = [];
  while (edgeMap.size > 0) {
    const [firstKey] = edgeMap.entries().next().value;
    const [startX, startY] = firstKey.split(":").map(Number);
    const points = [{ x: startX, y: startY }];
    let current = { x: startX, y: startY };

    do {
      const currentKey = pointKey(current.x, current.y);
      const candidates = edgeMap.get(currentKey);
      if (!candidates || candidates.length === 0) {
        throw new Error(`Could not close the ${component.id} map-region boundary.`);
      }

      const next = candidates.shift();
      if (candidates.length === 0) {
        edgeMap.delete(currentKey);
      }

      current = next;
      points.push(current);
    } while (current.x !== startX || current.y !== startY);

    const simplifiedPoints = simplifyClosedPath(points);
    pathSegments.push(
      `M${simplifiedPoints[0].x} ${simplifiedPoints[0].y}${simplifiedPoints.slice(1).map((point) => `L${point.x} ${point.y}`).join("")}Z`,
    );
  }

  return pathSegments.join("");
}

async function main() {
  const [mask, artwork] = await Promise.all([
    sharp(maskSource).resize(mapWidth, mapHeight, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(artworkSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  if (mask.info.width !== mapWidth || mask.info.height !== mapHeight || artwork.info.width !== mapWidth || artwork.info.height !== mapHeight) {
    throw new Error("The map artwork and the supplied SVG must both align to the 1536 x 1024 map canvas.");
  }

  const alpha = new Uint8Array(mapWidth * mapHeight);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = mask.data[pixel * mask.info.channels + 3];
  }

  const { componentIds, components } = findComponents(alpha, mapWidth, mapHeight);
  const significantComponents = components
    .map((component, index) => ({ ...component, index }))
    .filter((component) => component.area >= minimumComponentArea);

  const matchedRegions = regionMatchers.map((region) => {
    const component = significantComponents.find(region.matches);
    if (!component) {
      throw new Error(`Could not find the ${region.id} region in the supplied SVG.`);
    }
    return { ...region, component };
  });

  if (new Set(matchedRegions.map((region) => region.component.index)).size !== regionMatchers.length) {
    throw new Error("The supplied SVG did not resolve to five independent learning-map regions.");
  }

  await mkdir(outputDirectory, { recursive: true });
  const layout = [];

  for (const region of matchedRegions) {
    const { component } = region;
    const path = traceComponentPath(component, componentIds, mapWidth);
    const maskPixels = Buffer.alloc(component.width * component.height * 4);
    const zoomPixels = Buffer.alloc(component.width * component.height * 4);

    for (let y = component.minY; y <= component.maxY; y += 1) {
      for (let x = component.minX; x <= component.maxX; x += 1) {
        const sourcePixel = y * mapWidth + x;
        if (componentIds[sourcePixel] !== component.index) {
          continue;
        }

        const targetPixel = (y - component.minY) * component.width + (x - component.minX);
        const sourceOffset = sourcePixel * artwork.info.channels;
        const targetOffset = targetPixel * 4;
        const sourceAlpha = alpha[sourcePixel];

        maskPixels[targetOffset] = 255;
        maskPixels[targetOffset + 1] = 255;
        maskPixels[targetOffset + 2] = 255;
        maskPixels[targetOffset + 3] = sourceAlpha;
        zoomPixels[targetOffset] = artwork.data[sourceOffset];
        zoomPixels[targetOffset + 1] = artwork.data[sourceOffset + 1];
        zoomPixels[targetOffset + 2] = artwork.data[sourceOffset + 2];
        zoomPixels[targetOffset + 3] = sourceAlpha;
      }
    }

    const raw = { width: component.width, height: component.height, channels: 4 };
    await Promise.all([
      sharp(maskPixels, { raw }).png().toFile(resolve(outputDirectory, `${region.id}-mask.png`)),
      sharp(zoomPixels, { raw }).png().toFile(resolve(outputDirectory, `${region.id}-zoom.png`)),
    ]);

    layout.push({
      id: region.id,
      x: component.minX,
      y: component.minY,
      width: component.width,
      height: component.height,
      path,
    });
  }

  const layoutJson = `${JSON.stringify({ mapWidth, mapHeight, regions: layout }, null, 2)}\n`;
  await Promise.all([
    writeFile(resolve(outputDirectory, "region-layout.json"), layoutJson, "utf8"),
    writeFile(resolve(root, "apps/web/src/app/map/region-layout.json"), layoutJson, "utf8"),
  ]);

  console.log(`Generated ${layout.length} independent map regions from ${maskSource}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
