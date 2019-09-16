'use strict';

const { describe } = require('./helpers/mocha');
const { expect } = require('./helpers/chai');
const { promisify } = require('util');
const tmpDir = promisify(require('tmp').dir);
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);
const path = require('path');
const execa = require('execa');
const Server = require('..');

const projectName = 'my-app';
const originalCwd = process.cwd();

describe(Server, function() {
  this.timeout(5 * 60 * 1000);

  let tmp;
  let projectPath;
  let server;

  beforeEach(async function() {
    tmp = await tmpDir();
  });

  afterEach(async function() {
    if (server) {
      await server.stop();
    }

    process.chdir(originalCwd);
  });

  async function createBuildError() {
    let filePath = path.join(projectPath, 'ember-cli-build.js');

    let file = await readFile(filePath, 'utf8');

    file = file.replace('return ', '');

    await writeFile(filePath, file);
  }

  it('works', async function() {
    await execa('ember', [
      'new',
      'my-app',
      '-sg',
      '-sn'
    ], {
      cwd: tmp,
      stdio: 'inherit'
    });

    projectPath = path.join(tmp, projectName);

    process.chdir(projectPath);

    server = new Server();

    await expect(server.start(), 'handles missing dependencies error')
      .to.eventually.be.rejectedWith('node_modules appears empty');

    await expect(server.stop(), 'can stop after dependencies error')
      .to.eventually.be.fulfilled;

    await execa('npm', ['install'], {
      stdio: 'inherit'
    });

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    // eslint-disable-next-line no-console
    console.error('before start');

    let port = await server.start();

    // eslint-disable-next-line no-console
    console.error('after start');
    // eslint-disable-next-line no-console
    console.error('before stop');

    await server.stop();

    // eslint-disable-next-line no-console
    console.error('after stop');

    expect(port).to.equal(4200);

    await createBuildError();

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    await expect(server.start(), 'handles a build error')
      .to.eventually.be.rejectedWith('undefined is not a Broccoli node');

    await expect(server.stop(), 'can stop after a build error')
      .to.eventually.be.fulfilled;
  });
});
