## Notify
Node used to send web notifications to the subscribed devices. In order to get notifications on a device, you need to browse to https://smart-nora.eu/my-nora, login and click the button to subscribe to notfications.

**Note:** Not all devices/browsers support the [Push API](https://www.w3.org/TR/push-api/) for  web notifications (https://caniuse.com/push-api).

Node attributes:
- `Tag` - [optional] used to identify a notification. A notification with the same tag will override a previos one.
- `Title` - title of the notification
- `Body` - body message of the notification
- `Icon` - [optional] web link to an image that will be used as the notification icon.

**Actions** are optional but can be used to inject actions into the flow from the notification using buttons
- `Label` - the message that will appear on the notification button
- `Value` - the type and the value of the payload that will be sent when the action button in the notification is clicked

Any of the node attributes can be overriden by the message `payload` properties:
- `title` - overrides the title of the notification
- `body` - overrides the body 
- `icon` - overrides the icon
- `tag` - overrides the tag

### Example flow:
```
[{"id":"15d2bc77.95d534","type":"noraf-notify","z":"15d66f47.1c0181","tag":"sample-1","title":"Title","body":"Body Message","icon":"","name":"","nora":"c38ae3d9.b9765","topic":"","actions":[{"p":"OK","v":"ok","vt":"str"},{"p":"Cancel","v":"cancel","vt":"str"}],"x":910,"y":220,"wires":[["59bda358.56095c"]]},{"id":"ab487b16.887728","type":"inject","z":"15d66f47.1c0181","name":"Override the body","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"body\":\"This will override the body\"}","payloadType":"json","x":710,"y":240,"wires":[["15d2bc77.95d534"]]},{"id":"724a49ee.219698","type":"inject","z":"15d66f47.1c0181","name":"Send","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":670,"y":200,"wires":[["15d2bc77.95d534"]]},{"id":"59bda358.56095c","type":"debug","z":"15d66f47.1c0181","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":1100,"y":220,"wires":[]},{"id":"c38ae3d9.b9765","type":"noraf-config","name":"Firebase [test group]","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```
