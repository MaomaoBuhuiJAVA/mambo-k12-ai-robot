const INTERRUPTED_NOTICE = "\n\n（回答连接中断，可点击“重试上一问”。）";

export function withTextStreamFallback(
  source: ReadableStream<string>,
  fallbackText: string,
): ReadableStream<string> {
  const reader = source.getReader();
  let emitted = false;
  let finished = false;

  return new ReadableStream<string>({
    async pull(controller) {
      if (finished) return;
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) {
            finished = true;
            if (!emitted) controller.enqueue(fallbackText);
            controller.close();
            return;
          }
          if (!result.value) continue;
          emitted = true;
          controller.enqueue(result.value);
          return;
        }
      } catch (error) {
        finished = true;
        try {
          await reader.cancel(error);
        } catch {
          // The provider stream is already failed.
        }
        controller.enqueue(emitted ? INTERRUPTED_NOTICE : fallbackText);
        controller.close();
      }
    },
    async cancel(reason) {
      finished = true;
      await reader.cancel(reason);
    },
  });
}
