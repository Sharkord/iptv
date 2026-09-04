import {
  createCallAction,
  useCanUseAction,
  usePush,
  useStoreSelector,
  type TPluginStoreState,
} from "@sharkord/plugin-sdk/client";
import { useCallback, useEffect, useState } from "react";
import type { IptvChannel, StreamSnapshot, TSharkord } from "../contract";

const callAction = createCallAction<TSharkord>();

const EMPTY_STREAM: StreamSnapshot = {
  streamActive: false,
  streamStarting: false,
  channelName: null,
  channelLogo: null,
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong.";

const useIptv = () => {
  const currentVoiceChannelId = useStoreSelector(
    (state: TPluginStoreState) => state.currentVoiceChannelId,
  );
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [listError, setListError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState(EMPTY_STREAM);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // UX only: every one of these is checked again server side on the call itself
  const canBrowse = useCanUseAction<TSharkord>("getChannels");
  const canPlay = useCanUseAction<TSharkord>("playChannel");
  const canStop = useCanUseAction<TSharkord>("stopStream");

  // the server pushes on every change, so nothing here polls
  usePush<TSharkord>(({ channelId, stream: pushed, error: pushedError }) => {
    if (channelId !== currentVoiceChannelId) return;

    setStream(pushed);

    // a start that failed after the action already answered
    if (pushedError) setError(pushedError);
  });

  const loadChannels = useCallback(async (refresh = false) => {
    setIsLoading(true);

    try {
      const response = await callAction("getChannels", { refresh });

      setChannels(response.channels);
      setListError(response.error ?? "");
    } catch (err) {
      setListError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // the panel is hidden outside a voice channel, and the whole playlist is a
    // big payload to hand someone who cannot see it
    if (!canBrowse || !currentVoiceChannelId) {
      setIsLoading(false);

      return;
    }

    loadChannels();
  }, [canBrowse, currentVoiceChannelId, loadChannels]);

  useEffect(() => {
    setError("");

    if (!currentVoiceChannelId) {
      setStream(EMPTY_STREAM);

      return;
    }

    let cancelled = false;

    callAction("getStreamState")
      .then((snapshot) => {
        if (!cancelled) setStream(snapshot);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentVoiceChannelId]);

  const run = useCallback(async (call: () => Promise<StreamSnapshot>) => {
    setIsBusy(true);

    try {
      setStream(await call());
      // the panel already shows what changed, so only failures are worth text
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }, []);

  // stable identities: the grid holds every channel in the playlist, and a new
  // callback on each keystroke would re-render all of them
  const play = useCallback(
    (id: number) => {
      setError("");

      return run(() => callAction("playChannel", { id }));
    },
    [run],
  );

  const stop = useCallback(
    () => run(() => callAction("stopStream")),
    [run],
  );

  const refresh = useCallback(() => loadChannels(true), [loadChannels]);

  return {
    canBrowse,
    canPlay,
    canStop,
    channels,
    error,
    isBusy,
    isDisconnected: !currentVoiceChannelId,
    isLoading,
    listError,
    play,
    refresh,
    stop,
    stream,
  };
};

export { useIptv };
