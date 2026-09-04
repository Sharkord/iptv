import {
  Permission,
  PluginSlot,
  type PluginContext,
  type UnloadPluginContext,
} from "@sharkord/plugin-sdk";
import type { PlaylistItem } from "iptv-playlist-parser";
import type { TSharkord } from "../contract";
import { assertBinariesReady, startBinaryBootstrap } from "./binaries";
import {
  findClosestChannel,
  getChannelAt,
  invalidatePlaylist,
  loadPlaylist,
  toChannels,
} from "./playlist";
import { setDataDir } from "./paths";
import {
  cleanupAll,
  cleanupChannel,
  getExistingStreamState,
  getStreamSnapshot,
  publishStreamState,
  setStreamNotifier,
} from "./stream-state";
import { startStream } from "./streaming";
import { getErrorMessage } from "./utils";

type TIptvContext = PluginContext<TSharkord>;

const PLAYLIST_SETTING = "playlistUrl";

const requireText = (value: unknown, message: string): string => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) throw new Error(message);

  return text;
};

const requireHttpUrl = (value: unknown): string => {
  const url = requireText(value, "A source URL is required.");

  if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
    throw new Error("The source URL must be an http(s) URL.");
  }

  return url;
};

const requireVoiceChannelId = (
  channelId: number | undefined,
  message: string,
): number => {
  if (!channelId) throw new Error(message);

  return channelId;
};

