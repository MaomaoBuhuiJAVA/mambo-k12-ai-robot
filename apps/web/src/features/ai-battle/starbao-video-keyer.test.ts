import { describe, expect, it } from "vitest";

import {
  keyEdgeConnectedBlackPixels,
  keyEdgeConnectedCheckerboardPixels,
} from "./starbao-video-keyer";

function createFrame(width: number, height: number) {
  return new Uint8ClampedArray(Array.from({ length: width * height * 4 }, (_, index) => (index % 4 === 3 ? 255 : 0)));
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, red: number, green: number, blue: number) {
  const offset = (y * width + x) * 4;
  data[offset] = red;
  data[offset + 1] = green;
  data[offset + 2] = blue;
  data[offset + 3] = 255;
}

function alphaAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  return data[(y * width + x) * 4 + 3];
}

describe("keyEdgeConnectedBlackPixels", () => {
  it("removes dark pixels connected to the frame edge while preserving enclosed dark character outlines", () => {
    const width = 5;
    const data = createFrame(width, 5);

    setPixel(data, width, 2, 1, 245, 202, 64);
    setPixel(data, width, 1, 2, 245, 202, 64);
    setPixel(data, width, 2, 2, 6, 6, 6);
    setPixel(data, width, 3, 2, 245, 202, 64);
    setPixel(data, width, 2, 3, 245, 202, 64);
    setPixel(data, width, 0, 4, 18, 18, 18);
    setPixel(data, width, 1, 4, 18, 18, 18);

    keyEdgeConnectedBlackPixels(data, width, 5);

    expect(alphaAt(data, width, 0, 0)).toBe(0);
    expect(alphaAt(data, width, 0, 4)).toBe(0);
    expect(alphaAt(data, width, 1, 4)).toBe(0);
    expect(alphaAt(data, width, 2, 2)).toBe(255);
    expect(alphaAt(data, width, 2, 1)).toBe(255);
  });
});

describe("keyEdgeConnectedCheckerboardPixels", () => {
  it("removes checkerboard pixels connected to the frame edge while preserving enclosed gray outlines", () => {
    const width = 6;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);
    const checkerboard = (x: number, y: number) => ((x + y) % 2 === 0 ? 38 : 56);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const value = checkerboard(x, y);
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }

    const enclosedOffset = (2 * width + 2) * 4;
    data[enclosedOffset] = 10;
    data[enclosedOffset + 1] = 10;
    data[enclosedOffset + 2] = 10;

    keyEdgeConnectedCheckerboardPixels(data, width, height);

    expect(alphaAt(data, width, 0, 0)).toBe(0);
    expect(alphaAt(data, width, 5, 5)).toBe(0);
    expect(alphaAt(data, width, 2, 2)).toBe(255);
  });
});
