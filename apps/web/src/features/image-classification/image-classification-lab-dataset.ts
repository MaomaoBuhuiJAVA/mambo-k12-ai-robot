export type ImageClassificationLabLabel = "leaf" | "ball" | "cup";

export type ImageClassificationLabVariable = "color" | "shape" | "texture";

export interface ImageClassificationLabSample {
  readonly id: string;
  readonly label: ImageClassificationLabLabel;
  readonly labelText: string;
  readonly features: Readonly<Record<ImageClassificationLabVariable, string>>;
}

/**
 * The guided and independent labs use this small, versioned fixture. The
 * browser runtime mirrors the same three cases when it builds its checks.
 */
export const IMAGE_CLASSIFICATION_LAB_DATASET_VERSION = "image-classifier-lab-v1";
export const IMAGE_CLASSIFICATION_LAB_CHALLENGE_VERSION = 1;

export const IMAGE_CLASSIFICATION_LAB_SAMPLES: readonly ImageClassificationLabSample[] = [
  {
    id: "leaf-green-veined",
    label: "leaf",
    labelText: "叶子",
    features: { color: "green", shape: "long", texture: "veined" },
  },
  {
    id: "ball-white-striped",
    label: "ball",
    labelText: "球",
    features: { color: "white", shape: "round", texture: "striped" },
  },
  {
    id: "cup-blue-handle",
    label: "cup",
    labelText: "杯子",
    features: { color: "blue", shape: "tall", texture: "handle" },
  },
] as const;

export const IMAGE_CLASSIFICATION_LAB_SAMPLE_COUNT = IMAGE_CLASSIFICATION_LAB_SAMPLES.length;

export function getImageClassificationLabSample(id: string): ImageClassificationLabSample | undefined {
  return IMAGE_CLASSIFICATION_LAB_SAMPLES.find((sample) => sample.id === id);
}
