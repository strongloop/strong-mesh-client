var async = require('async');

module.exports = function(server) {
  var LoadBalancer = server.models.LoadBalancer;

  LoadBalancer.updateAllConifgs = function(hosts, cb) {
    LoadBalancer.find(function(err, balancers) {
      if(err) return cb(err);

      var validHosts = [];

      hosts.forEach(function(host) {
        if(host.host && host.app && host.app.port) {
          validHosts.push({
            host: host.host,
            port: host.app.port
          });
        }
      });

      async.each(balancers, function(balancer, cb) {
        balancer.updateConfig(validHosts, cb);
      }, cb);
    });
  }

  LoadBalancer.prototype.updateConfig = function(hosts, cb) {
    // call remote method with hosts...
    cb();
  }
}
