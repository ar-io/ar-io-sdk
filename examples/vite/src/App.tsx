import {
  ARIO,
  ARIO_DEVNET_PROCESS_ID,
  AoArNSNameDataWithName,
  AoGatewayWithAddress,
  AoReturnedName,
  AoWeightedObserver,
  PaginationResult,
} from '@ar.io/sdk/web';
import { useEffect, useState } from 'react';
import {
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import './App.css';

const ario = ARIO.init({ processId: ARIO_DEVNET_PROCESS_ID });

type ReturnedNameWithPrices = AoReturnedName & {
  currentPrice: number;
};

function App() {
  const [returnedNames, setReturnedNames] = useState<AoReturnedName[]>([]);
  const [selectedReturnedName, setSelectedReturnedName] =
    useState<ReturnedNameWithPrices | null>(null);
  const [names, setNames] = useState<AoArNSNameDataWithName[]>([]);
  const [gateways, setGateways] = useState<AoGatewayWithAddress[]>([]);
  const [totalGateways, setTotalGateways] = useState<number>(0);
  const [totalNames, setTotalNames] = useState<number>(0);
  const [totalReturnedNames, setTotalReturnedNames] = useState<number>(0);
  const [prescribedObservers, setPrescribedObservers] = useState<
    AoWeightedObserver[]
  >([]);

  useEffect(() => {
    // fetch first page of arns names
    ario
      .getArNSRecords({ limit: 10 })
      .then((page: PaginationResult<AoArNSNameDataWithName>) => {
        setNames(page.items);
        setTotalNames(page.totalItems);
      });

    // fetch first page of gateways
    ario
      .getGateways({ limit: 10 })
      .then((page: PaginationResult<AoGatewayWithAddress>) => {
        setGateways(page.items);
        setTotalGateways(page.totalItems);
      });

    // get returned names and prices for each returned name
    ario
      .getArNSReturnedNames({ limit: 10 })
      .then((page: PaginationResult<AoReturnedName>) => {
        setReturnedNames(page.items);
        setTotalReturnedNames(page.totalItems);
        page.items.forEach((returnedName: AoReturnedName) => {
          ario
            .getTokenCost({
              name: returnedName.name,
              intent: 'Buy-Record',
              type: 'lease',
              intervalMs: 1000 * 60 * 60 * 24, // 1 day
            })
            .then((price: number) => {
              setSelectedReturnedName({
                ...returnedName,
                currentPrice: price / 10 ** 6,
              });
            });
        });
      });

    ario.getPrescribedObservers().then((observers: AoWeightedObserver[]) => {
      setPrescribedObservers(observers);
    });
  }, []);

  return (
    <div className="App" style={{ padding: '50px', textAlign: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '30px',
          alignItems: 'center',
        }}
      >
        <div
          style={{ paddingLeft: '75px', paddingRight: '75px', width: '75%' }}
        >
          <h3>ArNS Names</h3>
          <div>
            <strong>Total Names:</strong> {totalNames}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Process
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Expiry
                  </th>
                </tr>
              </thead>
              <tbody>
                {names.map((record) => (
                  <tr
                    key={record.name}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>{record.name}</td>
                    <td style={{ padding: '10px' }}>
                      {record.processId.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '10px' }}>{record.type}</td>
                    <td style={{ padding: '10px' }}>
                      {record.type === 'lease' && record.endTimestamp
                        ? new Date(record.endTimestamp).toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{ paddingLeft: '75px', paddingRight: '75px', width: '75%' }}
        >
          {' '}
          <h3>Active Gateways</h3>
          <div>
            <strong>Total Gateways:</strong> {totalGateways}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Address
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Operator Stake (ARIO)
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Total Delegated Stake (ARIO)
                  </th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gateway) => (
                  <tr
                    key={gateway.gatewayAddress}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>
                      {gateway.gatewayAddress.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '10px' }}>{gateway.status}</td>
                    <td style={{ padding: '10px' }}>
                      {gateway.operatorStake / 10 ** 6}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {gateway.totalDelegatedStake / 10 ** 6}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div
          style={{ paddingLeft: '75px', paddingRight: '75px', width: '75%' }}
        >
          {' '}
          <h3>Active Returned names</h3>
          <div>
            <strong>Total Returned names:</strong> {totalReturnedNames}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Starts
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Ends</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Base Fee
                  </th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>
                    Initiator
                  </th>
                </tr>
              </thead>
              <tbody>
                {returnedNames.map((returnedName) => (
                  <tr
                    key={returnedName.name}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>{returnedName.name}</td>
                    <td style={{ padding: '10px' }}>
                      {new Date(
                        returnedName.startTimestamp,
                      ).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {new Date(returnedName.endTimestamp).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {returnedName.premiumMultiplier}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {returnedName.initiator.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedReturnedName && (
            <div style={{ margin: '0 auto' }}>
              <ResponsiveContainer width="50%" height={500}>
                <LineChart
                  data={selectedReturnedName.prices}
                  title={`Prices for ${returnedNames[0].name}`}
                >
                  <XAxis dataKey="timestamp" tick={{ fontSize: 12 }}>
                    <Label value="Date" offset={-5} position="insideBottom" />
                  </XAxis>
                  <YAxis dataKey="price" tick={{ fontSize: 12 }}>
                    <Label value="Price" offset={10} position="top" />
                  </YAxis>
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#222222"
                    strokeWidth={1}
                    dot={false}
                  >
                    <Label value="Price" offset={10} position="top" />
                  </Line>
                  <ReferenceLine
                    y={
                      selectedReturnedName.prices[
                        selectedReturnedName.prices.length - 1
                      ].price
                    }
                    label={`Floor Price: ${selectedReturnedName.prices[selectedReturnedName.prices.length - 1].price}`}
                    stroke="red"
                    strokeDasharray="3 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div
          style={{ paddingLeft: '75px', paddingRight: '75px', width: '75%' }}
        >
          <h3>Prescribed Observers</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '10px', textAlign: 'center' }}>
                  Observer
                </th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Stake</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>
                  Tenure Weight
                </th>
                <th style={{ padding: '10px', textAlign: 'center' }}>
                  Stake Weight
                </th>
                <th style={{ padding: '10px', textAlign: 'center' }}>
                  Normalized Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {prescribedObservers.map((observer) => (
                <tr
                  key={observer.gatewayAddress}
                  style={{ borderBottom: '1px solid #eee' }}
                >
                  <td style={{ padding: '10px' }}>
                    {observer.gatewayAddress.slice(0, 8)}...
                  </td>
                  <td style={{ padding: '10px' }}>{observer.stake}</td>
                  <td style={{ padding: '10px' }}>{observer.tenureWeight}</td>
                  <td style={{ padding: '10px' }}>{observer.stakeWeight}</td>
                  <td style={{ padding: '10px' }}>
                    {observer.compositeWeight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
