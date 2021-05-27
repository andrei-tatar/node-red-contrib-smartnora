## Switch

Represents a [Google Home Switch](https://developers.google.com/assistant/smarthome/guides/switch) device.

Node attributes:
- [Common](../common.md)
- `If state doesn't change via voice, warn user` - if checked, the assistant will warn if the device is already on/off
- `On Payload` - message type and value used when the switch is on
- `Off Payload` - message type and value used when the switch is off

Input/output payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `on` - boolean, deafult: false - indicates if the switch is on
- `online` - boolean, default: true

Example flow:
```
[{"id":"6ad1a7b6.753158","type":"noraf-switch","z":"15d66f47.1c0181","devicename":"Switch","roomhint":"","name":"","passthru":false,"nora":"c38ae3d9.b9765","topic":"","onvalue":"true","onvalueType":"bool","offvalue":"false","offvalueType":"bool","twofactor":"off","twofactorpin":"","x":850,"y":160,"wires":[["b1dfcf7b.ba699"]]},{"id":"31ad7173.3c118e","type":"inject","z":"15d66f47.1c0181","name":"On","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"true","payloadType":"bool","x":650,"y":100,"wires":[["6ad1a7b6.753158"]]},{"id":"8766d41a.08d4f8","type":"inject","z":"15d66f47.1c0181","name":"Off","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"false","payloadType":"bool","x":650,"y":140,"wires":[["6ad1a7b6.753158"]]},{"id":"2da66d37.ad7fc2","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":650,"y":180,"wires":[["6ad1a7b6.753158"]]},{"id":"ab6b7e03.abb9","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":650,"y":220,"wires":[["6ad1a7b6.753158"]]},{"id":"b1dfcf7b.ba699","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1020,"y":160,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
