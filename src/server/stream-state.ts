import type {
  AppData,
  PlainTransport,
  Producer,
  TExternalStreamHandle,
} from "@sharkord/plugin-sdk";
import { killFFmpegProcesses, type TProcessPair } from "./ffmpeg";

type TStreamState = {
  processes: TProcessPair;
  streamActive: boolean;
  streamStarting: boolean;
  videoProducer: Producer | null;
  audioProducer: Producer | null;
  videoTransport: PlainTransport<AppData> | null;
  audioTransport: PlainTransport<AppData> | null;
  streamHandle: TExternalStreamHandle | null;
  isCleaning: boolean;
};

const streamStates = new Map<number, TStreamState>();

const createDefaultState = (): TStreamState => ({
  processes: {},
  streamActive: false,
  streamStarting: false,
  videoProducer: null,
  audioProducer: null,
  videoTransport: null,
  audioTransport: null,
  streamHandle: null,
  isCleaning: false,
});

const getStreamState = (channelId: number): TStreamState => {
  const existing = streamStates.get(channelId);

  if (existing) return existing;

  const state = createDefaultState();

  streamStates.set(channelId, state);

  return state;
};

const getExistingStreamState = (
  channelId: number,
): TStreamState | undefined => {
  return streamStates.get(channelId);
};

const cleanupChannel = (channelId: number): void => {
  const state = streamStates.get(channelId);

  if (!state || state.isCleaning) return;

  state.isCleaning = true;

  try {
    killFFmpegProcesses(state.processes);

    state.processes = {};

    state.streamHandle?.remove?.();
    state.streamHandle = null;

    state.videoProducer?.close();
    state.audioProducer?.close();
    state.videoTransport?.close();
    state.audioTransport?.close();

    state.videoProducer = null;
    state.audioProducer = null;
    state.videoTransport = null;
    state.audioTransport = null;

    state.streamActive = false;
    state.streamStarting = false;
  } finally {
    state.isCleaning = false;
    streamStates.delete(channelId);
  }
};

const cleanupAll = (): void => {
  for (const channelId of streamStates.keys()) {
    cleanupChannel(channelId);
  }
};

export {
  cleanupAll,
  cleanupChannel,
  getExistingStreamState,
  getStreamState,
  streamStates,
};

export type { TStreamState };
