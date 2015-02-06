var path = require('path');
var SANDBOX = path.join(__dirname, 'sandbox');
var fs = require('fs-extra');
var spawn = require('child_process').spawn;
var expect = require('chai').expect;
var helpers = require('./helpers');
var createPM = helpers.createPM;
var createSandbox = helpers.createSandbox;
var removeSandBox = helpers.removeSandBox;
var createController = helpers.createController;
var deployTo = helpers.deployTo;
var sleep = helpers.sleep;
var TEST_BALANCER = {
  host: 'localhost',
  port: 7001
};

describe.skip('LoadBalancer', function () {

  this.timeout(0);

  beforeEach(function (done) {
    createSandbox();
    var proxy = this.proxy = require('../proxy/server')(path.join(SANDBOX, 'config.json'));
    this.ManagerHost = proxy.models.ManagerHost;
    this.LoadBalancer = proxy.models.LoadBalancer;
    done();
  });

  describe('LoadBalancer.updateAllConifgs', function() {
    beforeEach(function(done) {
      createController(TEST_BALANCER.port);
      this.LoadBalancer.create(TEST_BALANCER, function(err, balancer) {
        if(err) return done(err);
        test.balancer = balancer;
        done();
      });
    });
    it('should update each balancer with a set of valid hosts', function(done) {
      LoadBalancer.updateAllConifgs(hosts, function(err) {
        if(err) return done(err);
        test.balancer.createClient().models.Config.findOne(function(err, config) {
          console.log(config);
          done();
        });
      });
    });
  });


  // LoadBalancer.getValidHosts
  // loadBalancer.updateConfig
  // loadBalancer.toURL()


});