const onLoad = async (ctx: TIptvContext) => {
  setDataDir(ctx.dataPath);
  startBinaryBootstrap(ctx.logger);

  ctx.logger.log("IPTV plugin loaded");

  ctx.ui.enable({ [PluginSlot.TOPBAR_RIGHT]: Permission.MANAGE_PLUGINS });

  const settings = await ctx.settings.register([
    {
      key: PLAYLIST_SETTING,
      name: "Playlist URL",
      description:
        "URL of the .m3u playlist to load channels from. Provider URLs usually carry credentials, so it is stored write-only.",
      type: "secret",
      defaultValue: "",
    },
  ] as const);

  const getPlaylistUrl = (): string =>
    String(settings.get(PLAYLIST_SETTING) ?? "");

  setStreamNotifier((channelId, error) => {
    ctx.push.toAll({
      channelId,
      stream: getStreamSnapshot(channelId),
      error: error ?? null,
    });
  });

  ctx.events.on("voice:runtime_closed", ({ channelId }) => {
    cleanupChannel(channelId);
  });

  ctx.events.on("setting:set", ({ key }) => {
    if (key !== PLAYLIST_SETTING) return;

    invalidatePlaylist();
    ctx.logger.log("Playlist URL changed, cached channels dropped");
  });

  const beginStream = (
    voiceChannelId: number,
    options: { sourceUrl: string; title: string; logoUrl?: string | null },
  ): string => {
    startStream(ctx, { channelId: voiceChannelId, ...options }).catch(
      (error: unknown) => {
        ctx.logger.error("Failed to start the IPTV stream", error);
        // startStream has already torn its own half-built stream down
        publishStreamState(voiceChannelId, getErrorMessage(error));
      },
    );

    return options.title;
  };

  const beginPlaylistStream = (
    voiceChannelId: number,
    item: PlaylistItem,
  ): string =>
    beginStream(voiceChannelId, {
      sourceUrl: item.url,
      title: item.name || item.tvg?.name || "IPTV",
      logoUrl: item.tvg?.logo || null,
    });

  ctx.actions.register({
    name: "getChannels",
    description: "Lists the channels in the configured playlist",
    requires: Permission.MANAGE_PLUGINS,
    executes: async (_invoker, payload) => {
      try {
        const items = await loadPlaylist(getPlaylistUrl(), {
          refresh: payload?.refresh,
        });

        return { channels: toChannels(items), error: null };
      } catch (error) {
        return { channels: [], error: getErrorMessage(error) };
      }
    },
  });

  ctx.actions.register({
    name: "getStreamState",
    description: "Reads what is streaming in the caller's voice channel",
    requires: Permission.MANAGE_PLUGINS,
    executes: async (invoker) =>
      getStreamSnapshot(invoker.currentVoiceChannelId),
  });

  ctx.actions.register({
    name: "playChannel",
    description: "Streams a playlist channel into the caller's voice channel",
    requires: Permission.MANAGE_PLUGINS,
    executes: async (invoker, payload) => {
      await assertBinariesReady();

      const voiceChannelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "Join a voice channel before starting a stream.",
      );

      await loadPlaylist(getPlaylistUrl());

      const item = getChannelAt(payload.id);

      if (!item) {
        throw new Error("That channel is no longer in the playlist. Refresh.");
      }

      beginPlaylistStream(voiceChannelId, item);

      return getStreamSnapshot(voiceChannelId);
    },
  });

  ctx.actions.register({
    name: "stopStream",
    description: "Stops the stream in the caller's voice channel",
    requires: Permission.MANAGE_PLUGINS,
    executes: async (invoker) => {
      const voiceChannelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "Join a voice channel to stop its stream.",
      );

      cleanupChannel(voiceChannelId);

      return getStreamSnapshot(voiceChannelId);
    },
  });

  ctx.commands.register({
    name: "iptv_play",
    description: "Play a channel from the playlist by name",
    requires: Permission.JOIN_VOICE_CHANNELS,
    args: [
      {
        name: "channelName",
        description: "The name of the channel to play from the playlist",
        type: "string",
        required: true,
      },
    ],
    executes: async (invoker, args) => {
      await assertBinariesReady();

      const query = requireText(
        args.channelName,
        "A channel name is required.",
      );
      const voiceChannelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "Join a voice channel before starting a stream.",
      );

      await loadPlaylist(getPlaylistUrl());

      const item = findClosestChannel(query);

      if (!item?.url) {
        throw new Error(`No channel matching "${query}" is in the playlist.`);
      }

      return `Starting ${beginPlaylistStream(voiceChannelId, item)}...`;
    },
  });

  ctx.commands.register({
    name: "iptv_play_direct",
    description: "Play an IPTV stream straight from a media URL",
    requires: Permission.MANAGE_PLUGINS,
    args: [
      {
        name: "sourceUrl",
        description: "A direct link to a media stream, not to a playlist.",
        type: "string",
        required: true,
        sensitive: true,
      },
      {
        name: "streamName",
        description: "The name shown to viewers",
        type: "string",
        required: false,
      },
    ],
    executes: async (invoker, args) => {
      await assertBinariesReady();

      const sourceUrl = requireHttpUrl(args.sourceUrl);
      const voiceChannelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "Join a voice channel before starting a stream.",
      );
      const title =
        typeof args.streamName === "string" && args.streamName.trim()
          ? args.streamName.trim()
          : "IPTV";

      return `Starting ${beginStream(voiceChannelId, { sourceUrl, title })}...`;
    },
  });

  ctx.commands.register({
    name: "iptv_stop",
    description: "Stop the stream in your voice channel",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker) => {
      const voiceChannelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "Join a voice channel to stop its stream.",
      );

      if (!getExistingStreamState(voiceChannelId)) {
        return "Nothing is streaming in this channel.";
      }

      cleanupChannel(voiceChannelId);

      return "Stopped the stream.";
    },
  });

  ctx.commands.register({
    name: "iptv_clean",
    description: "Stop every IPTV stream on the server",
    requires: Permission.MANAGE_PLUGINS,
    executes: async () => {
      cleanupAll();

      return "Stopped every IPTV stream.";
    },
  });
};

const onUnload = (ctx: UnloadPluginContext) => {
  setStreamNotifier(() => {});

  cleanupAll();
  invalidatePlaylist();

  ctx.logger.log("IPTV plugin unloaded");
};

export { onLoad, onUnload };
