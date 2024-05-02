import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WarpFactory, Contract } from 'warp-contracts';

import './App.css';

const contractTxId = 'ilwT4ObFQ7cGPbW-8z-h7mvvWGt_yhWNlqxNjSUgiYY';
const warp = WarpFactory.forMainnet();
const antContract = warp.contract(contractTxId);

function App() {
  const [contract, setContract] = useState<string>('Loading...');

  useEffect(() => {
    antContract
      .syncState(`https://api.arns.app/v1/contract/${contractTxId}`, {
        validity: true,
      })
      .then(async (syncContract: Contract) => {
        const { cachedValue } = await syncContract.readState();
        setContract(
          `\`\`\`json\n${JSON.stringify(cachedValue.state, null, 2)}`,
        );
      })
      .catch((error: unknown) => {
        console.error(error);
        setContract('Error loading contract state');
      });
  }, []);

  return (
    <div className="App">
      <Markdown className="markdown" remarkPlugins={[remarkGfm]}>
        {contract}
      </Markdown>
    </div>
  );
}

export default App;
