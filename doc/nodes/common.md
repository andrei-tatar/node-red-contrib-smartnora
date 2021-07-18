## Attributes all nodes have:
- `[Device Name]` usually the first field after the config node, this field is used to indicate the device name to Google. This is used only duing the sync with Google Home. After the initial sync, you need to change the name of the device in the Google Home app
- `If msg arrives on input, pass through to output` - if checked, all messages that are received by the node, are immediately sent to the node output
- `Ignore input messages that don't match the topic value` - if checked, all messages received with a `msg.topic` different than the `Topic` value, will be ignored
- `Room Hint` Provides the current room of the device in the user's home to simplify setup. This is used only during the sync with Google Home. After the initial sync, you need to change the room in the Google Home app
- `Two Factor` Provides means of securing command execution for the device. Note that enabling secondary verification for a device will disable local exection for that device. Also, touch widgets do not work for devices with secondary verification. Available modes are:
  - `None` - no secondary verification used;
  - `Acknowledge` - Google Assistant will ask for confirmation when a command is invoked, preventing accidental command execution
  - `Pin` - Google Assistant will ask for a pin code when a command is invoked, preventing unauthorized access
- `Topic` Attaches the string value as a `topic` property to any outgoing message from the node (also used to optionally filter the input messages)

