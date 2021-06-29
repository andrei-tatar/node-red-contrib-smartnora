## Sensor

Represents a [Google Home Sensor](https://developers.google.com/assistant/smarthome/guides/sensor) device.

Node attributes:
- [Common](../common.md)
- `Temperature` - if checked, the sensor will report temperature
- `Temperature Unit` - select between C and F
- `Humidity` - if checked, the sensor will report relative humidity

Input payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `online` - boolean, default: true
- `temperature` - number, default: 21 - the temperature to report (in Celsius)
- `humidity` - number, default: 40 - the relative humidity to report (in %)

Example flow:
```
[{"id":"cf8038ff.4d2598","type":"noraf-sensor","z":"68061750.490f48","devicename":"Sensor","roomhint":"","name":"","temperature":true,"unit":"C","humidity":false,"passthru":false,"nora":"e76a4bf6.431dd8","x":420,"y":120,"wires":[]},{"id":"d51b59de.460178","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"temperature\": 24}","payloadType":"json","x":170,"y":120,"wires":[["cf8038ff.4d2598"]]},{"id":"1c7de22c.80ffbe","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"temperature\": 25}","payloadType":"json","x":170,"y":160,"wires":[["cf8038ff.4d2598"]]},{"id":"183eef2d.f5f9f1","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\": false}","payloadType":"json","x":160,"y":200,"wires":[["cf8038ff.4d2598"]]},{"id":"aa6fcbd2.050ba8","type":"inject","z":"68061750.490f48","name":"","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\": true}","payloadType":"json","x":150,"y":240,"wires":[["cf8038ff.4d2598"]]},{"id":"e76a4bf6.431dd8","type":"noraf-config","name":"Nora Testing","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
