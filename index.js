'use strict';

const execa = require('execa');
const pkgDir = require('pkg-dir');
const fkill = require('fkill');
const psList = require('ps-list');
const debug = require('debug')(require('./package').name);

class Server {
  async start() {
    debug('starting');

    this.server = execa('npm', ['start'], {
      cwd: await pkgDir()
    });

    this.server.stdout.pipe(process.stdout);
    this.server.stderr.pipe(process.stderr);

    let port = await new Promise((resolve, reject) => {
      let stderr = '';

      let close = async() => {
        await this.waitForDeath();

        reject(new Error(stderr));
      };

      this.server.once('close', close);

      this.server.stdout.on('data', data => {
        let str = data.toString();
        let matches = str.match(/^Build successful \(\d+ms\) – Serving on http:\/\/localhost:(\d+)\/$/m);
        if (matches) {
          this.server.removeListener('close', close);

          let port = parseInt(matches[1], 10);

          resolve(port);
        }
      });

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
    });

    debug('started');

    return port;
  }

  async stop() {
    debug('stopping');

    if (this.server) {
      let silent = process.platform === 'win32';
      await this.kill(silent);

      await this.waitForDeath();
    }

    debug('stopped');
  }

  async kill(silent) {
    await fkill(this.server.pid, {
      force: process.platform === 'win32',
      ...silent ? { silent } : {}
    });
  }

  async waitForDeath() {
    if (process.platform === 'linux') {
      let startPrinting;

      for (let ps of await psList()) {
        if (ps.name === 'npm') {
          startPrinting = true;
        }

        if (startPrinting) {
          debug(ps);
        }

        if (ps.name === 'ember') {
          debug(`killing pid ${ps.pid}`);

          await fkill(ps.pid, { silent: true });

          debug(`killed pid ${ps.pid}`);
        }
      }
    }

    this.server = null;
  }
}

module.exports = Server;
