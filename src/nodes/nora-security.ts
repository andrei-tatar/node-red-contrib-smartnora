import { ArmDisarmDevice, isStatusReportDevice, StatusReportDevice } from '@andrei-tatar/nora-firebase-common';
import { NodeInterface } from '..';
import { registerNoraDevice } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-security', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        const armLevels: { v: string, n: string }[] | undefined = config.armLevels;
        const deviceConfig: Omit<ArmDisarmDevice, 'id'> = {
            type: 'action.devices.types.SECURITYSYSTEM',
            traits: ['action.devices.traits.ArmDisarm'],
            name: {
                name: config.devicename,
            },
            roomHint: config.roomhint,
            willReportState: true,
            noraSpecific: {
            },
            state: {
                online: true,
                currentArmLevel: armLevels?.[0]?.v,
                isArmed: false,
            },
            attributes: {
                availableArmLevels: armLevels && armLevels?.length > 0
                    ? {
                        levels: armLevels.map(({ v, n }) => ({
                            level_name: v,
                            level_values: [{
                                level_synonym: n.split(',').map(p => p.trim()),
                                lang: config.language,
                            }],
                        })),
                        ordered: true,
                    }
                    : undefined,
            },
        };

        if (config.supportStatusReport) {
            deviceConfig.traits.push('action.devices.traits.StatusReport');
            if (isStatusReportDevice(deviceConfig)) {
                const statusReportState: Omit<StatusReportDevice['state'], 'online'> = {
                    currentStatusReport: [],
                };
                Object.assign(deviceConfig.state, statusReportState);
            }
        }

        registerNoraDevice(this, RED, config, {
            deviceConfig,
            updateStatus: ({ state, update }) => {
                const statuses: string[] = [];

                statuses.push(state.isArmed ? 'armed' : 'disarmed');
                if (state.currentArmLevel) {
                    statuses.push(state.currentArmLevel);
                }

                if (typeof state.exitAllowance === 'number') {
                    statuses.push(`${state.exitAllowance} sec`);
                }

                update(statuses.join(','));
            },
            stateChanged: (state) => {
                this.send({
                    payload: state,
                    topic: config.topic
                });
            },
            handleNodeInput: async ({ msg, updateState }) => {
                await updateState(msg?.payload);
            },
        });
    });
};
