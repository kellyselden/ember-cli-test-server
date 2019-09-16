'use strict';

const execa = require('execa');
const pkgDir = require('pkg-dir');
// const getPort = require('get-port');

class Server {
  async start() {
    this.server = execa('npm', ['start'], {
      cwd: await pkgDir()
    });

    this.server.stdout.pipe(process.stdout);
    this.server.stderr.pipe(process.stderr);

    let port;

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
          this.server.removeListener('exit', close);
          port = parseInt(matches[1], 10);
        }
        matches = str.match(/^Slowest Nodes /m);
        if (matches) {
          resolve(port);
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
      this.server.once('exit', close);
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

    // this.server.kill('SIGKILL');

    await this.waitForDeath();
  }

  async kill() {
    // this.server.kill();
    let fkill = require('fkill');
    await fkill(this.server.pid, { force: true });
  }

  async waitForDeath() {
    this.server = null;

    let psList = require('ps-list');
    let fkill = require('fkill');
    let startPrinting;
    for (let x of await psList()) {
      // eslint-disable-next-line no-console
      console.error(x);
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
        try {
          await fkill(x.pid);
        } catch (err) {}
        // eslint-disable-next-line no-console
        console.error('killed');
      }
    }

    // while (this.port) {
    //   // eslint-disable-next-line no-console
    //   console.error('port', this.port);
    //   let foundPort = await getPort({ port: this.port });
    //   // eslint-disable-next-line no-console
    //   console.error('foundPort', foundPort);
    //   if (foundPort === this.port) {
    //     // eslint-disable-next-line no-console
    //     console.error('match');
    //     this.port = null;
    //   } else {
    //     // eslint-disable-next-line no-console
    //     console.error('no match');
    //   }
    // }
  }
}

module.exports = Server;
