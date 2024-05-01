import { ANT } from '@ar.io/sdk';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './App.css';

const contractTxId = 'ilwT4ObFQ7cGPbW-8z-h7mvvWGt_yhWNlqxNjSUgiYY';
const ant = ANT.init({
  contractTxId,
});
function App() {
  const [contract, setContract] = useState<string>('Loading...');

  useEffect(() => {
    ant
      .getState()
      .then((state) => {
        setContract(`\`\`\`json\n${JSON.stringify(state, null, 2)}`);
      })
      .catch((error) => {
        console.error(error);
        setContract('Error loading contract state');
      });
  }, []);

  return (
    <div className="App">
        <Markdown className="markdown" remarkPlugins={[remarkGfm]}>{contract}</Markdown>
    </div>
  );
}

export default App;
