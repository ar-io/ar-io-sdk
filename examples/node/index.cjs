const { DefaultClient } = require('../../lib/index.js');

(async () => {
  const client = new DefaultClient();
  console.log(client);
})();
