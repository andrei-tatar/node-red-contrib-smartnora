## Sprinkler

Represents a [Google Home Sprinkler](https://developers.google.com/assistant/smarthome/guides/sprinkler) device.

Node attributes:
- [Common](../common.md)
- `Start/Stop` - when checked, enables support for the [start/stop trait](https://developers.google.com/assistant/smarthome/traits/startstop)
    - `Pausable` - Indicates whether the device can be paused during operation.
    - `Zones` - Indicates supported zone names. Strings should be localized as set by the user. This list is not exclusive; users can report any names they want.
- `Timer` - when checked, enables support for the [timer trait](https://developers.google.com/assistant/smarthome/traits/timer)

    - `Mode` - Indicates if the device supports using one-way (true) or two-way (false) communication. Select `command only` if the device cannot respond to a QUERY intent or Report State for this trait.


Input/output payload is an object with the following properties:
- `on` - boolean: true/false, default: false. Indicates if the fan is on
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.

When `Start/Stop` trait is enabled:
- `isRunning` - boolean (default `false`): Indicates if the device is currently in operation.
- `isPaused` - boolean: Indicates if the device is explicitly paused. If this value is true, it implies isRunning is false but can be resumed.
- `activeZones` - array of string: Indicates zones in which the device is currently running, from list of availableZones.

When `Timer` trait is enabled:
- `timerRemainingSec` - number (default `-1`): Current time remaining in seconds, -1, or [0, maxTimerLimitSec]. Set to -1 to indicate no timer is running.
- `timerPaused` - boolean *optional*: True if a active timer exists but is currently paused.

```

```
