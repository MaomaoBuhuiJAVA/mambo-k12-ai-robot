export const LEARNING_STATE_CHANGED_EVENT = "mambo:learning-state-changed";

export function announceLearningStateChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LEARNING_STATE_CHANGED_EVENT));
  }
}
