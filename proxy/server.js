var loopback = require('loopback');
var boot = require('loopback-boot');
var buildBrowserBundle = require('./build-client');
var Primus = require('primus')

module.exports = function createServer(configFile, options) {
  var server = loopback();
  var sparks = [];
  options = options || {};

  server.dataSource('file', {
    connector: 'memory',
    file: configFile
  });

  boot(server, __dirname);

  server.setupPrimus = function(httpServer, options) {
    options = options || {};
    options.transformer = options.transformer || 'engine.io';
    server.primus = new Primus(httpServer, options);
    server.primusClient = server.primus.library();
  }

  server.get('/client.js', function(req, res) {
    res.set('Content-Type', 'application/javascript');
    res.write(server.primusClient, 'utf-8');

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

  server.models.ManagerHost.find(function(err, hosts) {
    server.models.LoadBalancer.updateAllConifgs(hosts);
  });

  server.models.ManagerHost.on('host changed', function(host) {
    if(server.primus) {
      server.primus.write({
        event: 'host changed',
        data: {
          host: host.id,
          data: host
        }
      });
    }
    setTimeout(function() {
      server.models.ManagerHost.find(function(err, hosts) {
        server.models.LoadBalancer.updateAllConifgs(hosts);
      });
    }, 2000);
  });

  return server;
}
