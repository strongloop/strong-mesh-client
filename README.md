# strong-mesh-client

## Background

This module provides a node.js and browser client that interacts with a set of
strong-pm APIs.

## Usage

**Node.js**

Below is an example setting up the mesh client for use in node.js.

```js
var mesh = MeshClient.create('/path/to/config/file.json', {
  interval: 2000
});

mesh.Process.find(function(err, procs) {
  console.log(procs);
});
```

**Browser + Proxy**

First mount the proxy as an express middleware / route handler.

```js
// app => an express / loopback app
var proxy = MeshProxy.create('/path/to/config/file.json', {
  interval: 2000
});

app.use('/path/to/proxy', proxy.middleware(app));
```

Add the client script.

```html
<script src="/path/to/proxy/client.js"></script>
```

Interact with mesh from the browser via the proxy.

```js
var mesh = MeshProxyClient.create('/path/to/proxy');

// get notifications when hosts change
mesh.notifications.on('hosts changed', function() {
  mesh.ManagerHost.find(function(err, hosts) {
    $scope.hosts = hosts;
    $scope.$apply();
  });
});

// adding a host to the manager (that is a PM)
mesh.ManagerHost.create({
  host: '...',
  port: ...
}, function(err, inst) {
  
});

// delete from the config
ManagerHost.deleteById('...', cb);

// perform an action on a specific host
managerHost.action('stop', cb);

// global action (iterates over all valid hosts)
ManagerHost.action('restart', cb);
```

## Models

### ManagerHost

```js
{
  host: 'foo.com',
  port: 3000,
  error: {message: '...', status: 500},
  errorType: 'connection', // correspond to the error property
  app: {
    name: 'appname',
    version: '1.2.3',
    port: 4000
  }, // if null, app is not running
  actions: [
    'start',
    'edit', // always included
    'delete' // always included
  ], // list of available actions depending on the state of the host
  processes: {
    targetCount: 7,
    pids: [{
      id: '...',
      pid: 123
    }]
  },
  credentials: {
    username: '...',
    password: '...'
  }
}
```

**Notes**

When a host is added or removed the LoadBalancer should be notified.


### LoadBalancer

```js
{
  host: 'foo.com',
  port: 3000,
  credentials: {
    username: '...',
    password: '...'
  },
  error: {status: 500, message: '...'}
}
```
