type Commands = {
  iptv_play_direct: {
    args: { sourceUrl: string; streamName: string };
    response: void;
  };
  iptv_play: {
    args: { channelName: string };
    response: void;
  };
  iptv_stop: {
    args: void;
    response: void;
  };
  iptv_clean: {
    args: void;
    response: void;
  };
};

export type { Commands };
