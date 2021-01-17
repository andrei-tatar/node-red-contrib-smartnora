node-red-contrib-nora-firebase
=====================

[![npm](https://img.shields.io/npm/v/node-red-contrib-nora-firebase.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/node-red-contrib-nora-firebase)
[![dependencies Status](https://img.shields.io/david/andrei-tatar/node-red-contrib-nora-firebase.svg?style=flat-square)](https://david-dm.org/andrei-tatar/node-red-contrib-nora-firebase)
[![devDependencies Status](https://img.shields.io/david/dev/andrei-tatar/node-red-contrib-nora-firebase.svg?style=flat-square)](https://david-dm.org/andrei-tatar/node-red-contrib-nora-firebase?type=dev)
[![downloads](https://img.shields.io/npm/dm/node-red-contrib-nora-firebase.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-nora-firebase)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?style=flat-square&logo=paypal)](https://paypal.me/andreitatar)

This module provides a set of nodes in Node-RED for Google smart home Action integration via [NORA](https://nora-firebase.web.app/).

## ~~In Testing~~

~~In order to be able to link NORA to your Google Home, send me a PM on [Node-RED Forum](https://discourse.nodered.org/u/andrei-tatar/summary) with the gmail address you use with your Google Home and I will add it to the "Testers" list.~~

Publicly available and free of charge. If a very big number of active users is exceeded (more than 2K...) I may need to charge or block access. Also, if you like NORA and find it useful or you simply want to support the development and adding new features, **consider donating using [Paypal Me](https://paypal.me/andreitatar)**.

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

For feedback, you can join the Node-RED topic opened for this project on the Node-RED forum: [Node-RED google home integration](https://discourse.nodered.org/t/node-red-google-home-integration/4829)

## Setup

### Node-RED (*These steps need to happen only once*)

1. Open your node-red instance and install `node-red-contrib-nora-firebase`. You can do this by clicking the hamburger menu in the top-right corner and select `Manage palette`, select `Install`, type `node-red-contrib-nora-firebase` and click the install button.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/1_pallete.png" width=350>
<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/2_pallete_install.png" width=500>

2. After installation is complete a new set of nodes shoud appear under nora category

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/3_new_nodes.png" width=200>

### Get the NORA service token (*These steps need to happen only once*)

1. Go to [NORA homepage](https://nora-firebase.web.app/)
2. Login with your Google or Github account
3. Copy the generated token in your clipboard to be later used in Node-RED.

### Create/Adapt a Node-RED flow

1. Create a new flow (or open the existing one you want to use) and add the NORA nodes you plan to use. Each NORA node will correspond to a Google Home device. In this case we are going to use a light node.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/4_flow.png" width=400>

2. Edit the light node. Add a new nora-config (configs can be reused between multiple nora devices) in which you need to paste the token copied from the NORA homepage. The `Group` is used if you want to use multiple connections to the same NORA account (if you use multiple Node-RED instances).

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/5_edit_node.png" width=800>

3. Deploy your flow

### Link to Google Home (*These steps need to happen only once*)
Once you have at least one NORA device you can link your Google Home to NORA

1. Open your Google Home and click Add

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/6_ghome_open.png" width=300>

2. In the `Add and manage` screen, select `Set up device`.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/7_ghome_add.png" width=300>

3. Select `Have something already set up?`

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/8_ghome_setup.png" width=300>

4. Select `NORA` (in this image it's already linked) and login again with the Google/Github account you used when logging in to the NORA homepage.

<img src="https://raw.githubusercontent.com/andrei-tatar/node-red-contrib-nora-firebase/master/doc/9_ghome_manage.jpeg" width=300>

The devices setup in Node-RED will sync with your Google Home and now you are able to control them via voice/routines/etc.
