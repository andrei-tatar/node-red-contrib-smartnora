import { TwoFactor } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-config',
        function (this: NodeInterface & ConfigNode, config: any) {
            RED.nodes.createNode(this, config);
            this.email = this.credentials && this.credentials.email;
            this.password = this.credentials && this.credentials.password;
            this.group = (config.group || '<default>').trim();
            this.valid = !!this.email?.length && !!this.password?.length;
            this.localExecution = config.localexecution ?? true;
            this.structureHint = config.structure;

            let twoFactor: TwoFactor | undefined;
            if (config.twofactor === 'pin' || config.twofactor === 'ack') {
                twoFactor = {
                    type: config.twofactor,
                    pin: config.twofactor === 'pin' ? config.twofactorpin?.trim() : undefined,
                };
            }

            let structureHint: string | undefined;
            if (typeof config.structure === 'string') {
                structureHint = config.structure.trim() || undefined;
            }

            this.setCommon = (device) => {
                device.structureHint = structureHint;
                device.noraSpecific.twoFactor = twoFactor;
                return device;
            };
        },
        {
            credentials: {
                email: { type: 'text' },
                password: { type: 'text' },
            },
        });
};

