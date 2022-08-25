import { EnergyStorageDevice } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-charger', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const noraConfig: ConfigNode = RED.nodes.getNode(config.nora);
        if (!noraConfig?.valid) {
            return;
        }

        registerNoraDevice<EnergyStorageDevice>(this, RED, config, {
            deviceConfig: {
                type: 'action.devices.types.CHARGER',
                traits: ['action.devices.traits.EnergyStorage'],
                name: {
                    name: config.devicename,
                },
                roomHint: config.roomhint,
                willReportState: true,
                state: {
                    online: true,
                    descriptiveCapacityRemaining: 'MEDIUM',
                },
                attributes: {
                    queryOnlyEnergyStorage: false,
                    energyStorageDistanceUnitForUX: config.energyStorageDistanceUnitForUX,
                    isRechargeable: !!config.isRechargeable,
                },
                noraSpecific: {
                    asyncCommandExecution: !!config.asyncCmd,
                },
            },
            updateStatus: ({ state, update }) => {
                const states: string[] = [];

                if (state.capacityRemaining?.length) {
                    states.push(`R:${state.capacityRemaining[0].rawValue}${state.capacityRemaining[0].unit}`);
                } else {
                    states.push(state.descriptiveCapacityRemaining);
                }
                if (state.capacityUntilFull?.length) {
                    states.push(`F:${state.capacityUntilFull[0].rawValue}${state.capacityUntilFull[0].unit}`);
                }
                if (state.isCharging) {
                    states.push('charging');
                }
                if (state.isPluggedIn) {
                    states.push('plugged-in');
                }

                update(states.join(','));
            },
            mapStateToOutput: state => ({
                payload: { ...state },
            }),
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg.payload);
            },
        });
    });
};

