'use strict'

var multicastdns = require('multicast-dns')
var flatten = require('./flatten')

module.exports = Server

function Server (opts) {
  this.mdns = multicastdns(opts)
  this.registry = {}
  this.mdns.on('query', this._respondToQuery.bind(this))
}

Server.prototype.register = function (records) {
  var self = this

  if (Array.isArray(records)) records.forEach(register)
  else register(records)

  function register (record) {
    // TODO: Should the registry be able to hold two records with the
    // same name and type? Or should the new record replace the old?
    var subRegistry = self.registry[record.type]
    if (!subRegistry) subRegistry = self.registry[record.type] = []
    subRegistry.push(record)
  }
}

Server.prototype.unregister = function (records) {
  var self = this

  if (Array.isArray(records)) records.forEach(unregister)
  else unregister(records)

  function unregister (record) {
    var type = record.type
    if (!(type in self.registry)) return
    self.registry[type] = self.registry[type].filter(function (r) {
      return r.name !== record.name
    })
  }
}

// _handleITxPTQuery is specially designed for reponse ITxPT query only
Server.prototype._handleITxPTQuery = function(query, opts) {
  console.log('opts', opts)
  var self = this
  query.questions.forEach(function (question) {
    var type = question.type
    var name = question.name
     if (type !== 'PTR') return
    var answers = []
    var record = {
      name: opts.serviceName === undefined ? '' : opts.serviceName,
      type: 'PTR',
      ttl: opts.ttl === undefined ? 120 : opts.ttl,
      data: opts.instance === undefined ? '' : opts.instance
    }
    answers.push(record)

    var additionals = []
    var src = {
      service: opts.instance.split('.')[0],
      protocol: opts.instance.split('.')[1],
      name: opts.instance === undefined ? '' : opts.instance,
      type: 'SRV',
      ttl: 120,
      data: {
        port: opts.port === undefined ? 5353 : opts.port,
        target: opts.target === undefined ? '' : opts.target,
      }
    }
    var txt = {
      name: opts.instance === undefined ? '' : opts.instance,
      type: 'TXT',
      ttl: 120,
      data: opts.text
    }
    additionals.push(src)
    additionals.push(txt)

    // TODO: When responding to PTR queries, the additionals array should be
    // populated with the related SRV and TXT records
    self.mdns.respond({ answers: answers, additionals: additionals }, function (err) {
      if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
    })
  })
}

Server.prototype._respondToQuery = function (query) {
  var self = this
  query.questions.forEach(function (question) {
    var type = question.type
    var name = question.name
    var answers = type === 'ANY'
      ? flatten(Object.keys(self.registry).map(self._recordsFor.bind(self, name)))
      : self._recordsFor(name, type)

    if (answers.length === 0) return

    var additionals = []
    if (type !== 'ANY') {
      answers.forEach(function (answer) {
        if (answer.type !== 'PTR') return
        additionals = additionals.concat(flatten(Object.keys(self.registry)
          .filter(function (type) {
            return ~['SRV', 'TXT'].indexOf(type)
          })
          .map(self._recordsFor.bind(self, answer.data))))
      })
    }

    // TODO: When responding to PTR queries, the additionals array should be
    // populated with the related SRV and TXT records
    self.mdns.respond({ answers: answers, additionals: additionals }, function (err) {
      if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
    })
  })
}

Server.prototype._recordsFor = function (name, type) {
  var self = this

  type = type ? [type] : Object.keys(this.registry)

  return flatten(type.map(function (type) {
    if (!(type in self.registry)) return []
    if (name) {
      return self.registry[type].filter(function (record) {
        var _name = ~name.indexOf('.') ? record.name : record.name.split('.')[0]
        return _name === name
      })
    } else {
      return self.registry[type]
    }
  }))
}
