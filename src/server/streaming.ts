import type { PluginContext, TInvokerContext } from "@sharkord/plugin-sdk";
import { spawnFFmpeg } from "./ffmpeg";
import { cleanupChannel, getStreamState, streamStates } from "./stream-state";
import { addOnceListener } from "./utils";

const VIDEO_SSRC = 11_111_111;
const AUDIO_SSRC = 22_222_222;
const VIDEO_PAYLOAD_TYPE = 102;
const AUDIO_PAYLOAD_TYPE = 111;
const DEFAULT_STREAM_TITLE = "IPTV";
const DEFAULT_AVATAR_URL = "https://i.imgur.com/ozINkq3.jpeg";

const startStream = async (
  ctx: PluginContext,
  invoker: TInvokerContext,
  sourceUrl: string,
  streamName?: string,
  streamImageUrl?: string,
): Promise<void> => {
  if (invoker.currentVoiceChannelId === undefined) {
    throw new Error("You must be in a voice channel to start a stream.");
  }

  const channelId = invoker.currentVoiceChannelId;
  const state = getStreamState(channelId);

  if (state.streamActive) {
    throw new Error(
      "A stream is already active. Stop it before starting a new one.",
    );
  }

  if (state.streamStarting) {
    throw new Error("A stream is already starting. Please wait.");
  }

  ctx.log("Voice runtime initialized in IPTV plugin");

  const router = ctx.voice.getRouter(channelId);

  if (!router) {
    ctx.log("No router found for channel:", channelId);
    return;
  }

  state.streamStarting = true;

  try {
    const { announcedAddress, ip } = await ctx.voice.getListenInfo();

    ctx.log("Listen Info:", { announcedAddress, ip });

    addOnceListener(router, "@close", () => {
      ctx.log("Router closed, cleaning up");
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

    ctx.log("Video RTP ingest on port", state.videoTransport.tuple.localPort);
    ctx.log("Audio RTP ingest on port", state.audioTransport.tuple.localPort);

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
      title: streamName ?? DEFAULT_STREAM_TITLE,
      avatarUrl: streamImageUrl ?? DEFAULT_AVATAR_URL,
      producers: {
        video: state.videoProducer,
        audio: state.audioProducer,
      },
    });

    const { videoProducer, audioProducer } = state;

    addOnceListener(videoProducer?.observer, "close", () => {
      ctx.log("IPTV video producer closed:", videoProducer!.id);
      cleanupChannel(channelId);
    });

    addOnceListener(audioProducer?.observer, "close", () => {
      ctx.log("IPTV audio producer closed:", audioProducer!.id);
      cleanupChannel(channelId);
    });

    try {
      state.processes = await spawnFFmpeg(ctx.path, {
        sourceUrl,
        videoPayloadType: VIDEO_PAYLOAD_TYPE,
        audioPayloadType: AUDIO_PAYLOAD_TYPE,
        videoSsrc: VIDEO_SSRC,
        audioSsrc: AUDIO_SSRC,
        rtpHost: ip,
        videoRtpPort: state.videoTransport.tuple.localPort,
        audioRtpPort: state.audioTransport.tuple.localPort,
        packetSize: 1200,
        log: (...messages: unknown[]) => ctx.debug("[FFmpeg]", ...messages),
        error: (...messages: unknown[]) => ctx.error("[FFmpeg]", ...messages),
      });
    } catch (error) {
      cleanupChannel(channelId);
      throw error;
    }

    state.streamActive = true;
  } finally {
    const currentState = streamStates.get(channelId);

    if (currentState) {
      currentState.streamStarting = false;
    }
  }
};

export { startStream };
