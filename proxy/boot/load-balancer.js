var async = require('async');
var loopback = require('loopback');
var path = require('path');
var boot = require('loopback-boot');
var debug = require('debug')('strong-mesh-client:LoadBalancer');

module.exports = function(server) {
  var LoadBalancer = server.models.LoadBalancer;

  LoadBalancer.updateAllConifgs = function(hosts, cb) {
    LoadBalancer.find(function(err, balancers) {
      if(err) return cb(err);

      debug('found LoadBalancers to update %j', balancers);


      var validHosts = LoadBalancer.getValidHosts(hosts);

      async.each(balancers, function(balancer, cb) {
        balancer.updateConfig(validHosts, cb);
      }, cb);
    });
  }

  LoadBalancer.getValidHosts = function(hosts) {
    var validHosts = [];

    hosts.forEach(function(host) {
      if(!host.error && host.host && host.app && host.app.port) {
        validHosts.push({
          host: host.host,
          port: host.app.port
        });
      } else {
        debug('invalid host %j', host);
      }
    });

    return validHosts;
  }

  LoadBalancer.prototype.updateConfig = function(hosts, cb) {
    // call remote method with hosts...
    debug('updating config for %s %j', this.toURL(), hosts);
    this.createClient().models.Config.setEndpoints(hosts, cb);
  }

  LoadBalancer.prototype.createClient = function() {
    var host = this;
    var client = loopback();
    var remote = client.dataSource('db', {
      connector: 'remote',
      url: this.toURL() + '/api'
    });

    // TODO(ritch) this is going to block and be incredibly slow...
    boot(client, {
      appRootDir: path.join(path.dirname(require.resolve('strong-nginx-controller')))
    });

    client.models.Config.attachTo(remote);

    return client;
  }

  LoadBalancer.prototype.toURL = function() {
    return this.protocol + '://' + this.host + ':' + this.port;
  }
}
