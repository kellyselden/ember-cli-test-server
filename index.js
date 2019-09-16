'use strict';

const execa = require('execa');
const pkgDir = require('pkg-dir');

class Server {
  async start() {
    this.server = execa('npm', ['start'], {
      cwd: await pkgDir()
    });

    this.server.stdout.pipe(process.stdout);
    this.server.stderr.pipe(process.stderr);

    // eslint-disable-next-line no-async-promise-executor
    let port = await new Promise(async(resolve, reject) => {
      this.server.stdout.on('data', data => {
        let str = data.toString();
        let matches = str.match(/^Build successful \(\d+ms\) – Serving on http:\/\/localhost:(\d+)\/$/m);
        if (matches) {
          resolve(matches[1]);
        }
      });

      let stderr = '';
      this.server.stderr.on('data', data => {
        let str = data.toString();
        stderr += str;
        if (/^Stack Trace and Error Report: /m.test(str)) {
          this.server.kill();
        }
      });

      await this.waitForDeath();

      reject(new Error(stderr));
    });

    return port;
  }

  async stop() {
    if (!this.server) {
      return;
    }

    this.server.kill();

    await this.waitForDeath();
  }

  async waitForDeath() {
    // await this.server;
    await new Promise(resolve => {
      this.server.once('exit', resolve);
    });

    this.server = null;
  }
}

module.exports = Server;
