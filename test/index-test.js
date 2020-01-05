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

describe(Server, function() {
  this.timeout(5 * 60 * 1000);

  let projectPath;
  let server;
  let oldFile;

  beforeEach(async function() {
    let tmp = await tmpDir();

    await execa('ember', [
      'new',
      'my-app',
      '-sg',
      '-sn'
    ], {
      cwd: tmp,
      stdio: 'inherit',
      preferLocal: true,
      localDir: __dirname
    });

    projectPath = path.join(tmp, projectName);
  });

  afterEach(async function() {
    if (server) {
      await server.stop();
    }
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
    // eslint-disable-next-line no-console
    console.log('process', process);

    let separator = process.platform === 'win32' ? ';' : ':';

    let options = {
      cwd: projectPath,
      env: {
        // ignore any global packages that would mess with the test
        Path: path.dirname(process.execPath)

        // still finds global ember
        // PATH: process.env.Path.split(separator).filter(p => !p.includes(path.resolve(__dirname, '..'))).join(separator)
      }
    };

    // eslint-disable-next-line no-console
    console.log('options', options);

    server = new Server();

    await expect(server.start(options), 'handles no install error')
      .to.eventually.be.rejectedWith((() => {
        switch (process.platform) {
          case 'win32': return '\'ember\' is not recognized as an internal or external command';
          case 'darwin': return 'ember: command not found';
          default: return 'ember: not found';
        }
      })());

    await expect(server.stop(), 'can stop no install error')
      .to.eventually.be.fulfilled;

    await execa('npm', ['install'], {
      cwd: projectPath,
      stdio: 'inherit'
    });

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    let port = await server.start(options);

    await server.stop();

    expect(port).to.equal(4200);

    await createInstantBuildError();

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    await expect(server.start(options), 'handles instant build error')
      .to.eventually.be.rejectedWith('undefined is not a Broccoli node');

    await expect(server.stop(), 'can stop after instant build error')
      .to.eventually.be.fulfilled;

    await resetBuildFile();

    await createHungBuildError();

    // eslint-disable-next-line require-atomic-updates
    server = new Server();

    await expect(server.start(options), 'handles hung build error')
      .to.eventually.be.rejectedWith('Build Error ');

    await expect(server.stop(), 'can stop after hung build error')
      .to.eventually.be.fulfilled;

    await resetBuildFile();
  });
});
