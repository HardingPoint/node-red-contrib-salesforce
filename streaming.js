module.exports = function(RED) {
    const nforce = require('./nforce_wrapper');

    function Streaming(config) {
        const node = this;
        RED.nodes.createNode(node, config);
        node.connection = RED.nodes.getNode(config.connection);
        node.subscriptionActive = false;
        node.client = {}; // The client

        node.status({ fill: 'gray', shape: 'ring', text: 'idle' });

        this.on('input', function(msg) {
            const action = msg.action || 'subscribe';
            if (action === 'subscribe') {
                // create connection object
                node.status({ fill: 'blue', shape: 'ring', text: 'connecting....' });
                debugger;
                const org = nforce.createConnection(node.connection, msg);
                try {
                    nforce.authenticate(org, node.connection, msg, function(err, oauth) {
                        if (err) {
                            var errormsg = '';
                            if (err.message==null)
                                errormsg = JSON.stringify(err);

                            node.status({ fill: 'red', shape: 'dot', text: 'Error:' + errormsg });
                            console.log('[GRAX.io] ERROR nforce.authenticate - ' + JSON.stringify(err));
                            // console.log(JSON.stringify(node.connection));
                            return node.error(err, errormsg);
                        }
                        const opts = {};
                        const topicType = msg.topicType || config.topicType;
                        if (topicType === 'platform') {
                            opts.isEvent = true;
                        } else if (topicType === 'generic') {
                            opts.isSystem = true;
                        }
                        // Topic in message takes priority over configuration
                        opts.topic = msg.topic || config.pushTopic;
                        const subscriptionMessage = 'Subscription on ' + topicType + ' to:' + opts.topic;

                        var stream;
                        try {
                            node.client = org.createStreamClient();
                            stream = node.client.subscribe(opts);
                            node.log(subscriptionMessage);
                            node.status({ fill: 'blue', shape: 'dot', text: subscriptionMessage });
                            node.subscriptionActive = true;
                            stream.on('error', function(err) {
                                node.log('Subscription error!!!');
                                node.status({ fill: 'red', shape: 'dot', text: 'Error:' + err.message });
                                node.log(err, msg);
                                node.client.disconnect();
                                node.subscriptionActive = false;
                                return node.error(err, err.message);
                            });
                        } catch (ex) {
                            node.status({ fill: 'red', shape: 'dot', text: 'Error:' + ex.message });
                            return node.error(ex, ex.message);
                        }

                        stream.on('data', function(data) {
                            node.status({ fill: 'green', shape: 'dot', text: 'Receiving data' });
                            node.send({
                                payload: data
                            });
                            node.status({ fill: 'blue', shape: 'dot', text: subscriptionMessage });
                        });
                    });
                } catch (ex) {
                    node.status({ fill: 'red', shape: 'dot', text: 'Error:' + ex.message });
                    return node.error(ex, ex.message);
                }

            } else if (node.subscriptionActive) {
                // Unsubscribe only for active subscriptions
                if (node.client.disconnect) {
                    node.client.disconnect();
                    node.status({ fill: 'gray', shape: 'ring', text: 'idle' });
                    node.subscriptionActive = false;
                }
            }
        });
    }

    RED.nodes.registerType('streaming', Streaming);
};