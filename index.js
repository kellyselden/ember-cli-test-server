'use strict';

const execa = require('execa');
const pkgDir = require('pkg-dir');
const getPort = require('get-port');

class Server {
  async start() {
    this.server = execa('npm', ['start'], {
      cwd: await pkgDir()
    });

    this.server.stdout.pipe(process.stdout);
    this.server.stderr.pipe(process.stderr);

    // eslint-disable-next-line no-async-promise-executor
    this.port = await new Promise(async(resolve, reject) => {
      this.server.stdout.on('data', data => {
        let str = data.toString();
        let matches = str.match(/^Build successful \(\d+ms\) – Serving on http:\/\/localhost:(\d+)\/$/m);
        if (matches) {
          resolve(parseInt(matches[1], 10));
        }
      });

      let stderr = '';
      this.server.stderr.on('data', data => {
        let str = data.toString();
        stderr += str;
        if (/^Stack Trace and Error Report: /m.test(str)) {
          this.kill();
        }
      });

      // await this.server;
      await new Promise(resolve => {
        this.server.once('close', resolve);
      });

      await this.waitForDeath();

      reject(new Error(stderr));
    });

    return this.port;
  }

  async stop() {
    if (!this.server) {
      return;
    }

    this.kill();

    // await this.server;
    await new Promise(resolve => {
      this.server.once('exit', resolve);
    });

    await this.waitForDeath();
  }

  async kill() {
    this.server.kill();
  }

  async waitForDeath() {
    this.server = null;

    while (this.port) {
      // eslint-disable-next-line no-console
      console.error('port', this.port);
      let foundPort = await getPort({ port: this.port });
      // eslint-disable-next-line no-console
      console.error('foundPort', foundPort);
      if (foundPort === this.port) {
        // eslint-disable-next-line no-console
        console.error('match');
        this.port = null;
      } else {
        // eslint-disable-next-line no-console
        console.error('no match');
      }
    }
  }
}

module.exports = Server;
