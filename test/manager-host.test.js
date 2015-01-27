var path = require('path');
var SANDBOX = path.join(__dirname, 'sandbox');
var fs = require('fs-extra');
var spawn = require('child_process').spawn;
var PM_PORT = 8000;
var expect = require('chai').expect;

describe('ManagerHost', function () {

  this.timeout(10000);

  beforeEach(function (done) {
    createSandbox();
    this.pm = createPM(PM_PORT);
    var proxy = this.proxy = require('../proxy/server')(path.join(SANDBOX, 'config.json'));
    this.ManagerHost = proxy.models.ManagerHost;
    proxy.listen(3000, done);
  });

  beforeEach(sleep(2000));

  beforeEach(function(done) {
    var test = this;
    this.proxy.models.ManagerHost.create({
      host: 'localhost',
      port: PM_PORT
    }, function(err, host) {
      if(err) return done(err);
      test.host = host;
      done();
    });
  });

  afterEach(function() {
    this.pm.kill();
    removeSandBox();
  });

  describe('managerHost.sync()', function () {
    it('should update the managerHost with the remote info', function (done) {
      var test = this;
      this.host.sync(function(err) {
        console.log(err);
        console.log(test.host);
        done();
      });
    });
  });

  describe('Invalid host', function () {
    beforeEach(function(done) {
      var test = this;
      this.ManagerHost.create({
        host: 'invalid',
        port: 2222
      }, function(err, invalidHost) {
        if(err) return done(err);
        test.invalidHost = invalidHost;
        done();
      });
    });

    it('actions should error', function(done) {
      this.invalidHost.action({
        cmd: 'stop'
      }, function(err) {
        expect(err).to.exist;
        done();
      })
    });
  });
});

function createPM(port) {
  var PATH_TO_PM = path.join(path.dirname(require.resolve('strong-pm')), 'bin', 'sl-pm.js');
  return spawn(PATH_TO_PM, ['--listen', port], {
    cwd: SANDBOX,
    stdio:  [0,1,2]
  });
}

function createSandbox() {
  removeSandBox();
  fs.mkdirSync(SANDBOX);
}

function removeSandBox() {
  fs.removeSync(SANDBOX);
}

function sleep(time) {
  return function(done) {
    setTimeout(done, time);
  }
}
