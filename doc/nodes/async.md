## Asynchronous command exection

**This feature is experimental and only enabled right now for switch/outlet nodes. Be aware that it might have breaking changes in the upcoming releases**

This feature allows the replacement of the regular NORA command handlers with user defined command handlers. Right now a command is handled in the following way:

1. Google sends a command to NORA
2. NORA handles the command by updating the state
3. NORA sends the reply back to Google
4. NORA also sends the updated state to Node-RED

Async command execution allows to replace point 2 with a Node-RED flow. 

**Important Notes**:

- the timeout period from when a command handler begins until a response is awaited is 1500 msec. If more time passes, NORA responds to google that the device is not available (offline)
- when sending a message to the async `response` node, make sure to preserve the `msg._asyncCommandId` property. It's used to correlate the async response with the request

## Example flows:

### Handling the On/Off command on a switch to update the state:
```
[{"id":"6ed0ba1c.8e17f4","type":"noraf-async","z":"68061750.490f48","name":"response","x":620,"y":260,"wires":[]},{"id":"d126cedc.feabf","type":"function","z":"68061750.490f48","name":"","func":"//we only replace the payload, to keep the msg id intact\n\nmsg.payload = {\n    state: {\n        on: msg.payload.on,\n    },\n};\n\nreturn msg;","outputs":1,"noerr":0,"initialize":"","finalize":"","libs":[],"x":480,"y":260,"wires":[["6ed0ba1c.8e17f4"]]},{"id":"b127c595.a98df8","type":"noraf-switch","z":"68061750.490f48","devicename":"Thingie","roomhint":"","name":"","passthru":false,"errorifstateunchaged":false,"nora":"e76a4bf6.431dd8","topic":"","onvalue":"true","onvalueType":"bool","offvalue":"false","offvalueType":"bool","twofactor":"off","twofactorpin":"","filter":false,"asyncCmd":true,"outputs":2,"x":300,"y":240,"wires":[["637078a8.004118"],["d126cedc.feabf"]]},{"id":"637078a8.004118","type":"debug","z":"68061750.490f48","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":490,"y":220,"wires":[]},{"id":"e76a4bf6.431dd8","type":"noraf-config","name":"Nora Testing","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```

### Returning an error code:
```
[{"id":"52bf7fe0.e5491","type":"inject","z":"68061750.490f48","name":"on","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"true","payloadType":"bool","x":150,"y":220,"wires":[["b127c595.a98df8"]]},{"id":"6ed0ba1c.8e17f4","type":"noraf-async","z":"68061750.490f48","name":"response","x":620,"y":260,"wires":[]},{"id":"d126cedc.feabf","type":"function","z":"68061750.490f48","name":"","func":"//we only replace the payload, to keep the msg id intact\n\nif (msg.payload.on) {\n    msg.payload = {\n        errorCode: 'alreadyOn',\n    };\n} else {\n    msg.payload = {\n        state: {\n            on: false,\n        },\n    };\n}\n\nreturn msg;","outputs":1,"noerr":0,"initialize":"","finalize":"","libs":[],"x":480,"y":260,"wires":[["6ed0ba1c.8e17f4"]]},{"id":"b127c595.a98df8","type":"noraf-switch","z":"68061750.490f48","devicename":"Thingie","roomhint":"","name":"","passthru":false,"errorifstateunchaged":false,"nora":"e76a4bf6.431dd8","topic":"","onvalue":"true","onvalueType":"bool","offvalue":"false","offvalueType":"bool","twofactor":"off","twofactorpin":"","filter":false,"asyncCmd":true,"outputs":2,"x":300,"y":240,"wires":[["637078a8.004118"],["d126cedc.feabf"]]},{"id":"637078a8.004118","type":"debug","z":"68061750.490f48","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","statusVal":"","statusType":"auto","x":490,"y":220,"wires":[]},{"id":"a6c6d10c.9740c","type":"inject","z":"68061750.490f48","name":"off","props":[{"p":"payload"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"false","payloadType":"bool","x":150,"y":260,"wires":[["b127c595.a98df8"]]},{"id":"e76a4bf6.431dd8","type":"noraf-config","name":"Nora Testing","group":"test","twofactor":"off","twofactorpin":"","localexecution":true,"structure":""}]
```