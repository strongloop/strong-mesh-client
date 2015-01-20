module.exports = function setupHooks(server) {
  var uuid = require('node-uuid');
  var ManagerHost = server.models.ManagerHost;
  var loopback = require('loopback');
  var Change = loopback.Change;
  var boot = require('loopback-boot');
  var async = require('async');
  var path = require('path');

  ManagerHost.beforeCreate = function(next) {
    this.id = uuid.v4();
    this.protocol = this.protocol || 'http';
    if(this.error) {
      next();
    } else {
      // get the latest info
      this.sync(next);
    }
  }

  ManagerHost.startPolling = function() {
    setInterval(function() {
      ManagerHost.sync();
    }, ManagerHost.settings.interval || 15000);
  }

  ManagerHost.sync = function(cb) {
    ManagerHost.find(function(err, hosts) {
      async.each(hosts, function(host, cb) {
        host.sync(function(err) {
          if(err) {
            cb(err);
          } else {
            host.save(cb);
          }
        });
      }, cb);
    });
  }

  ManagerHost.prototype.sync = function(cb) {
    var host = this;
    var originalRev = Change.revisionForInst(host);
    this.getServiceInstance(function(err, inst) {
      if(err) {
        return host.handleError(err, cb);
      }
      // TODO(ritch) set host.app
      inst.processes(function(err, processes) {
        console.log('processes', arguments);
        if(err) {
          return host.handleError(err, cb);
        }
        host.clearError();
        host.setActions();
        host.processes = host.processes || {};
        host.processes.pids = processes;
        if(Change.revisionForInst(host) !== originalRev) {
          ManagerHost.emit('host changed', host.id);
        }
        cb();
      });
    });
  }

  ManagerHost.prototype.createClient = function() {
    var host = this;
    var client = loopback();
    var ds = client.dataSource('remote', {
      connector: 'remote',
      url: this.toURL() + '/api'
    });
    
    // TODO(ritch) this is going to block and be incredibly slow...
    boot(client, {
      appRootDir: path.join(path.dirname(require.resolve('strong-pm')), 'lib', 'client')
    });

    ds.connector.remotes.before('**', before);
    
    function before(ctx, next) {
      ctx.req.headers = ctx.req.headers || {};
      ctx.req.headers.Authorization =  host.getAuthString();
      next();
    }

    return client;
  }

  ManagerHost.prototype.getServiceInstance = function(cb) {
    this.createClient().models.ServiceInstance.findOne(cb);
  }

  ManagerHost.prototype.toURL = function() {
    return this.protocol + '://' + this.host + ':' + this.port;
  }

  ManagerHost.prototype.getAuthString = function() {
    var credentials = this.credentials;
    if(credentials && credentials.username && credentials.password) {
      return 'Basic ' + credentials.username + ':' + credentials.password;
    } else {
      return "";
    }
  }

  ManagerHost.prototype.handleError = function(err, cb) {
    this.error = {
      message: err.message,
      status: err.status
    };
    // TODO(ritch) set this.errorType
    this.save(cb);
  }

  ManagerHost.prototype.clearError = function() {
    this.error = this.errorType = null;
  }

  ManagerHost.prototype.setActions = function() {
    var procs = this.processes;
    var hasPids = procs && procs.pids && procs.pids.length;
    var actions = this.actions = ['delete', 'edit'];
    if(hasPids) {
      actions.push('stop', 'restart');
    } else {
      actions.push('start');
    }
  }
};
