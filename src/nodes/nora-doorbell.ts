import { ObjectDetectionDevice, ObjectDetectionNotification, validateIndividual } from '@andrei-tatar/nora-firebase-common';
import { firstValueFrom } from 'rxjs';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-doorbell', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        registerNoraDevice<ObjectDetectionDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.DOORBELL',
                traits: ['action.devices.traits.ObjectDetection'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                notificationSupportedByAgent: true,
                state: {
                    online: true,
                },
                attributes: {
                },
                noraSpecific: {
                },
            },
            handleNodeInput: async ({ msg, updateState, device$ }) => {
                const { online, named, familiar, unfamiliar, unclassified } = msg.payload;
                if (typeof online !== 'undefined') {
                    await updateState({ online });
                }

                const objects = { named, familiar, unfamiliar, unclassified };
                for (const key of Object.keys(objects) as (keyof typeof objects)[]) {
                    if (objects[key] === void 0) {
                        delete objects[key];
                    }
                }

                if (Object.entries(objects).length) {
                    const notification: ObjectDetectionNotification = {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        ObjectDetection: {
                            priority: 0,
                            detectionTimestamp: new Date().getTime(),
                            objects,
                        }
                    };

                    const result = validateIndividual('object-detection-notification', notification);
                    if (!result.valid) {
                        throw new Error(`Invalid notification object ${result.errors}`);
                    }

                    const device = await firstValueFrom(device$);
                    await device.sendNotification(notification);
                }
            },
        });
    });
};

