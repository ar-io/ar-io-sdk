import { ARIO, ARIOToken, Logger, mARIOToken } from '@ar.io/sdk/web';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';

import './App.css';
import { ArNSNamesExample } from './components/ArNSNames';
import { FaucetExample } from './components/Faucet';
import { GatewaysExample } from './components/Gateways';
import { WayfinderExample } from './components/Wayfinder';
import { useArNSRecords } from './hooks/useArNS';
import { useGatewayDelegations, useGateways } from './hooks/useGatewayRegistry';

Logger.default.setLogLevel('debug');
const ario = ARIO.testnet();

function App() {
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenRequestMessage, setTokenRequestMessage] = useState<string | null>(
    null,
  );
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (window.arweaveWallet) {
      window.arweaveWallet.getActiveAddress().then((address) => {
        setConnectedAddress(address);
        setSelectedAddress(address);
      });
    }
  }, [window.arweaveWallet]);

  useEffect(() => {
    fetchBalance();
  }, [ario, selectedAddress]);

  const fetchBalance = async () => {
    setBalance(null);
    if (!selectedAddress) return;
    await ario
      .getBalance({
        address: selectedAddress,
      })
      .then((balance) => {
        const arioBalance = new mARIOToken(balance).toARIO().valueOf();
        setBalance(arioBalance);
      });
  };

  const examples = [
    {
      name: 'Wayfinder',
      component: <WayfinderExample />,
    },
    {
      name: 'Faucet',
      component: <FaucetExample />,
    },
    {
      name: 'Gateways',
      component: <GatewaysExample />,
    },
    {
      name: 'ArNS Names',
      component: <ArNSNamesExample />,
    },
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
