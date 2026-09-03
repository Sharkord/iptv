# IPTV

A simple IPTV plugin for Sharkord that allows you to restream IPTV channels to your Sharkord voice channels. It uses ffmpeg to restream the channels and supports both HLS and RTMP streams.

## Screenshots

![ss](https://i.imgur.com/HGcVKhC.png)

## Dependencies

The plugin will automatically download the required dependencies (ffmpeg) on first run.

## Manual Installation

1. Download the latest release from the [Releases](https://github.com/Sharkord/iptv/releases) page.
2. Move the `iptv` folder to your Sharkord plugins directory, typically located at `~/.config/sharkord/plugins`. See: [Data Dir](https://sharkord.com/docs/data-dir).

## Settings

- `playlistUrl`: The URL of your `.m3u` playlist. Stored write-only, since provider URLs usually carry credentials.

## Channel browser

Admins get a TV button in the top bar. It opens a searchable grid of every channel in the playlist, with the logo each entry declares, and clicking one streams it into the voice channel you are currently in. The grid is gated behind `MANAGE_PLUGINS`; server owners can narrow that further per role.

## Commands

- `/iptv_play <channel_name>`: Finds the closest matching channel in the playlist and starts streaming it. Needs `JOIN_VOICE_CHANNELS`.
- `/iptv_play_direct <stream_url> [stream_name]`: Streams a direct media URL (not a playlist). Needs `MANAGE_PLUGINS`, because it makes the server fetch an arbitrary URL.
- `/iptv_stop`: Stops the stream in your voice channel. Needs `JOIN_VOICE_CHANNELS`.
- `/iptv_clean`: Stops every IPTV stream on the server. Needs `MANAGE_PLUGINS`.

## Development

```bash
bun install
bun run build        # set SHARKORD_PLUGINS_PATH in .env to deploy on every build
bun run test
bun run check-types
```
