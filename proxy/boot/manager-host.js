module.exports = function setupHooks(server) {
  var uuid = require('node-uuid');
  var url = require('url');
  var request = require('request');
  var ManagerHost = server.models.ManagerHost;
  var loopback = require('loopback');
  var Change = loopback.Change;
  var boot = require('loopback-boot');
  var async = require('async');
  var path = require('path');
  var debug = require('debug')('ManagerHost');

  ManagerHost.beforeCreate = function(next) {
    var host = this;
    this.id = uuid.v4();
    this.protocol = this.protocol || 'http';
    debug('creating host %s:%s', host.host, host.port);
    next();
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

    host.debug('sync started');

    this.getServiceInstance(function(err, inst) {
      if(err) {
        host.setActions();
        return host.handleError(err, function(handleErrorErr) {
          if(handleErrorErr) return cb(handleErrorErr);
          host.debug('sync error');
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

      });
      request({
        url: host.toURL() + '/ServiceInstance/' + inst.id + '/processes',
        json: true,
        verb: 'GET'
      }, function(err, body, res) {
        var processes = body;

        if(err) {
          host.debug('error getting processes');
          host.debug(err);
          return host.handleError(err, cb);
        }
        host.clearError();
        host.processes = host.processes || {};
        host.processes.pids = processes;

        var listeningSockets = processes && processes[0] && processes[0].listeningSockets;

        host.debug('setting host.processes.pids');
        host.debug(processes);

        var port = listeningSockets && listeningSockets[0] && listeningSockets[0].port

        if(host.app && port) {
          host.app.port = port;
          host.debug('setting app port');
          host.debug(port);
        }
        host.setActions();
        host.debug('sync complete');
        host.save(function(err) {
          if(err) return cb(err);
          cb(null, Change.revisionForInst(host) !== originalRev);
        });
      });
    });
  }

  ManagerHost.prototype.debug = function(msg) {
    var url = this.toURL();
    debug('(%s) - %j', url, msg);
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
      var u = url.parse(ctx.req.url);
      u.hostname = host.host;
      u.port = host.port;
      ctx.req.url = url.format(u);
      host.debug('making request to ' + ctx.req.url);
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
    var hasApp = this.app;
    var actions = this.actions = ['delete', 'edit'];

    if(!this.error) {
      actions.push('env-set', 'env-get');
    }

    if(hasPids) {
      actions.push('stop', 'restart', 'cluster-restart');
    } else if(hasApp) {
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
