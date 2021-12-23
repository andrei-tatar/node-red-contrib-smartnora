## Sous Vide

Represents a [Google Home Sous Vide Cooker](https://developers.google.com/assistant/smarthome/guides/sousvide) device.

Node attributes:
- [Common](../common.md)
- `On / Off` - if checked, will support on/off.
  - `Mode` - `Command Only`, `Query Only`, or both `Command & Query`
- `Temperature` - if checked, will support Temperature Setting
  - `Mode` - `Command Only`, `Query Only`, or both `Command & Query`
  - `Display Unit` - select between C and F
  - `Step Size` - size of increments when adjusting temperature
  - `Allowable Range` - the minimum and maximum temperatures supported by the device
- `Start / Stop` - if checked, will support start/stop.
  - `Pausable` - allows the device to be paused
- `Timer` - if checked, will spport a timer.
  - `Mode` - `Command Only` or `Command & Query`
  - `Max Time` - the maximum length of a timer (in seconds)

```
[{"id": "5ad52be2c68ed3ee","type": "noraf-sousvide","z": "e2a58e37b9b7b501","devicename": "my sous vide","roomhint": "","name": "","onOffSupported": true,"onOffMode": "cq","temperatureSupported": true,"temperatureMode": "cq","temperatureUnit": "C","temperatureStepSize": 1,"temperatureRangeMin": "","temperatureRangeMax": "","startStopSupported": false,"startStopPausable": false,"timerSupported": true,"timerMaxLimitSeconds": 3600,        "timerMode": "cq","topic": "","passthru": false,"nora": "e76a4bf6.431dd8","x": 1010,"y": 220,"wires": [[]]},{"id": "b9808a509fcefdc9","type": "inject","z": "e2a58e37b9b7b501","name": "setpoint: 60C","props": [{"p": "payload"},{"p": "topic","vt": "str"}],"repeat": "","crontab": "","once": false,"onceDelay": 0.1,"topic": "","payload": "{\"thermostatTemperatureSetpoint\":60}","payloadType": "json","x": 750,"y": 220,"wires": [["5ad52be2c68ed3ee"]]},{"id": "f137f3aa35b285cc","type": "inject","z": "e2a58e37b9b7b501","name": "1 hour timer","props": [{"p": "payload"},{"p": "topic","vt": "str"}],"repeat": "","crontab": "","once": false,"onceDelay": 0.1,"topic": "","payload": "{\"timeRemainingSec\":3600,\"timerPaused\":false}","payloadType": "json","x": 750,"y": 260,"wires": [["5ad52be2c68ed3ee"]]},{"id": "663ad0574b8965ed","type": "inject","z": "e2a58e37b9b7b501","name": "pause timer","props": [{"p": "payload"},{"p": "topic","vt": "str"}],"repeat": "","crontab": "","once": false,"onceDelay": 0.1,"topic": "","payload": "{\"timerPaused\":true}","payloadType": "json","x": 750,"y": 300,"wires": [["5ad52be2c68ed3ee"]]},{"id": "e76a4bf6.431dd8","type": "noraf-config","name": "Nora Testing","group": "test","twofactor": "off","twofactorpin": "","localexecution": true,"structure": ""}]
```
