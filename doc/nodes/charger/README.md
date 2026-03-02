## Charger

Represents a [Google Home Charger](https://developers.google.com/assistant/smarthome/guides/charger) device.

Node attributes:
- [Common](../common.md)
- `Is rechargeable` - if checked, indicates that the energy storage device is rechargeable
- `Query only` - if checked, the device will only support querying the state, not sending commands
- `Energy Distance Unit` - select between kilometers or miles for distance-related capacity reporting
- `If state doesn't change via voice, warn user` - if checked, the assistant will warn if the state doesn't change

Input/output payload will be an object with the following properties:
- `descriptiveCapacityRemaining` - string, **required**, default: `MEDIUM` - descriptive capacity level (one of: `CRITICALLY_LOW`, `LOW`, `MEDIUM`, `HIGH`, `FULL`)
- `capacityRemaining` - array with capacity remaining object(s), each containing:
  - `rawValue` - number, **required** - the remaining capacity value
  - `unit` - string, **required** - the unit of measurement (one of: `SECONDS`, `MILES`, `KILOMETERS`, `PERCENTAGE`, `KILOWATT_HOURS`)
- `capacityUntilFull` - array with capacity until full object(s), each containing:
  - `rawValue` - number, , **required** - the capacity needed to charge fully
  - `unit` - string, , **required** - the unit of measurement
- `isCharging` - boolean - indicates if the charger is currently charging
- `isPluggedIn` - boolean - indicates if the charger is currently plugged in
- `online` - boolean, default: true - indicates if the device is online

Example flow:
```
[{"id":"c1a2d9e5.3e4b5","type":"noraf-charger","z":"15d66f47.1c0181","devicename":"Charger","roomhint":"","name":"","passthru":false,"nora":"c38ae3d9.b9765","topic":"","isRechargeable":true,"queryOnlyEnergyStorage":false,"energyStorageDistanceUnitForUX":"KILOMETERS","twofactor":"off","twofactorpin":"","filter":false,"asyncCmd":false,"x":830,"y":220,"wires":[["25158b3a.a308a4"]]},{"id":"b8c3f6e1.7d2cf8","type":"inject","z":"15d66f47.1c0181","name":"Charging","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"capacityRemaining\":[{\"rawValue\":75,\"unit\":\"PERCENTAGE\"}],\"isCharging\":true,\"isPluggedIn\":true,\"descriptiveCapacityRemaining\":\"MEDIUM\"}","payloadType":"json","x":640,"y":180,"wires":[["c1a2d9e5.3e4b5"]]},{"id":"d9f4g7h2.8e3d6","type":"inject","z":"15d66f47.1c0181","name":"Fully Charged","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"capacityRemaining\":[{\"rawValue\":100,\"unit\":\"PERCENTAGE\"}],\"isCharging\":false,\"isPluggedIn\":true,\"descriptiveCapacityRemaining\":\"FULL\"}","payloadType":"json","x":640,"y":220,"wires":[["c1a2d9e5.3e4b5"]]},{"id":"e0g5h8i3.9f4e7","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":640,"y":260,"wires":[["c1a2d9e5.3e4b5"]]},{"id":"25158b3a.a308a4","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1000,"y":220,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```

