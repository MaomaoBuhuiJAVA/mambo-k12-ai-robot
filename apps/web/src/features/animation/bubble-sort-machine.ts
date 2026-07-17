export interface BubbleSortMachine {
  readonly originalValues: readonly number[];
  readonly values: readonly number[];
  readonly comparisonIndex: number;
  readonly pass: number;
  readonly sortedFrom: number;
  readonly comparisons: number;
  readonly swaps: number;
  readonly lastAction: "ready" | "compare" | "swap" | "complete";
  readonly lastCompared: readonly [number, number] | null;
  readonly lastComparedIndexes: readonly [number, number] | null;
}

export function createBubbleSortMachine(values = [4, 1, 3, 2]): BubbleSortMachine {
  const originalValues = [...values];
  return {
    originalValues,
    values: [...originalValues],
    comparisonIndex: 0,
    pass: 0,
    sortedFrom: originalValues.length,
    comparisons: 0,
    swaps: 0,
    lastAction: "ready",
    lastCompared: null,
    lastComparedIndexes: null,
  };
}

export function nextBubbleSortFrame(state: BubbleSortMachine): BubbleSortMachine {
  if (state.sortedFrom <= 1) {
    return state;
  }

  const left = state.comparisonIndex;
  const right = left + 1;
  const values = [...state.values];
  const lastCompared: readonly [number, number] = [values[left], values[right]];
  const shouldSwap = values[left] > values[right];

  if (shouldSwap) {
    [values[left], values[right]] = [values[right], values[left]];
  }

  const reachesEndOfPass = right === state.sortedFrom - 1;
  const nextSortedFrom = reachesEndOfPass ? state.sortedFrom - 1 : state.sortedFrom;
  return {
    ...state,
    values,
    comparisonIndex: reachesEndOfPass ? 0 : left + 1,
    pass: reachesEndOfPass ? state.pass + 1 : state.pass,
    sortedFrom: nextSortedFrom,
    comparisons: state.comparisons + 1,
    swaps: state.swaps + (shouldSwap ? 1 : 0),
    lastAction: nextSortedFrom <= 1 ? "complete" : shouldSwap ? "swap" : "compare",
    lastCompared,
    lastComparedIndexes: [left, right],
  };
}

export function resetBubbleSortMachine(state: BubbleSortMachine): BubbleSortMachine {
  return createBubbleSortMachine([...state.originalValues]);
}
