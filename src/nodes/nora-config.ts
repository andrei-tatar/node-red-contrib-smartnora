import { TwoFactor } from '@andrei-tatar/nora-firebase-common';
import { ConfigNode, NodeInterface } from '..';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-config',
        function (this: NodeInterface & ConfigNode, config: any) {
            RED.nodes.createNode(this, config);
            this.email = this.credentials && this.credentials.email;
            this.password = this.credentials && this.credentials.password;
            this.sso = this.credentials && this.credentials.sso;
            this.group = (config.group || '<default>').trim();
            this.valid = !!this.email?.length && (!!this.password?.length || !!this.sso?.length);
            this.localExecution = config.localexecution ?? true;
            this.storeStateInContext = config.storeStateInContext ?? false;

            let structureHint: string | undefined;
            if (typeof config.structure === 'string') {
                structureHint = config.structure.trim() || undefined;
            }

            this.setCommon = (device, deviceConfig?: any) => {
                device.structureHint = structureHint;
                device.noraSpecific.twoFactor = getTwoFactor(config) ?? getTwoFactor(deviceConfig);
                return device;
            };
        },
        {
            credentials: {
                email: { type: 'text' },
                password: { type: 'text' },
                sso: { type: 'text' },
            },
        });
};

function getTwoFactor(config: any): TwoFactor | undefined {
    if (config.twofactor === 'pin' || config.twofactor === 'ack') {
        return {
            type: config.twofactor,
            pin: config.twofactor === 'pin' ? config.twofactorpin?.trim() : undefined,
        };
    }
}

