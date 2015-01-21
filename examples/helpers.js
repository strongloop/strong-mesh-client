var sh = require('shelljs');
var path = require('path');
var async = require('async');

exports.setupSamplePMs = function() {
  process.env.PM_PORT = 6700;
  sh.exec(path.join(__dirname, 'setup-pm.sh'), {async: true});
  setTimeout(function() {
    sh.exec(path.join(__dirname, 'deploy.sh'));
    setTimeout(resize, 5000);
  }, 2000);

  function resize() {
    sh.exec('slc pmctl set-size 3');
  }
}
