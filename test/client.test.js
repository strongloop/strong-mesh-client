// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-mesh-client
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

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
