import { IO } from '@ar.io/sdk';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './App.css';

const io = IO.init();
function App() {
  const [contract, setContract] = useState<string>('Loading...');
  const [success, setSuccess] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    io.getInfo()
      .then((state) => {
        setContract(`\`\`\`json\n${JSON.stringify(state, null, 2)}`);
        setSuccess(true);
      })
      .catch((error) => {
        console.error(error);
        setSuccess(false);
        setContract('Error loading contract state');
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  return (
    <div className="App">
      {loaded && <div data-testid="load-info-result">{`${success}`}</div>}
      <Markdown className="markdown" remarkPlugins={[remarkGfm]}>
        {contract}
      </Markdown>
    </div>
  );
}

export default App;
