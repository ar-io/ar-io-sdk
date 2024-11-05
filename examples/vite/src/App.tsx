import {
  AoAuction,
  AoAuctionPriceData,
  IO,
  IO_DEVNET_PROCESS_ID,
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

const io = IO.init({ processId: IO_DEVNET_PROCESS_ID });

type AuctionWithPrices = AoAuction & {
  prices: { timestamp: string; price: number }[];
  currentPrice: number;
};

function App() {
  const [auctions, setAuctions] = useState<AuctionWithPrices[]>([]);

  useEffect(() => {
    io.getArNSAuctions().then((page: PaginationResult<AoAuction>) => {
      page.items.forEach((auction: AoAuction) => {
        io.getArNSAuctionPrices({
          name: auction.name,
          type: 'lease',
          intervalMs: 1000 * 60 * 60 * 24, // 1 day
        }).then((price: AoAuctionPriceData) => {
          const arrayOfPrices = Object.entries(price.prices)
            .sort(([timestampA], [timestampB]) => +timestampA - +timestampB)
            .map(([timestamp, price]) => ({
              timestamp: new Date(+timestamp).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
              price: price / 10 ** 6,
            }));
          const auctionWithPrices = {
            ...auction,
            prices: arrayOfPrices,
            currentPrice: price.currentPrice / 10 ** 6,
          };
          setAuctions((prev) => [...prev, auctionWithPrices]);
        });
      });
    });
  }, []);

  return (
    <div className="App" style={{ padding: '50px' }}>
      {auctions.length > 0 && (
        <ResponsiveContainer width="50%" height={500}>
          <LineChart
            data={auctions[0].prices}
            title={`Auction Prices for ${auctions[0].name}`}
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
              y={auctions[0].prices[auctions[0].prices.length - 1].price}
              label={`Floor Price: ${auctions[0].prices[auctions[0].prices.length - 1].price}`}
              stroke="red"
              strokeDasharray="3 3"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default App;
