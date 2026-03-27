# IPTV

A simple IPTV plugin for Sharkord that allows you to restream IPTV channels to your Sharkord voice channels. It uses ffmpeg to restream the channels and supports both HLS and RTMP streams.

## Screenshots

![ss](https://i.imgur.com/4WALR7e.png)

## Dependencies

The plugin will automatically download the required dependencies (ffmpeg) on first run.

## Manual Installation

1. Download the latest release from the [Releases](https://github.com/Sharkord/iptv/releases) page.
2. Move the `iptv` folder to your Sharkord plugins directory, typically located at `~/.config/sharkord/plugins`. See: [Data Dir](https://sharkord.com/docs/data-dir).

## Settings

- `playlist`: Paste the contents of your `.m3u` playlist here.

## Commands

- `/iptv_play_direct <stream_url> [stream_name]`: Starts streaming a direct IPTV stream URL (not a playlist).
- `/iptv_play <channel_name>`: Finds the closest matching channel in the playlist and starts streaming it.
- `/iptv_stop`: Stops the currently active IPTV stream in the channel.
- `/iptv_clean`: Cleans up the active stream in the current channel.
