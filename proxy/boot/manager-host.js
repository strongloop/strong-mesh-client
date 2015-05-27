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
  var debug = require('debug')('strong-mesh-client:ManagerHost');

  ManagerHost.beforeCreate = function(next) {
    var host = this;
    this.id = uuid.v4();
    this.protocol = this.protocol || 'http';
    this.created = Date.now();
    debug('creating host %s:%s', host.host, host.port);
    if(!this.actions) this.actions = [];
    next();
  }

  ManagerHost.beforeRemote('find', function(ctx) {
    var next = arguments[arguments.length - 1];
    ctx.args.filter = ctx.args.filter || {};

    // force sorting
    if(!ctx.args.filter.order) ctx.args.filter.order = 'created ASC';

    next();
  });

  ManagerHost.startPolling = function(cb) {
    var timer;
    ManagerHost.sync(function(firstErr) {
      if(firstErr) {
        return cb ? cb(err) : null;
      }
      timer = setInterval(function() {
        ManagerHost.sync(function(err) {
          if(err) {
            clearInterval(timer);
            return cb(err);
          }
        });
      }, ManagerHost.settings.interval || 1000);
    });
  }

  ManagerHost.sync = function(cb) {
    ManagerHost.find(function(err, hosts) {
      if(err) {
        return cb ? cb(err) : err;
      }
      async.each(hosts, function(host, cb) {
        var originalRev = Change.revisionForInst(host);

        host.sync(function(err) {
          if(err) {
            host.handleError(err);
          }

          host.setActions();
          ManagerHost.findById(host.id, function(err, cur) {
            if(err) return cb(err);
            if(cur) {
              if(!(cur.host === host.host && cur.port === host.port)) {
                // throw out the sync result
                return cb();
              }
            } else {
              // throw out the sync result
              // since the host no longer exists
              return cb();
            }

            host.save(function(err) {
              if(err) {
                return cb(err);
              }
              if(Change.revisionForInst(host) !== originalRev) {
                ManagerHost.emit('host changed', host);
              }
              cb();
            });
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

    this.getServiceInstance(function(err, inst) {
      if(err) {
        return cb(err);
      }

      if(inst.applicationName) {
        host.app = {
          name: inst.applicationName,
          version: null
        };
      }

      if(inst.npmModules) {
        host.app.version = inst.npmModules.version;
      }

      request({
        url: host.toURL() + '/api/ServiceInstances/' + inst.id
        + '/processes?filter[where][stopTime]=null',
        json: true,
        method: 'GET'
      }, function(err, res, body) {
        var processes = body;

        err = host.getHttpError(err, res, body);

        if(err) {
          return cb(err);
        }
        host.clearError();
        host.processes = host.processes || {};
        host.processes.pids = processes;

        var port;

        if(processes) {
          for (var i = 0; i < processes.length; i++) {
            var listeningSockets = processes && processes[i]
              && processes[i].listeningSockets;

            if(listeningSockets) {
              for (var j = 0; j < listeningSockets.length; j++) {
                if(listeningSockets[j] && listeningSockets[j].addressType === 4) {
                  port = listeningSockets[j].port;
                  break;
                }
              };
            } else {
              debug('no listening sockets found for', host.toURL());
            }
          };
        }
        if(host.app && port) {
          host.app.port = port;
        }
        host.setActions();
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
      appRootDir: path.join(path.dirname(require.resolve('strong-mesh-models')), 'client')
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
      method: 'GET'
    }, function(err, res, body) {
      err = host.getHttpError(err, res, body);
      if(err) {
        return cb(err);
      }
      cb(null, body);
    });
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
    if(msg && (msg.indexOf('ENOTFOUND') > -1 ||  msg.indexOf('ECONNREFUSED') > -1) ) {
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
      actions.push('stop', 'restart', 'cluster-restart', 'license-push');
    } else if(hasApp) {
      host.debug('limiting actions due to no pids found');
      actions.push('start');
    }

    this.actions = actions;
  }

  ManagerHost.prototype.action = function(req, cb) {
    var host = this;
    this.getServiceInstance(function(err, inst) {
      if (err) return cb(err);
      if (inst) {
        host.debug('performing action:');
        host.debug(req);
        ManagerHost.notifyObserversOf('before action', {
          Model: ManagerHost,
          instance: host,
          service: inst,
          data: req}, function(err) {
          if (err) {
            return cb(err);
          }
          request({
            url: host.getServiceInstanceURL() + '/' + inst.id + '/actions',
            json: true,
            body: {
              request: req
            },
            method: 'POST'
          }, function(err, res, body) {
            err = host.getHttpError(err, res, body);
            if (err) {
              return cb(err);
            }
            cb(null, body);
          });
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
