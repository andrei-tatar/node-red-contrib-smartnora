## Config

Represents a NORA configuration node.

Node attributes:
- `Name` - identifier for the config node
- `Email` - email address used when registering on [Smart NORA](https://smart-nora.eu/)
- `Password` - password associated with the email address
- `Home name` - suggested name for the structure (`structureHint`) where this device is installed. Google attempts to use this value during user setup
- `Group` - group name to identify multiple instances of node-red connecting with the same credentials. **Leave this field blank** if you're not using multiple instances of node-red on the same account
- `Two Factor` - same as the *node specific* `Two Factor` attribute described [here](../common.md) but will override the `Two Factor` for any node that uses this configuration
- `Local execution support` - if checked will enable local execution support for devices that use this configuration. Note that not all devices support local execution path.