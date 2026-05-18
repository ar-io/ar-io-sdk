import { ARIO } from "@ar.io/sdk";
import { createSolanaRpc } from "@solana/kit";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import "./App.css";

const ario = ARIO.init({
  rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
});
function App() {
  const [contract, setContract] = useState<string>("Loading...");

  useEffect(() => {
    ario
      .getInfo()
      .then((state) => {
        setContract(`\`\`\`json\n${JSON.stringify(state, null, 2)}`);
      })
      .catch((error) => {
        console.error(error);
        setContract("Error loading contract state");
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
