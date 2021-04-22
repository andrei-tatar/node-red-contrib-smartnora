## How can I migrate from the old NORA service
Unfortunately it's a manual process as this is a completely new service.
All the nodes in Smart NORA are backwards compatible with the old NORA nodes so just copying over the settings from each of the old nodes should do the trick.

The main difference in the new version is that the only accepted signin method is email + password and there is no more token copied from the main page.

## Some devices show no status in Google Home app and can only be controlled using voice
The widget that shows up for a device type in the Google Home application is not under our control. The Google Home application is developed and maintained by the team over at Google and we have no way of changing its behaviour. 

Also, devices that have secondary verification enabled can not be controlled via the touch interface of the Google Home application, only via voice.

[Here is the official list of touch support for Google Home devices](https://developers.google.com/assistant/smarthome/develop/touch-controls)

## My Garage/Lock device is not showing up in Google Home
Google requested all Garage/Lock devices should require pin secondary verification setup for security reasons. If you have the latest `node-red-contrib-smartnora` package, the error should be visible under the node.

<img src="./missing_2fa.png">

In a future release there will be a checkbox in the node-red UI to opt-out of this security restriction once the user acknowledges the security risks.

## I have ghost devices in my Google Home application
This can happen if you use/change the group name in the Smart NORA configuration node. The group name is intended to be used if you have multiple instances of Node RED connected to the same Smart NORA account.

If you change the group name, Smart NORA has no way of knowing if the group was actually deleted or the device that was using the old name just went offline.

In order to delete the unused groups, just head over to [Smart NORA](https://smart-nora.eu/my-nora), login and you will be able to see all the groups synced on your account. Here you can delete the groups you don't want to use. This will trigger a resync with Google Home.
<img src="./delete_group.png">


## I can't link to Google. Each time I try to link, I just get redirected back to Add device page
Not sure exactly why this happens but it seems to happen when there are no devices to sync in node-red. Please make sure you define at least one device before trying to link with Google Home.

## How does local execution work
In order for local execution to work you need to have a Google Home [compatible device](https://developers.google.com/assistant/smarthome/concepts/local#supported-devices) in the same network as the node-red instance you're running Smart NORA. The Google Home device(s) will load a local execution application that broadcasts UDP messages in order to discover any Smart NORA instances running locally and send commands to them.

The ports used are:
- 6988 - used to broadcast the discovery packet from Google Home
- 6989 - used by node-red to reply to the discovery packet
- 6987 - used to send commands from Google Home to Smart NORA

## How can I check if local execution is working
Devices that receive commands using the local execution path will have a blue status color (starting with version 1.0.3), like in the image below. Keep in mind not all devices support local execution (devices that require secondary verification, garage door, lock/unlock).

It might take a few hours after linking until the Google Home devices start using the local execution scripts.

<img src="./local_execution.png">

Furthermore, you can enable `trace` level logging in node-red which will reveal extra information about local execution in the node red logs like:
```
21 Apr 10:25:10 - [trace] [nora][local-execution] Received discovery packet, sending reply
21 Apr 10:44:53 - [trace] [nora][local-execution] Executing action.devices.commands.OnOff - device: group|id
```
