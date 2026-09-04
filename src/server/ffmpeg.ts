import fs from "fs/promises";
import path from "path";
import { getFfmpegBinaryPath, getHlsDir } from "./paths";
import { pipeStreamToLogger } from "./utils";

// a lot of vibes going on this file
// i don't even know if this is efficient or the best way to do this, but it's kinda working

type TLogger = {
  log: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
};

type TSpawnOptions = {
  channelId: number;
  sourceUrl: string;
  videoPayloadType: number;
  audioPayloadType: number;
  videoSsrc: number;
  audioSsrc: number;
  rtpHost: string;
  videoRtpPort: number;
  audioRtpPort: number;
  packetSize: number;
} & TLogger;

type TProcessPair = {
  hls?: ReturnType<typeof Bun.spawn>;
  videoRtp?: ReturnType<typeof Bun.spawn> | null;
  audioRtp?: ReturnType<typeof Bun.spawn> | null;
};

const buildHlsArgs = (
  sourceUrl: string,
  hlsDir: string,
  hlsPlaylist: string,
): string[] => [
  "-reconnect",
  "1",
  "-reconnect_streamed",
  "1",
  "-reconnect_on_network_error",
  "1",
  "-reconnect_delay_max",
  "5",
  "-timeout",
  "10000000",
  "-user_agent",
  "Mozilla/5.0",

  "-fflags",
  "+genpts+discardcorrupt",
  "-err_detect",
  "ignore_err",

  "-i",
  sourceUrl,

  // deinterlace
  "-vf",
  "yadif=1:-1:0",

  // transcode to H264 baseline (done once here)
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-tune",
  "zerolatency",
  "-profile:v",
  "baseline",
  "-level",
  "3.1",
  "-pix_fmt",
  "yuv420p",

  // bitrate
  "-b:v",
  "2500k",
  "-maxrate",
  "3000k",
  "-bufsize",
  "6000k",

  "-g",
  "50",
  "-sc_threshold",
  "0",
  "-r",
  "25",

  // audio -> opus
  "-c:a",
  "libopus",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-b:a",
  "128k",

  // HLS output
  "-f",
  "hls",
  "-hls_time",
  "2",
  "-hls_list_size",
  "15",
  "-hls_flags",
  "delete_segments+append_list",
  "-hls_segment_type",
  "mpegts",
  "-hls_segment_filename",
  path.join(hlsDir, "segment_%03d.ts"),
  "-start_number",
  "0",

  hlsPlaylist,
];

const buildRtpArgs = (
  hlsPlaylist: string,
  kind: "video" | "audio",
  payloadType: number,
  ssrc: number,
  host: string,
  port: number,
): string[] => {
  const isVideo = kind === "video";

  return [
    "-re",
    "-stream_loop",
    "-1",

    "-i",
    hlsPlaylist,

    "-map",
    isVideo ? "0:v:0" : "0:a:0",
    isVideo ? "-an" : "-vn",

    // copy — already transcoded in the HLS stage
    isVideo ? "-c:v" : "-c:a",
    "copy",

    "-payload_type",
    payloadType.toString(),
    "-ssrc",
    ssrc.toString(),
    "-f",
    "rtp",
    `rtp://${host}:${port}?pkt_size=1200`,
  ];
};

const prepareHlsDir = async (hlsDir: string): Promise<void> => {
  try {
    const entries = await fs.readdir(hlsDir);

    await Promise.all(
      entries.map((file) => fs.unlink(path.join(hlsDir, file))),
    );
  } catch {
    // Directory doesn't exist — create it
    await fs.mkdir(hlsDir, { recursive: true });
  }
};

const waitForHls = async (
  playlistPath: string,
  process: ReturnType<typeof Bun.spawn>,
  minSegments = 4,
  timeout = 30_000,
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const content = await fs.readFile(playlistPath, "utf8");
      const segmentCount = (content.match(/\.ts/g) ?? []).length;

      if (segmentCount >= minSegments) {
        await Bun.sleep(2_000);
        return;
      }
    } catch {
      // File doesn't exist yet — keep waiting
    }

    // polling the file alone waits out the full timeout when ffmpeg is already
    // gone, which is every bad source url and every stop during the warmup
    if (process.exitCode !== null) {
      throw new Error(
        `FFmpeg exited with code ${process.exitCode} before the HLS buffer was ready. Check the plugin logs.`,
      );
    }

    await Bun.sleep(500);
  }

  throw new Error("HLS playlist not created within timeout");
};

const spawnWithLogging = (
  cmd: string[],
  label: string,
  logger: TLogger,
): ReturnType<typeof Bun.spawn> => {
  const proc = Bun.spawn({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  pipeStreamToLogger(
    proc.stdout,
    (text) => logger.log(`[${label} stdout]`, text),
    (err) => logger.error(`[${label} stdout error]`, err),
  );

  pipeStreamToLogger(
    proc.stderr,
    (text) => logger.log(`[${label} stderr]`, text),
    (err) => logger.error(`[${label} stderr error]`, err),
  );

  return proc;
};

const spawnFFmpeg = async (options: TSpawnOptions): Promise<TProcessPair> => {
  const binaryPath = getFfmpegBinaryPath();
  const logger: TLogger = { log: options.log, error: options.error };

  logger.log(`Binary path: ${binaryPath}`);

  const hlsDir = getHlsDir(options.channelId);
  const hlsPlaylist = path.join(hlsDir, "stream.m3u8");

  await prepareHlsDir(hlsDir);

  logger.log("Starting HLS buffer creation...");

  const hlsArgs = buildHlsArgs(options.sourceUrl, hlsDir, hlsPlaylist);
  const hlsProcess = spawnWithLogging([binaryPath, ...hlsArgs], "HLS", logger);

  logger.log("Waiting for HLS playlist...");
  await waitForHls(hlsPlaylist, hlsProcess, 4);
  logger.log("HLS playlist ready with buffer!");

  logger.log("Starting video RTP stream from HLS...");

  const videoRtpArgs = buildRtpArgs(
    hlsPlaylist,
    "video",
    options.videoPayloadType,
    options.videoSsrc,
    options.rtpHost,
    options.videoRtpPort,
  );

  const videoRtpProcess = spawnWithLogging(
    [binaryPath, ...videoRtpArgs],
    "Video RTP",
    logger,
  );

  logger.log("Starting audio RTP stream from HLS...");

  const audioRtpArgs = buildRtpArgs(
    hlsPlaylist,
    "audio",
    options.audioPayloadType,
    options.audioSsrc,
    options.rtpHost,
    options.audioRtpPort,
  );

  const audioRtpProcess = spawnWithLogging(
    [binaryPath, ...audioRtpArgs],
    "Audio RTP",
    logger,
  );

  return {
    hls: hlsProcess,
    videoRtp: videoRtpProcess,
    audioRtp: audioRtpProcess,
  };
};

const killFFmpegProcesses = (processes: TProcessPair): void => {
  processes.videoRtp?.kill();
  processes.audioRtp?.kill();
  processes.hls?.kill();
};

export { killFFmpegProcesses, spawnFFmpeg };
export type { TProcessPair, TSpawnOptions };
