## Vacuum

Represents a [Google Home Vacuum](https://developers.google.com/assistant/smarthome/guides/vacuum) device.

Node attributes:
- [Common](../common.md)
- [`Start / Stop`](https://developers.google.com/assistant/smarthome/traits/startstop)
  - `Pausable` - allows the device to be paused
- [`On / Off`](https://developers.google.com/assistant/smarthome/traits/onoff) - if checked, will support on/off.
  - `Mode` - `Command Only`, `Query Only`, or both `Command & Query`
- [`Dock trait support`](https://developers.google.com/assistant/smarthome/traits/dock) - if checked, will support the dock trait
  - ` If dock state doesn't change via voice, warn user` - if checked, the assistant will warn if the device is docked or not

Input/output message format
- `online` - boolean, default: true
- `on` - boolean [used if `On/Off` is checked] - on/off state (true = on, false = off)
- `isRunning` - boolean [default false] - Indicates if the device is currently in operation.
- `isPaused` - boolean - Indicates if the device is explicitly paused. If this value is true, it implies isRunning is false but can be resumed.
- `isDocked` - boolean [used if `Dock trait support` is checked, default false] - Whether the device is connected to the docking station or not.