## Scene

Represents a [Google Home Scene](https://developers.google.com/assistant/smarthome/guides/scene) device.

Node attributes:
- [Common](../common.md)
- `Scene reversible` - if checked, the scene can be reversed from Google assistant
- `Activate` - message type and value used when the scene is activated
- `Deactivate` - message type and value used when the scene is deactivated


Example flow:
```
[{"id":"25158b3a.a308a4","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1000,"y":220,"wires":[]},{"id":"b10b00b1.fd781","type":"noraf-scene","z":"15d66f47.1c0181","devicename":"Scene","roomhint":"","scenereversible":true,"name":"","nora":"c38ae3d9.b9765","topic":"","onvalue":"true","onvalueType":"bool","offvalue":"false","offvalueType":"bool","twofactor":"off","twofactorpin":"","x":830,"y":220,"wires":[["25158b3a.a308a4"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
