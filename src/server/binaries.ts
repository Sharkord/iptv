import type { PluginContext } from "@sharkord/plugin-sdk";
import {
  areRequiredBinariesPresent,
  ensureRequiredBinaries,
} from "./downloads";

let binariesReady = false;
let binariesInitError: Error | null = null;

const startBinaryBootstrap = (ctx: PluginContext): void => {
  binariesReady = false;
  binariesInitError = null;

  ensureRequiredBinaries(ctx)
    .then(() => {
      binariesReady = true;
      ctx.log("Required binaries are ready");
    })
    .catch((err: unknown) => {
      binariesInitError = err instanceof Error ? err : new Error(String(err));
      ctx.error("Failed to prepare required binaries", err);
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
    "Required binaries are still downloading. Try again in a moment.",
  );
};

export { startBinaryBootstrap, assertBinariesReady };
