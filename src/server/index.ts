import {
  createRegisterCommand,
  type PluginContext,
} from "@sharkord/plugin-sdk";
import type { Commands } from "../contracts/commands";
import { zPlayStreamCommand, zStartStreamCommand } from "../types";
import { assertBinariesReady, startBinaryBootstrap } from "./binaries";
import { findClosestChannel, loadPlaylist } from "./playlist";
import {
  cleanupAll,
  cleanupChannel,
  getExistingStreamState,
} from "./stream-state";
import { startStream } from "./streaming";

const onLoad = async (ctx: PluginContext) => {
  startBinaryBootstrap(ctx);

  ctx.log("IPTV plugin loaded");

  const registerCommand = createRegisterCommand<Commands>(ctx);

  const settings = await ctx.settings.register([
    {
      key: "playlist",
      name: "Playlist URL",
      description: "The contents of the playlist .m3u file",
      type: "string",
      defaultValue: "",
    },
  ]);

  registerCommand(
    "iptv_play_direct",
    {
      args: [
        {
          name: "sourceUrl",
          description:
            "The source URL of the stream. Note that this must be a direct link to a media stream, not a playlist.",
          type: "string",
          required: true,
          sensitive: true,
        },
        {
          name: "streamName",
          description: "The name of the stream",
          type: "string",
          required: false,
        },
      ],
      description: "Play an IPTV stream directly from a source URL",
    },
    async (invoker, input) => {
      await assertBinariesReady();

      const { sourceUrl, streamName } = zStartStreamCommand.parse(input);

      await startStream(ctx, invoker, sourceUrl, streamName);
    },
  );

  registerCommand(
    "iptv_play",
    {
      args: [
        {
          name: "channelName",
          description: "The name of the channel to play from the playlist",
          type: "string",
          required: true,
        },
      ],
      description:
        "Play an IPTV stream by selecting a channel from the provided playlist",
    },
    async (invoker, input) => {
      await assertBinariesReady();

      const { channelName } = zPlayStreamCommand.parse(input);
      const rawPlaylist = settings.get("playlist").trim();

      if (!rawPlaylist) {
        throw new Error("Playlist is empty. Add it in plugin settings.");
      }

      loadPlaylist(rawPlaylist);

      const item = findClosestChannel(channelName);

      ctx.log('Found channel match for "', channelName, '":', item?.name);

      if (!item?.url) {
        throw new Error(
          `No channel match found for "${channelName}" in the playlist.`,
        );
      }

      const displayName = item.name || item.tvg?.name || channelName;

      await startStream(ctx, invoker, item.url, displayName, item.tvg?.logo);
    },
  );

  registerCommand(
    "iptv_stop",
    {
      description:
        "Stop the currently active IPTV stream in your voice channel",
    },
    async (invoker) => {
      if (invoker.currentVoiceChannelId === undefined) {
        throw new Error("You must be in a voice channel to stop a stream.");
      }

      const state = getExistingStreamState(invoker.currentVoiceChannelId);

      if (!state?.streamActive) {
        ctx.log("No active stream to stop in this channel.");
        return;
      }

      ctx.log(
        `Stopping IPTV stream in channel ${invoker.currentVoiceChannelId}`,
      );

      cleanupChannel(invoker.currentVoiceChannelId);

      ctx.log(
        `IPTV stream stopped in channel ${invoker.currentVoiceChannelId}`,
      );
    },
  );

  registerCommand(
    "iptv_clean",
    {
      description: "Stop all active IPTV streams in all channels",
    },
    async () => {
      ctx.log("Cleaning up all IPTV streams");
      cleanupAll();
      ctx.log("All IPTV streams cleaned up");
    },
  );
};

const onUnload = (ctx: PluginContext) => {
  cleanupAll();
  ctx.log("IPTV plugin unloaded");
};

export { onLoad, onUnload };
