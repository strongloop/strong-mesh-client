// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-mesh-client
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

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
