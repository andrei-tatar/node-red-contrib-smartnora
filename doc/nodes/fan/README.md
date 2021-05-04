## Fan

Represents a [Google Home Fan](https://developers.google.com/assistant/smarthome/guides/fan) device.

Node attributes:
- [Common](../common.md)
- `Control speed using percentage` - if checked, then the fan speed will be controlled using a percentage (0 - 100), otherwise speed modes need to be defined.
- `Language` - [if not using percentage] - language in which the speed modes are defined.
- `Speeds` - [if not using percentage] - list of predefined speed modes the fan will use:
  - `value` [left input] - the string value used in payload to indentify this speed mode
  - `name` [right input] - comma separated list of words in the selected language that will help Google Assistant identify this speed mode

Input/output payload is an object with the following properties:
- `on` - boolean: true/false, default: false. Indicates if the fan is on
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.
- `speed`:
  - number - 0 to 100 - if `Control speed using percentage` is checked
  - string - if `Control speed using percentage` is **not** checked, represents the value used to identify the speed mode.

Example flow:
```
[{"id":"d4bded6d.cd22d","type":"debug","z":"4bcbc906.2b0e18","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":790,"y":320,"wires":[]},{"id":"47d8b04c.64a15","type":"noraf-fan","z":"4bcbc906.2b0e18","devicename":"Fan","roomhint":"","name":"","passthru":false,"percentcontrol":false,"nora":"c38ae3d9.b9765","topic":"","twofactor":"off","twofactorpin":"","language":"en","speeds":[{"v":"low","n":"Low"},{"v":"medium","n":"Medium"},{"v":"high","n":"High"}],"x":630,"y":320,"wires":[["d4bded6d.cd22d"]]},{"id":"313d77f.a114188","type":"inject","z":"4bcbc906.2b0e18","name":"low","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"speed\":\"low\"}","payloadType":"json","x":430,"y":240,"wires":[["47d8b04c.64a15"]]},{"id":"3d37a9d.878b556","type":"inject","z":"4bcbc906.2b0e18","name":"medium","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"speed\":\"medium\"}","payloadType":"json","x":430,"y":280,"wires":[["47d8b04c.64a15"]]},{"id":"a2c0ecd4.7a34b","type":"inject","z":"4bcbc906.2b0e18","name":"high","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"speed\":\"high\"}","payloadType":"json","x":430,"y":320,"wires":[["47d8b04c.64a15"]]},{"id":"5827a954.163418","type":"inject","z":"4bcbc906.2b0e18","name":"on","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"on\":true}","payloadType":"json","x":430,"y":380,"wires":[["47d8b04c.64a15"]]},{"id":"9af8131.b9061f","type":"inject","z":"4bcbc906.2b0e18","name":"off","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"on\":false}","payloadType":"json","x":430,"y":420,"wires":[["47d8b04c.64a15"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
