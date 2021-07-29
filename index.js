'use strict'

var registry = require('./lib/registry')
var Server = require('./lib/mdns-server')

module.exports = function (opts) {
  var server = new Server(opts)

  return {
    handleQuery: registry.handleQuery.bind(null, query),
    setText: registry.setText.bind(null, server),
    publish: registry.publish.bind(null, server),
    unpublishAll: registry.unpublishAll.bind(null, server),
    tcp: {
      publish: publish.bind(null, 'tcp')
    },
    udp: {
      publish: publish.bind(null, 'udp')
    }
  }

  function publish (protocol, opts) {
    if (typeof opts === 'string') return publish(protocol, { type: opts, port: arguments[2] })
    opts.protocol = protocol
    return registry.publish(server, opts)
  }
}
