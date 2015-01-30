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
        var originalRev = Change.revisionForInst(host);

        host.sync(function(err) {
          if(err) {
            host.handleError(err);
          }

          host.setActions();
          host.save(function(err) {
            if(err) {
              return cb(err);
            }
            if(Change.revisionForInst(host) !== originalRev) {
              ManagerHost.emit('host changed', host);
            }
          });
        });
      }, cb);
    });
  }

  ManagerHost.prototype.clearRemoteInfo = function() {
    this.clearError();
    this.app = null;
    this.processes = null;
    this.setActions();
  };

  ManagerHost.prototype.sync = function(cb) {
    var host = this;

    host.clearRemoteInfo();
    
    host.debug('sync started');

    this.getServiceInstance(function(err, inst) {
      if(err) {
        return cb(err);
      }

      if(inst.applicationName && inst.npmModules) {
        host.app = {
          name: inst.applicationName,
          version: inst.npmModules.version
        }
      }

      request({
        url: host.toURL() + '/api/ServiceInstances/' + inst.id + '/processes',
        json: true,
        verb: 'GET'
      }, function(err, res, body) {
        var processes = body;
        
        err = host.getHttpError(err, res, body);

        if(err) {
          return cb(err);
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
        cb();
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
    var host = this;
    request({
      url: this.getServiceInstanceURL() + '/findOne',
      json: true,
      verb: 'GET'
    }, function(err, res, body) {
      err = host.getHttpError(err, res, body);
      if(err) {
        return cb(err);
      } 
      cb(null, body);
    });
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
    this.errorType = this.getErrorType();
  }

  ManagerHost.prototype.getErrorType = function() {
    if(!this.error) return null;
    var status = this.error.status;
    var msg = this.error.message;
    if(status) {
      if(status >= 400 && status <= 500) {
        return 'invalid'
      }
      if(status >= 500 && status <= 600) {
        return 'server'
      }
    }
    if(msg.indexOf('ENOTFOUND') > -1 ||  msg.indexOf('ECONNREFUSED')) {
      return 'connection';
    }
    return 'unknown';
  }

  ManagerHost.prototype.clearError = function() {
    this.error = this.errorType = null;
  }

  ManagerHost.prototype.setActions = function() {
    var host = this;
    var procs = this.processes;
    var hasPids = procs && procs.pids && procs.pids.length;
    var hasApp = this.app;
    var actions = ['delete', 'edit'];

    if(this.error) {
      host.debug('limiting actions due to host.error');
      this.actions = actions;
      return;
    }

    // always allow these
    actions.push('env-set', 'env-get');

    if(hasPids) {
      actions.push('stop', 'restart', 'cluster-restart');
    } else if(hasApp) {
      host.debug('limiting actions due to no pids found');
      actions.push('start');
    }

    this.actions = actions;
  }

  ManagerHost.prototype.action = function(req, cb) {
    var host = this;
    this.getServiceInstance(function(err, inst) {
      if(err) return cb(err);
      if(inst) {
        request({
          url: host.getServiceInstanceURL() + '/' + inst.id + '/actions',
          json: true,
          body: {
            request: req
          },
          verb: 'POST'
        }, function(err, res, body) {
          err = host.getHttpError(err, res, body);
          if(err) {
            return cb(err);
          }
          cb(null, body);
        });
      } else {
        cb(new Error('no instance available'));
      }
    });
  }

  ManagerHost.prototype.getHttpError = function(err, res, body) {
    if(res && res.statusCode >= 400) {

      err = body.error || body;
      err.status = res.statusCode;
    }

    if(err) {
      return err;
    }
  }

  ManagerHost.prototype.getServiceInstanceURL = function() {
    return this.toURL() + '/api/ServiceInstances';
  }
};
