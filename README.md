node-red-contrib-smartnora
=====================

[![npm](https://img.shields.io/npm/v/node-red-contrib-smartnora.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/node-red-contrib-smartnora)
[![dependencies Status](https://img.shields.io/david/andrei-tatar/node-red-contrib-smartnora.svg?style=flat-square)](https://david-dm.org/andrei-tatar/node-red-contrib-smartnora)
[![devDependencies Status](https://img.shields.io/david/dev/andrei-tatar/node-red-contrib-smartnora.svg?style=flat-square)](https://david-dm.org/andrei-tatar/node-red-contrib-smartnora?type=dev)
[![downloads](https://img.shields.io/npm/dm/node-red-contrib-smartnora.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-smartnora)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?style=flat-square&logo=paypal)](https://paypal.me/andreitatar)

This module provides a set of nodes in Node-RED for Google smart home Action integration via [Smart NORA](https://smart-nora.eu/).
This is a new implementation based on firebase for NORA.

## Alpha Testing

This is in alpha testing.


## Supported nodes with devices/traits:


| Type       | Traits                        |
|------------|-------------------------------|
| light      | on/off, [brightness], [color] |
| outlet     | on/off                        |
| scene      | scene                         |
| speaker    | on/off, volume                |
| switch     | on/off                        |
| thermostat | thermostat                    |
| blinds     | open/close                    |
| garage     | open/close                    |


## Forum

Send me a message to join the NORA Discord server.

## Setup

### Node-RED (*These steps need to happen only once*)

1. Open your node-red instance and install `node-red-contrib-smartnora`. You can do this by clicking the hamburger menu in the top-right corner and select `Manage palette`, select `Install`, type `node-red-contrib-smartnora` and click the install button.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/1_pallete.png" width=350>
<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/2_pallete_install.png" width=500>

2. After installation is complete a new set of nodes shoud appear under nora category

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/3_new_nodes.png" width=200>

### Create a NORA account (*These steps need to happen only once*)

1. Go to [NORA homepage](https://nora-firebase.web.app/)
2. Create an account using your email address and a password
3. Verify your email address by clicking the link in the email

### Create/Adapt a Node-RED flow

1. Create a new flow (or open the existing one you want to use) and add the NORA nodes you plan to use. Each NORA node will correspond to a Google Home device. In this case we are going to use a light node.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/4_flow.png" width=400>

2. Edit the light node. Add a new nora-config (configs can be reused between multiple nora devices) in which you need to enter your credentials (email/password) used when you created your NORA account. The `Group` is used if you want to use multiple connections to the same NORA account (if you use multiple Node-RED instances - leave it blank if you don't plan on using this!).

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/5_edit_node.png" width=800>

3. Deploy your flow

### Link to Google Home (*These steps need to happen only once*)
Once you have at least one NORA device you can link your Google Home to NORA

1. Open your Google Home and click Add

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/6_ghome_open.png" width=300>

2. In the `Add and manage` screen, select `Set up device`.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/7_ghome_add.png" width=300>

3. Select `Have something already set up?`

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/8_ghome_setup.png" width=300>

4. Select `NORA` (in this image it's already linked) and login again with the Google/Github account you used when logging in to the NORA homepage.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-smartnora/master/doc/9_ghome_manage.jpeg" width=300>

The devices setup in Node-RED will sync with your Google Home and now you are able to control them via voice/routines/etc.
