var loopback = require('loopback');
var boot = require('loopback-boot');
var buildBrowserBundle = require('./build-client');

module.exports = function createServer(configFile, options) {
  var server = module.exports = loopback();

  server.dataSource('file', {
    connector: 'memory',
    file: configFile
  });

  boot(server, __dirname);

  server.get('/client.js', function(req, res) {
    buildBrowserBundle(process.env.NODE_ENV, res, function(err) {
      if(err) {
        res.status(500).send(err);
      } else {
        res.end();
      }
    });
  });

  server.use(loopback.rest());

  server.models.ManagerHost.startPolling();

  server.models.ManagerHost.on('host changed', function(id) {
    console.log('host %s changed!',  id);
  });

  return server;
}
