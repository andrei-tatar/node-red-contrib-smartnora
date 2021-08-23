import { CameraStreamDevice, CameraStreamResult } from '@andrei-tatar/nora-firebase-common';
import { NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-camera', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const protocols: CameraStreamResult[] = config.protocols ?? [];
        if (!protocols) {
            return;
        }

        registerNoraDevice<CameraStreamDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.CAMERA',
                traits: ['action.devices.traits.CameraStream'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                attributes: {
                    cameraStreamNeedAuthToken: !!config.cameraStreamNeedAuthToken,
                    cameraStreamSupportedProtocols: protocols.map(p => p.cameraStreamProtocol),
                },
                noraSpecific: {
                    asyncCommandExecution: config.asyncCmd,
                    cameraStreamProtocols: protocols,
                },
                state: {
                    online: true,
                },
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload);
            },
        });
    });
};

