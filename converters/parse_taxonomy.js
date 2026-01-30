const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/wine_regions_outline.md');
const OUTPUT_FILE = path.join(__dirname, '../data/persistence/taxonomy.json');

const parseTaxonomy = () => {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error('Input file not found:', INPUT_FILE);
        return;
    }

    const content = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = content.split('\n');
    const taxonomy = {};

    let currentCountry = null;
    let currentRegion = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Detect Country (Level 1 Header: ## I. FRANCE)
        const countryMatch = trimmed.match(/^##\s+[IVXLC]+\.\s+(.+)$/);
        if (countryMatch) {
            currentCountry = countryMatch[1].trim();
            taxonomy[currentCountry] = {};
            currentRegion = null; // Reset region
            return;
        }

        // Detect Region (Level 2 Header: ### A. Bordeaux)
        if (currentCountry) {
            const regionMatch = trimmed.match(/^###\s+[A-Z]\.\s+(.+)$/);
            if (regionMatch) {
                currentRegion = regionMatch[1].trim();
                taxonomy[currentCountry][currentRegion] = [];
                return;
            }
        }

        // Detect Appellation (Level 3 List Item: 1. Médoc)
        if (currentCountry && currentRegion) {
            const appellationMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (appellationMatch) {
                const appellation = appellationMatch[1].trim();
                // Avoid "No official subregions" entries
                if (!appellation.toLowerCase().includes('no official subregions')) {
                    taxonomy[currentCountry][currentRegion].push(appellation);
                }
            }
        }
    });

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(taxonomy, null, 2));
    console.log('Taxonomy parsed successfully!');
    console.log(`Saved to: ${OUTPUT_FILE}`);
    console.log(`Countries found: ${Object.keys(taxonomy).length}`);
};

parseTaxonomy();
