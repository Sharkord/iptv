import {
  areRequiredBinariesPresent,
  ensureRequiredBinaries,
  type TDownloadLogger,
} from "./downloads";

let binariesReady = false;
let binariesInitError: Error | null = null;

const startBinaryBootstrap = (logger: TDownloadLogger): void => {
  binariesReady = false;
  binariesInitError = null;

  ensureRequiredBinaries(logger)
    .then(() => {
      binariesReady = true;
      logger.log("Required binaries are ready");
    })
    .catch((err: unknown) => {
      binariesInitError = err instanceof Error ? err : new Error(String(err));
      logger.error("Failed to prepare required binaries", err);
    });
};

const assertBinariesReady = async (): Promise<void> => {
  if (binariesInitError) {
    throw new Error(
      `Failed to prepare required binaries: ${binariesInitError.message}`,
    );
  }

  if (binariesReady || (await areRequiredBinariesPresent())) {
    binariesReady = true;

    return;
  }

  throw new Error(
    "FFmpeg is still downloading. Follow it in the plugin logs and try again in a moment.",
  );
};

export { assertBinariesReady, startBinaryBootstrap };
