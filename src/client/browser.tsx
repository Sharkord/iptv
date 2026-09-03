// deep imports: the "@sharkord/ui" barrel drags every component, and all of
// radix and lucide with it, into a bundle that only wants two of them
import { Button } from "@sharkord/ui/src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@sharkord/ui/src/components/popover";
import { memo, useDeferredValue, useMemo, useState } from "react";
import type { IptvChannel } from "../contract";
import { panelStyle } from "./styles";
import { useIptv } from "./use-iptv";

const MAX_TILES = 256;

type IconProps = { size?: number };

const TvIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.7 2.3 12 5.6l3.3-3.3 1.4 1.4L14.8 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.2L7.3 3.7l1.4-1.4zM4 8v10h16V8H4z" />
  </svg>
);

const RefreshIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
  </svg>
);

type ChannelTileProps = {
  channel: IptvChannel;
  isOnAir: boolean;
  disabled: boolean;
  onPlay: (id: number) => void;
};

const ChannelTile = ({
  channel,
  isOnAir,
  disabled,
  onPlay,
}: ChannelTileProps) => {
  // playlist logos rot constantly, so a broken one falls back rather than
  // leaving the browser's own broken-image glyph in the grid
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = channel.logo !== null && !logoFailed;

  return (
    <button
      type="button"
      className={isOnAir ? "iptv-tile iptv-tile-on" : "iptv-tile"}
      title={channel.name}
      disabled={disabled}
      onClick={() => onPlay(channel.id)}
    >
      <span className="iptv-thumb">
        {showLogo ? (
          <img
            src={channel.logo ?? undefined}
            alt=""
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <TvIcon size={22} />
        )}
      </span>

      <span className="iptv-tile-name">{channel.name}</span>
      {channel.group ? (
        <span className="iptv-tile-group">{channel.group}</span>
      ) : null}
    </button>
  );
};

type PanelProps = {
  controller: ReturnType<typeof useIptv>;
};

const ChannelBrowser = ({ controller }: PanelProps) => {
  const {
    canBrowse,
    canPlay,
    canStop,
    channels,
    error,
    isBusy,
    isDisconnected,
    isLoading,
    listError,
    play,
    refresh,
    stop,
    stream,
  } = controller;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  // typing stays responsive while the filter runs over the whole playlist
  const deferredQuery = useDeferredValue(query);

  const groups = useMemo(() => {
    const seen = new Set<string>();

    for (const channel of channels) {
      if (channel.group) seen.add(channel.group);
    }

    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [channels]);

  const matches = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return channels.filter(
      (channel) =>
        (group === "" || channel.group === group) &&
        (needle === "" || channel.name.toLowerCase().includes(needle)),
    );
  }, [channels, deferredQuery, group]);

  const visible = matches.slice(0, MAX_TILES);
  const isStarting = stream.streamStarting;
  const isOnAir = stream.streamActive || isStarting;
  const canStartNow = canPlay && !isBusy && !isDisconnected && !isOnAir;

  // one line saying why the grid is inert beats every tile looking broken
  const blockedReason = !canBrowse
    ? "You do not have access to this plugin's channel list."
    : !canPlay
      ? "You do not have access to start streams."
      : isDisconnected
        ? "Join a voice channel to start a stream."
        : "";

  return (
    <div className="iptv-panel">
      <div className="iptv-head">
        <span className="iptv-head-title">Channels</span>
        <span className="iptv-head-count">
          {isLoading ? "Loading..." : `${matches.length} of ${channels.length}`}
        </span>
        <button
          type="button"
          className="iptv-icon-btn"
          title="Reload the playlist"
          aria-label="Reload the playlist"
          disabled={isLoading || !canBrowse}
          onClick={refresh}
        >
          <span className={isLoading ? "iptv-spin" : undefined}>
            <RefreshIcon />
          </span>
        </button>
      </div>

      {isOnAir ? (
        <div className="iptv-onair">
          <span className="iptv-onair-art">
            {stream.channelLogo ? (
              <img src={stream.channelLogo} alt="" />
            ) : (
              <TvIcon size={20} />
            )}
          </span>

          <span>
            <span className="iptv-onair-label">
              <span className="iptv-live" />
              {isStarting ? "Starting" : "On air"}
            </span>
            <span className="iptv-onair-name">
              {stream.channelName ?? "IPTV"}
            </span>
          </span>

          <button
            type="button"
            className="iptv-stop"
            title={
              canStop
                ? "Stop the stream"
                : "You do not have access to stop streams."
            }
            disabled={isBusy || !canStop}
            onClick={stop}
          >
            Stop
          </button>
        </div>
      ) : null}

      <div className="iptv-filters">
        <input
          className="iptv-input"
          value={query}
          placeholder="Filter channels"
          aria-label="Filter channels"
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          className="iptv-select"
          value={group}
          aria-label="Filter by group"
          onChange={(event) => setGroup(event.target.value)}
        >
          <option value="">All groups</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {listError ? (
        <div className="iptv-note iptv-note-error">{listError}</div>
      ) : null}
      {error ? <div className="iptv-note iptv-note-error">{error}</div> : null}
      {blockedReason ? <div className="iptv-note">{blockedReason}</div> : null}

      {visible.length > 0 ? (
        <div className="iptv-grid">
          {visible.map((channel) => (
            <ChannelTile
              key={channel.id}
              channel={channel}
              isOnAir={isOnAir && stream.channelName === channel.name}
              disabled={!canStartNow}
              onPlay={play}
            />
          ))}
        </div>
      ) : (
        <div className="iptv-note">
          {!canBrowse
            ? "Nothing to show."
            : isLoading
              ? "Loading the playlist..."
              : listError
                ? "No channels to show."
                : "Nothing matches that filter."}
        </div>
      )}

      {matches.length > visible.length ? (
        <div className="iptv-note">
          Showing the first {visible.length} of {matches.length}. Narrow the
          filter to see the rest.
        </div>
      ) : null}
    </div>
  );
};

const ChannelBrowserPopover = memo(() => {
  const [open, setOpen] = useState(false);
  const controller = useIptv();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="IPTV channels"
          style={{ position: "relative" }}
        >
          <TvIcon size={20} />
          {controller.stream.streamActive ? (
            <span className="iptv-dot" />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" style={panelStyle}>
        <ChannelBrowser controller={controller} />
      </PopoverContent>
    </Popover>
  );
});

export { ChannelBrowserPopover };
