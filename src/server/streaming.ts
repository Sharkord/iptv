import type { PluginContext, Router } from "@sharkord/plugin-sdk";
import { spawnFFmpeg } from "./ffmpeg";
import {
  cleanupChannel,
  getExistingStreamState,
  getStreamState,
  publishStreamState,
  streamStates,
  type TStreamState,
} from "./stream-state";

const VIDEO_SSRC = 11_111_111;
const AUDIO_SSRC = 22_222_222;
const VIDEO_PAYLOAD_TYPE = 102;
const AUDIO_PAYLOAD_TYPE = 111;
const DEFAULT_STREAM_TITLE = "IPTV";
const DEFAULT_AVATAR_URL = "https://i.imgur.com/ozINkq3.jpeg";

type TStartOptions = {
  channelId: number;
  sourceUrl: string;
  title?: string;
  logoUrl?: string | null;
};

const runStream = async (
  ctx: PluginContext,
  router: Router,
  state: TStreamState,
  channelId: number,
  sourceUrl: string,
): Promise<void> => {
  try {
    const { announcedAddress, ip } = ctx.voice.getListenInfo();

    ctx.logger.debug("Listen info:", { announcedAddress, ip });

    router.once("@close", () => {
      ctx.logger.log("Router closed, cleaning up channel", channelId);
      cleanupChannel(channelId);
    });

    state.videoTransport = await router.createPlainTransport({
      listenInfo: {
        ip,
        protocol: "udp",
        announcedAddress,
      },
      rtcpMux: false,
      comedia: true,
      enableSrtp: false,
    });

    state.audioTransport = await router.createPlainTransport({
      listenIp: {
        ip,
        announcedIp: announcedAddress,
      },
      rtcpMux: true,
      comedia: true,
      enableSrtp: false,
    });

    ctx.logger.debug(
      "RTP ingest ports",
      state.videoTransport.tuple.localPort,
      state.audioTransport.tuple.localPort,
    );

    state.videoProducer = await state.videoTransport.produce({
      kind: "video",
      rtpParameters: {
        codecs: [
          {
            mimeType: "video/H264",
            payloadType: VIDEO_PAYLOAD_TYPE,
            clockRate: 90_000,
            parameters: {
              "packetization-mode": 1,
              "profile-level-id": "42e01f",
              "level-asymmetry-allowed": 1,
              "x-google-start-bitrate": 1000,
            },
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: VIDEO_SSRC }],
      },
    });

    state.audioProducer = await state.audioTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            payloadType: AUDIO_PAYLOAD_TYPE,
            clockRate: 48_000,
            channels: 2,
            parameters: {},
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: AUDIO_SSRC }],
      },
    });

    state.streamHandle = ctx.voice.createStream({
      key: "stream",
      channelId,
      title: state.channelName ?? DEFAULT_STREAM_TITLE,
      avatarUrl: state.channelLogo ?? DEFAULT_AVATAR_URL,
      producers: {
        video: state.videoProducer,
        audio: state.audioProducer,
      },
    });

    const { videoProducer, audioProducer } = state;

    videoProducer.observer.once("close", () => {
      ctx.logger.debug("Video producer closed:", videoProducer.id);
      cleanupChannel(channelId);
    });

    audioProducer.observer.once("close", () => {
      ctx.logger.debug("Audio producer closed:", audioProducer.id);
      cleanupChannel(channelId);
    });

    state.processes = await spawnFFmpeg({
      channelId,
      sourceUrl,
      videoPayloadType: VIDEO_PAYLOAD_TYPE,
      audioPayloadType: AUDIO_PAYLOAD_TYPE,
      videoSsrc: VIDEO_SSRC,
      audioSsrc: AUDIO_SSRC,
      rtpHost: ip,
      videoRtpPort: state.videoTransport.tuple.localPort,
      audioRtpPort: state.audioTransport.tuple.localPort,
      packetSize: 1200,
      log: (...messages: unknown[]) =>
        ctx.logger.debug("[FFmpeg]", ...messages),
      error: (...messages: unknown[]) =>
        ctx.logger.error("[FFmpeg]", ...messages),
    });

    state.streamActive = true;
  } catch (error) {
    if (cleanupChannel(channelId)) throw error;

    ctx.logger.debug("Start aborted for channel", channelId);
  } finally {
    const currentState = streamStates.get(channelId);

    if (currentState) {
      currentState.streamStarting = false;

      publishStreamState(channelId);
    }
  }
};

const startStream = (
  ctx: PluginContext,
  { channelId, sourceUrl, title, logoUrl }: TStartOptions,
): Promise<void> => {
  const existing = getExistingStreamState(channelId);

  if (existing?.streamActive) {
    throw new Error(
      "A stream is already active in this channel. Stop it before starting another.",
    );
  }

  if (existing?.streamStarting) {
    throw new Error("A stream is already starting. Please wait.");
  }

  // throws when the channel has no live voice runtime, before any state is kept
  const router = ctx.voice.getRouter(channelId);
  const state = getStreamState(channelId);

  state.streamStarting = true;
  state.channelName = title ?? DEFAULT_STREAM_TITLE;
  state.channelLogo = logoUrl ?? null;

  // the panel needs its stop button now, not when the warmup finishes
  publishStreamState(channelId);

  return runStream(ctx, router, state, channelId, sourceUrl);
};

export { startStream };
