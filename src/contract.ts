type IptvChannel = {
  id: number;
  name: string;
  logo: string | null;
  group: string | null;
};

type StreamSnapshot = {
  streamActive: boolean;
  streamStarting: boolean;
  channelName: string | null;
  channelLogo: string | null;
};

type ChannelsResponse = {
  channels: IptvChannel[];
  error: string | null;
};

type TSharkord = {
  actions: {
    getChannels: {
      payload: { refresh?: boolean };
      response: ChannelsResponse;
    };
    getStreamState: {
      payload: void;
      response: StreamSnapshot;
    };
    playChannel: {
      payload: { id: number };
      response: StreamSnapshot;
    };
    stopStream: {
      payload: void;
      response: StreamSnapshot;
    };
  };
  commands: {
    iptv_play: { args: { channelName: string }; response: string };
    iptv_play_direct: {
      args: { sourceUrl: string; streamName?: string };
      response: string;
    };
    iptv_stop: { args: void; response: string };
    iptv_clean: { args: void; response: string };
  };
  push: {
    channelId: number;
    stream: StreamSnapshot;
    error: string | null;
  };
};

export type { ChannelsResponse, IptvChannel, StreamSnapshot, TSharkord };
