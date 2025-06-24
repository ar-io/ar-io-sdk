/**
 * Script to analyze ARNs modules report CSV file and display version distribution
 *
 * Usage: node analyze-ant-versions.mjs [path-to-csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure path for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Main function
async function main() {
  try {
    // Find the latest CSV file if none provided as argument
    let csvPath = process.argv[2];
    if (!csvPath) {
      const files = fs.readdirSync(__dirname);
      const reportFiles = files
        .filter(
          (file) =>
            file.startsWith('arns-modules-report') && file.endsWith('.csv'),
        )
        .sort()
        .reverse();

      if (reportFiles.length === 0) {
        console.error(
          'No report CSV files found. Please generate a report first or specify path.',
        );
        process.exit(1);
      }

      csvPath = path.join(__dirname, reportFiles[0]);
      console.log(`Using latest report file: ${csvPath}`);
    }

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const rows = csvContent.split('\n').filter((row) => row.trim());

    // Skip header row
    const dataRows = rows.slice(1);

    // Extract version data
    const versionDistribution = {};
    let totalRecords = 0;

    dataRows.forEach((row) => {
      const columns = row.split(',');
      // CSV format: ArNS Name, Process ID, Module ID, Version
      if (columns.length >= 4) {
        const name = columns[0];
        const version = columns[3].trim();

        // Group all empty, ERROR, or '' versions as "<16"
        const versionCategory =
          !version || version === 'ERROR' || version === '' ? '<16' : version;

        versionDistribution[versionCategory] =
          (versionDistribution[versionCategory] || 0) + 1;
        totalRecords++;
      }
    });

    // Display results
    console.log('='.repeat(50));
    console.log('ANT MODULE VERSION DISTRIBUTION');
    console.log('='.repeat(50));
    console.log(`Total ARNs records analyzed: ${totalRecords}`);
    console.log('-'.repeat(50));

    // Sort by count (descending)
    const sortedVersions = Object.entries(versionDistribution).sort(
      (a, b) => b[0] - a[0],
    );

    // Calculate percentages and display
    console.log(
      'Version'.padEnd(8) + ' | ' + 'Count'.padEnd(7) + ' | ' + 'Percentage',
    );
    console.log('-'.repeat(50));
    const maxPercent = Math.max(
      ...sortedVersions.map(([, count]) => (count / totalRecords) * 100),
    );
    const barWidth = 30; // Maximum bar width in characters

    sortedVersions.forEach(([version, count]) => {
      const percentage = (count / totalRecords) * 100;
      const barLength = Math.round((percentage / maxPercent) * barWidth);
      const bar = '█'.repeat(barLength);
      const percentageStr = percentage.toFixed(2) + '%';

      console.log(
        `${version.padEnd(8)} | ${count.toString().padEnd(7)} | ${percentageStr.padStart(6)} ${bar.padEnd(barWidth)}`,
      );
    });

    console.log('='.repeat(50));

    // Save results to JSON
    const outputPath = path.join(
      path.dirname(csvPath),
      'ant-version-distribution.json',
    );
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          totalRecords,
          distribution: Object.fromEntries(sortedVersions),
          analyzedFile: path.basename(csvPath),
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`Analysis saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error analyzing report:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
