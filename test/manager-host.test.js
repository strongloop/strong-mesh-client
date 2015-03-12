var path = require('path');
var SANDBOX = path.join(__dirname, 'sandbox');
var fs = require('fs-extra');
var spawn = require('child_process').spawn;
var expect = require('chai').expect
var helpers = require('./helpers');
var createPM = helpers.createPM;
var createSandbox = helpers.createSandbox;
var removeSandBox = helpers.removeSandBox;
var deployTo = helpers.deployTo;
var sleep = helpers.sleep;

var testPM = {
  host: 'localhost',
  port: 8000
};
var altTestPM = {
  host: 'localhost',
  port: 9000
};
var invalidPM = {
  host: 'invalid',
  port: 2222
};

var PM_PORT = testPM.port;
var ALT_PM_PORT = altTestPM.port;

describe('ManagerHost', function () {

  this.timeout(0);

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
    describe('multiple PMs', function () {
      beforeEach(function() {
        this.altPM = createPM(ALT_PM_PORT);
      });
      beforeEach(function(done) {
        this.altPM.on('message', function(msg) {
          if(msg.data.cmd === 'listening') {
            done();
          }
        });
      });
      beforeEach(function(done) {
        var test = this;
        this.proxy.models.ManagerHost.create(altTestPM, function(err, host) {
          if(err) return done(err);
          test.altHost = host;
          done();
        });
      });
      beforeEach(function(done) {
        deployTo(altTestPM, done);
      });
      beforeEach(sleep(7500));
      it('should have a unique set of pids', function (done) {
        var test = this;

        test.host.sync(function() {
          test.altHost.sync(function() {
            expect(test.host.processes.pids).to.not.eql(test.altHost.processes.pids);
            var host = test.host;
            var altHost = test.altHost;

            expect(host.processes.pids).to.eql([]);
            expect(altHost.processes.pids.length > 0).to.be.ok;

            host.debug('-----pids--------');
            host.debug(host.processes.pids);

            altHost.debug('-----pids--------');
            altHost.debug(altHost.processes.pids);

            expect(host.processes.pids).to.not.eql(altHost.processes.pids);
            done();
          });
        });
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
        expect(host.actions).to.contain('env-set');
        expect(host.actions).to.contain('env-get');
        done();
      });
    });
  });

  describe('Event: host changed', function () {
    it('should be emitted when a host changes', function (done) {
      var test = this;
      this.ManagerHost.once('host changed', function() {
        done();
      });

      deployTo(altTestPM, function() {
        // deployed!
      });
    });
  });

  describe('Invalid host', function () {
    beforeEach(function(done) {
      var test = this;
      this.ManagerHost.create(invalidPM, function(err, invalidHost) {
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
      });
    });
  });
});

