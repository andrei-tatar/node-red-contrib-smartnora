import { EnergyStorageDevice, EneryStorageCapacity } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';
import { registerNoraDevice } from './util';

const SHORT_UNIT = new Map<string, string>([
    ['SECONDS', 'sec'],
    ['MILES', 'mi'],
    ['KILOMETERS', 'km'],
    ['PERCENTAGE', '%'],
    ['KILOWATT_HOURS', 'kWh'],
]);

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
                    queryOnlyEnergyStorage: !!config.queryOnlyEnergyStorage,
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
                    states.push(`R:${humanReadable(state.capacityRemaining[0])}`);
                } else {
                    states.push(state.descriptiveCapacityRemaining);
                }

                if (state.capacityUntilFull?.length) {
                    states.push(`F:${humanReadable(state.capacityUntilFull[0])}`);
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

function humanReadable(cap: EneryStorageCapacity) {
    const shortUnit = SHORT_UNIT.get(cap.unit);
    return `${cap.rawValue}${shortUnit}`;
}
