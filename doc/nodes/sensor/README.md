## Sensor

Represents a [Google Home Sensor](https://developers.google.com/assistant/smarthome/guides/sensor) device.

Node attributes:
- [Common](../common.md)
- `Temperature` - if checked, the sensor will report temperature
  - `Temperature Unit` - select between C and F
- `Humidity` - if checked, the sensor will report relative humidity
- `Open/close` - if checked, the sensor will support open/close, query only, trait
  - `Discrete only open/close` - When checked, this indicates that the device must either be fully open or fully closed (that is, it does not support values between 0% and 100%).
- `Sensor` - if checked, the sensor will support the [sensor state trait](https://developers.google.com/assistant/smarthome/traits/sensorstate)
  - `Type` - type of sensor ([List of supported sensors](https://developers.google.com/assistant/smarthome/traits/sensorstate#supported-sensors))
  - `Numeric capability` - if checked, sensor will support numeric capability.
  - `Supported states` - the checked states will be reported to Google as supported.
  - if both `Numeric capability` and `Supported states` are missing, the sensor will support only numeric capability as a requirement.

Input payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `online` - boolean, default: true
- `temperature` - number [used if `Temperature` is checked] - the temperature to report (in Celsius)
- `humidity` - number [used if `Humidity` is checked] - the relative humidity to report (in %)
- `open` - number/boolean [used if `Open/close` is checked] - the open percentaget (0 to 100) or true/false
- `state` - string [used if `Sensor` is checked]- the current state of the sensor descriptive capability if supported (Eg: *healthy*/*no carbon monoxide detected*/etc.)
- `value` - number [used if `Sensor` is checked]- the current numeric sensor value (if supported)

Example flow:
```
[{"id":"cf8038ff.4d2598","type":"noraf-sensor","z":"68061750.490f48","devicename":"Sensor","roomhint":"","name":"","temperature":true,"unit":"C","humidity":false,"passthru":false,"nora":"e76a4bf6.431dd8","x":420,"y":120,"wires":[]},{"id":"d51b59de.460178","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"temperature\": 24}","payloadType":"json","x":170,"y":120,"wires":[["cf8038ff.4d2598"]]},{"id":"1c7de22c.80ffbe","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"temperature\": 25}","payloadType":"json","x":170,"y":160,"wires":[["cf8038ff.4d2598"]]},{"id":"183eef2d.f5f9f1","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\": false}","payloadType":"json","x":160,"y":200,"wires":[["cf8038ff.4d2598"]]},{"id":"aa6fcbd2.050ba8","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\": true}","payloadType":"json","x":150,"y":240,"wires":[["cf8038ff.4d2598"]]},{"id":"e76a4bf6.431dd8","type":"noraf-config","name":"Nora Testing","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
