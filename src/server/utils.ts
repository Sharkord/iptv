import fs from "fs/promises";

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

      onLine(decoder.decode(value, { stream: true }).trim());
    }
  } catch (error) {
    onError(error);
  }
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);

    return true;
  } catch {
    return false;
  }
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export { getErrorMessage, pathExists, pipeStreamToLogger };
