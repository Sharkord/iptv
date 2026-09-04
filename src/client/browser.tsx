import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@sharkord/ui";
import { memo, useDeferredValue, useMemo, useState } from "react";
import type { IptvChannel } from "../contract";
import { panelStyle } from "./styles";
import { useIptv } from "./use-iptv";

const RotateCw = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-rotate-cw-icon lucide-rotate-cw"
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const Tv = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-tv-icon lucide-tv"
    {...props}
  >
    <path d="m17 2-5 5-5-5" />
    <rect width="20" height="15" x="2" y="7" rx="2" />
  </svg>
);

// radix refuses an empty string as an item value, so "no group filter" needs
// a sentinel of its own
const ALL_GROUPS = "__all";

type ChannelTileProps = {
  channel: IptvChannel;
  isOnAir: boolean;
  disabled: boolean;
  onPlay: (id: number) => void;
};

// a provider playlist runs to tens of thousands of entries and all of them are
// on screen, so a keystroke must not re-render every tile
// ponytail: memo plus content-visibility carries a few thousand tiles; past
// that the DOM node count itself is the cost and it wants real virtualisation
const ChannelTile = memo(
  ({ channel, isOnAir, disabled, onPlay }: ChannelTileProps) => {
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
            <Tv width={22} height={22} />
          )}
        </span>

        <span className="iptv-tile-name">{channel.name}</span>
        {channel.group ? (
          <span className="iptv-tile-group">{channel.group}</span>
        ) : null}
      </button>
    );
  },
);

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
  const [group, setGroup] = useState(ALL_GROUPS);
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
        (group === ALL_GROUPS || channel.group === group) &&
        (needle === "" || channel.name.toLowerCase().includes(needle)),
    );
  }, [channels, deferredQuery, group]);

  const isStarting = stream.streamStarting;
  const isOnAir = stream.streamActive || isStarting;
  const canStartNow = canPlay && !isBusy && !isDisconnected && !isOnAir;

  // one line saying why the grid is inert beats every tile looking broken
  const blockedReason = !canBrowse
    ? "You do not have access to this plugin's channel list."
    : !canPlay
      ? "You do not have access to start streams."
      : "";

  return (
    <div className="iptv-panel">
      <div className="iptv-head">
        <span className="iptv-head-title">Channels</span>
        <span className="iptv-head-count">
          {isLoading ? (
            <Spinner size="xxs" />
          ) : (
            `${matches.length} of ${channels.length}`
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Reload the playlist"
          aria-label="Reload the playlist"
          disabled={isLoading || !canBrowse}
          onClick={refresh}
        >
          <RotateCw />
        </Button>
      </div>

      {isOnAir ? (
        <div className="iptv-onair">
          <span className="iptv-onair-art">
            {stream.channelLogo ? (
              <img src={stream.channelLogo} alt="" />
            ) : (
              <Tv width={20} height={20} />
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

          <Button
            variant="outline"
            size="sm"
            title={
              canStop
                ? "Stop the stream"
                : "You do not have access to stop streams."
            }
            disabled={isBusy || !canStop}
            onClick={stop}
          >
            Stop
          </Button>
        </div>
      ) : null}

      <div className="iptv-filters">
        <Input
          value={query}
          placeholder="Filter channels"
          aria-label="Filter channels"
          onChange={(event) => setQuery(event.target.value)}
        />

        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger size="sm" aria-label="Filter by group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
            {groups.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listError || error ? (
        <div className="iptv-alert">
          <Alert variant="destructive">
            <AlertDescription>{listError || error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {blockedReason ? <div className="iptv-note">{blockedReason}</div> : null}

      {matches.length > 0 ? (
        <div className="iptv-grid">
          {matches.map((channel) => (
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
    </div>
  );
};

const ChannelBrowserPopover = memo(() => {
  const [open, setOpen] = useState(false);
  const controller = useIptv();

  // every action the panel offers is scoped to the caller's own voice channel,
  // so outside one there is nothing for the trigger to open
  if (controller.isDisconnected) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="IPTV channels"
          style={{ position: "relative" }}
        >
          <Tv />
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
