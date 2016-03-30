// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-mesh-client
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

var express = require('express');
var app = express();
app.get('/', function(req, res) {
  res.send('hello world');
});
app.listen(0);
