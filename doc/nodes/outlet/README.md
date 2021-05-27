## Outlet

Represents a [Google Home Outlet](https://developers.google.com/assistant/smarthome/guides/outlet) device.

Node attributes:
- [Common](../common.md)
- `If state doesn't change via voice, warn user` - if checked, the assistant will warn if the device is already on/off
- `On Payload` - message type and value used when the outlet is on
- `Off Payload` - message type and value used when the outlet is off

Input/output payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `on` - boolean, deafult: false - indicates if the outlet is on
- `online` - boolean, default: true

Example flow:
```
[{"id":"41b8dff4.642e","type":"noraf-outlet","z":"15d66f47.1c0181","devicename":"Outlet","roomhint":"","name":"","passthru":false,"nora":"c38ae3d9.b9765","topic":"","onvalue":"true","onvalueType":"bool","offvalue":"false","offvalueType":"bool","twofactor":"off","twofactorpin":"","x":830,"y":220,"wires":[["25158b3a.a308a4"]]},{"id":"31ad7173.3c118e","type":"inject","z":"15d66f47.1c0181","name":"On","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"true","payloadType":"bool","x":630,"y":160,"wires":[["41b8dff4.642e"]]},{"id":"8766d41a.08d4f8","type":"inject","z":"15d66f47.1c0181","name":"Off","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"false","payloadType":"bool","x":630,"y":200,"wires":[["41b8dff4.642e"]]},{"id":"2da66d37.ad7fc2","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":630,"y":240,"wires":[["41b8dff4.642e"]]},{"id":"ab6b7e03.abb9","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":630,"y":280,"wires":[["41b8dff4.642e"]]},{"id":"25158b3a.a308a4","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1000,"y":220,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
