import { removeDirectories } from '../utils';

function jestGlobalTeardown() {
  removeDirectories();
  console.log('Test finished!');
}

module.exports = jestGlobalTeardown;
