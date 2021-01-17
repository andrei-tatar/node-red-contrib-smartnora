import { ConfigNode, NodeInterface } from '..';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-config',
        function (this: NodeInterface & ConfigNode, config: any) {
            RED.nodes.createNode(this, config);
            this.email = this.credentials && this.credentials.email;
            this.password = this.credentials && this.credentials.password;
            this.group = (config.group || '<default>').trim();
            this.valid = !!this.email?.length && !!this.password?.length;
        },
        {
            credentials: {
                email: { type: 'text' },
                password: { type: 'text' },
            },
        });
};

