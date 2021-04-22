## Blinds

Represents a [Google Home Blinds](https://developers.google.com/assistant/smarthome/guides/blinds) device.

Node attributes:
- [Common](../common.md)
- `Invert value` - if checked, the `openPercent` will be inverted. 0 = open, 100 = close

Input/output payload is an object with the following properties:
- `openPercent` - number: 0-100, default: 100. Represents how open the blinds are.
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.

Example flow:
```
[{"id":"73cf36cf.1a1b58","type":"noraf-blinds","z":"15d66f47.1c0181","devicename":"Blinds","roomhint":"","name":"","passthru":false,"invert":false,"nora":"c38ae3d9.b9765","topic":"","twofactor":"off","twofactorpin":"","x":840,"y":240,"wires":[["edcdffb1.e6e6c"]]},{"id":"e977c005.7fba4","type":"inject","z":"15d66f47.1c0181","name":"100","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"openPercent\":100}","payloadType":"json","x":670,"y":220,"wires":[["73cf36cf.1a1b58"]]},{"id":"d76bc49b.cf9298","type":"inject","z":"15d66f47.1c0181","name":"0","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"openPercent\":0}","payloadType":"json","x":670,"y":180,"wires":[["73cf36cf.1a1b58"]]},{"id":"1dccec48.8422d4","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":670,"y":260,"wires":[["73cf36cf.1a1b58"]]},{"id":"ba947ae0.abda58","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":670,"y":300,"wires":[["73cf36cf.1a1b58"]]},{"id":"edcdffb1.e6e6c","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":990,"y":240,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
