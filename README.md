Smart NORA integration plugin for Node RED
=====================

[![Node.js CI](https://github.com/andrei-tatar/node-red-contrib-smartnora/actions/workflows/node.js.yml/badge.svg)](https://github.com/andrei-tatar/node-red-contrib-smartnora/actions/workflows/node.js.yml)
[![npm](https://img.shields.io/npm/v/node-red-contrib-smartnora.svg?logo=npm)](https://www.npmjs.com/package/node-red-contrib-smartnora)
[![GitHub last commit](https://img.shields.io/github/last-commit/andrei-tatar/node-red-contrib-smartnora)](https://github.com/andrei-tatar/node-red-contrib-smartnora/commits/master)
[![downloads](https://img.shields.io/npm/dm/node-red-contrib-smartnora.svg)](https://www.npmjs.com/package/node-red-contrib-smartnora)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/andreitatar)

This module provides a set of nodes in Node-RED for Google smart home Action integration via [Smart NORA](https://smart-nora.eu/).

## Features
- support for multiple devices/traits (On/Off, Brightness, Color, Open/Close, etc.) and many more to come
- local execution path to reduce latency to a minimum
- web push notifications to mobile devices so you don't need yet another service to be informed about the important things
- better performance with capability of scaling up for tens of thousands of users

## Setup

[Here's a short guide](./doc/setup/README.md) on how to get started with Smart NORA.

## Subscription

Yes, starting with the 1st of December, a paid subscription is required to have more than 5 devices synchronized with Google Home. This was added to cover the cloud costs of the service, the business overhead (starting and owning a business, accounting, taxes, VAT, payment processor fees, etc.), offer a bit of support to the ongoing development and hopefully a beer or two at the end of the month 🍻.

There are two ways of using the service:
1. Free. This will limit the devices synced with Google to **5**. There is no way to determine which will be synced if you have more than 5 devices defined in node-red (note that not all nodes are a device).
2. Subscription based (monthly or yearly recurring payment) integration via Stripe. 

Once you create a subscription, you can cancel/change it at any time from https://smart-nora.eu/my-nora. You will see a *Manage subscription* button that will take you to Stripe Customer Portal where you can cancel, change the plan (monthly vs yearly), change billing information, etc.

Canceling a subscription maintains it active until the end of the paid period, it's not immediate. So if you pay for one year and don't want a recurring payment, you can just cancel it and the subscription will remain active for the rest of the year. 

## Supported nodes

[Here's a list](./doc/nodes) and documentation on the supported nodes. 
If a device that you want is not on the list, you can [create a new discussion](https://github.com/andrei-tatar/node-red-contrib-smartnora/discussions/new) to discuss it. Contributions are appreciated, especially around the node-red configuration node code (html file) and documentation.

## Changelog

You can see all the releases and the changes made over on the [releases page](https://github.com/andrei-tatar/node-red-contrib-smartnora/releases).

## Discussions

[Github Discussions](https://github.com/andrei-tatar/node-red-contrib-smartnora/discussions)

## I'm having an issue

For any issues you might encounter, please check the [FAQ section](./doc/faq/README.md), check [the existing issues](https://github.com/andrei-tatar/node-red-contrib-smartnora/issues) or [open a new issue](https://github.com/andrei-tatar/node-red-contrib-smartnora/issues/new/choose) on this repository.
