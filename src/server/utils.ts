const pipeStreamToLogger = async (
  stream: ReadableStream<Uint8Array>,
  onLine: (text: string) => void,
  onError: (error: unknown) => void,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const text = decoder.decode(value, { stream: true });

      onLine(text.trim());
    }
  } catch (error) {
    onError(error);
  }
};

const addOnceListener = (
  target: unknown,
  event: string,
  handler: () => void,
): void => {
  if (!target) return;

  const t = target as Record<string, unknown>;

  if (typeof t.once === "function") {
    (t.once as (event: string, handler: () => void) => void)(event, handler);
    return;
  }

  if (typeof t.on === "function") {
    (t.on as (event: string, handler: () => void) => void)(event, handler);
  }
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  const fs = await import("fs/promises");

  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export { addOnceListener, pathExists, pipeStreamToLogger };
