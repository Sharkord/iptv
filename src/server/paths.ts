import path from "path";

let dataDir = "";

const setDataDir = (value: string): void => {
  dataDir = value;
};

const getBinDir = (): string => path.join(dataDir, "bin");

const getDownloadDir = (): string => path.join(dataDir, "downloads");

const getHlsDir = (channelId: number): string =>
  path.join(dataDir, "hls", String(channelId));

const getFfmpegBinaryPath = (): string =>
  path.join(
    getBinDir(),
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );

export {
  getBinDir,
  getDownloadDir,
  getFfmpegBinaryPath,
  getHlsDir,
  setDataDir,
};
