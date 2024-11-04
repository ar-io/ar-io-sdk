import { ANT } from '@ar.io/sdk/web';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './App.css';

const processId = 'U2dlP4DMMZFO82tWzcDfcgNGq5aGYY6CU84oeHAfNHE';
const antContract = ANT.init({ processId });

function App() {
  const [contract, setContract] = useState<string>('Loading...');

  useEffect(() => {
    antContract
      .getState()
      .then((state: any) => {
        setContract(`\`\`\`json\n${JSON.stringify(state, null, 2)}`);
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
