import { SceneDevice } from '@andrei-tatar/nora-firebase-common';
import { EMPTY } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { FirebaseSceneDevice } from '../nora/scene-device';
import { convertValueType, getValue, registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-scene', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        const { value: onValue, type: onType } = convertValueType(RED, config.onvalue, config.onvalueType, { defaultValue: true });
        const { value: offValue, type: offType } = convertValueType(RED, config.offvalue, config.offvalueType, { defaultValue: false });

        registerNoraDevice<SceneDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.SCENE',
                traits: ['action.devices.traits.Scene'],
                name: {
                    name: config.devicename,
                },
                willReportState: true,
                roomHint: config.roomhint,
                attributes: {
                    sceneReversible: !!config.scenereversible,
                },
                state: {
                    online: true
                },
                noraSpecific: {
                },
            },
            customRegistration: device$ => device$.pipe(
                switchMap(d => d instanceof FirebaseSceneDevice
                    ? d.activateScene$
                    : EMPTY),
                tap(({ deactivate }) => {
                    const value = !deactivate;
                    this.send({
                        payload: getValue(RED, this, value ? onValue : offValue, value ? onType : offType),
                        topic: config.topic
                    });
                }),
            ),
        });
    });
};

