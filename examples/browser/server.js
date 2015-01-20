var loopback = require('loopback');
var path = require('path');

var meshProxy = require('../../proxy/server')(
  path.join(__dirname, 'config.json')
);

var app = loopback();

app.use(loopback.static(__dirname));

app.use(meshProxy);

app.listen(3000);
