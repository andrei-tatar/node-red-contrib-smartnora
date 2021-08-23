## Camera

Represents a [Google Home Camera](https://developers.google.com/assistant/smarthome/guides/camera) device.

Node attributes:
- [Common](../common.md)
- `Needs auth token` - whether an auth token will be provided for the target surface to stream the camera feed
- `Enable hls` - if checked, enables HTTP Live Streaming
- `Enable dash` - if checked, enables Dynamic Adaptive Streaming over HTTP
- `Enable smooth stream` - if checked, enables Smooth Streaming
- `Enable progressive mp4` - if checked, enables Progressive MP4 (mostly used for clips)
- `Enable webrtc` - if checked, enables WebRTC
- `Auth token` - An auth token for the specific receiver to authorize access to the stream. If `Needs auth token` is true and this value is not provided, the user's OAuth credentials will be used as the auth token

All protocols **except WebRTC** have the following config:
- `Access URL` - URL endpoint for retrieving the real-time stream in the specified format
- `App Id` - Cast receiver ID to process the camera stream when the StreamToChromecast parameter is true; default receiver will be used if not provided

**WebRTC**:
- `Signaling URL` - URL endpoint for retrieving and exchanging camera and client [session description protocols](https://en.wikipedia.org/wiki/Session_Description_Protocol) (SDPs). The client should return the signaling URL which uses the `Auth token` as the authentication token in the request header.
- `Offer` - Offer session description protocol (SDP)
- `ICE Servers` - Represents the Interactive Connectivity Establishment (ICE) servers using an encoded JSON string with the description of a [RTCIceServer](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer). If you do not specify STUN (Session Traversal Utilities for NAT) servers, the platform defaults to Google's public STUN servers. TURN (Traversal Using Relays around NAT) servers are only required if you cannot guarantee the IPs / ICE candidates provided will be publicly accessible (e.g. via a media server, public host ICE candidate, relay ICE candidate, etc).

Input payload is an object with the following properties:
- `online` - boolean: true/false, default: true. Flag that indicates if a device is online.
