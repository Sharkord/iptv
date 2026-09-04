import Fuse from "fuse.js";
import { parse, type PlaylistItem } from "iptv-playlist-parser";
import type { IptvChannel } from "../contract";

type PlaylistCache = {
  url: string;
  items: PlaylistItem[];
  fuse: Fuse<PlaylistItem> | null;
};

const cache: PlaylistCache = { url: "", items: [], fuse: null };

// a second caller while the first is still fetching gets the same request
let inFlight: Promise<PlaylistItem[]> | null = null;

const createPlaylistFuse = (items: PlaylistItem[]) =>
  new Fuse(items, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "tvg.name", weight: 0.2 },
      { name: "group.title", weight: 0.1 },
    ],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

const assertPlaylistUrl = (value: string): string => {
  const url = value.trim();

  if (!url) {
    throw new Error(
      "No playlist URL configured. Add one in the plugin settings.",
    );
  }

  if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
    throw new Error(
      "The playlist setting must be an http(s) URL pointing at an .m3u playlist.",
    );
  }

  return url;
};

const fetchPlaylist = async (url: string): Promise<string> => {
  // some providers answer a bare fetch with a redirect to an error page
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Playlist request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
};

const loadPlaylist = async (
  settingValue: string,
  options: { refresh?: boolean } = {},
): Promise<PlaylistItem[]> => {
  const url = assertPlaylistUrl(settingValue);
  const isCached = url === cache.url && cache.items.length > 0;

  if (isCached && !options.refresh) return cache.items;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const raw = await fetchPlaylist(url);
    const items = parse(raw).items;

    if (items.length === 0) {
      throw new Error("The playlist was fetched but holds no channels.");
    }

    cache.url = url;
    cache.items = items;
    cache.fuse = createPlaylistFuse(items);

    return items;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

const invalidatePlaylist = (): void => {
  cache.url = "";
  cache.items = [];
  cache.fuse = null;
};

const toChannels = (items: PlaylistItem[]): IptvChannel[] =>
  items.map((item, id) => ({
    id,
    name: item.name || item.tvg?.name || `Channel ${id + 1}`,
    logo: item.tvg?.logo || null,
    group: item.group?.title || null,
  }));

const getChannelAt = (id: number): PlaylistItem | undefined => cache.items[id];

const findClosestChannel = (query: string): PlaylistItem | null =>
  cache.fuse?.search(query, { limit: 1 })[0]?.item ?? null;

export {
  findClosestChannel,
  getChannelAt,
  invalidatePlaylist,
  loadPlaylist,
  toChannels,
};
