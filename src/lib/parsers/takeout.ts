import JSZip from 'jszip';
import Papa from 'papaparse';
import type { ParsedPlace, ImportError } from '@/types';

export interface TakeoutParseResult {
  places: ParsedPlace[];
  errors: ImportError[];
  collections: string[];
}

/**
 * Parse a Google Takeout ZIP file
 */
export async function parseTakeoutZip(file: File): Promise<TakeoutParseResult> {
  const places: ParsedPlace[] = [];
  const errors: ImportError[] = [];
  const collections = new Set<string>();

  try {
    const zip = await JSZip.loadAsync(file);

    // Find all CSV files in the Saved folder
    const savedPath = 'Takeout/Maps/Saved Places/';
    const csvFiles: JSZip.JSZipObject[] = [];

    zip.forEach((relativePath, zipEntry) => {
      // Look for CSVs in Saved Places folder
      if (
        relativePath.toLowerCase().includes('saved') &&
        relativePath.toLowerCase().endsWith('.csv')
      ) {
        csvFiles.push(zipEntry);
      }
    });

    if (csvFiles.length === 0) {
      // Try alternate paths
      zip.forEach((relativePath, zipEntry) => {
        if (relativePath.toLowerCase().endsWith('.csv')) {
          csvFiles.push(zipEntry);
        }
      });
    }

    for (const csvFile of csvFiles) {
      const content = await csvFile.async('string');
      const listName = extractListName(csvFile.name);
      collections.add(listName);

      const result = await parseTakeoutCsv(content, listName);
      places.push(...result.places);
      errors.push(...result.errors);
    }
  } catch (error) {
    errors.push({
      reason: `Failed to read ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return {
    places,
    errors,
    collections: Array.from(collections),
  };
}

/**
 * Parse a single Takeout CSV file
 */
export async function parseTakeoutCsv(
  content: string,
  listName: string
): Promise<{ places: ParsedPlace[]; errors: ImportError[] }> {
  return new Promise((resolve) => {
    const places: ParsedPlace[] = [];
    const errors: ImportError[] = [];

    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: Record<string, string>, index: number) => {
          try {
            const place = parseTakeoutRow(row, listName);
            if (place) {
              places.push(place);
            }
          } catch (error) {
            errors.push({
              row: index + 2,
              item: row['Title'] || row['Name'] || 'Unknown',
              reason: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        resolve({ places, errors });
      },
      error: (error) => {
        errors.push({ reason: `CSV parse error: ${error.message}` });
        resolve({ places, errors });
      },
    });
  });
}

/**
 * Parse a row from Takeout CSV
 */
function parseTakeoutRow(row: Record<string, string>, listName: string): ParsedPlace | null {
  // Google Takeout uses 'Title' column
  const title = row['Title'] || row['Name'] || row['title'] || row['name'];
  if (!title) {
    return null;
  }

  // Address column
  const address = row['Address'] || row['address'] || row['Location'] || '';

  // Note/Comment
  const notes = row['Note'] || row['Comment'] || row['note'] || '';

  // URL - Google Takeout includes this
  const sourceUrl = row['URL'] || row['url'] || row['Link'] || '';

  // Try to extract coordinates from URL if present
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (sourceUrl) {
    const coords = extractCoordsFromUrl(sourceUrl);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  // Some Takeout exports have direct lat/lng columns
  if (!latitude && row['Latitude']) {
    latitude = parseFloat(row['Latitude']);
    if (isNaN(latitude)) latitude = undefined;
  }
  if (!longitude && row['Longitude']) {
    longitude = parseFloat(row['Longitude']);
    if (isNaN(longitude)) longitude = undefined;
  }

  return {
    title,
    address,
    latitude,
    longitude,
    notes: notes || undefined,
    sourceUrl: sourceUrl || undefined,
    listName,
  };
}

/**
 * Extract list name from file path
 */
function extractListName(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  // Remove .csv extension
  return fileName.replace(/\.csv$/i, '');
}

/**
 * Extract coordinates from Google Maps URL
 */
function extractCoordsFromUrl(url: string): { latitude: number; longitude: number } | null {
  try {
    // Pattern: @lat,lng,zoom
    const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }

    // Pattern: ?ll=lat,lng
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) {
      const latitude = parseFloat(llMatch[1]);
      const longitude = parseFloat(llMatch[2]);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }

    // Pattern: query=lat,lng
    const queryMatch = url.match(/query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (queryMatch) {
      const latitude = parseFloat(queryMatch[1]);
      const longitude = parseFloat(queryMatch[2]);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }

    return null;
  } catch {
    return null;
  }
}
