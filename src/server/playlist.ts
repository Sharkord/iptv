import Fuse from "fuse.js";
import { parse, type Playlist, type PlaylistItem } from "iptv-playlist-parser";

type PlaylistCache = {
  raw: string;
  parsed: Playlist | null;
  fuse: Fuse<PlaylistItem> | null;
  error: string | null;
};

const cache: PlaylistCache = {
  raw: "",
  parsed: null,
  fuse: null,
  error: null,
};

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

const loadPlaylist = (rawPlaylist: string): Playlist => {
  if (rawPlaylist !== cache.raw) {
    cache.raw = rawPlaylist;

    try {
      cache.parsed = parse(rawPlaylist);
      cache.fuse = createPlaylistFuse(cache.parsed.items);
      cache.error = null;
    } catch (error) {
      cache.parsed = null;
      cache.fuse = null;
      cache.error = error instanceof Error ? error.message : String(error);
    }
  }

  if (!cache.parsed) {
    throw new Error(
      cache.error || "Playlist could not be parsed. Check settings.",
    );
  }

  return cache.parsed;
};

const findClosestChannel = (query: string): PlaylistItem | null => {
  if (!cache.parsed || !cache.fuse) return null;

  const results = cache.fuse.search(query, { limit: 1 });
  return results[0]?.item ?? null;
};

export { loadPlaylist, findClosestChannel };
