## Lock

Represents a [Google Home Garage lock](https://developers.google.com/assistant/smarthome/guides/lock) device.

Node attributes:
- [Common](../common.md)
- `If state doesn't change via voice, warn user` - if checked, the assistant will warn if the device is already locked/unlocked
- `Lock` - message type and value used when the lock is locked
- `Unlock` - message type and value used when the lock is unlocked
- `Jammed` - message type and value used to detect when the lock is jammed
- `Unjammed` - message type and value used to detect when the lock is unjammed

Input/output payload will be an object that follow the payload defined in the attributes.

**Note:** you can also send messages with the state properties to the input of the node:
- `isLocked` - boolean, default: false - flag that indicates if device is locked
- `isJammed` - boolean, default: false - flag that indicates if device is jammed
- `online` - boolean, default: true

**Note:** currently, lock devices are required to have a `Two Factor` mode with a pin setup. The device will not sync with Google Home otherwise.

Example flow:
```
[{"id":"b429e61d.c0bc18","type":"noraf-lock","z":"15d66f47.1c0181","devicename":"Lock","roomhint":"","name":"","passthru":false,"nora":"c38ae3d9.b9765","topic":"","lockValue":"true","lockValueType":"bool","unlockValue":"false","unlockValueType":"bool","jammedValue":"true","jammedValueType":"bool","unjammedValue":"false","unjammedValueType":"bool","twofactor":"pin","twofactorpin":"1234","x":930,"y":200,"wires":[["c7381ac8.c26ba8"]]},{"id":"d016e685.75b2f8","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":690,"y":300,"wires":[["b429e61d.c0bc18"]]},{"id":"da2dd57c.4ba1b8","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":690,"y":340,"wires":[["b429e61d.c0bc18"]]},{"id":"e4793bdc.9fa0d8","type":"inject","z":"15d66f47.1c0181","name":"Lock","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"true","payloadType":"bool","x":690,"y":120,"wires":[["b429e61d.c0bc18"]]},{"id":"422950f9.b9194","type":"inject","z":"15d66f47.1c0181","name":"Unlock","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"false","payloadType":"bool","x":690,"y":160,"wires":[["b429e61d.c0bc18"]]},{"id":"186f797d.661347","type":"inject","z":"15d66f47.1c0181","name":"Jammed","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"jammed","payload":"true","payloadType":"bool","x":700,"y":200,"wires":[["b429e61d.c0bc18"]]},{"id":"bb13e3c2.f0bae","type":"inject","z":"15d66f47.1c0181","name":"Unjammed","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"jammed","payload":"false","payloadType":"bool","x":700,"y":240,"wires":[["b429e61d.c0bc18"]]},{"id":"c7381ac8.c26ba8","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1100,"y":200,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
