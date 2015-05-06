var buildClient = require('../proxy/build-client');
var fs = require('fs');

var bundlePath = 'proxy/mesh-client-bundle.js';
var sourceMapUrl = './client.map.json';
var handleError = function(err) {
  console.log('unable to generate browser bundle: ' + err.message);
  process.exit(1);
};

var cachedFile = fs.createWriteStream(bundlePath);

cachedFile.on('error', handleError);
cachedFile.on('open', function() {
  buildClient.buildBrowserBundle(cachedFile, sourceMapUrl, function(err) {
    if (err) {
      cachedFile.close();
      return handleError(err);
    }

    console.log('browser bundle successfully generated')
    process.exit(0);
  });
});
