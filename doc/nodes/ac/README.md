## AC Unit

Represents a [Google Home AC Unit](https://developers.google.com/assistant/smarthome/guides/acunit) device.

Node attributes:
- [Common](../common.md)
- `Temperature Unit` - select between degrees Celsius or Fahrenheit
- `Temperature Range` - range of the temperature Google Assistant will set the setpoint to (specified in Celsius)
- `Supported modes` - list of supported modes (check the ones that apply)
- `Buffer range celsius` - Specifies the minimum offset between heat-cool setpoints in degrees Celsius, if `heatcool` mode is supported
- `Control speed using percentage` - if checked, then the fan speed will be controlled using a percentage (0 - 100), otherwise speed modes need to be defined.
- `Language` - [if not using percentage] - language in which the speed modes are defined.
- `Speeds` - [if not using percentage] - list of predefined speed modes the fan will use:
  - `value` [left input] - the string value used in payload to indentify this speed mode
  - `name` [right input] - comma separated list of words in the selected language that will help Google Assistant identify this speed mode

Input/output payload will be an object with the following properties:
- `mode` - string, default: `off` - operation mode
- `setpoint` - number - current setpoint temperature (Celsius)
- `setpointHigh` - number - current high setpoint temperature (Celsius) - if `heatcool` mode is used
- `setpointLow` - number - current low setpoint temperature (Celsius) - if `heatcool` mode is used
- `temperature` - number - current observed temperature, in degrees Celsius
- `humidity` - number (0-100) - represents the relative level of the ambient humidity, if supported by the device
- `speed`:
  - number - 0 to 100 - if `Control speed using percentage` is checked
  - string - if `Control speed using percentage` is **not** checked, represents the value used to identify the speed mode.
- `online` - boolean, default: true - indicates if the device is online

Example flow:
```
TODO
```
