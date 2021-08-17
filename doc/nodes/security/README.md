## Security System

Represents a [Google Home Security System](https://developers.google.com/assistant/smarthome/guides/securitysystem) device.

Node attributes:
- [Common](../common.md)

Input/output payload is an object with the following properties:
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.
- `isArmed` - boolean, default: false. Indicates if the device is currently armed.
- `currentArmLevel` - string, default: **first value from arm levels (if any)**. Required if the Arm Levels are specified. If multiple security levels exist, indicates the value of the current security level.
- `exitAllowance` - number, default: undefined. Indicates the time, in seconds, the user has to leave before currentArmLevel takes effect.

Example flow:
```
TODO
```
