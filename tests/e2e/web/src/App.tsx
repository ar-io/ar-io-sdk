import { ANTRegistry, IO } from '@ar.io/sdk/web';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './App.css';

const io = IO.init();
const antRegistry = ANTRegistry.init();
function App() {
  const [contract, setContract] = useState<string>('Loading...');
  const [ants, setAnts] = useState<string>('Loading...');
  const [ioContractSuccess, setIoContractSuccess] = useState<boolean>(false);
  const [antRegistrySuccess, setAntRegistrySuccess] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    io.getInfo()
      .then((state: any) => {
        setContract(`\`\`\`json\n${JSON.stringify(state, null, 2)}`);
        setIoContractSuccess(true);
      })
      .catch((error: any) => {
        console.error(error);
        setIoContractSuccess(false);
        setContract('Error loading contract state');
      })
      .finally(() => {
        setLoaded(true);
      });
    antRegistry
      .accessControlList({
        address: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
      })
      .then((affiliatedAnts: { Owned: string[]; Controlled: string[] }) => {
        setAnts(`\`\`\`json\n${JSON.stringify(affiliatedAnts, null, 2)}`);
        setAntRegistrySuccess(true);
      })
      .catch((error: any) => {
        console.error(error);
        setAntRegistrySuccess(false);
        setAnts('Error loading affiliated ants');
      });
  }, []);

  return (
    <div className="App">
      <div>
        {loaded && (
          <div data-testid="load-info-result">{`${ioContractSuccess}`}</div>
        )}
        <Markdown className="markdown" remarkPlugins={[remarkGfm]}>
          {contract}
        </Markdown>
      </div>
      {loaded && (
        <div data-testid="load-registry-result">{`${antRegistrySuccess}`}</div>
      )}
      <Markdown className="markdown" remarkPlugins={[remarkGfm]}>
        {ants}
      </Markdown>
    </div>
  );
}

export default App;
