import { NodeInterface } from '..';
import { AsyncCommandsRegistry } from '../nora/async-commands.registry';
import { handleNodeInput } from './util';

module.exports = function (RED: any) {
    RED.nodes.registerType('noraf-async', function (this: NodeInterface, config: any) {
        RED.nodes.createNode(this, config);

        handleNodeInput({
            node: this,
            nodeConfig: config,
            handler: msg => AsyncCommandsRegistry.handle({
                id: msg._asyncCommandId,
                response: msg.payload,
                warn: w => this.warn(w),
            }),
        });
    });
};

