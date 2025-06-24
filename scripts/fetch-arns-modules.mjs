/**
 * Script to fetch all ARNs records from mainnet, extract process IDs,
 * query Goldsky GraphQL for Module tags, and create a CSV report.
 *
 * ESM version for better compatibility with the AR.IO SDK.
 */
import { ANTVersions, ARIO } from '@ar.io/sdk';
import fs from 'fs';
import pLimit from 'p-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure path for ESM
const __filename = fileURLToPath(import.meta.url);

// GraphQL endpoint
const GOLDSKY_GQL_ENDPOINT = 'https://arweave-search.goldsky.com/graphql';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Function to fetch all ARNs records with pagination and filtering
async function fetchAllArnsRecords(ario) {
  console.log('Fetching all ARNs records from mainnet...');

  let records = [];
  let hasNextPage = true;
  let cursor = null;
  let pageCount = 0;
  const PAGE_SIZE = 1000;

  while (hasNextPage) {
    pageCount++;
    console.log(
      `Fetching page ${pageCount}${cursor ? ` after cursor: ${cursor}` : ''}...`,
    );

    try {
      const { items, nextCursor, hasMore } = await ario.getArNSRecords({
        cursor,
        limit: PAGE_SIZE,
      });

      records = records.concat(items);

      console.log(
        `Fetched ${items.length} records on this page. Total: ${records.length}`,
      );

      if (!hasNextPage) {
        break;
      }
      hasNextPage = hasMore;
      cursor = nextCursor;
    } catch (error) {
      console.error(`Error fetching page ${pageCount}:`, error);

      // Retry logic
      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        retryCount++;
        console.log(
          `Retrying page ${pageCount} (attempt ${retryCount}/${MAX_RETRIES})...`,
        );

        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryCount),
        );

        try {
          const response = await ario.getArNSRecords({
            after: cursor,
            limit: PAGE_SIZE,
            filters,
          });

          if (response.items && Array.isArray(response.items)) {
            records = records.concat(response.items);
            hasNextPage = response.hasNextPage;
            cursor = response.cursor;
            success = true;

            console.log(`Retry successful. Total records: ${records.length}`);
          } else {
            console.error('Unexpected response format on retry:', response);
          }
        } catch (retryError) {
          console.error(`Retry ${retryCount} failed:`, retryError);
        }
      }

      if (!success) {
        console.error(
          `Failed to fetch page ${pageCount} after ${MAX_RETRIES} retries. Continuing with next page.`,
        );
        if (cursor) {
          // Try to move to next page if we have a cursor
          continue;
        } else {
          // If we don't have a cursor, we can't continue
          hasNextPage = false;
        }
      }
    }
  }

  console.log(`Total ARNs records fetched: ${records.length}`);
  return records;
}

// Function to query GraphQL for Module tag with retries
async function fetchModuleTag(processId) {
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      // First try to query for a direct Module tag
      let query = `
        query {
          transactions(
            ids: ["${processId}"]
          ) {
            edges {
              node {
                tags {
                  name
                  value
                }
              }
            }
          }
        }
      `;

      let response = await fetch(GOLDSKY_GQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      let data = await response.json();

      if (data.errors) {
        console.error(`GraphQL error for processId ${processId}:`, data.errors);
        retryCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryCount),
        );
        continue;
      }

      let edges = data.data?.transactions?.edges || [];
      if (edges.length > 0) {
        const tags = edges[0]?.node?.tags || [];
        const moduleTag =
          tags.find((tag) => tag.name === 'Module')?.value || null;

        if (moduleTag) {
          return moduleTag;
        }
      }

      response = await fetch(GOLDSKY_GQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.error(
          `Failed to fetch module tag for processId ${processId}:`,
          response.statusText,
        );
        retryCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryCount),
        );
        continue;
      }

      data = await response.json();
      edges = data.data?.transactions?.edges || [];
      if (edges.length > 0) {
        const tags = edges[0]?.node?.tags || [];
        const initStateTag =
          tags.find((tag) => tag.name === 'Init-State')?.value || null;

        if (initStateTag) {
          try {
            const initState = JSON.parse(initStateTag);
            if (initState && initState.Module) {
              return initState.Module;
            }
          } catch (e) {
            console.error(
              `Error parsing Init-State for processId ${processId}:`,
              e,
            );
          }
        }
      }

      // If we reach here, no Module was found
      return null;
    } catch (error) {
      console.error(
        `Error fetching module tag for processId ${processId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
        error,
      );
      retryCount++;

      if (retryCount <= MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryCount),
        );
      } else {
        return null;
      }
    }
  }

  return null;
}

// Function to get and save ANT versions once
async function fetchAndSaveANTVersions(antVersions) {
  try {
    console.log('Fetching ANT versions from registry...');
    const versions = await antVersions.getANTVersions();

    // Save versions to file
    const versionsPath = path.join(process.cwd(), 'ant-versions.json');
    fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2), 'utf8');
    console.log(`ANT versions saved to ${versionsPath}`);

    return versions;
  } catch (error) {
    console.error('Error fetching ANT versions:', error);
    return null;
  }
}

// Function to check module against ANTRegistry versions
function checkModuleVersion(moduleId, antVersionsMap) {
  if (!moduleId || !antVersionsMap) return null;

  try {
    for (const [version, details] of Object.entries(antVersionsMap)) {
      if (details.moduleId === moduleId) {
        return version;
      }
    }
    return null; // Module not found in registry
  } catch (error) {
    console.error(`Error checking module version:`, error);
    return null;
  }
}

// Function to generate CSV
function generateCSV(data) {
  const csvRows = [];

  // Add header
  csvRows.push(['ArNS Name', 'Process ID', 'Module ID', 'Version']);

  // Add data rows
  data.forEach((item) => {
    csvRows.push([
      item.name,
      item.processId,
      item.moduleId || '',
      item.version || '',
    ]);
  });

  // Convert to CSV string
  const csvContent = csvRows
    .map((row) =>
      row
        .map((field) =>
          // Escape fields with commas or quotes by wrapping in quotes
          typeof field === 'string' &&
          (field.includes(',') || field.includes('"'))
            ? `"${field.replace(/"/g, '""')}"`
            : field,
        )
        .join(','),
    )
    .join('\n');

  return csvContent;
}

