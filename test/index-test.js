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
  let oldFile;

  beforeEach(async function() {
    tmp = await tmpDir();
  });

  afterEach(async function() {
    if (server) {
      await server.stop();
    }

    process.chdir(originalCwd);
  });

  async function createInstantBuildError() {
    let filePath = path.join(projectPath, 'ember-cli-build.js');

    oldFile = await readFile(filePath, 'utf8');

    let newFile = oldFile.replace('return ', '');

    await writeFile(filePath, newFile);
  }

  async function createHungBuildError() {
    let filePath = path.join(projectPath, 'ember-cli-build.js');

    oldFile = await readFile(filePath, 'utf8');

    let newFile = oldFile.replace('return ', 'app.import("node_modules/ember-source/missing.js"); return ');

    await writeFile(filePath, newFile);
  }

  async function resetBuildFile() {
    let filePath = path.join(projectPath, 'ember-cli-build.js');

    await writeFile(filePath, oldFile);
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

    let port = await server.start();

    await server.stop();


    expect(port).to.equal(4200);

    await createInstantBuildError();

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    await expect(server.start(), 'handles instant build error')
      .to.eventually.be.rejectedWith('undefined is not a Broccoli node');

    await expect(server.stop(), 'can stop after instant build error')
      .to.eventually.be.fulfilled;

    await resetBuildFile();

    await createHungBuildError();

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    await expect(server.start(), 'handles hung build error')
      .to.eventually.be.rejectedWith('Build Error ');

    await expect(server.stop(), 'can stop after hung build error')
      .to.eventually.be.fulfilled;

    await resetBuildFile();
  });
});
