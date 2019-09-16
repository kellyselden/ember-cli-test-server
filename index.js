'use strict';

const execa = require('execa');
const pkgDir = require('pkg-dir');
const getPort = require('get-port');
const fkill = require('fkill');

class Server {
  async start() {
    this.server = execa('npm', ['start'], {
      cwd: await pkgDir()
    });

    this.server.stdout.pipe(process.stdout);
    this.server.stderr.pipe(process.stderr);

    // eslint-disable-next-line no-async-promise-executor
    this.port = await new Promise(async(resolve, reject) => {
      let self = this;
      async function close() {
        await self.waitForDeath();

        reject(new Error(stderr));
      }

      this.server.stdout.on('data', data => {
        let str = data.toString();
        let matches = str.match(/^Build successful \(\d+ms\) – Serving on http:\/\/localhost:(\d+)\/$/m);
        if (matches) {
          this.server.removeListener('close', close);
          resolve(parseInt(matches[1], 10));
        }
      });

      let stderr = '';
      this.server.stderr.on('data', async data => {
        let str = data.toString();
        stderr += str;
        let isLocalError = /^Stack Trace and Error Report: /m.test(str);
        let isCIError = /^ERROR Summary:$/m.test(str);
        if (isLocalError || isCIError) {
          this.server.removeListener('close', close);
          // Build errors sometimes hang and sometimes exit on their own.
          let silent = true;
          await this.kill(silent);
          await close();
        }
      });

      this.server.once('close', close);
    });

    return this.port;
  }

  async stop() {
    if (!this.server) {
      return;
    }

    let silent = process.platform === 'win32';
    await this.kill(silent);

    await this.waitForDeath();
  }

  async kill(silent) {
    await fkill(this.server.pid, {
      force: process.platform === 'win32',
      ...silent ? { silent } : {}
    });
  }

  async waitForDeath() {
    this.server = null;

    if (process.platform === 'linux') {
      let psList = require('ps-list');
      let startPrinting;
      for (let x of await psList()) {
        if (x.name === 'npm') {
          startPrinting = true;
        }
        if (startPrinting) {
          // eslint-disable-next-line no-console
          console.error(x);
        }
        if (x.name === 'ember') {
          // eslint-disable-next-line no-console
          console.error('killing');
          await fkill(x.pid, { silent: true });
          // eslint-disable-next-line no-console
          console.error('killed');
        }
      }
    }

    while (this.port) {
      // eslint-disable-next-line no-console
      console.error('port', this.port);
      let foundPort = await getPort({ port: this.port });
      // eslint-disable-next-line no-console
      console.error('foundPort', foundPort);
      let isMatch = foundPort === this.port;
      // eslint-disable-next-line no-console
      console.error('isMatch', isMatch);
      if (isMatch) {
        this.port = null;
      }
    }
  }
}

module.exports = Server;
