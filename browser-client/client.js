var loopback = require('loopback');
var boot = require('loopback-boot');
var EventEmitter = require('events').EventEmitter;

module.exports = function createClient(proxyUrl, options) {
  var server = loopback();
  options = options || {};

  server.dataSource('proxy', {
    connector: 'remote',
    url: proxyUrl
  });

  var primus = Primus.connect(proxyUrl, options.primus);

  var notifications = server.notifications = new EventEmitter();

  primus.on('data', function(msg) {
    if(msg.event) {
      notifications.emit(msg.event, msg.data);
    }
  });

  boot(server, __dirname);

  return server;
}
