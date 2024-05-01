import { ANT } from '@ar.io/sdk';
import { useEffect, useState } from 'react';
import { WarpFactory } from 'warp-contracts';

import './App.css';

const warp = WarpFactory.forMainnet();
const contractTxId = 'ilwT4ObFQ7cGPbW-8z-h7mvvWGt_yhWNlqxNjSUgiYY';
const ant = ANT.init({
  contractTxId,
});
function App() {
  const [contract, setContract] = useState<any>({});

  useEffect(() => {
    warp
      .contract(contractTxId)
      .syncState(`https://api.arns.app/v1/contract/${contractTxId}`, {
        validity: true,
      })
      .then((syncedContract) => {
        syncedContract
          .readState()
          .then((state) => {
            setContract(state);
          })
          .catch((error) => {
            console.error(error);
          });
      });
  }, []);

  // useEffect(() => {
  //   ant
  //     .getState()
  //     .then((contract) => {
  //       console.log(contract);
  //     })
  //     .catch((error) => {
  //       console.error(error);
  //     });
  // }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>{JSON.stringify(contract)}</p>
      </header>
    </div>
  );
}

export default App;