// Main function
async function main() {
  try {
    // Create instances
    const ario = ARIO.mainnet();
    const antVersions = ANTVersions.init();

    // 1. Fetch all ANT versions once and save to file
    const antVersionsMap = await fetchAndSaveANTVersions(antVersions);
    if (!antVersionsMap) {
      console.error('Failed to fetch ANT versions, aborting');
      process.exit(1);
    }

    // 2. Fetch all ARNs records
    const arnsRecords = await fetchAllArnsRecords(ario);
    console.log(`Successfully fetched ${arnsRecords.length} ARNs records`);

    // Save raw records to JSON file for reference/backup
    const rawDataPath = path.join(process.cwd(), 'arns-raw-records.json');
    fs.writeFileSync(rawDataPath, JSON.stringify(arnsRecords, null, 2), 'utf8');
    console.log(`Raw ARNs data saved to ${rawDataPath}`);

    // 2. Process each record to get module tags
    const processedData = [];
    const failedProcessIds = [];

    // Log timing information
    const startTime = Date.now();
    console.log(`Started processing at ${new Date(startTime).toISOString()}`);
    console.log(
      `Estimated time: ${Math.ceil((arnsRecords.length * 0.5) / 60)} minutes (with concurrency of 20)`,
    );

    // Create a concurrency limit
    const limit = pLimit(5);

    // Process records concurrently with p-limit
    const processRecordPromises = arnsRecords.map((record, i) => {
      return limit(async () => {
        const percentComplete = ((i / arnsRecords.length) * 100).toFixed(2);
        console.log(
          `Processing record ${i + 1}/${arnsRecords.length} (${percentComplete}%): ${record.name}`,
        );

        const processId = record.processId;
        if (!processId) {
          console.log(`No processId found for ${record.name}, skipping...`);
          return null;
        }

        try {
          // 3. Fetch module tag
          const moduleId = await fetchModuleTag(processId);

          // 4. Check version in ANTRegistry if module tag exists
          let version = null;
          if (moduleId) {
            version = checkModuleVersion(moduleId, antVersionsMap);
          }

          const result = {
            name: record.name,
            processId,
            moduleId: moduleId || '',
            version: version || '',
          };

          // Log successful processing
          console.log(
            `Processed ${record.name} - Module: ${moduleId || 'Not found'}, Version: ${version || 'Unknown'}`,
          );

          return result;
        } catch (error) {
          console.error(
            `Error processing ${record.name} (${processId}):`,
            error,
          );
          failedProcessIds.push(processId);

          // Still add to processed data, but mark as error
          return {
            name: record.name,
            processId,
            moduleId: 'ERROR',
            version: 'ERROR',
          };
        }
      });
    });

    // Wait for all promises to resolve
    const results = await Promise.all(processRecordPromises);

    // Filter out null results (from skipped records) and add to processedData
    results
      .filter((result) => result !== null)
      .forEach((result) => {
        processedData.push(result);
      });

    const endTime = Date.now();
    const totalTimeMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);
    console.log(`Processing completed in ${totalTimeMinutes} minutes`);

    // 5. Generate and save CSV
    const csvContent = generateCSV(processedData);
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const outputPath = path.join(
      process.cwd(),
      `arns-modules-report-${timestamp}.csv`,
    );
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`Report saved to ${outputPath}`);

    // Log failure summary if any
    if (failedProcessIds.length > 0) {
      console.log(`Failed to process ${failedProcessIds.length} process IDs:`);
      console.log(failedProcessIds);

      // Save failed IDs to file for retry
      const failedPath = path.join(process.cwd(), 'failed-process-ids.json');
      fs.writeFileSync(
        failedPath,
        JSON.stringify(failedProcessIds, null, 2),
        'utf8',
      );
      console.log(`Failed process IDs saved to ${failedPath}`);
    }
  } catch (error) {
    console.error('Error running script:', error);
    process.exit(1);
  }
}

// Run the script with proper error handling
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
