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
    done();
  });

  beforeEach(function(done) {
    this.pm.on('message', function(msg) {
      if(msg.data.cmd === 'listening') {
        done();
      }
    });
  });

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

  afterEach(function(done) {
    removeSandBox();
    this.pm.kill('SIGTERM');
    this.pm.on('exit', done);
  });

  describe('ManagerHost.find()', function () {
    it('should find the newly added host', function (done) {
      this.ManagerHost.find(function(err, hosts) {
        expect(hosts.length).to.eql(1);
        expect(hosts[0].port).to.eql(PM_PORT); 
        done();
      });
    });
  });

  describe('managerHost.sync()', function () {
    it('should update the managerHost with the remote info', function (done) {
      var test = this;
      var host = this.host;
      this.host.sync(function(err) {
        expect(err).to.not.exist;
        expect(host.error).to.not.exist;
        expect(host.actions).to.contain('delete');
        expect(host.actions).to.contain('edit');
        done();
      });
    });
  });

  describe('Event: host changed', function () {
    it('should be emitted when a host changes', function (done) {
      var test = this;
      this.ManagerHost.on('host changed', function() {
        done();
      });

      test.host.action({
        cmd: 'set-size',
        size: 1
      }, done);
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
