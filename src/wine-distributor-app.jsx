import React, { useState, useEffect } from 'react';
import { Upload, Wine, Package, Users, LogOut, X, Search, ShoppingCart, FileSpreadsheet, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

const WineDistributorApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login');
  const [products, setProducts] = useState([]); // Active catalog only
  const [orders, setOrders] = useState([]);
  const [discontinuedProducts, setDiscontinuedProducts] = useState([]); // Products no longer in catalog but in orders
  const [formulas, setFormulas] = useState({
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
    nonAlcoholic: {
      taxPerLiter: 0,
      taxFixed: 0,
      shippingPerCase: 13,
      marginDivisor: 0.65,
      srpMultiplier: 1.47
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [pendingUpload, setPendingUpload] = useState(null);
  const [columnMapping, setColumnMapping] = useState(null);
  const [mappingTemplates, setMappingTemplates] = useState({});

  // Load data from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = async () => {
    try {
      const productsResult = await window.storage.get('wine-products');
      if (productsResult) {
        setProducts(JSON.parse(productsResult.value));
      }

      const ordersResult = await window.storage.get('wine-orders');
      if (ordersResult) {
        setOrders(JSON.parse(ordersResult.value));
      }

      const discontinuedResult = await window.storage.get('wine-discontinued');
      if (discontinuedResult) {
        setDiscontinuedProducts(JSON.parse(discontinuedResult.value));
      }

      const formulasResult = await window.storage.get('wine-formulas');
      if (formulasResult) {
        setFormulas(JSON.parse(formulasResult.value));
      }

      const templatesResult = await window.storage.get('wine-mapping-templates');
      if (templatesResult) {
        setMappingTemplates(JSON.parse(templatesResult.value));
      }
    } catch (error) {
      console.log('No existing data found, starting fresh');
    }
  };

  const saveProducts = async (newProducts) => {
    setProducts(newProducts);
    await window.storage.set('wine-products', JSON.stringify(newProducts));
  };

  const saveDiscontinuedProducts = async (newDiscontinued) => {
    setDiscontinuedProducts(newDiscontinued);
    await window.storage.set('wine-discontinued', JSON.stringify(newDiscontinued));
  };

  const saveOrders = async (newOrders) => {
    setOrders(newOrders);
    await window.storage.set('wine-orders', JSON.stringify(newOrders));
  };

  const saveFormulas = async (newFormulas) => {
    setFormulas(newFormulas);
    await window.storage.set('wine-formulas', JSON.stringify(newFormulas));
  };

  const saveMappingTemplate = async (supplierName, mapping) => {
    const updatedTemplates = {
      ...mappingTemplates,
      [supplierName]: mapping
    };
    setMappingTemplates(updatedTemplates);
    await window.storage.set('wine-mapping-templates', JSON.stringify(updatedTemplates));
  };

  const handleLogin = (username, password, userType) => {
    // Simple authentication for MVP - in production, use proper auth
    const user = { username, type: userType };
    setCurrentUser(user);
    setView(userType === 'admin' ? 'admin' : 'catalog');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setCart([]);
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          // Parse the data - looking for common column headers
          const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
          const parsedProducts = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const product = {
              id: `prod-${Date.now()}-${i}`,
              itemCode: findValue(row, headers, ['item code', 'sku', 'code', 'item']),
              producer: findValue(row, headers, ['producer', 'winery', 'brand', 'manufacturer']),
              productName: findValue(row, headers, ['product', 'name', 'wine', 'description']),
              vintage: findValue(row, headers, ['vintage', 'year']),
              packSize: findValue(row, headers, ['pack', 'pack size', 'case size']),
              bottleSize: findValue(row, headers, ['bottle', 'bottle size', 'size', 'ml']),
              productType: findValue(row, headers, ['type', 'category', 'product type']),
              fobCasePrice: parseFloat(findValue(row, headers, ['fob', 'price', 'case price', 'cost'])) || 0,
              supplier: file.name.split('.')[0],
              uploadDate: new Date().toISOString()
            };

            if (product.producer || product.productName) {
              parsedProducts.push(product);
            }
          }

          resolve(parsedProducts);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const findValue = (row, headers, possibleNames) => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index !== -1 && row[index] !== undefined && row[index] !== null && row[index] !== '') {
        return String(row[index]).trim();
      }
    }
    return '';
  };

  const calculateFrontlinePrice = (product) => {
    const productType = product.productType.toLowerCase();
    let formula = formulas.wine;

    if (productType.includes('spirit') || productType.includes('liquor') || productType.includes('vodka') || productType.includes('whiskey') || productType.includes('whisky') || productType.includes('bourbon') || productType.includes('rum') || productType.includes('gin') || productType.includes('tequila')) {
      formula = formulas.spirits;
    } else if (productType.includes('non-alc') || productType.includes('na ') || productType.includes('juice') || productType.includes('soda') || productType.includes('non alc')) {
      formula = formulas.nonAlcoholic;
    }

    // Parse bottle size (remove 'ml' and convert to number)
    const bottleSize = parseFloat(String(product.bottleSize).replace(/[^0-9.]/g, '')) || 750;
    const packSize = parseInt(product.packSize) || 12;

    // AOC Converter Formula (matching the spreadsheet exactly):

    // 1. Net FOB = FOB - DA (discount amount, assume 0 for now)
    const netFOB = product.fobCasePrice;

    // 2. Case Size (L) = (bottles/case * bottle size ml) / 1000
    const caseSizeL = (packSize * bottleSize) / 1000;

    // 3. Tax = (Case Size L * taxPerLiter) + taxFixed
    const tax = (caseSizeL * formula.taxPerLiter) + formula.taxFixed;

    // 4. Taxes, etc = Shipping + Tax
    const taxesEtc = formula.shippingPerCase + tax;

    // 5. Laid In = Net FOB + Taxes, etc
    const laidIn = netFOB + taxesEtc;

    // 6. Whls Case = Laid In / 0.65
    const whlsCase = laidIn / formula.marginDivisor;

    // 7. Whls Bottle = Whls Case / bottles per case
    const whlsBottle = whlsCase / packSize;

    // 8. SRP = ROUNDUP(Whls Bottle * 1.47, 0) - 0.01
    const srp = Math.ceil(whlsBottle * formula.srpMultiplier) - 0.01;

    // 9. Frontline Bottle = SRP / 1.47
    const frontlinePrice = srp / formula.srpMultiplier;

    return {
      frontlinePrice: frontlinePrice.toFixed(2),
      srp: srp.toFixed(2),
      whlsBottle: whlsBottle.toFixed(2),
      laidIn: laidIn.toFixed(2),
      formulaUsed: productType.includes('spirit') ? 'spirits' : productType.includes('non-alc') || productType.includes('non alc') ? 'nonAlcoholic' : 'wine'
    };
  };

  const handleFileUpload = async (e) => {
    console.log('File upload triggered', e);
    const file = e.target.files[0];
    console.log('File selected:', file);

    if (!file) {
      console.log('No file selected');
      return;
    }

    setUploadStatus('Reading file...');
    console.log('Upload status set');

    try {
      const fileExt = file.name.split('.').pop().toLowerCase();
      console.log('File extension:', fileExt);

      if (fileExt === 'pdf') {
        // Handle PDF file - extract with Python backend
        setUploadStatus('Extracting data from PDF... This may take a moment.');

        const formData = new FormData();
        formData.append('pdf', file);

        // For the MVP, we'll provide instructions for PDF conversion
        // In production, this would call a backend API
        const shouldProceed = window.confirm(
          `PDF Upload Detected: ${file.name}\n\n` +
          `We can process this PDF automatically, but it requires a backend service.\n\n` +
          `For now, would you like to:\n` +
          `- Click OK to see instructions for converting PDF to Excel\n` +
          `- Click Cancel to upload a different file`
        );

        if (shouldProceed) {
          setUploadStatus(
            `To upload "${file.name}":\n\n` +
            `1. Open the PDF in Adobe Acrobat or your PDF viewer\n` +
            `2. Export/Save As → Excel (.xlsx)\n` +
            `3. Upload the Excel file here\n\n` +
            `OR\n\n` +
            `Use an online converter like:\n` +
            `- smallpdf.com/pdf-to-excel\n` +
            `- ilovepdf.com/pdf_to_excel\n\n` +
            `Then upload the resulting Excel file.`
          );
        } else {
          setUploadStatus('');
        }
      } else {
        // Handle Excel file (existing code)
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          // Get headers
          const headers = jsonData[0].map(h => String(h || '').trim());

          // Extract clean supplier name from filename
          const cleanSupplierName = extractSupplierName(file.name);

          // Check if we have a saved template for this supplier
          const savedTemplate = mappingTemplates[cleanSupplierName];

          let autoMapping;
          if (savedTemplate) {
            // Use saved template
            autoMapping = savedTemplate;
            setUploadStatus(`Found saved mapping template for ${cleanSupplierName}`);
          } else {
            // Auto-detect columns
            autoMapping = {
              itemCode: findColumnIndex(headers, ['item code', 'sku', 'code', 'item', 'item#']),
              producer: findColumnIndex(headers, ['producer', 'winery', 'brand', 'manufacturer', 'supplier']),
              productName: findColumnIndex(headers, ['product', 'name', 'wine', 'description', 'item']),
              vintage: findColumnIndex(headers, ['vintage', 'year']),
              packSize: findColumnIndex(headers, ['pack', 'pack size', 'case size', 'cs', 'btl/cs']),
              bottleSize: findColumnIndex(headers, ['bottle', 'bottle size', 'size', 'ml', 'volume']),
              productType: findColumnIndex(headers, ['type', 'category', 'product type', 'class']),
              fobCasePrice: findColumnIndex(headers, ['fob', 'price', 'case price', 'cost', 'wholesale'])
            };
          }

          setPendingUpload({
            file,
            headers,
            data: jsonData,
            autoMapping,
            supplierName: cleanSupplierName,
            hasTemplate: !!savedTemplate
          });

          setColumnMapping(autoMapping);
          setTimeout(() => setUploadStatus(''), 2000);
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error reading file: ${error.message}`);
      setTimeout(() => setUploadStatus(''), 5000);
    }

    e.target.value = '';
  };

  const findColumnIndex = (headers, possibleNames) => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.toLowerCase().includes(name));
      if (index !== -1) return index;
    }
    return -1;
  };

  const extractSupplierName = (filename) => {
    // Remove file extension and common suffixes
    let name = filename
      .replace(/\.(xlsx?|csv|xls)$/i, '')
      .replace(/[-_]price[-_]?list/gi, '')
      .replace(/[-_]pricelist/gi, '')
      .replace(/[-_]\d{4}[-_]\d{2}[-_]\d{2}/g, '') // Remove dates like 2024-11-15
      .replace(/[-_](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi, '') // Remove month names
      .replace(/[-_]v?\d+$/i, '') // Remove version numbers at end
      .replace(/[-_]final/gi, '')
      .replace(/[-_]updated/gi, '')
      .replace(/[_-]+/g, ' ') // Replace underscores and hyphens with spaces
      .trim();

    return name || filename.split('.')[0];
  };

  const confirmMapping = async () => {
    if (!pendingUpload || !columnMapping) return;

    setUploadStatus('Importing products...');

    try {
      const { data, file, supplierName } = pendingUpload;
      const parsedProducts = [];
      const warnings = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const product = {
          id: `prod-${Date.now()}-${i}`,
          itemCode: columnMapping.itemCode >= 0 ? String(row[columnMapping.itemCode] || '') : '',
          producer: columnMapping.producer >= 0 ? String(row[columnMapping.producer] || '') : '',
          productName: columnMapping.productName >= 0 ? String(row[columnMapping.productName] || '') : '',
          vintage: columnMapping.vintage >= 0 ? String(row[columnMapping.vintage] || '') : '',
          packSize: columnMapping.packSize >= 0 ? String(row[columnMapping.packSize] || '') : '',
          bottleSize: columnMapping.bottleSize >= 0 ? String(row[columnMapping.bottleSize] || '') : '',
          productType: columnMapping.productType >= 0 ? String(row[columnMapping.productType] || '') : '',
          fobCasePrice: columnMapping.fobCasePrice >= 0 ? parseFloat(row[columnMapping.fobCasePrice]) || 0 : 0,
          supplier: supplierName,
          uploadDate: new Date().toISOString()
        };

        // Validation warnings
        if (!product.fobCasePrice || product.fobCasePrice === 0) {
          warnings.push(`Row ${i + 1}: Missing FOB price for ${product.productName || 'unknown product'}`);
        }
        if (!product.packSize) {
          warnings.push(`Row ${i + 1}: Missing pack size for ${product.productName || 'unknown product'}`);
        }
        if (!product.productType) {
          warnings.push(`Row ${i + 1}: Missing product type for ${product.productName || 'unknown product'}`);
        }

        if (product.producer || product.productName) {
          parsedProducts.push(product);
        }
      }

      // Calculate frontline prices for all products
      const productsWithPricing = parsedProducts.map(product => ({
        ...product,
        ...calculateFrontlinePrice(product)
      }));

      // Handle supplier replacement - move old products to discontinued list
      const oldSupplierProducts = products.filter(p => p.supplier === supplierName);
      const otherProducts = products.filter(p => p.supplier !== supplierName);

      // Check which old products are in active orders
      const productIdsInOrders = new Set();
      orders.forEach(order => {
        if (order.status !== 'completed' && order.status !== 'cancelled') {
          order.items.forEach(item => productIdsInOrders.add(item.id));
        }
      });

      // Move old products that are in orders to discontinued list
      const productsToDiscontinue = oldSupplierProducts.filter(p => productIdsInOrders.has(p.id));
      if (productsToDiscontinue.length > 0) {
        const updatedDiscontinued = [
          ...discontinuedProducts.filter(d => !productsToDiscontinue.find(p => p.id === d.id)), // Remove duplicates
          ...productsToDiscontinue.map(p => ({
            ...p,
            discontinuedDate: new Date().toISOString(),
            replacedBy: supplierName
          }))
        ];
        await saveDiscontinuedProducts(updatedDiscontinued);
      }

      // Update active catalog with new products
      const updatedProducts = [...otherProducts, ...productsWithPricing];
      await saveProducts(updatedProducts);

      // Save mapping template for future use
      await saveMappingTemplate(supplierName, columnMapping);

      const discontinuedCount = productsToDiscontinue.length;
      let message = `Successfully uploaded ${parsedProducts.length} products from ${file.name}. `;

      if (oldSupplierProducts.length > 0) {
        message += `${oldSupplierProducts.length} old products removed`;
        if (discontinuedCount > 0) {
          message += ` (${discontinuedCount} moved to discontinued as they're in active orders)`;
        }
        message += '. ';
      }

      message += `Mapping template saved for ${supplierName}.`;

      if (warnings.length > 0 && warnings.length <= 5) {
        message += `\n\nWarnings:\n${warnings.slice(0, 5).join('\n')}`;
      } else if (warnings.length > 5) {
        message += `\n\n${warnings.length} validation warnings detected. Check console for details.`;
        console.warn('Import warnings:', warnings);
      }

      setUploadStatus(message);
      setTimeout(() => setUploadStatus(''), 8000);

      setPendingUpload(null);
      setColumnMapping(null);
    } catch (error) {
      setUploadStatus(`Error importing: ${error.message}`);
      setTimeout(() => setUploadStatus(''), 5000);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const placeOrder = async () => {
    const order = {
      id: `order-${Date.now()}`,
      customer: currentUser.username,
      items: cart,
      total: cart.reduce((sum, item) => sum + (parseFloat(item.frontlinePrice) * item.quantity), 0).toFixed(2),
      status: 'pending',
      date: new Date().toISOString()
    };

    const updatedOrders = [...orders, order];
    await saveOrders(updatedOrders);
    setCart([]);
    setShowCart(false);
    alert('Order placed successfully! Your rep will be in touch.');
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.producer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vintage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSupplier = selectedSupplier === 'all' || product.supplier === selectedSupplier;

    return matchesSearch && matchesSupplier;
  });

  const suppliers = [...new Set(products.map(p => p.supplier))];

  // Login View
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full border border-amber-200/50">
          <div className="flex items-center justify-center mb-8">
            <Wine className="w-12 h-12 text-rose-600 mr-3" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent">
              Wine Portal
            </h1>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleLogin('admin', 'admin', 'admin')}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-4 rounded-xl font-semibold hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Admin Login
            </button>

            <button
              onClick={() => handleLogin('customer', 'customer', 'customer')}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Customer Login
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            MVP Demo - Click either button to continue
          </p>
        </div>
      </div>
    );
  }

  // Admin View
  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <nav className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Wine className="w-8 h-8 text-rose-600" />
              <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        <div className="p-6 max-w-7xl mx-auto">
          {/* Clear Data Button */}
          <div className="mb-6">
            <button
              onClick={async () => {
                if (window.confirm('Clear all products, orders, and reset formulas? This cannot be undone.')) {
                  try {
                    // Try to delete each key, but don't fail if it doesn't exist
                    try { await window.storage.delete('wine-products'); } catch (e) { console.log('No products to delete'); }
                    try { await window.storage.delete('wine-orders'); } catch (e) { console.log('No orders to delete'); }
                    try { await window.storage.delete('wine-discontinued'); } catch (e) { console.log('No discontinued to delete'); }
                    try { await window.storage.delete('wine-formulas'); } catch (e) { console.log('No formulas to delete'); }

                    setProducts([]);
                    setOrders([]);
                    setDiscontinuedProducts([]);
                    setFormulas({
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
                      nonAlcoholic: {
                        taxPerLiter: 0,
                        taxFixed: 0,
                        shippingPerCase: 13,
                        marginDivisor: 0.65,
                        srpMultiplier: 1.47
                      }
                    });

                    alert('All data cleared successfully! Page will reload.');
                    setTimeout(() => window.location.reload(), 500);
                  } catch (error) {
                    console.error('Clear error:', error);
                    alert('Error clearing data. Check console for details.');
                  }
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear All Data & Reset
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Products</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{products.length}</p>
                </div>
                <Package className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Orders</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{orders.length}</p>
                </div>
                <ShoppingCart className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Suppliers</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{suppliers.length}</p>
                </div>
                <Users className="w-12 h-12 text-purple-500 opacity-20" />
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Upload className="w-6 h-6 mr-2 text-rose-600" />
              Upload Price List
            </h2>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-rose-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                ref={(input) => { window.fileInput = input; }}
              />
              <FileSpreadsheet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-700 mb-4">Upload Price List</p>
              <p className="text-sm text-slate-500 mb-4">Supports Excel (.xlsx, .xls) and PDF formats</p>
              <button
                onClick={() => document.getElementById('file-upload')?.click()}
                className="px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-semibold"
              >
                Choose File
              </button>
            </div>

            {uploadStatus && (
              <div className={`mt-4 p-4 rounded-lg ${uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {uploadStatus}
              </div>
            )}
          </div>

          {/* Louis Dressner PDF Converter Section */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 shadow-lg border-2 border-purple-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
              <FileSpreadsheet className="w-6 h-6 mr-2 text-purple-600" />
              Louis Dressner PDF Quick Converter
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              For Louis Dressner PDFs: Use the Python script or Mac app below to convert, then upload the Excel file above. ↑
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-slate-800 mb-2">📱 Mac App (Drag & Drop)</h3>
                <p className="text-xs text-slate-600 mb-3">Download and set up once, then just drag PDFs onto the app</p>
                <a
                  href="/api/placeholder/download/mac-app"
                  className="text-xs px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 inline-block"
                  download="louis_dressner_converter_mac.py"
                >
                  Download Mac App Files
                </a>
              </div>

              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-slate-800 mb-2">🐍 Python Script (Command Line)</h3>
                <p className="text-xs text-slate-600 mb-2">Run from terminal:</p>
                <code className="text-xs bg-slate-100 p-2 rounded block mb-2">
                  python3 convert.py input.pdf output.xlsx
                </code>
                <a
                  href="/api/placeholder/download/python-script"
                  className="text-xs px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 inline-block"
                  download="convert_louis_dressner_pdf.py"
                >
                  Download Python Script
                </a>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>💡 Quick Start:</strong> Download the files above → Follow MAC_INSTALLATION.md instructions →
                Convert your PDFs → Upload the resulting Excel files using the regular upload section above
              </p>
            </div>
          </div>

          {/* Column Mapping UI */}
          {pendingUpload && columnMapping && (
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800">
                  Map Columns - {pendingUpload.file.name}
                </h2>
                {pendingUpload.hasTemplate && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                    ✓ Using saved template
                  </span>
                )}
              </div>

              {/* Supplier Name Editor */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={pendingUpload.supplierName}
                  onChange={(e) => setPendingUpload({
                    ...pendingUpload,
                    supplierName: e.target.value
                  })}
                  placeholder="Enter supplier name (e.g., Rosenthal Wine Merchant)"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-xs text-slate-600 mt-2">
                  This name will be used to identify all products from this supplier.
                  Clean supplier names help with organization and filtering.
                </p>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Please verify the column mapping below. Adjust any incorrect mappings before importing.
                {!pendingUpload.hasTemplate && " This mapping will be saved as a template for future uploads from this supplier."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(columnMapping).map(([field, colIndex]) => (
                  <div key={field} className="border border-slate-200 rounded-lg p-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <select
                      value={colIndex}
                      onChange={(e) => setColumnMapping({
                        ...columnMapping,
                        [field]: parseInt(e.target.value)
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="-1">-- Not mapped --</option>
                      {pendingUpload.headers.map((header, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}: {header || '(empty)'}
                        </option>
                      ))}
                    </select>
                    {colIndex >= 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Sample: {pendingUpload.data[1]?.[colIndex] || '(empty)'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Preview Section */}
              <div className="mb-6 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Preview (First 5 Products)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left p-2">Producer</th>
                        <th className="text-left p-2">Product</th>
                        <th className="text-left p-2">Vintage</th>
                        <th className="text-left p-2">Size</th>
                        <th className="text-left p-2">Pack</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-right p-2">FOB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUpload.data.slice(1, 6).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="p-2">{columnMapping.producer >= 0 ? row[columnMapping.producer] : '-'}</td>
                          <td className="p-2">{columnMapping.productName >= 0 ? row[columnMapping.productName] : '-'}</td>
                          <td className="p-2">{columnMapping.vintage >= 0 ? row[columnMapping.vintage] : '-'}</td>
                          <td className="p-2">{columnMapping.bottleSize >= 0 ? row[columnMapping.bottleSize] : '-'}</td>
                          <td className="p-2">{columnMapping.packSize >= 0 ? row[columnMapping.packSize] : '-'}</td>
                          <td className="p-2">{columnMapping.productType >= 0 ? row[columnMapping.productType] : '-'}</td>
                          <td className="p-2 text-right">{columnMapping.fobCasePrice >= 0 ? `$${row[columnMapping.fobCasePrice]}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={confirmMapping}
                  className="px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-lg"
                >
                  Import Products
                </button>
                <button
                  onClick={() => {
                    setPendingUpload(null);
                    setColumnMapping(null);
                  }}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Pricing Formulas */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-rose-600" />
              Pricing Formulas (AOC)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(formulas).map(([type, formula]) => (
                <div key={type} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-700 mb-3 capitalize">{type}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-slate-600">Tax per Liter ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formula.taxPerLiter}
                        onChange={(e) => {
                          const newFormulas = {
                            ...formulas,
                            [type]: { ...formula, taxPerLiter: parseFloat(e.target.value) || 0 }
                          };
                          saveFormulas(newFormulas);
                        }}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600">Fixed Tax ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formula.taxFixed}
                        onChange={(e) => {
                          const newFormulas = {
                            ...formulas,
                            [type]: { ...formula, taxFixed: parseFloat(e.target.value) || 0 }
                          };
                          saveFormulas(newFormulas);
                        }}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600">Shipping per Case ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formula.shippingPerCase}
                        onChange={(e) => {
                          const newFormulas = {
                            ...formulas,
                            [type]: { ...formula, shippingPerCase: parseFloat(e.target.value) || 0 }
                          };
                          saveFormulas(newFormulas);
                        }}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600">Margin Divisor</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formula.marginDivisor}
                        onChange={(e) => {
                          const newFormulas = {
                            ...formulas,
                            [type]: { ...formula, marginDivisor: parseFloat(e.target.value) || 0.65 }
                          };
                          saveFormulas(newFormulas);
                        }}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600">SRP Multiplier</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formula.srpMultiplier}
                        onChange={(e) => {
                          const newFormulas = {
                            ...formulas,
                            [type]: { ...formula, srpMultiplier: parseFloat(e.target.value) || 1.47 }
                          };
                          saveFormulas(newFormulas);
                        }}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
              <p className="font-semibold mb-2">Formula Logic:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Case Size (L) = (Bottles/Case × Bottle Size ML) ÷ 1000</li>
                <li>Tax = (Case Size L × Tax/Liter) + Fixed Tax</li>
                <li>Laid In = FOB + Shipping + Tax</li>
                <li>Wholesale Case = Laid In ÷ {formulas.wine.marginDivisor}</li>
                <li>Wholesale Bottle = Wholesale Case ÷ Bottles/Case</li>
                <li>SRP = ROUNDUP(Wholesale Bottle × {formulas.wine.srpMultiplier}, 0) - $0.01</li>
                <li>Frontline Bottle = SRP ÷ {formulas.wine.srpMultiplier}</li>
              </ol>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Users className="w-6 h-6 mr-2 text-rose-600" />
              Supplier Management
            </h2>

            {suppliers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No suppliers yet</p>
            ) : (
              <div className="space-y-3">
                {suppliers.map(supplier => {
                  const supplierProducts = products.filter(p => p.supplier === supplier);
                  const latestUpload = supplierProducts.length > 0
                    ? new Date(Math.max(...supplierProducts.map(p => new Date(p.uploadDate)))).toLocaleDateString()
                    : 'Unknown';

                  return (
                    <div key={supplier} className="border border-slate-200 rounded-lg p-4 flex justify-between items-center hover:shadow-md transition-shadow">
                      <div>
                        <p className="font-semibold text-slate-800">{supplier}</p>
                        <p className="text-sm text-slate-600">{supplierProducts.length} products</p>
                        <p className="text-xs text-slate-400">Last updated: {latestUpload}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Remove all products from ${supplier}? This cannot be undone.`)) {
                            const updatedProducts = products.filter(p => p.supplier !== supplier);
                            await saveProducts(updatedProducts);
                          }
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors text-sm"
                      >
                        Remove Supplier
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Catalog - Admin View with Pricing */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Package className="w-6 h-6 mr-2 text-rose-600" />
              Product Catalog (Admin View)
            </h2>

            {products.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No products in catalog</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Producer</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Product</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Vintage</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Size</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Pack</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Type</th>
                      <th className="text-right p-3 font-semibold text-slate-700">FOB Case</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Frontline Btl</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Frontline Case</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, idx) => {
                      const calc = calculateFrontlinePrice(product);
                      const frontlineCase = (parseFloat(calc.frontlinePrice) * parseInt(product.packSize || 12)).toFixed(2);

                      return (
                        <tr key={product.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="p-3 text-slate-800">{product.producer}</td>
                          <td className="p-3 text-slate-700">{product.productName}</td>
                          <td className="p-3 text-slate-600">{product.vintage || 'NV'}</td>
                          <td className="p-3 text-slate-600">{product.bottleSize}</td>
                          <td className="p-3 text-slate-600">{product.packSize}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-1 rounded ${calc.formulaUsed === 'wine' ? 'bg-purple-100 text-purple-700' :
                              calc.formulaUsed === 'spirits' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                              {calc.formulaUsed}
                            </span>
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-800">${product.fobCasePrice.toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-rose-600">${calc.frontlinePrice}</td>
                          <td className="p-3 text-right font-bold text-rose-700">${frontlineCase}</td>
                          <td className="p-3 text-slate-500 text-xs">{product.supplier}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Package className="w-6 h-6 mr-2 text-rose-600" />
              Discontinued Products (In Active Orders)
            </h2>

            {discontinuedProducts.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No discontinued products with active orders</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {discontinuedProducts.map(product => (
                  <div key={product.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{product.producer} - {product.productName}</p>
                        <p className="text-sm text-slate-600">{product.vintage || 'NV'} | {product.bottleSize} | {product.supplier}</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Discontinued: {new Date(product.discontinuedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-700">${product.frontlinePrice}</p>
                        <p className="text-xs text-slate-500">per bottle</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <ShoppingCart className="w-6 h-6 mr-2 text-rose-600" />
              Recent Orders
            </h2>

            {orders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {orders.slice().reverse().map(order => {
                  // Check if any items are discontinued
                  const hasDiscontinued = order.items.some(item =>
                    discontinuedProducts.find(d => d.id === item.id)
                  );

                  return (
                    <div key={order.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-slate-800">{order.customer}</p>
                          <p className="text-sm text-slate-500">{new Date(order.date).toLocaleDateString()}</p>
                          {hasDiscontinued && (
                            <p className="text-xs text-amber-600 mt-1">⚠ Contains discontinued items</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-rose-600">${order.total}</p>
                          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            {order.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">
                        {order.items.length} item(s)
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">View items</summary>
                          <div className="mt-2 space-y-1">
                            {order.items.map((item, idx) => {
                              const isDiscontinued = discontinuedProducts.find(d => d.id === item.id);
                              return (
                                <div key={idx} className={`text-xs pl-2 ${isDiscontinued ? 'text-amber-700' : 'text-slate-600'}`}>
                                  {isDiscontinued && '⚠ '}{item.producer} - {item.productName} (×{item.quantity})
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Customer Catalog View
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-purple-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-amber-200/50 px-6 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <Wine className="w-8 h-8 text-rose-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent">
              Wine Catalog
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative p-2 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-6 h-6 text-slate-700" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-6 shadow-lg border border-amber-200/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by producer, product, vintage, or supplier..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-12 text-center shadow-lg border border-amber-200/50">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              // Recalculate to show current formula values
              const calc = calculateFrontlinePrice(product);

              return (
                <div key={product.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200/50 hover:shadow-xl transition-shadow">
                  <div className="mb-4">
                    <h3 className="font-bold text-lg text-slate-800 mb-1">{product.producer}</h3>
                    <p className="text-slate-600">{product.productName}</p>
                    {product.vintage && (
                      <p className="text-sm text-slate-500 mt-1">Vintage: {product.vintage}</p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <p><span className="font-medium">Type:</span> {product.productType} <span className="text-xs text-purple-600">({calc.formulaUsed})</span></p>
                    <p><span className="font-medium">Size:</span> {product.bottleSize} × {product.packSize}</p>
                    {product.itemCode && <p><span className="font-medium">Code:</span> {product.itemCode}</p>}
                    <p className="text-xs text-slate-400"><span className="font-medium">Supplier:</span> {product.supplier}</p>
                    <details className="text-xs text-slate-400">
                      <summary className="cursor-pointer hover:text-slate-600">Calculation Details</summary>
                      <div className="mt-2 pl-2 border-l-2 border-slate-200">
                        <p>SRP: ${calc.srp}</p>
                        <p>Whls Bottle: ${calc.whlsBottle}</p>
                        <p>Laid In: ${calc.laidIn}</p>
                      </div>
                    </details>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                    <div>
                      <p className="text-2xl font-bold text-rose-600">${calc.frontlinePrice}</p>
                      <p className="text-xs text-slate-500">per bottle</p>
                    </div>
                    <button
                      onClick={() => addToCart({ ...product, ...calc })}
                      className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCart(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Your Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map(item => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{item.producer}</p>
                            <p className="text-sm text-slate-600">{item.productName}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 bg-slate-200 hover:bg-slate-300 rounded flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 bg-slate-200 hover:bg-slate-300 rounded flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          <p className="font-bold text-rose-600">
                            ${(parseFloat(item.frontlinePrice) * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-rose-600">
                        ${cart.reduce((sum, item) => sum + (parseFloat(item.frontlinePrice) * item.quantity), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={placeOrder}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl font-semibold hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Place Order
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WineDistributorApp;
