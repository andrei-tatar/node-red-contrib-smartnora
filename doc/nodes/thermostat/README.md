## Thermostat

Represents a [Google Home Thermostat](https://developers.google.com/assistant/smarthome/guides/thermostat) device.

Node attributes:
- [Common](../common.md)
- `Temperature Unit` - select between degrees Celsius or Fahrenheit
- `Temperature Range` - range of the temperature Google Assistant will set the setpoint to (specified in Celsius)
- `Supported modes` - list of supported thermostat modes (check the ones that apply)
- `Buffer range celsius` - Specifies the minimum offset between heat-cool setpoints in degrees Celsius, if `heatcool` mode is supported
- `Command only` - indicates if this is a command only device
- `Query only` - indicates if this devices supports only queries (sensor)

Input/output payload will be an object with the following properties:
- `mode` - string, default: `off` - operation mode of the thermostat
- `setpoint` - number - current setpoint temperature (Celsius)
- `setpointHigh` - number - current high setpoint temperature (Celsius) - if `heatcool` mode is used
- `setpointLow` - number - current low setpoint temperature (Celsius) - if `heatcool` mode is used
- `temperature` - number - current observed temperature, in degrees Celsius
- `humidity` - number (0-100) - represents the relative level of the ambient humidity, if supported by the device
- `online` - boolean, default: true - indicates if the device is online

Example flow:
```
[{"id":"31ad7173.3c118e","type":"inject","z":"15d66f47.1c0181","name":"Heat","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"mode\":\"heat\"}","payloadType":"json","x":650,"y":100,"wires":[["d6cf39a4.731f88"]]},{"id":"8766d41a.08d4f8","type":"inject","z":"15d66f47.1c0181","name":"Cool","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"mode\":\"cool\"}","payloadType":"json","x":650,"y":140,"wires":[["d6cf39a4.731f88"]]},{"id":"2da66d37.ad7fc2","type":"inject","z":"15d66f47.1c0181","name":"Offline","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":false}","payloadType":"json","x":650,"y":180,"wires":[["d6cf39a4.731f88"]]},{"id":"ab6b7e03.abb9","type":"inject","z":"15d66f47.1c0181","name":"Online","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"online\":true}","payloadType":"json","x":650,"y":220,"wires":[["d6cf39a4.731f88"]]},{"id":"b1dfcf7b.ba699","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1020,"y":160,"wires":[]},{"id":"d6cf39a4.731f88","type":"noraf-thermostat","z":"15d66f47.1c0181","devicename":"Thermostat","roomhint":"","name":"","modes":"off,heat,cool","unit":"C","rangeMin":"","rangeMax":"","topic":"","passthru":false,"commandOnly":false,"queryOnly":false,"bufferRangeCelsius":2,"nora":"c38ae3d9.b9765","twofactor":"off","twofactorpin":"","x":850,"y":160,"wires":[["b1dfcf7b.ba699"]]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
