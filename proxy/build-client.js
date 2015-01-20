var path = require('path');
var fs = require('fs');
var browserify = require('browserify');
var boot = require('loopback-boot');

module.exports = function buildBrowserBundle(env, out, callback) {
  var clientDir = path.join(__dirname, '..', 'browser-client');
  var b = browserify({ basedir: clientDir });
  b.require('./client.js', { expose: 'strong-mesh-client' });

  try {
    boot.compileToBrowserify({
      appRootDir: clientDir,
      modelSources: [path.join(__dirname, '..', 'common', 'models')],
      env: env
    }, b);
  } catch(err) {
    return callback(err);
  }
  var isDevEnv = ~['debug', 'development', 'test'].indexOf(env);

  b.bundle({
    // TODO(bajtos) debug should be always true, the sourcemaps should be
    // saved to a standalone file when !isDev(env)
    debug: isDevEnv
  })
    .on('error', callback)
    .pipe(out);

  out.on('error', callback);
  out.on('close', callback);
};
