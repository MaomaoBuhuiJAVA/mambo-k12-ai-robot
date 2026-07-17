import assert from "node:assert/strict";

import { loadPyodide } from "pyodide";

import {
  CHALLENGE_VERSIONS,
  buildExecutableCode,
  disableRuntimeCapabilities,
} from "../public/lab-execution-core.mjs";

const challenges = [
  {
    id: "bubble-sort",
    code: `def bubble_sort(values):
    result = values[:]
    for end in range(len(result) - 1, 0, -1):
        swapped = False
        for index in range(end):
            if result[index] > result[index + 1]:
                result[index], result[index + 1] = result[index + 1], result[index]
                swapped = True
        if not swapped:
            break
    return result`,
  },
  {
    id: "image-classifier",
    code: `def classify_image(features):
    scores = {"leaf": 0, "ball": 0, "cup": 0}
    if features.get("color") == "green": scores["leaf"] += 2
    if features.get("shape") == "round": scores["ball"] += 2
    if features.get("texture") == "handle": scores["cup"] += 3
    if features.get("texture") == "veined": scores["leaf"] += 2
    if features.get("texture") == "striped": scores["ball"] += 2
    return max(scores, key=scores.get)`,
  },
];

const pyodide = await loadPyodide();
disableRuntimeCapabilities();
for (const challenge of challenges) {
  const globals = pyodide.runPython("dict()");
  try {
    await pyodide.runPythonAsync(
      buildExecutableCode(
        challenge.id,
        CHALLENGE_VERSIONS[challenge.id],
        challenge.code,
      ),
      { globals },
    );
    assert.equal(globals.get("_mambo_passed"), true);
    console.log(`${challenge.id}:passed`);
  } finally {
    globals.destroy();
  }
}
