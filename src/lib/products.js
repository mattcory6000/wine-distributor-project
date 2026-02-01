import { supabase } from './supabase';

// AOC Wines org ID - hardcoded for now, will come from user context later
const ORG_ID = 'a0000000-0000-0000-0000-000000000001';

/**
 * Fetch all products for the organization
 */
export async function getProducts() {
    const { data, error } = await supabase
        .from('products')
        .select(`
      *,
      suppliers (name)
    `)
        .eq('organization_id', ORG_ID)
        .eq('is_discontinued', false)
        .order('producer');

    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }

    // Transform to match existing app format
    return data.map(p => ({
        id: p.id,
        itemCode: p.item_code,
        producer: p.producer,
        productName: p.product_name,
        vintage: p.vintage || '',
        packSize: String(p.pack_size),
        bottleSize: String(p.bottle_size_ml),
        productType: p.product_type,
        fobCasePrice: parseFloat(p.fob_case_price),
        productLink: p.product_link || '',
        country: p.country || '',
        region: p.region || '',
        appellation: p.appellation || '',
        supplier: p.suppliers?.name || '',
        uploadDate: p.uploaded_at,
        ...p.extra_fields,
    }));
}

/**
 * Fetch discontinued products
 */
export async function getDiscontinuedProducts() {
    const { data, error } = await supabase
        .from('products')
        .select(`
      *,
      suppliers (name)
    `)
        .eq('organization_id', ORG_ID)
        .eq('is_discontinued', true)
        .order('discontinued_at', { ascending: false });

    if (error) {
        console.error('Error fetching discontinued products:', error);
        return [];
    }

    return data.map(p => ({
        id: p.id,
        itemCode: p.item_code,
        producer: p.producer,
        productName: p.product_name,
        vintage: p.vintage || '',
        packSize: String(p.pack_size),
        bottleSize: String(p.bottle_size_ml),
        productType: p.product_type,
        fobCasePrice: parseFloat(p.fob_case_price),
        productLink: p.product_link || '',
        country: p.country || '',
        region: p.region || '',
        appellation: p.appellation || '',
        supplier: p.suppliers?.name || '',
        discontinuedDate: p.discontinued_at,
        ...p.extra_fields,
    }));
}

/**
 * Get or create a supplier by name
 */
async function getOrCreateSupplier(supplierName) {
    if (!supplierName) return null;

    // Try to find existing
    const { data: existing } = await supabase
        .from('suppliers')
        .select('id')
        .eq('organization_id', ORG_ID)
        .eq('name', supplierName)
        .single();

    if (existing) return existing.id;

    // Create new
    const { data: created, error } = await supabase
        .from('suppliers')
        .insert({
            organization_id: ORG_ID,
            name: supplierName,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating supplier:', error);
        return null;
    }

    return created.id;
}

/**
 * Save a single product (insert or update)
 */
export async function saveProduct(product) {
    const supplierId = await getOrCreateSupplier(product.supplier);

    // Separate standard fields from extra fields
    const {
        id, itemCode, producer, productName, vintage, packSize, bottleSize,
        productType, fobCasePrice, productLink, country, region, appellation,
        supplier, uploadDate, frontlinePrice, frontlineCase, srp, whlsBottle,
        whlsCase, laidIn, formulaUsed,
        ...extraFields
    } = product;

    const productData = {
        organization_id: ORG_ID,
        supplier_id: supplierId,
        item_code: itemCode || null,
        producer,
        product_name: productName,
        vintage: vintage || null,
        pack_size: parseInt(packSize) || 12,
        bottle_size_ml: parseInt(String(bottleSize).replace(/[^0-9]/g, '')) || 750,
        product_type: productType?.toLowerCase().includes('spirit') ? 'spirits'
            : productType?.toLowerCase().includes('non') ? 'non_alcoholic'
                : 'wine',
        fob_case_price: fobCasePrice,
        product_link: productLink || null,
        country: country || null,
        region: region || null,
        appellation: appellation || null,
        extra_fields: Object.keys(extraFields).length > 0 ? extraFields : {},
        uploaded_at: uploadDate || new Date().toISOString(),
    };

    // Check if product exists (by id or by unique combo)
    if (id && !id.startsWith('prod-')) {
        // UUID format - update existing
        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating product:', error);
            return null;
        }
        return data;
    }

    // Insert new
    const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

    if (error) {
        console.error('Error inserting product:', error);
        return null;
    }

    return data;
}

/**
 * Save multiple products (bulk import)
 */
export async function saveProducts(products, supplierName) {
    const supplierId = await getOrCreateSupplier(supplierName);

    const productRows = products.map(product => {
        const {
            id, itemCode, producer, productName, vintage, packSize, bottleSize,
            productType, fobCasePrice, productLink, country, region, appellation,
            supplier, uploadDate, frontlinePrice, frontlineCase, srp, whlsBottle,
            whlsCase, laidIn, formulaUsed,
            ...extraFields
        } = product;

        return {
            organization_id: ORG_ID,
            supplier_id: supplierId,
            item_code: itemCode || null,
            producer,
            product_name: productName,
            vintage: vintage || null,
            pack_size: parseInt(packSize) || 12,
            bottle_size_ml: parseInt(String(bottleSize).replace(/[^0-9]/g, '')) || 750,
            product_type: productType?.toLowerCase().includes('spirit') ? 'spirits'
                : productType?.toLowerCase().includes('non') ? 'non_alcoholic'
                    : 'wine',
            fob_case_price: fobCasePrice,
            product_link: productLink || null,
            country: country || null,
            region: region || null,
            appellation: appellation || null,
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : {},
            uploaded_at: uploadDate || new Date().toISOString(),
        };
    });

    const { data, error } = await supabase
        .from('products')
        .insert(productRows)
        .select();

    if (error) {
        console.error('Error bulk inserting products:', error);
        return [];
    }

    return data;
}

/**
 * Delete a product
 */
export async function deleteProduct(productId) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        console.error('Error deleting product:', error);
        return false;
    }

    return true;
}

/**
 * Mark products as discontinued (by supplier, for replacement imports)
 */
export async function discontinueProductsBySupplier(supplierName) {
    const supplierId = await getOrCreateSupplier(supplierName);
    if (!supplierId) return 0;

    const { data, error } = await supabase
        .from('products')
        .update({
            is_discontinued: true,
            discontinued_at: new Date().toISOString()
        })
        .eq('supplier_id', supplierId)
        .eq('is_discontinued', false)
        .select('id');

    if (error) {
        console.error('Error discontinuing products:', error);
        return 0;
    }

    return data.length;
}

/**
 * Get unique suppliers
 */
export async function getSuppliers() {
    const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('organization_id', ORG_ID)
        .order('name');

    if (error) {
        console.error('Error fetching suppliers:', error);
        return [];
    }

    return data;
}