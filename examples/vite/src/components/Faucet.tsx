import { ARIO, ARIOToken, mARIOToken } from '@ar.io/sdk/web';
import { useEffect, useMemo, useState } from 'react';

export const FaucetExample = () => {
  const ario = useMemo(() => ARIO.testnet(), []);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenRequestMessage, setTokenRequestMessage] = useState<string | null>(
    null,
  );
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

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
  async function requestTokens() {
    try {
      if (localStorage.getItem('ario-jwt')) {
        await ario.faucet
          .claimWithAuthToken({
            authToken: localStorage.getItem('ario-jwt') ?? '',
            recipient: await window.arweaveWallet.getActiveAddress(),
            quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
          })
          .then((res) => {
            // refetch balance
            fetchBalance();
            setTokenRequestMessage(`Successfully claimed 100 ARIO tokens!`);
          })
          .catch((err) => {
            setTokenRequestMessage(`Failed to claim tokens: ${err}`);
          });
      } else {
        const captchaUrl = await ario.faucet.captchaUrl();
        const newWindow = window.open(
          captchaUrl.captchaUrl,
          '_blank',
          'width=600,height=600',
        );
        window.parent.addEventListener('message', async (event) => {
          if (event.data.type === 'ario-jwt-success') {
            newWindow?.close();
            localStorage.setItem('ario-jwt', event.data.token);
            const res = await ario.faucet
              .claimWithAuthToken({
                authToken: localStorage.getItem('ario-jwt') ?? '',
                recipient: await window.arweaveWallet.getActiveAddress(),
                quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
              })
              .then((res) => {
                setTokenRequestMessage(`Successfully claimed 100 ARIO tokens!`);
              })
              .catch((err) => {
                setTokenRequestMessage(`Failed to claim tokens: ${err}`);
              });
          }
        });
      }
    } catch (error) {
      console.error('Failed to claim tokens:', error);
      alert('Failed to claim tokens. See console for details.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ textAlign: 'left' }}>Faucet</h1>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px',
        }}
      >
        <span>
          {!selectedAddress
            ? 'Enter wallet address'
            : `Current Balance: ${balance ? `${balance.toFixed(2)} ARIO` : 'Loading...'}`}
        </span>

        <input
          type="text"
          placeholder={selectedAddress ?? 'Enter wallet address'}
          onChange={(e) => {
            const value = e.target.value;
            clearTimeout((window as any).addressTimeout);
            (window as any).addressTimeout = setTimeout(() => {
              setSelectedAddress(value);
            }, 1000);
          }}
          style={{
            padding: '8px',
            width: '350px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />

        {/* Example of using the testnet faucet to request tokens */}
        <button onClick={requestTokens} disabled={!selectedAddress}>
          Request 100 tARIO
        </button>
        {tokenRequestMessage && (
          <span
            style={{
              color: 'green',
              opacity: tokenRequestMessage ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
            onAnimationEnd={() => {
              setTimeout(() => {
                setTokenRequestMessage(null);
              }, 5000);
            }}
          >
            {tokenRequestMessage}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: '0.8em',
          color: '#666',
          textAlign: 'center',
          margin: '0 auto',
          maxWidth: '500px',
        }}
      >
        Note: This example uses the AR.IO testnet faucet to request test tokens
        (tARIO). A captcha verification is required to claim tokens.
      </div>
    </div>
  );
};
