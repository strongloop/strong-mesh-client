var loopback = require('loopback');
var boot = require('loopback-boot');
var buildBrowserBundle = require('./build-client');
var Primus = require('primus')
var debug = require('debug')('strong-mesh-client:server');

module.exports = function createServer(configFile, options) {
  var server = loopback();
  var sparks = [];
  options = options || {};

  server.dataSource('file', {
    connector: 'memory',
    file: configFile
  });

  boot(server, __dirname);

  var ManagerHost = server.models.ManagerHost;
  var LoadBalancer = server.models.LoadBalancer;

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
        console.error('(strong-mesh-client) Error building client.js');
        console.error(err.stack || err.message);
        res.end();
      }
    });
  });

  server.use(loopback.rest());

  ManagerHost.startPolling();

  updateBalancers();

  server.models.ManagerHost.on('host changed', function(host) {
    debug('host changed %j', host);

    if(server.primus) {
      server.primus.write({
        event: 'host changed',
        data: {
          host: host.id,
          data: host
        }
      });
    }

    updateBalancers();
  });

  function updateBalancers() {
    ManagerHost.sync(function(err) {
      if(err) return console.error(err);
      ManagerHost.find(function(err, hosts) {
        if(err) return console.error(err);
        debug('updating all balancers with raw hosts %j', hosts);
        LoadBalancer.updateAllConifgs(hosts);
      });
    });
  }

  ManagerHost.observe('after delete', function(ctx, next) {
    debug('manager host deleted');
    updateBalancers();
    next();
  });

  LoadBalancer.observe('after save', function(ctx, next) {
    ManagerHost.find(function(err, hosts) {
      if(err) return next(err);
      var validHosts = LoadBalancer.getValidHosts(hosts);
      LoadBalancer.findById(ctx.instance.id, function(err, balancer) {
        if(err) return next(err);
        balancer.updateConfig(validHosts, next);
      });
    });
  });

  return server;
}
