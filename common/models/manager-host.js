var PMClient = require('strong-mesh-models').Client;

module.exports = function(ManagerHost) {
  ManagerHost.remoteMethod('action', {
    isStatic: false,
    accepts: [{
      arg: 'request',
      type: 'object'
    }],
    returns: {
      arg: 'result',
      type: 'object',
      root: true
    }
  });
  
  ManagerHost.prototype.toURL = function() {
    return this.protocol + '://' + this.host + ':' + this.port;
  }
  
  ManagerHost.prototype.getPMClient = function() {
    return new PMClient(this.toURL(), {
      appBrowserifyId: 'meshClient'
    });
  }
};
