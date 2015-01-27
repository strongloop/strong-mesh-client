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
    ManagerHost.sync();
    setInterval(function() {
      ManagerHost.sync();
    }, ManagerHost.settings.interval || 1000);
  }

  ManagerHost.sync = function(cb) {
    ManagerHost.find(function(err, hosts) {
      async.each(hosts, function(host, cb) {
        host.sync(function(err, changed) {
          host.save(function(err) {
            if(err) return cb(err);
            if(changed) {
              ManagerHost.emit('host changed', host.id);
            }
          });
        });
      }, cb);
    });
  }

  ManagerHost.prototype.sync = function(cb) {
    var host = this;
    var originalRev = Change.revisionForInst(host);

    this.getServiceInstance(function(err, inst) {
      if(err) {
        return host.handleError(err, function(err) {
          cb(err, Change.revisionForInst(host) !== originalRev);
        });
      }

      if(inst.applicationName && inst.npmModules) {
        host.app = {
          name: inst.applicationName,
          version: inst.npmModules.version
        }
      }

      inst.processes(function(err, processes) {
        if(err) {
          return host.handleError(err, cb);
        }
        host.clearError();
        host.setActions();
        host.processes = host.processes || {};
        host.processes.pids = processes;
        var listeningSockets = processes && processes[0] && processes[0].listeningSockets;


        var port = listeningSockets && listeningSockets[0] && listeningSockets[0].port

        if(host.app && port) {
          host.app.port = port;
        }
        cb(null, Change.revisionForInst(host) !== originalRev);
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
    this.processes = null;
    this.app = null;
    // TODO(ritch) set this.errorType
    this.save(cb);
  }

  ManagerHost.prototype.clearError = function() {
    this.error = this.errorType = null;
  }

  ManagerHost.prototype.setActions = function() {
    var procs = this.processes;
    var hasPids = procs && procs.pids && procs.pids.length;
    var actions = this.actions = ['delete', 'edit', 'env-set', 'env-get'];

    if(hasPids) {
      actions.push('stop', 'restart', 'cluster-restart');
    } else {
      actions.push('start');
    }
  }

  ManagerHost.prototype.action = function(request, cb) {
    this.getServiceInstance(function(err, inst) {
      if(err) return cb(err);
      if(inst) {
        inst.actions.create({
          request: request
        }, cb);
      } else {
        cb(new Error('no instance available'));
      }
    });
  }
};
