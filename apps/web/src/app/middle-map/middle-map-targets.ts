const middleMapTargetHrefs = {
  "stage-progress": "/learn?stage=middle_school&grade=middle_1&view=courses",
  "course-resources": "/learn/course/middle-ai-foundations#course-resources",
  "ai-foundations-course": "/learn/course/middle-ai-foundations",
  "guided-image-lab": "/lab?stage=middle_school&template=image-classifier&mode=guided",
  "independent-image-lab": "/lab?stage=middle_school&template=image-classifier&mode=independent",
} as const;

export type MiddleMapTarget = keyof typeof middleMapTargetHrefs;

export function getMiddleMapTargetHref(target: string): string {
  if (!(target in middleMapTargetHrefs)) {
    throw new Error(`Unknown middle map target: ${target}`);
  }

  return middleMapTargetHrefs[target as MiddleMapTarget];
}

export function requireMiddleMapTarget(target: string): MiddleMapTarget {
  getMiddleMapTargetHref(target);
  return target as MiddleMapTarget;
}
