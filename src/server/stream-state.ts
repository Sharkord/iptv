import type {
  AppData,
  PlainTransport,
  Producer,
  TExternalStreamHandle,
} from "@sharkord/plugin-sdk";
import fs from "fs/promises";
import type { StreamSnapshot } from "../contract";
import { killFFmpegProcesses, type TProcessPair } from "./ffmpeg";
import { getHlsDir } from "./paths";

type TStreamState = {
  processes: TProcessPair;
  streamActive: boolean;
  streamStarting: boolean;
  channelName: string | null;
  channelLogo: string | null;
  videoProducer: Producer | null;
  audioProducer: Producer | null;
  videoTransport: PlainTransport<AppData> | null;
  audioTransport: PlainTransport<AppData> | null;
  streamHandle: TExternalStreamHandle | null;
  isCleaning: boolean;
};

const IDLE_SNAPSHOT: StreamSnapshot = {
  streamActive: false,
  streamStarting: false,
  channelName: null,
  channelLogo: null,
};

const streamStates = new Map<number, TStreamState>();

let notify: (channelId: number, error?: string) => void = () => {};

const setStreamNotifier = (
  handler: (channelId: number, error?: string) => void,
): void => {
  notify = handler;
};

const publishStreamState = (channelId: number, error?: string): void =>
  notify(channelId, error);

const createDefaultState = (): TStreamState => ({
  processes: {},
  streamActive: false,
  streamStarting: false,
  channelName: null,
  channelLogo: null,
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

const getExistingStreamState = (channelId: number): TStreamState | undefined =>
  streamStates.get(channelId);

const getStreamSnapshot = (channelId: number | undefined): StreamSnapshot => {
  const state =
    channelId === undefined ? undefined : streamStates.get(channelId);

  if (!state) return IDLE_SNAPSHOT;

  return {
    streamActive: state.streamActive,
    streamStarting: state.streamStarting,
    channelName: state.channelName,
    channelLogo: state.channelLogo,
  };
};

/** false when there was nothing to tear down, so callers can tell a stop apart */
const cleanupChannel = (channelId: number, error?: string): boolean => {
  const state = streamStates.get(channelId);

  if (!state || state.isCleaning) return false;

  state.isCleaning = true;

  try {
    killFFmpegProcesses(state.processes);

    state.processes = {};

    try {
      state.streamHandle?.remove();
    } catch {}

    state.videoProducer?.close();
    state.audioProducer?.close();
    state.videoTransport?.close();
    state.audioTransport?.close();

    state.videoProducer = null;
    state.audioProducer = null;
    state.videoTransport = null;
    state.audioTransport = null;
    state.streamHandle = null;

    state.streamActive = false;
    state.streamStarting = false;
    state.channelName = null;
    state.channelLogo = null;
  } finally {
    state.isCleaning = false;
    streamStates.delete(channelId);
  }

  fs.rm(getHlsDir(channelId), { recursive: true, force: true }).catch(() => {});

  notify(channelId, error);

  return true;
};

const cleanupAll = (): void => {
  for (const channelId of [...streamStates.keys()]) {
    cleanupChannel(channelId);
  }
};

export {
  cleanupAll,
  cleanupChannel,
  getExistingStreamState,
  getStreamSnapshot,
  getStreamState,
  publishStreamState,
  setStreamNotifier,
  streamStates,
};

export type { TStreamState };
