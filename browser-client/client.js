var loopback = require('loopback');
var boot = require('loopback-boot');

module.exports = function createServer(proxyUrl, options) {
  var server = module.exports = loopback();

  server.dataSource('proxy', {
    connector: 'remote',
    url: proxyUrl
  });

  boot(server, __dirname);
  
  return server;
}
