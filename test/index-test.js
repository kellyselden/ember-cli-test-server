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
  let tmp;
  let projectPath;
  let server;

  async function newProject({
    skipNpm
  } = {}) {
    await execa('ember', [
      'new',
      'my-app',
      '--yarn', // temp
      '-sg',
      ...skipNpm ? ['-sn'] : []
    ], {
      cwd: tmp,
      stdio: 'inherit'
    });

    projectPath = path.join(tmp, projectName);

    process.chdir(projectPath);
  }

  beforeEach(async function() {
    tmp = await tmpDir();
  });

  afterEach(async function() {
    if (server) {
      await server.stop();
    }

    process.chdir(originalCwd);
  });

  describe('no error', function() {
    beforeEach(async function() {
      await newProject();
    });

    async function createBuildError() {
      let filePath = path.join(projectPath, 'ember-cli-build.js');

      let file = await readFile(filePath, 'utf8');

      file = file.replace('return ', '');

      await writeFile(filePath, file);
    }

    it('works', async function() {
      server = new Server();

      let port = await server.start();

      await server.stop();

      expect(port).to.equal('4200');
    });

    it('handles a build error', async function() {
      await createBuildError();

      server = new Server();

      await expect(server.start()).to.eventually.be.rejectedWith('undefined is not a Broccoli node');
    });
  });

  describe('error', function() {
    beforeEach(async function() {
      await newProject({
        skipNpm: true
      });
    });

    it('handles missing dependencies error', async function() {
      server = new Server();

      await expect(server.start()).to.eventually.be.rejectedWith('node_modules appears empty');
    });
  });
});
