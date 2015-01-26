var loopback = require('loopback');
var path = require('path');
var helpers = require('../helpers');

var meshProxy = require('../../proxy/server')(
  path.join(__dirname, 'config.json'), {
    interval: 1000
  }
);

var app = loopback();

app.use(loopback.static(__dirname));

app.use(meshProxy);

var server = app.listen(3000);

meshProxy.setupPrimus(server, {
  // primus options
});
