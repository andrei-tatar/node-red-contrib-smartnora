## Doorbell

Represents a [Google Home Doorbell](https://developers.google.com/assistant/smarthome/guides/doorbell) device.

Node attributes:
- [Common](../common.md)

**Notice:** Make sure the device has `Voice notifications` set to `On` in the Google Home app, otherwise you won't receive any notifications.

Input payload is an object with the following properties:
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.
- `named` - List of objects recognized by the user that have been tagged with a label.
- `familiar` - number: Count of objects recognized by the user that have no label.
- `unfamiliar` - number: Count of objects detected by the device that the user may not recognize.
- `unclassified` - number: Count of objects detected that the device was unable to classify.

Example flow:
```
[{"id":"bbbdecb1cda7db5e","type":"noraf-doorbell","z":"244894166ed790d5","devicename":"Doorbell","roomhint":"","name":"","nora":"c38ae3d9.b9765","topic":"","filter":false,"x":880,"y":480,"wires":[]},{"id":"7dc0804a1cdeba54","type":"inject","z":"244894166ed790d5","name":"\"Alice\" is at the doorbell","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"named\":[\"Alice\"]}","payloadType":"json","x":560,"y":440,"wires":[["bbbdecb1cda7db5e"]]},{"id":"1b08bca9fd2551e9","type":"inject","z":"244894166ed790d5","name":"someone's at the doorbell (unclassified)","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"unclassified\":1}","payloadType":"json","x":610,"y":520,"wires":[["bbbdecb1cda7db5e"]]},{"id":"71629549d9fd9dc9","type":"inject","z":"244894166ed790d5","name":"someone you know is at the doorbell","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"familiar\":1}","payloadType":"json","x":600,"y":480,"wires":[["bbbdecb1cda7db5e"]]},{"id":"aeeedb84a9e88d39","type":"inject","z":"244894166ed790d5","name":"someone's at the doorbell (unfamiliar)","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"unfamiliar\":1}","payloadType":"json","x":610,"y":560,"wires":[["bbbdecb1cda7db5e"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":"","storeStateInContext":true,"disableValidationErrors":false}]
```
