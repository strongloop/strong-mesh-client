var path = require('path');
var SANDBOX = path.join(__dirname, 'sandbox');
var fs = require('fs-extra');
var sh = require('shelljs');
var spawn = require('child_process').spawn;
var expect = require('chai').expect;

exports.createPM = createPM;
exports.SANDBOX = SANDBOX;
exports.createSandbox = createSandbox;
exports.createController = createController;
exports.removeSandBox = removeSandBox;
exports.deployTo = deployTo;
exports.sleep = sleep;

var count = 0;
function createPM(port) {
  var dir = path.join(SANDBOX, count.toString());
  count += 1;
  fs.mkdirSync(dir);
  var PATH_TO_PM = require.resolve('strong-pm/bin/sl-pm.js');
  process.env.STRONGLOOP_CLUSTER = '1';
  return spawn(PATH_TO_PM, ['--listen', port], {
    cwd: dir,
    stdio:  ['ignore', process.stdout, process.stderr, 'ipc']
  });
}

function createController(port) {
  var dir = path.join(SANDBOX, count.toString());
  count += 1;
  fs.mkdirSync(dir);
  var PATH_TO_CONTROLLER = path.join(path.dirname(require.resolve('strong-nginx-controller')), '..', 'bin', 'sl-nginx-ctl.js');
  var PATH_TO_NGINX = sh.which('nginx');
  return spawn(PATH_TO_CONTROLLER, [
    '-x', PATH_TO_NGINX,
    '--listen', 'http://localhost:' + (Number(port) + 1),
    '--control', 'http://localhost:' + port,
  ], {
    cwd: dir,
    stdio:  ['ignore', process.stdout, process.stderr, 'ipc']
  });
}

function createSandbox() {
  removeSandBox();
  fs.mkdirSync(SANDBOX);
}

function removeSandBox() {
  fs.removeSync(SANDBOX);
}

function deployTo(pm, cb) {
  var PATH_TO_DEPLOY = path.join(path.dirname(require.resolve('strong-deploy')), 'bin', 'sl-deploy.js');
  var tarball = path.join(__dirname, 'fixtures', 'sample-app.tgz');
  var pmURL = 'http://' + pm.host + ':' + pm.port;
  var deploy = spawn(PATH_TO_DEPLOY, [pmURL, tarball], {
    stdio:  ['ignore', process.stdout, process.stderr, 'ipc']
  });

  deploy.on('exit', function(code) {
    if(code) {
      cb(new Error('failed to deploy'));
    } else {
      cb();
    }
  });
}

function sleep(ms) {
  return function(done) {
    setTimeout(done, ms);
  }
}
