# ember-cli-test-server

[![npm version](https://badge.fury.io/js/ember-cli-test-server.svg)](https://badge.fury.io/js/ember-cli-test-server)

Start a long-running [Ember CLI](https://ember-cli.com) server in a test environment

## Usage

The server will run whatever you have set up in your `npm start` script (ex. `ember serve`).

```js
const Server = require('ember-cli-test-server');

let server = new Server();

let port = await server.start();

await server.stop();
```
