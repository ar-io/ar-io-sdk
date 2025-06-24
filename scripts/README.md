# AR.IO SDK Scripts

<!-- toc -->

- [ARNs Records and Module Tags](#arns-records-and-module-tags)

<!-- tocstop -->

## ARNs Records and Module Tags

This directory contains scripts to fetch all ARNs records from mainnet, extract their process IDs, query the Goldsky GraphQL API for Module tags, and generate a CSV report. Two versions of the script are provided for different environments.

### Features

- Fetches all registered ARNs records from mainnet using pagination
- Extracts process IDs from ARNS records
- Queries Goldsky GraphQL to get Module tags for each process ID
- Cross-checks module tags against ANTRegistry versions
- Generates a CSV with ARNs name, process ID, module tag, and version information
- Implements retry logic for resilience
- Saves intermediate results for error recovery

### Prerequisites

Before running the script, make sure you have:

1. Built the AR.IO SDK:
   ```
   yarn build
   ```

### Script Versions

#### CommonJS Version - fetch-arns-modules.js

For environments that use CommonJS modules:

```
node scripts/fetch-arns-modules.js
```

This version dynamically imports the AR.IO SDK from the dist/cjs directory.

#### ESM Version - fetch-arns-modules.mjs

For environments that use ES modules:

```
node scripts/fetch-arns-modules.mjs
```

This version directly imports the AR.IO SDK from the dist/esm directory and uses ES module syntax.

### Output

Both scripts generate the same output files:

1. `arns-raw-records.json` - Raw data of all ARNs records (for reference/backup)
2. `arns-modules-report-{timestamp}.csv` - CSV report with the following columns:
   - ArNS Name
   - Process ID
   - Module ID
   - Version
3. `failed-process-ids.json` - List of process IDs that failed to be processed (if any)

### Troubleshooting

If you encounter any issues:

1. Make sure you've built the SDK with `yarn build`
2. Check if you're using the appropriate script version for your environment
3. Check for network connectivity issues
4. If Goldsky rate limits are encountered, try increasing the delay between requests
5. For process IDs that failed, you can check the `failed-process-ids.json` file
