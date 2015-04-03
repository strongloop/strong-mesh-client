var buildBrowserBundle = require('../proxy/build-client').buildBrowserBundle;
var helpers = require('./helpers');
var fs = require('fs');
var path = require('path');

describe('client', function () {
  this.timeout(0);
  beforeEach(function() {
    helpers.createSandbox();
  });
  it('should be generated', function (done) {
    var file = fs.createWriteStream(path.join(helpers.SANDBOX, 'testout.js'));
    buildBrowserBundle(file, '/path/to/map', done);
  });
});
