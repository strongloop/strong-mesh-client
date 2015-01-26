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
};
