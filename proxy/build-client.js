// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-mesh-client
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

var path = require('path');
var fs = require('fs');
var boot = require('loopback-boot');
var debug = require('debug')('strong-mesh-client:build-client');

var nodeEnv = process.env.NODE_ENV  || 'production';
var bundlePathBase = path.join(__dirname, 'mesh-client-bundle');
var bundlePath = bundlePathBase + '.js';
var bundleSourceMapPath = bundlePathBase + '.map.json';

function getBundle(out, sourceMapUrl, callback) {
  if (process.env.ARC_BROWSERIFY_DEBUG) {
    return buildBrowserBundle(out, null, callback);
  }

  if (!out) return callback();

  debug('loading cached bundle: %s', bundlePath);
  var cachedFile = fs.createReadStream(bundlePath);
  cachedFile.on('error', function(err) {
    if (err && err.code === 'ENOENT') {
      debug('Client bundle was not pre-generated.\n' +
        'Use `npm run rebuild-client`.');
      throw Error('Client bundle was not pre-generated');
    }
    callback(err);
  });
  cachedFile.on('open', function() {
    cachedFile.pipe(out);
    cachedFile.once('close', callback);
  });
}

function getBundleMap(out, callback) {
  var isDevEnv = ~['debug', 'development', 'test'].indexOf(nodeEnv);
  debug('isDevEnv %s %s', nodeEnv, isDevEnv);
  if (isDevEnv) {
    debug('loading cache map file: %s', bundleSourceMapPath);
    var cachedFile = fs.createReadStream(bundleSourceMapPath);

    cachedFile.on('error', callback);
    cachedFile.on('open', function() {
      cachedFile.pipe(out);
      cachedFile.once('close', callback);
    });
  } else {
    out.end('{}');
    callback();
  }
}

exports.getBundle = getBundle;
exports.getBundleMap = getBundleMap;
exports.buildBrowserBundle = buildBrowserBundle;

function buildBrowserBundle(out, sourceMapUrl, callback) {
  var clientDir = path.join(__dirname, '..', 'browser-client');
  var meshModelsDir = path.dirname(require.resolve('strong-mesh-models'));
  var browserify = require('browserify');

  var b = browserify({
    basedir: clientDir,
    // TODO(bajtos) debug should be always true, the sourcemaps should be
    // saved to a standalone file when !isDev(env)
    debug: true,
  });
  b.require(path.join(clientDir, 'client.js'), { expose: 'strong-mesh-client' });

  // Include mesh-models, exclude non-browser requirements
  b.require(path.join(meshModelsDir,'index.js'), { expose: 'strong-mesh-models' });
  var nonBrowserReq = [
    'minkelite', 'compression', 'concat-stream', 'errorhandler', 'sprintf',
    'loopback-explorer', 'osenv', 'posix-getopt', 'serve-favicon', 'user-home',
    'strong-npm-ls', 'strong-tunnel', 'http-auth'
  ];
  for (var i in nonBrowserReq) {
    b.ignore(nonBrowserReq[i]);
  }

  try {
    boot.compileToBrowserify({
      appRootDir: clientDir,
      modelSources: [path.join(__dirname, '..', 'common', 'models')],
      env: nodeEnv
    }, b);
  } catch(err) {
    return callback(err);
  }

  try {
    boot.compileToBrowserify({
      appId: 'meshClient',
      appRootDir: path.join(meshModelsDir, 'client'),
      modelSources: [
        path.join(meshModelsDir, 'common', 'models'),
        path.join(meshModelsDir, 'client', 'models'),
      ],
      env: nodeEnv
    }, b);
  } catch(err) {
    return callback(err);
  }

  if (bundleSourceMapPath) {
    minifyOptions = {
      output: bundleSourceMapPath,
      map: sourceMapUrl,
    };
    b.plugin('minifyify', minifyOptions);
  }

  b.bundle()
    .on('error', function(err) {
      callback(err);
    })
    .pipe(out);

  out.on('close', callback);
}

if (require.main === module) {
  var handleError = function(err) {
    console.log('unable to generate browser bundle: ' + err.message);
    process.exit(1);
  };

  var cachedFile = fs.createWriteStream(bundlePath);

  cachedFile.on('error', handleError);
  cachedFile.on('open', function() {
    buildBrowserBundle(cachedFile, './client.map.json', function(err) {
      if (err) {
        cachedFile.close();
        return handleError(err);
      }

      console.log('browser bundle successfully generated');
      process.exit(0);
    });
  });
}
