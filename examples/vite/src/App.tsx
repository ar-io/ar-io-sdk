import { ARIO, Logger } from '@ar.io/sdk/web';

import './App.css';
import { ArNSNamesExample } from './components/ArNSNames';
import { FaucetExample } from './components/Faucet';
import { GatewaysExample } from './components/Gateways';
import { WayfinderExample } from './components/Wayfinder';

Logger.default.setLogLevel('debug');

function App() {
  const examples = [
    {
      name: 'Wayfinder',
      component: <WayfinderExample />,
    },
    // {
    //   name: 'Faucet',
    //   component: <FaucetExample />,
    // },
    // {
    //   name: 'Gateways',
    //   component: <GatewaysExample />,
    // },
    // {
    //   name: 'ArNS Names',
    //   component: <ArNSNamesExample />,
    // },
  ];
  return (
    <div
      className="App"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '100px',
        width: '75%',
        margin: '0 auto',
      }}
    >
      <h1>AR.IO SDK Examples</h1>
      {examples.map((example) => (
        <div key={example.name}>
          {example.component}
          <div style={{ padding: '10px' }}>
            <hr />
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
