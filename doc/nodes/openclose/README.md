## Open/Close device

Represents a generic Open/Close device type.

Node attributes:
- [Common](../common.md)
- `Type` can be one of the following:
  - [Closet](https://developers.google.com/assistant/smarthome/guides/closet)
  - [Awning](https://developers.google.com/assistant/smarthome/guides/awning)
  - [Curtain](https://developers.google.com/assistant/smarthome/guides/curtain)
  - [Door](https://developers.google.com/assistant/smarthome/guides/door)
  - [Drawer](https://developers.google.com/assistant/smarthome/guides/drawer)
  - [Blinds](https://developers.google.com/assistant/smarthome/guides/blinds)
  - [Garage](https://developers.google.com/assistant/smarthome/guides/garage)
  - [Gate](https://developers.google.com/assistant/smarthome/guides/gate)
  - [Pergola](https://developers.google.com/assistant/smarthome/guides/pergola)
  - [Shutter](https://developers.google.com/assistant/smarthome/guides/shutter)
  - [Valve](https://developers.google.com/assistant/smarthome/guides/valve)
  - [Window](https://developers.google.com/assistant/smarthome/guides/window)
- `Supported Open/Close directions` - some devices (like blinds) support multiple open/close directions. [Read more](https://developers.google.com/assistant/smarthome/guides/blinds#example-device:-simple-blinds). Leave empty if not of interest.
- `Discrete only open/close` - check if the device only supports 2 states (fully opened or fully closed).
- `Open Payload` - message type and value used when the device is opened
- `Close Payload` - message type and value used when the device is closed
- `Support Lock/Unlock` - will add the [lock/unlock trait](https://developers.google.com/assistant/smarthome/traits/lockunlock) to this device, adding the capability to send lock/unlock commands

If `discrete only` checkbox is checked, the input/output payload will be an object that follow the payload defined in the attributes.

Otherwise, the format of the payload is an object with the following properties:
- `online` boolean (true/false), default: true - indicates if the device is online
- `open` - percentage the device is open (0 - closed, 100 - open)

If `Open/Close direction(s)` are used there is another property:
- `direction` - direction in which the device opens/closed. If missing, all directions will change at once (for input messages, output messages will always contain the `direction`)

If `Lock/Unlock` is checked, the following properties are also present:
- `locked` - boolean (true/false) - indicates if the device is locked
- `jammed` - boolean (true/false) - indicates if the device is jammed


**Note:** currently, garage doors and lock/unlock devices are required to have a `Two Factor` mode with a pin setup. The device will not sync with Google Home otherwise.

### Example flow:
```
[{"id":"62dfcd4.2cce534","type":"noraf-openclose","z":"15d66f47.1c0181","devicename":"Water","roomhint":"","name":"","directions":"","openclosetype":"VALVE","passthru":false,"discrete":false,"lockunlock":false,"commandonly":false,"queryonly":false,"nora":"c38ae3d9.b9765","topic":"","openvalue":"true","openvalueType":"bool","closevalue":"false","closevalueType":"bool","twofactor":"off","twofactorpin":"","x":790,"y":220,"wires":[["c1d557c1.8a06f8"]]},{"id":"c1d557c1.8a06f8","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":970,"y":220,"wires":[]},{"id":"6d85633d.11005c","type":"inject","z":"15d66f47.1c0181","name":"Open","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":100}","payloadType":"json","x":590,"y":120,"wires":[["62dfcd4.2cce534"]]},{"id":"5039d1f9.832c9","type":"inject","z":"15d66f47.1c0181","name":"Close","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":0}","payloadType":"json","x":590,"y":160,"wires":[["62dfcd4.2cce534"]]},{"id":"11f4e459.7e9bbc","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":590,"y":240,"wires":[["62dfcd4.2cce534"]]},{"id":"43fa6205.2af41c","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":590,"y":280,"wires":[["62dfcd4.2cce534"]]},{"id":"12795d70.9509e3","type":"inject","z":"15d66f47.1c0181","name":"50%","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":50}","payloadType":"json","x":590,"y":200,"wires":[["62dfcd4.2cce534"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```

### Example Blinds with directions:
```
[{"id":"62dfcd4.2cce534","type":"noraf-openclose","z":"15d66f47.1c0181","devicename":"Blinds","roomhint":"","name":"","directions":"LEFT,RIGHT","openclosetype":"BLINDS","passthru":false,"discrete":false,"lockunlock":false,"commandonly":false,"queryonly":false,"nora":"c38ae3d9.b9765","topic":"","openvalue":"true","openvalueType":"bool","closevalue":"false","closevalueType":"bool","twofactor":"off","twofactorpin":"","x":870,"y":240,"wires":[["c1d557c1.8a06f8"]]},{"id":"c1d557c1.8a06f8","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1090,"y":240,"wires":[]},{"id":"6d85633d.11005c","type":"inject","z":"15d66f47.1c0181","name":"Open","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":100}","payloadType":"json","x":670,"y":140,"wires":[["62dfcd4.2cce534"]]},{"id":"5039d1f9.832c9","type":"inject","z":"15d66f47.1c0181","name":"Close","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":0}","payloadType":"json","x":670,"y":180,"wires":[["62dfcd4.2cce534"]]},{"id":"11f4e459.7e9bbc","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":670,"y":300,"wires":[["62dfcd4.2cce534"]]},{"id":"43fa6205.2af41c","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":670,"y":340,"wires":[["62dfcd4.2cce534"]]},{"id":"12795d70.9509e3","type":"inject","z":"15d66f47.1c0181","name":"50%","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":50}","payloadType":"json","x":670,"y":220,"wires":[["62dfcd4.2cce534"]]},{"id":"ce91fdbb.7318f","type":"inject","z":"15d66f47.1c0181","name":"Right 50%","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"open\":50, \"direction\": \"RIGHT\"}","payloadType":"json","x":680,"y":260,"wires":[["62dfcd4.2cce534"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```