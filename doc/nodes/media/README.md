## Media

Represents one of the following devices:
- [Speaker](https://developers.google.com/assistant/smarthome/guides/speaker)
- [Audio-Video Receiver](https://developers.google.com/assistant/smarthome/guides/audiovideoreceiver)
- [Remote control/Media remote](https://developers.google.com/assistant/smarthome/guides/remotecontrol)
- [Set-top Box](https://developers.google.com/assistant/smarthome/guides/settop)
- [Soundbar](https://developers.google.com/assistant/smarthome/guides/soundbar)
- [Streaming Box](https://developers.google.com/assistant/smarthome/guides/streamingbox)
- [Streaming Soundbar](https://developers.google.com/assistant/smarthome/guides/streamingsoundbar)
- [Streaming Stick](https://developers.google.com/assistant/smarthome/guides/streamingstick)
- [TV](https://developers.google.com/assistant/smarthome/guides/tv)

Node attributes:
- [Common](../common.md)
- `Device Type` - list to select the device type that will be presented to Google (see the list above)
- `On/Off Trait` - if checked, the device will support the [OnOff trait](https://developers.google.com/assistant/smarthome/traits/onoff)
- `Volume Trait` - if checked, the device will support the [Volume trait](https://developers.google.com/assistant/smarthome/traits/volume). 
  - `Can mute/unmute` - Indicates if the device can mute and unmute the volume. Mute is a separate option as the 'mute' behavior takes the volume to 0 while remembering the previous volume, so that unmute restores it. This is reflected in volume state—if volume is 5, and the user mutes, the volume remains 5 and isMuted is true
  - `Volume level step size` - The default step size for relative volume queries like 'volume up on <device_name>.
- `Media State Trait` - if checked, the device will support the [MediaState trait](https://developers.google.com/assistant/smarthome/traits/mediastate)
  - `Support activity state` - Indicate if the device can report the activity state.
  - `Support playback state` - Indicate if the device can report the current playback state.
- `Transport Control Trait` - if checked, the device will support the [TransportControl trait](https://developers.google.com/assistant/smarthome/traits/transportcontrol)
  - Each checkbox under this section is a command that the device supports (eg. Pause/Stop/Resume). **NOTE** these commands do not automatically update the properties from the `Media State` trait (eg. the playback state).
- `Input Selector Trait` - if checked, the device will support the [InputSelector trait](https://developers.google.com/assistant/smarthome/traits/inputselector)
  - `Language` - the language in which the input names are spelled
  - `Inputs` - the value and the name of each input (note the inputs are sorted)
  - `Default Input` - the checkbox at the end of the input editor row, selects the default input to be selected (when node-red starts, this input will be set as the state)
- `Channel Trait` - if checked, the device will support the [Channel trait](https://developers.google.com/assistant/smarthome/traits/channel)
  - `Channels` - the key, name and (optional) number of each defined channel

Input/output **1** payload is an object with the following properties:
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.
- `on` - boolean: true/false, default: false. (if the `On/Off Trait` is enabled)
- `volume` - number: 0-100, default: 40. (if the `Volume Trait` is enabled)
- `mute` - boolean, default: false. (if the `Volume Trait` is enabled)
- `activity` - enum [`INACTIVE`, `STANDBY`, `ACTIVE`] (if the `Media State` trait is enabled)
- `playback` - enum [`PAUSED`, `PLAYING`, `FAST_FORWARDING`, `REWINDING`, `BUFFERING`, `STOPPED`] (if the `Media State` trait is enabled)
- `input` - string - the value of the current selected input

Output **2** payload is used when commands are triggered:

- [Set the current channel to a specific value](https://developers.google.com/assistant/smarthome/traits/channel#action.devices.commands.selectchannel) (if `Channel Trait` is enabled)

  ```
  {
    command: 'SelectChannel';
    channelCode: string;
    channelName: string;
    channelNumber: string;
  }
  ```
- [Adjust the current channel by a relative amount](https://developers.google.com/assistant/smarthome/traits/channel#action.devices.commands.relativechannel) (if `Channel Trait` is enabled)
  ```
  {
    command: 'RelativeChannel';
    relativeChannelChange: number;
  }
  ```
- [Return to the last/previous channel the user was on](https://developers.google.com/assistant/smarthome/traits/channel#action.devices.commands.returnchannel) (if `Channel Trait` is enabled)
  ```
  {
    command: 'ReturnChannel';
  }
  ```
- [Pause media playback](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediastop) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Stop';
  }
  ```
- [Skip to next media item](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.medianext) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Next';
  }
  ```
- [Skip to previous media item](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaprevious) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Previous';
  }
  ```
- [Pause media playback](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediapause) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Pause';
  }
  ```
- [Resume media playback](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaresume) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Resume';
  }
  ```
- [Seek to a relative position](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaseekrelative) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'SeekRelative';
    relativePositionMs: number;  -- Milliseconds of the forward (positive int) or backward (negative int) amount to seek.
  }
  ```
- [Seek to an absolute position](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaseektoposition) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'SeekToPosition';
    absPositionMs: number;     -- Millisecond of the absolute position to seek to.
  }
  ```
- [Set repeat playback mode](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediarepeatmode) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'RepeatMode';
    isOn: boolean;            -- True to turn on repeat mode, false to turn off repeat mode
    isSingle: boolean;        -- If specified, true means turning on single-item repeat mode, false means turning on normal repeat mode (for example a playlist)
  }
  ```
- [Shuffle the current playlist](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediashuffle) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'Shuffle';
  }
  ```
- [Turn captions on](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaclosedcaptioningon) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'ClosedCaptioningOn';
    closedCaptioningLanguage: string;   -- Language or locale for closed captioning.
    userQueryLanguage: string;          -- Language or locale for user query.
  }
  ```
- [Turn captions off](https://developers.google.com/assistant/smarthome/traits/transportcontrol#action.devices.commands.mediaclosedcaptioningoff) (if `Transport Control Trait` is enabled)
  ```
  {
    command: 'ClosedCaptioningOff';
  }
  ```
