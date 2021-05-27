## Garage door

Represents a [Google Home Garage door](https://developers.google.com/assistant/smarthome/guides/garage) device.

Node attributes:
- [Common](../common.md)
- `Warn user if already open/closed` - if checked, the assistant will warn if the device is already opened/closed
- `Open Payload` - message type and value used when the garage door is opened
- `Close Payload` - message type and value used when the garage door is closed

Input/output payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `openPercent` - percentage the door is open (0 - closed, 100 - open)
- `online` - boolean, default: true

**Note:** currently, garage doors are required to have a `Two Factor` mode with a pin setup. The device will not sync with Google Home otherwise.

Example flow:
```
[{"id":"edcdffb1.e6e6c","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1070,"y":240,"wires":[]},{"id":"58139775.766bf8","type":"noraf-garage","z":"15d66f47.1c0181","devicename":"Garage Door","roomhint":"","name":"","passthru":false,"nora":"c38ae3d9.b9765","topic":"","openvalue":"true","openvalueType":"bool","closevalue":"false","closevalueType":"bool","twofactor":"pin","twofactorpin":"1234","x":890,"y":240,"wires":[["edcdffb1.e6e6c"]]},{"id":"73772565.08fc5c","type":"inject","z":"15d66f47.1c0181","name":"Open","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"true","payloadType":"bool","x":690,"y":180,"wires":[["58139775.766bf8"]]},{"id":"bad0e0b7.d465c","type":"inject","z":"15d66f47.1c0181","name":"Close","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"false","payloadType":"bool","x":690,"y":220,"wires":[["58139775.766bf8"]]},{"id":"cc8ad40a.8e5f68","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":690,"y":260,"wires":[["58139775.766bf8"]]},{"id":"a0e1d3ad.d6d64","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":690,"y":300,"wires":[["58139775.766bf8"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
