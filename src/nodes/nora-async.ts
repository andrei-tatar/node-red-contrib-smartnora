import { NodeInterface } from '..';
import { AsyncCommandsRegistry } from '../nora/async-commands.registry';
import { handleNodeInput } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-async', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        handleNodeInput({
            node: this,
            nodeConfig: config,
            handler: msg => {
                if (typeof msg.payload === 'object') {
                    const response = {
                        state: msg.payload?.state,
                        errorCode: msg.payload?.errorCode,
                        timestamp: new Date().getTime(),
                    };
                    AsyncCommandsRegistry.handle(msg._asyncCommandId, response);
                }
            },
        });
    });
};

