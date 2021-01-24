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

            if (config.twofactor === 'pin' || config.twofactor === 'ack') {
                const twoFactor: TwoFactor = {
                    type: config.twofactor,
                    pin: config.twofactor === 'pin' ? config.twofactorpin?.trim() : undefined,
                };
                this.twoFactor = twoFactor;
            }
        },
        {
            credentials: {
                email: { type: 'text' },
                password: { type: 'text' },
            },
        });
};

