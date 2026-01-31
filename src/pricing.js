/**
 * AOC Wine Pricing Calculator
 * Isolated business logic - can run client-side or server-side
 */

/**
 * Determine which formula type applies to a product
 * @param {string} productType - The product type string
 * @returns {'wine' | 'spirits' | 'non_alcoholic'}
 */
export function getFormulaType(productType) {
    const type = (productType || '').toLowerCase();

    const spiritsKeywords = ['spirit', 'liquor', 'vodka', 'whiskey', 'whisky', 'bourbon', 'rum', 'gin', 'tequila'];
    const nonAlcKeywords = ['non-alc', 'na ', 'juice', 'soda', 'non alc'];

    if (spiritsKeywords.some(k => type.includes(k))) return 'spirits';
    if (nonAlcKeywords.some(k => type.includes(k))) return 'non_alcoholic';
    return 'wine';
}

/**
 * Calculate all pricing tiers for a product
 * @param {Object} product - Product with fobCasePrice, bottleSize, packSize, productType
 * @param {Object} formulas - Pricing formulas keyed by type
 * @returns {Object} Calculated prices
 */
export function calculateFrontlinePrice(product, formulas) {
    const formulaType = getFormulaType(product.productType);
    const formula = formulas[formulaType] || formulas.wine;

    // Parse inputs
    const bottleSize = parseFloat(String(product.bottleSize || product.bottle_size_ml).replace(/[^0-9.]/g, '')) || 750;
    const packSize = parseInt(product.packSize || product.pack_size) || 12;
    const fobCasePrice = parseFloat(product.fobCasePrice || product.fob_case_price) || 0;

    // AOC Formula Steps:
    // 1. Net FOB (assuming no discount)
    const netFOB = fobCasePrice;

    // 2. Case Size (L) = (bottles/case * bottle size ml) / 1000
    const caseSizeL = (packSize * bottleSize) / 1000;

    // 3. Tax = (Case Size L * taxPerLiter) + taxFixed
    const tax = (caseSizeL * formula.taxPerLiter) + formula.taxFixed;

    // 4. Taxes, etc = Shipping + Tax
    const taxesEtc = formula.shippingPerCase + tax;

    // 5. Laid In = Net FOB + Taxes, etc
    const laidIn = netFOB + taxesEtc;

    // 6. Whls Case = Laid In / margin divisor
    const whlsCase = laidIn / formula.marginDivisor;

    // 7. Whls Bottle = Whls Case / bottles per case
    const whlsBottle = whlsCase / packSize;

    // 8. SRP = ROUNDUP(Whls Bottle * SRP multiplier, 0) - 0.01
    const srp = Math.ceil(whlsBottle * formula.srpMultiplier) - 0.01;

    // 9. Frontline Bottle = SRP / SRP multiplier
    const frontlinePrice = srp / formula.srpMultiplier;

    return {
        frontlinePrice: frontlinePrice.toFixed(2),
        frontlineCase: (frontlinePrice * packSize).toFixed(2),
        srp: srp.toFixed(2),
        whlsBottle: whlsBottle.toFixed(2),
        whlsCase: whlsCase.toFixed(2),
        laidIn: laidIn.toFixed(2),
        formulaUsed: formulaType
    };
}

/**
 * Default formula values (for new organizations)
 */
export const DEFAULT_FORMULAS = {
    wine: {
        taxPerLiter: 0.32,
        taxFixed: 0.15,
        shippingPerCase: 13,
        marginDivisor: 0.65,
        srpMultiplier: 1.47
    },
    spirits: {
        taxPerLiter: 1.17,
        taxFixed: 0.15,
        shippingPerCase: 13,
        marginDivisor: 0.65,
        srpMultiplier: 1.47
    },
    non_alcoholic: {
        taxPerLiter: 0,
        taxFixed: 0,
        shippingPerCase: 13,
        marginDivisor: 0.65,
        srpMultiplier: 1.47
    }
};