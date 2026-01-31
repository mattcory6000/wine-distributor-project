import React, { useState, useEffect } from 'react';
import { Upload, Wine, Package, Users, LogOut, X, Search, ShoppingCart, FileSpreadsheet, Settings, ChevronDown, ChevronRight, ClipboardList, ListPlus, UserCheck, Edit, Trash2, Download, Plus, ExternalLink, LayoutGrid, List } from 'lucide-react';
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
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedAppellation, setSelectedAppellation] = useState('all');
  const [specialOrderList, setSpecialOrderList] = useState([]); // Currently active list
  const [allCustomerLists, setAllCustomerLists] = useState({}); // { username: [items] }
  const [showList, setShowList] = useState(false);
  const [selectedCustomerForList, setSelectedCustomerForList] = useState(null); // Admin view selection
  const [idealDeliveryDate, setIdealDeliveryDate] = useState('');
  const [mustHaveByDate, setMustHaveByDate] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [pendingUpload, setPendingUpload] = useState(null);
  const [columnMapping, setColumnMapping] = useState(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [mappingTemplates, setMappingTemplates] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({
    catalog: true,
    orders: true,
    discontinued: true,
    formulas: true,
    dressner: true,
    team: true,
    customerLists: true,
    suppliers: true,
    upload: true
  });
  const [allUsers, setAllUsers] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { id, name }
  const [originalAdmin, setOriginalAdmin] = useState(null);
  const [showImpersonationModal, setShowImpersonationModal] = useState(false);
  const [impersonationSearch, setImpersonationSearch] = useState(''); // For "Login As" functionality
  const [selectedExtraFields, setSelectedExtraFields] = useState([]); // Extra columns to import
  const [catalogViewMode, setCatalogViewMode] = useState('grid'); // 'grid' or 'list' for customer catalog
  const [taxonomy, setTaxonomy] = useState({});
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]); // [min, max]
  const [catalogPriceBounds, setCatalogPriceBounds] = useState({ min: 0, max: 1000 });
  const [orderNotes, setOrderNotes] = useState({}); // { username: "note content" }

  // Initialize price bounds based on active products
  useEffect(() => {
    if (products.length > 0) {
      const prices = products.map(p => parseFloat(calculateFrontlinePrice(p).whlsBottle) || 0);
      const min = Math.floor(Math.min(...prices));
      const max = Math.ceil(Math.max(...prices));
      setCatalogPriceBounds({ min, max });
      // Only set initial range if it looks like default/empty
      if (priceRange[0] === 0 && priceRange[1] === 1000) {
        setPriceRange([min, max]);
      }
    }
  }, [products]);

  // Initialize manual mode based on product data validity against taxonomy
  useEffect(() => {
    if (editingProduct && taxonomy && Object.keys(taxonomy).length > 0) {
      // If country is present but not in taxonomy, default to manual
      const isKnownCountry = !editingProduct.country || taxonomy[editingProduct.country];
      setUseManualLocation(!isKnownCountry);
    }
  }, [editingProduct, taxonomy]);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Auth State
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUserType, setAuthUserType] = useState('customer');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Load data from storage on mount
  useEffect(() => {
    loadFromStorage();
    // Check for reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setView('reset-password');
      // Clean up URL
      window.history.replaceState({}, document.title, "/");
    }
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

      const mappingTemplatesResult = await window.storage.get('wine-mapping-templates');
      if (mappingTemplatesResult) {
        setMappingTemplates(JSON.parse(mappingTemplatesResult.value));
      }

      const specialOrdersResult = await window.storage.get('wine-special-orders');
      if (specialOrdersResult) {
        const lists = JSON.parse(specialOrdersResult.value);
        setAllCustomerLists(lists);
      }

      const orderNotesResult = await window.storage.get('wine-order-notes');
      if (orderNotesResult) {
        setOrderNotes(JSON.parse(orderNotesResult.value));
      }

      // Load Taxonomy
      try {
        const taxonomyResponse = await fetch('http://localhost:3001/api/storage/taxonomy');
        if (taxonomyResponse.ok) {
          const taxonomyData = await taxonomyResponse.json();
          if (taxonomyData && taxonomyData.value) {
            setTaxonomy(JSON.parse(taxonomyData.value));
          }
        }
      } catch (e) {
        console.error('Failed to load taxonomy', e);
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

  const saveSpecialOrderLists = async (newLists) => {
    setAllCustomerLists(newLists);
    await window.storage.set('wine-special-orders', JSON.stringify(newLists));
  };

  const saveOrderNotes = async (newNotes) => {
    setOrderNotes(newNotes);
    await window.storage.set('wine-order-notes', JSON.stringify(newNotes));
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.user);
        const userList = allCustomerLists[data.user.username] || [];
        setSpecialOrderList(userList);
        if (data.user.type === 'admin') {
          fetchAllUsers();
          setView('admin');
        } else {
          setView('catalog');
        }
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setAuthError('Server connection failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
          email: authEmail
        })
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.user);
        setSpecialOrderList([]);
        setView(data.user.type === 'admin' ? 'admin' : 'catalog');
      } else {
        setAuthError(data.error || 'Signup failed');
      }
    } catch (error) {
      setAuthError('Server connection failed');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await response.json();
      if (data.success) {
        setAuthMessage(data.message);
      } else {
        setAuthError(data.error || 'Request failed');
      }
    } catch (error) {
      setAuthError('Server connection failed');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword })
      });
      const data = await response.json();
      if (data.success) {
        setAuthMessage(data.message);
        setTimeout(() => {
          setView('login');
          setResetToken('');
          setAuthMessage('');
        }, 3000);
      } else {
        setAuthError(data.error || 'Reset failed');
      }
    } catch (error) {
      setAuthError('Server connection failed');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/users');
      const data = await response.json();
      setAllUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`http://localhost:3001/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newRole })
      });
      const data = await response.json();
      if (data.success) {
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, type: newRole } : u));
        setUploadStatus(`User role updated to ${newRole}`);
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const toggleUserAccess = async (userId, accessRevoked) => {
    try {
      const response = await fetch(`http://localhost:3001/api/auth/users/${userId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessRevoked })
      });
      const data = await response.json();
      if (data.success) {
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, accessRevoked: data.user.accessRevoked } : u));
        setUploadStatus(`User access ${accessRevoked ? 'revoked' : 'restored'}`);
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        alert(data.error || 'Failed to update access');
      }
    } catch (error) {
      console.error('Failed to update access:', error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setOriginalAdmin(null);
    setView('login');
    setSpecialOrderList([]);
    setShowList(false);
  };

  const handleImpersonate = (user) => {
    if (currentUser.type !== 'admin') return;
    setOriginalAdmin(currentUser);
    setCurrentUser(user);
    setView('customer');
    setSpecialOrderList(allCustomerLists[user.username] || []);
    setSelectedCustomerForList(null); // Clear admin selection to avoid interference
    setShowList(false);
  };

  const handleStopImpersonating = () => {
    if (!originalAdmin) return;
    setCurrentUser(originalAdmin);
    setOriginalAdmin(null);
    setView('admin');
    setSpecialOrderList([]);
    setShowList(false);
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
      frontlineCase: (frontlinePrice * packSize).toFixed(2),
      srp: srp.toFixed(2),
      whlsBottle: whlsBottle.toFixed(2),
      whlsCase: whlsCase.toFixed(2),
      laidIn: laidIn.toFixed(2),
      formulaUsed: productType.includes('spirit') ? 'spirits' : productType.includes('non-alc') || productType.includes('non alc') ? 'nonAlcoholic' : 'wine'
    };
  };

  const getProductLink = (product) => {
    if (product.productLink && (product.productLink.startsWith('http') || product.productLink.startsWith('https'))) {
      return product.productLink;
    }

    // Generate suggested search link
    const query = `${product.producer} ${product.productName} ${product.vintage || ''}`.trim();
    let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    if (product.supplier === 'Bon Vivant Imports') {
      searchUrl += encodeURIComponent(' site:bonvivantimports.com');
    }

    return searchUrl;
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
    setSelectedExtraFields([]);
    console.log('Upload status set');

    try {
      const fileExt = file.name.split('.').pop().toLowerCase();
      console.log('File extension:', fileExt);

      if (fileExt === 'pdf') {
        // Handle PDF file - extract with Python backend
        setUploadStatus('Extracting data from PDF... This may take a moment.');

        const formData = new FormData();
        formData.append('pdf', file);

        try {
          const response = await fetch('http://localhost:3001/api/upload/pdf', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.statusText}`);
          }

          const result = await response.json();
          if (result.success) {
            const jsonData = result.data;

            // Get headers from first row
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
                fobCasePrice: findColumnIndex(headers, ['fob', 'price', 'case price', 'cost', 'wholesale']),
                productLink: findColumnIndex(headers, ['link', 'url', 'website', 'info']),
                country: findColumnIndex(headers, ['country', 'nation', 'pays']),
                region: findColumnIndex(headers, ['region', 'area', 'district']),
                appellation: findColumnIndex(headers, ['appellation', 'ava', 'doc', 'docg', 'aoc'])
              };
            }

            const mappedIndices = new Set(Object.values(autoMapping));
            const unmapped = headers
              .map((h, i) => ({ name: h, index: i }))
              .filter(h => h.name && h.name.trim() && !mappedIndices.has(h.index));

            setPendingUpload({
              file,
              headers,
              data: jsonData,
              autoMapping,
              supplierName: cleanSupplierName,
              hasTemplate: !!savedTemplate,
              unmappedHeaders: unmapped
            });

            setColumnMapping(autoMapping);
            setShowSupplierModal(true);
            setTimeout(() => setUploadStatus(''), 2000);
          } else {
            throw new Error(result.error || 'Conversion failed');
          }
        } catch (error) {
          console.error('PDF conversion error:', error);
          setUploadStatus(`PDF Conversion Error: ${error.message}`);
          setTimeout(() => setUploadStatus(''), 5000);
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
              fobCasePrice: findColumnIndex(headers, ['fob', 'price', 'case price', 'cost', 'wholesale']),
              productLink: findColumnIndex(headers, ['link', 'url', 'website', 'info']),
              country: findColumnIndex(headers, ['country', 'nation', 'pays']),
              region: findColumnIndex(headers, ['region', 'area', 'district']),
              appellation: findColumnIndex(headers, ['appellation', 'ava', 'doc', 'docg', 'aoc'])
            };
          }

          const mappedIndices = new Set(Object.values(autoMapping));
          const unmapped = headers
            .map((h, i) => ({ name: h, index: i }))
            .filter(h => h.name && h.name.trim() && !mappedIndices.has(h.index));

          setPendingUpload({
            file,
            headers,
            data: jsonData,
            autoMapping,
            supplierName: cleanSupplierName,
            hasTemplate: !!savedTemplate,
            unmappedHeaders: unmapped
          });

          setColumnMapping(autoMapping);
          setShowSupplierModal(true);
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

        // Map standard fields
        const product = {
          id: `prod-${Date.now()}-${i}`,
          itemCode: columnMapping.itemCode >= 0 ? String(row[columnMapping.itemCode] || '') : '',
          producer: columnMapping.producer >= 0 ? String(row[columnMapping.producer] || '') : '',
          productName: columnMapping.productName >= 0 ? String(row[columnMapping.productName] || '') : '',
          vintage: columnMapping.vintage >= 0 ? String(row[columnMapping.vintage] || '') : '',
          packSize: columnMapping.packSize >= 0 ? String(row[columnMapping.packSize] || '') : '',
          bottleSize: columnMapping.bottleSize >= 0 ? String(row[columnMapping.bottleSize] || '').replace(/[^0-9.]/g, '') : '',
          productType: columnMapping.productType >= 0 ? String(row[columnMapping.productType] || '') : '',
          fobCasePrice: columnMapping.fobCasePrice >= 0 ? parseFloat(row[columnMapping.fobCasePrice]) || 0 : 0,
          productLink: columnMapping.productLink >= 0 ? String(row[columnMapping.productLink] || '') : '',
          country: columnMapping.country >= 0 ? String(row[columnMapping.country] || '') : '',
          region: columnMapping.region >= 0 ? String(row[columnMapping.region] || '') : '',
          appellation: columnMapping.appellation >= 0 ? String(row[columnMapping.appellation] || '') : '',
          supplier: supplierName,
          uploadDate: new Date().toISOString()
        };

        // Inject selected extra fields
        selectedExtraFields.forEach(field => {
          const value = row[field.index];
          if (value !== undefined && value !== null && value !== '') {
            // Keep original name but sanitize for JS property access if needed
            // Actually, we can use the name directly for display later
            product[field.name] = value;
          }
        });

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

      // Check which old products are in active orders OR ongoing lists
      const productIdsInActiveUse = new Set();

      // Check Orders
      orders.forEach(order => {
        if (order.status !== 'completed' && order.status !== 'cancelled') {
          order.items.forEach(item => productIdsInActiveUse.add(item.id));
        }
      });

      // Check Special Order Lists
      Object.values(allCustomerLists).forEach(list => {
        list.forEach(item => productIdsInActiveUse.add(item.id));
      });

      // Move old products that are in active use to discontinued list
      const productsToDiscontinue = oldSupplierProducts.filter(p => productIdsInActiveUse.has(p.id));
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

  const addToList = async (product) => {
    const username = currentUser.username;
    const currentItems = allCustomerLists[username] || [];
    const existing = currentItems.find(item => item.id === product.id);

    if (existing) {
      setSpecialOrderList(currentItems);
      setShowList(true);
      return;
    } else {
      const packSize = parseInt(product.packSize) || 12;
      const newList = [...currentItems, {
        ...product,
        cases: 1,
        bottles: 0,
        quantity: packSize,
        requestedQuantity: packSize,
        status: 'Requested',
        notes: '',
        adminNotes: originalAdmin ? `Added by ${originalAdmin.username}` : '',
        submitted: false
      }];

      const updatedAllLists = {
        ...allCustomerLists,
        [username]: newList
      };

      await saveSpecialOrderLists(updatedAllLists);
      setAllCustomerLists(updatedAllLists);
      setSpecialOrderList(newList);
      setShowList(true);
    }
  };

  const updateListUnits = async (productId, unitType, value) => {
    const username = selectedCustomerForList || currentUser.username;
    const val = Math.max(0, parseInt(value) || 0);
    const userList = allCustomerLists[username] || [];

    const newList = userList.map(item => {
      if (item.id === productId) {
        const newUnits = {
          cases: unitType === 'cases' ? val : item.cases,
          bottles: unitType === 'bottles' ? val : item.bottles
        };
        const packSize = parseInt(item.packSize) || 12;
        const totalQuantity = (newUnits.cases * packSize) + newUnits.bottles;

        return {
          ...item,
          ...newUnits,
          quantity: totalQuantity,
          requestedQuantity: item.submitted ? item.requestedQuantity : totalQuantity
        };
      }
      return item;
    });

    const updatedAllLists = {
      ...allCustomerLists,
      [username]: newList
    };

    await saveSpecialOrderLists(updatedAllLists);
    setAllCustomerLists(updatedAllLists);
    setSpecialOrderList(newList);
  };

  const updateListItemMetadata = async (productId, status, notes, adminNotes) => {
    const username = selectedCustomerForList || currentUser.username;
    const userList = allCustomerLists[username] || [];

    if (status === 'Delivered' || status === 'Out of Stock') {
      const itemToDeliver = userList.find(item => item.id === productId);
      if (itemToDeliver) {
        // Create an "Order" snapshot for history
        const deliverySnapshot = {
          id: `archive-${Date.now()}`,
          customer: username,
          items: [{
            ...itemToDeliver,
            status: status,
            notes: notes !== undefined ? notes : itemToDeliver.notes,
            adminNotes: adminNotes !== undefined ? adminNotes : itemToDeliver.adminNotes
          }],
          total: status === 'Delivered' ? (parseFloat(itemToDeliver.frontlinePrice) * (itemToDeliver.quantity || 1)).toFixed(2) : "0.00",
          status: 'closed',
          date: new Date().toISOString(),
          adminNote: `${status === 'Delivered' ? 'Delivered' : 'Archived (Out of Stock)'} item: ${itemToDeliver.producer} ${itemToDeliver.productName}`
        };

        const updatedOrders = [...orders, deliverySnapshot];
        const updatedList = userList.filter(item => item.id !== productId);
        const updatedAllLists = {
          ...allCustomerLists,
          [username]: updatedList
        };

        await saveOrders(updatedOrders);
        await saveSpecialOrderLists(updatedAllLists);
        setAllCustomerLists(updatedAllLists);
        setSpecialOrderList(updatedList);
        return;
      }
    }

    const newList = userList.map(item => {
      if (item.id === productId) {
        return {
          ...item,
          status,
          notes,
          adminNotes: adminNotes !== undefined ? adminNotes : item.adminNotes,
          hasUnseenUpdate: currentUser.type === 'admin' ? true : item.hasUnseenUpdate
        };
      }
      return item;
    });

    const updatedAllLists = {
      ...allCustomerLists,
      [username]: newList
    };

    await saveSpecialOrderLists(updatedAllLists);
    setAllCustomerLists(updatedAllLists);
    setSpecialOrderList(newList);
  };

  const markSpecialOrderUpdatesAsSeen = async () => {
    if (currentUser.type !== 'customer') return;

    const username = currentUser.username;
    const userList = allCustomerLists[username] || [];
    const updated = userList.some(item => item.hasUnseenUpdate);

    if (updated) {
      const newList = userList.map(item => ({ ...item, hasUnseenUpdate: false }));
      const updatedAllLists = { ...allCustomerLists, [username]: newList };

      await saveSpecialOrderLists(updatedAllLists);
      setAllCustomerLists(updatedAllLists);
      setSpecialOrderList(newList);
    }
  };

  const removeFromList = async (productId) => {
    const username = selectedCustomerForList || currentUser.username;
    const userList = allCustomerLists[username] || [];
    const newList = userList.filter(item => item.id !== productId);

    const updatedAllLists = {
      ...allCustomerLists,
      [username]: newList
    };

    await saveSpecialOrderLists(updatedAllLists);
    setAllCustomerLists(updatedAllLists);
    setSpecialOrderList(newList);
  };

  const submitListUpdate = async () => {
    const username = selectedCustomerForList || currentUser.username;
    const currentItems = allCustomerLists[username] || [];

    // Create an "Order" snapshot for history
    const orderSnapshot = {
      id: `update-${Date.now()}`,
      customer: username,
      items: currentItems,
      total: currentItems.reduce((sum, item) => sum + (parseFloat(item.frontlinePrice) * item.quantity), 0).toFixed(2),
      status: 'updated',
      date: new Date().toISOString(),
      idealDeliveryDate: idealDeliveryDate,
      mustHaveByDate: mustHaveByDate,
      adminNote: orderNotes[username] || (originalAdmin ? `Created by ${originalAdmin.username} on behalf of ${username}` : null)
    };

    const updatedOrders = [...orders, orderSnapshot];

    // Mark items as submitted in the persistent list
    const submittedList = currentItems.map(item => ({ ...item, submitted: true }));
    const updatedAllLists = {
      ...allCustomerLists,
      [username]: submittedList
    };

    await saveOrders(updatedOrders);
    await saveSpecialOrderLists(updatedAllLists);
    await saveOrderNotes(orderNotes);
    setAllCustomerLists(updatedAllLists);
    setSpecialOrderList(submittedList);

    // We don't clear the list anymore, it's ongoing
    setIdealDeliveryDate('');
    setMustHaveByDate('');
    setShowList(false);
    setSelectedCustomerForList(null);
    alert('Special order list updated and rep notified!');
  };

  const deleteProduct = async (productId) => {
    const updatedProducts = products.filter(p => p.id !== productId);
    await saveProducts(updatedProducts);
    setUploadStatus('Product deleted successfully');
    setTimeout(() => setUploadStatus(''), 3000);
    setDeleteConfirmation(null);
  };

  const handleUpdateProduct = async (updatedProduct) => {
    const pricing = calculateFrontlinePrice(updatedProduct);
    const finalProduct = { ...updatedProduct, ...pricing };
    const updatedProducts = products.map(p => p.id === finalProduct.id ? finalProduct : p);
    await saveProducts(updatedProducts);
    setUploadStatus(`Updated ${finalProduct.producer} - ${finalProduct.productName}`);
    setTimeout(() => setUploadStatus(''), 3000);
    setEditingProduct(null);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const updatedOrders = orders.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    await saveOrders(updatedOrders);
    setUploadStatus(`Order status updated to ${newStatus}`);
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleUpdateOrderNote = async (orderId, note) => {
    const updatedOrders = orders.map(order =>
      order.id === orderId ? { ...order, adminNote: note } : order
    );
    await saveOrders(updatedOrders);
  };

  const closeSidebar = () => {
    setShowList(false);
    setSelectedCustomerForList(null);
    // Refresh the local specialOrderList to the current user's list
    setSpecialOrderList(allCustomerLists[currentUser.username] || []);
  };

  const generateOrderReport = () => {
    if (orders.length === 0) {
      alert('No orders to export');
      return;
    }

    const reportData = [];
    orders.forEach(order => {
      order.items.forEach(item => {
        reportData.push({
          'Order ID': order.id,
          'Date': new Date(order.date).toLocaleDateString(),
          'Customer': order.customer,
          'Status': order.status,
          'Supplier': item.supplier || '',
          'Producer': item.producer,
          'Product': item.productName,
          'Vintage': item.vintage || 'NV',
          'Item Code': item.itemCode || '',
          'Size': String(item.bottleSize || '').replace(/[^0-9.]/g, ''),
          'Pack': item.packSize,
          'FOB Case': item.fobCasePrice,
          'Frontline Case': item.frontlineCase || (parseFloat(item.frontlinePrice) * parseInt(item.packSize)).toFixed(2),
          'Cases Ordered': item.cases || 0,
          'Bottles Ordered': item.bottles || 0,
          'Total Bottles': item.quantity,
          'Item Total': (parseFloat(item.frontlinePrice) * item.quantity).toFixed(2),
          'Ideal Delivery Date': order.idealDeliveryDate ? new Date(order.idealDeliveryDate).toLocaleDateString() : '',
          'Must Have By Date': order.mustHaveByDate ? new Date(order.mustHaveByDate).toLocaleDateString() : '',
          'Admin Note': order.adminNote || '',
          'Order Total': order.total
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Orders');

    // Save the file
    XLSX.writeFile(workbook, `AOC_Orders_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generateSpecialOrderReport = () => {
    const allItems = [];
    Object.entries(allCustomerLists).forEach(([username, items]) => {
      items.forEach(item => {
        allItems.push({
          'Customer': username,
          'Establishment': username,
          'Date': new Date().toLocaleDateString(),
          'Supplier': item.supplier || '',
          'Producer': item.producer,
          'Item': item.productName,
          'Item Code': item.itemCode || '',
          'Size': String(item.bottleSize || '').replace(/[^0-9.]/g, ''),
          'Pack': item.packSize || '',
          'FOB Case': item.fobCasePrice || 0,
          'Frontline Case': item.frontlineCase || (parseFloat(item.frontlinePrice) * parseInt(item.packSize)).toFixed(2),
          'Cases': item.cases || 0,
          'Bottles': item.bottles || 0,
          'Total Bottles': item.quantity,
          'Status': item.status || 'Requested',
          'Admin Comments': item.adminNotes || '',
          'Notes': item.notes || '',
          '_username': username,
          '_item_id': item.id
        });
      });
    });

    if (allItems.length === 0) {
      alert('No special order requests to export');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(allItems);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Special Order Requests');
    XLSX.writeFile(workbook, `AOC_Special_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleStatusSyncUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Synchronizing statuses...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const updatedAllLists = { ...allCustomerLists };
        let updateCount = 0;

        jsonData.forEach(row => {
          const username = row['_username'];
          const itemId = row['_item_id'];
          // Find status with flexible key matching
          const statusKey = Object.keys(row).find(key => key.toLowerCase() === 'status');
          const newStatus = statusKey ? row[statusKey] : null;

          const adminNotesKey = Object.keys(row).find(key => key.toLowerCase().includes('admin') && key.toLowerCase().includes('comment'));
          const newAdminNotes = adminNotesKey ? row[adminNotesKey] : row['Admin Comments'];

          if (username && itemId && updatedAllLists[username]) {
            updatedAllLists[username] = updatedAllLists[username].map(item => {
              if (item.id === itemId) {
                updateCount++;
                let status = (newStatus && newStatus.trim()) || item.status;

                // Map legacy/common terms to our structured labels
                if (status === 'Ordered') status = 'Ordered from Supplier';
                if (status.toLowerCase() === 'created') status = 'ERP Item Created';
                if (status.toLowerCase() === 'sample') status = 'Sample Pending';
                if (status.toLowerCase() === 'arriving') status = 'Pending Arrival';
                if (status.toLowerCase() === 'received') status = 'In Stock';

                return {
                  ...item,
                  status: status,
                  adminNotes: newAdminNotes !== undefined ? newAdminNotes : item.adminNotes,
                  hasUnseenUpdate: true
                };
              }
              return item;
            });
          }
        });

        await saveSpecialOrderLists(updatedAllLists);
        setAllCustomerLists(updatedAllLists);

        // Update active view if viewing a specific list
        if (selectedCustomerForList) {
          setSpecialOrderList(updatedAllLists[selectedCustomerForList] || []);
        } else if (currentUser && !originalAdmin) {
          setSpecialOrderList(updatedAllLists[currentUser.username] || []);
        }

        setUploadStatus(`Successfully synchronized ${updateCount} items.`);
        setTimeout(() => setUploadStatus(''), 5000);
      } catch (error) {
        console.error('Sync error:', error);
        setUploadStatus('Error synchronizing statuses. Please ensure you are using the correct export file.');
        setTimeout(() => setUploadStatus(''), 5000);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const generateCatalogReport = () => {
    if (products.length === 0) {
      alert('No products in catalog to export');
      return;
    }

    const reportData = products.map(product => ({
      'Supplier': product.supplier || '',
      'Producer': product.producer,
      'Product': product.productName,
      'Vintage': product.vintage || 'NV',
      'Item Code': product.itemCode || '',
      'Type': product.productType || 'Wine',
      'Size': String(product.bottleSize || '').replace(/[^0-9.]/g, ''),
      'Pack': product.packSize,
      'FOB Case': product.fobCasePrice,
      'Frontline Btl': product.frontlinePrice,
      'Frontline Case': product.frontlineCase || (parseFloat(product.frontlinePrice) * parseInt(product.packSize)).toFixed(2),
      'SRP': product.srp,
      'Wholesale Btl': product.whlsBottle,
      'Wholesale Case': product.whlsCase,
      'Laid In': product.laidIn
    }));

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Catalog');

    // Save the file
    XLSX.writeFile(workbook, `AOC_Active_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.producer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vintage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.appellation?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSupplier = selectedSupplier === 'all' || product.supplier === selectedSupplier;
    const matchesCountry = selectedCountry === 'all' || (product.country && product.country.toLowerCase() === selectedCountry.toLowerCase());
    const matchesRegion = selectedRegion === 'all' || (product.region && product.region.toLowerCase() === selectedRegion.toLowerCase());
    const matchesAppellation = selectedAppellation === 'all' || (product.appellation && product.appellation.toLowerCase() === selectedAppellation.toLowerCase());

    // Price Filter
    const price = parseFloat(calculateFrontlinePrice(product).whlsBottle) || 0;
    const matchesPrice = price >= priceRange[0] && price <= priceRange[1];

    return matchesSearch && matchesSupplier && matchesCountry && matchesRegion && matchesAppellation && matchesPrice;
  });

  const uniqueCountries = [...new Set(products.map(p => p.country).filter(Boolean))].sort();

  const availableRegions = products
    .filter(p => selectedCountry === 'all' || (p.country && p.country.toLowerCase() === selectedCountry.toLowerCase()))
    .map(p => p.region)
    .filter(Boolean);
  const uniqueRegions = [...new Set(availableRegions)].sort();

  const availableAppellations = products
    .filter(p =>
      (selectedCountry === 'all' || (p.country && p.country.toLowerCase() === selectedCountry.toLowerCase())) &&
      (selectedRegion === 'all' || (p.region && p.region.toLowerCase() === selectedRegion.toLowerCase()))
    )
    .map(p => p.appellation)
    .filter(Boolean);
  const uniqueAppellations = [...new Set(availableAppellations)].sort();

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSupplier('all');
    setSelectedCountry('all');
    setSelectedRegion('all');
    setSelectedAppellation('all');
    setPriceRange([catalogPriceBounds.min, catalogPriceBounds.max]);
  };

  const suppliers = [...new Set(products.map(p => p.supplier))];

  // Login View
  if (view === 'login' || view === 'forgot-password' || view === 'reset-password') {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-100 rounded-full blur-[120px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100 rounded-full blur-[120px] opacity-40 animate-pulse"></div>

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-10 max-w-md w-full border border-white/50 relative z-10">
          <div className="flex flex-col items-center justify-center mb-10 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100/50">
              <Wine className="w-10 h-10 text-rose-600" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
              AOC Wines
            </h1>
            <p className="text-slate-500 font-medium tracking-wide uppercase text-xs">
              {view === 'login' ? (authMode === 'login' ? 'Partner Portal' : 'Create Account') :
                view === 'forgot-password' ? 'Reset Request' : 'Restore Access'}
            </p>
          </div>

          {(view === 'login') && (
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">Establishment</label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 placeholder:text-slate-400 font-medium"
                  placeholder="Name or Username"
                />
              </div>
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 placeholder:text-slate-400 font-medium"
                    placeholder="notifications@establishment.com"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setView('forgot-password')}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 placeholder:text-slate-400 font-medium"
                  placeholder="••••••••"
                />
              </div>

              {/* Admin Signup Restricted: type enforced to 'customer' by backend */}

              {authError && (
                <div className="p-4 bg-rose-50 border border-rose-100/50 text-rose-700 text-sm rounded-2xl text-center font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all duration-200 shadow-xl shadow-slate-200 hover:shadow-2xl hover:shadow-slate-300 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg"
              >
                {authMode === 'login' ? 'Continue to Portal' : 'Create My Account'}
              </button>
            </form>
          )}

          {(view === 'forgot-password') && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 placeholder:text-slate-400 font-medium"
                  placeholder="The email associated with your account"
                />
              </div>

              {authError && (
                <div className="p-4 bg-rose-50 border border-rose-100/50 text-rose-700 text-sm rounded-2xl text-center font-medium">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-100/50 text-emerald-700 text-sm rounded-2xl text-center font-medium">
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all duration-200 shadow-xl shadow-slate-200"
              >
                Send Reset Link
              </button>

              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setAuthError('');
                  setAuthMessage('');
                }}
                className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Back to Login
              </button>
            </form>
          )}

          {(view === 'reset-password') && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 font-medium"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 ml-1 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 font-medium"
                  placeholder="••••••••"
                />
              </div>

              {authError && (
                <div className="p-4 bg-rose-50 border border-rose-100/50 text-rose-700 text-sm rounded-2xl text-center font-medium">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-100/50 text-emerald-700 text-sm rounded-2xl text-center font-medium">
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all duration-200 shadow-xl shadow-slate-200"
              >
                Reset Password
              </button>
            </form>
          )}

          {view === 'login' && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
                className="text-slate-500 font-medium hover:text-rose-600 transition-colors duration-200 h-10 px-4 rounded-xl hover:bg-rose-50"
              >
                {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated View
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <style>{`
        .range-slider-thumb {
          pointer-events: none !important;
        }
        .range-slider-thumb::-webkit-slider-thumb {
          pointer-events: auto !important;
          pointer-events: all !important;
          cursor: grab !important;
        }
        .range-slider-thumb::-moz-range-thumb {
          pointer-events: auto !important;
          pointer-events: all !important;
          cursor: grab !important;
        }
        .range-slider-thumb:active::-webkit-slider-thumb {
          cursor: grabbing !important;
        }
      `}</style>
      {view === 'admin' ? (
        <div className="admin-view-transition-container">
          <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-8 py-5">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100/50">
                  <Wine className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">AOC Wines</h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Admin Dashboard</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-slate-600">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200/50">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">{currentUser.username}</span>
                </div>
                <button
                  onClick={() => setShowImpersonationModal(true)}
                  className="p-2.5 bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 rounded-xl transition-all duration-200 shadow-sm"
                  title="Login As Customer"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all duration-200 font-bold text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </nav>

          {/* Impersonation Modal */}
          {showImpersonationModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Login As Customer</h3>
                  <button
                    onClick={() => setShowImpersonationModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={impersonationSearch}
                      onChange={(e) => setImpersonationSearch(e.target.value)}
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {allUsers
                      .filter(u => u.type === 'customer' && !u.accessRevoked && u.username.toLowerCase().includes(impersonationSearch.toLowerCase()))
                      .map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            handleImpersonate(user);
                            setShowImpersonationModal(false);
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group text-left"
                        >
                          <span className="font-bold text-slate-700 group-hover:text-slate-900">{user.username}</span>
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            Select
                          </span>
                        </button>
                      ))}
                    {allUsers.filter(u => u.type === 'customer' && !u.accessRevoked && u.username.toLowerCase().includes(impersonationSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-slate-400 text-sm py-4 italic">No matching customers found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-8 max-w-7xl mx-auto">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <div
                onClick={generateCatalogReport}
                className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 cursor-pointer hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/[0.03] transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100/50 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-300">
                    <Package className="w-6 h-6 text-blue-600 group-hover:text-white transition-all duration-300" />
                  </div>
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">EXPORT XLS</div>
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-blue-700 transition-colors">Active Catalog</p>
                <p className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">{products.length}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium italic">Unique products</p>
              </div>

              <div
                onClick={generateOrderReport}
                className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 cursor-pointer hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/[0.03] transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/50 group-hover:bg-emerald-600 group-hover:border-emerald-600 transition-all duration-300">
                    <ShoppingCart className="w-6 h-6 text-emerald-600 group-hover:text-white transition-all duration-300" />
                  </div>
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">EXPORT XLS</div>
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-emerald-700 transition-colors">Historical Orders</p>
                <p className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">{orders.length}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium italic">Completed transactions</p>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/[0.03] transition-all duration-300 group relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100/50 group-hover:bg-purple-600 group-hover:border-purple-600 transition-all duration-300">
                    <FileSpreadsheet className="w-6 h-6 text-purple-600 group-hover:text-white transition-all duration-300" />
                  </div>
                  <label className="cursor-pointer px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full hover:bg-purple-200 transition-colors">
                    SYNC XLS
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx, .xls"
                      onChange={handleStatusSyncUpload}
                    />
                  </label>
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-purple-700 transition-colors">Sync Statuses</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">Status Sync</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400 font-medium italic">Upload modified report</p>
                  {uploadStatus && (
                    <span className="text-[10px] font-bold text-purple-600 animate-pulse bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                      {uploadStatus}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={generateSpecialOrderReport}
                className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 cursor-pointer hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/[0.03] transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100/50 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all duration-300">
                    <ClipboardList className="w-6 h-6 text-indigo-600 group-hover:text-white transition-all duration-300" />
                  </div>
                  <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">EXPORT XLS</div>
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-indigo-700 transition-colors">Special Orders</p>
                <p className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  {Object.values(allCustomerLists).reduce((acc, list) => acc + list.length, 0)}
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium italic">Active requests</p>
              </div>
            </div>

            {/* Customer Special Order Lists */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
              <div
                className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                onClick={() => toggleSection('customerLists')}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.customerLists ? 'bg-slate-100' : 'bg-rose-50'}`}>
                  {collapsedSections.customerLists ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Active Customer Lists</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Special order requests by establishment</p>
                </div>
              </div>

              {!collapsedSections.customerLists && (
                <div className="animate-in fade-in duration-500">
                  {Object.keys(allCustomerLists).filter(user => allCustomerLists[user].length > 0).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                      <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium tracking-tight">No active customer lists currently.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-3">
                      {Object.entries(allCustomerLists)
                        .filter(([_, items]) => items.length > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([username, items]) => {
                          const total = items.reduce((sum, item) => sum + (parseFloat(item.frontlinePrice) * item.quantity), 0).toFixed(2);
                          return (
                            <div
                              key={username}
                              className="bg-white border border-slate-100 rounded-2xl px-6 py-4 hover:border-rose-200 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all duration-200 cursor-pointer group flex items-center justify-between"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerForList(username);
                                setSpecialOrderList(items);
                                setShowList(true);
                              }}
                            >
                              <div className="flex items-center space-x-4 flex-1">
                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-rose-50 group-hover:border-rose-100 transition-colors duration-200">
                                  <UserCheck className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors duration-200" />
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-slate-900 uppercase tracking-tight text-sm group-hover:text-rose-600 transition-colors">{username}</h3>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{items.length} item(s) pending</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-8">
                                <div className="text-right">
                                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-0.5">Est. Total</p>
                                  <p className="text-base font-black text-slate-900 tracking-tight font-mono">${total}</p>
                                </div>
                                <div className="p-2 text-slate-200 group-hover:text-rose-400 transition-colors">
                                  <ChevronRight className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Team & Security Management - Restricted to Super Admins */}
            {currentUser && currentUser.isSuperAdmin && (
              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
                <div
                  className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                  onClick={() => toggleSection('team')}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.team ? 'bg-slate-100' : 'bg-rose-50'}`}>
                    {collapsedSections.team ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Team & Security</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Manage administrative access and permissions</p>
                  </div>
                </div>

                {!collapsedSections.team && (
                  <div className="animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-50">
                            <th className="pb-4 pl-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</th>
                            <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                            <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Current Role</th>
                            <th className="pb-4 pr-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {allUsers.map((user) => (
                            <tr key={user.id} className="group hover:bg-slate-50/30 transition-colors">
                              <td className="py-4 pl-1 font-extrabold text-slate-900 text-sm">
                                <div className="flex items-center gap-2">
                                  {user.username}
                                  {user.accessRevoked && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-tighter border border-amber-100">
                                      Revoked
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 text-slate-500 text-xs font-medium">{user.email || '-'}</td>
                              <td className="py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${user.type === 'admin'
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                                  }`}>
                                  {user.type}
                                </span>
                              </td>
                              <td className="py-4 pr-1 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {user.id !== currentUser.id && (
                                    <>
                                      <button
                                        onClick={() => updateUserRole(user.id, user.type === 'admin' ? 'customer' : 'admin')}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border ${user.type === 'admin'
                                          ? 'text-slate-400 border-slate-200 hover:bg-slate-100'
                                          : 'text-rose-600 border-rose-100 hover:bg-rose-50'
                                          }`}
                                      >
                                        {user.type === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                      </button>
                                      <button
                                        onClick={() => toggleUserAccess(user.id, !user.accessRevoked)}
                                        disabled={user.username === 'treys'}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border ${user.accessRevoked
                                          ? 'text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                                          : 'text-rose-600 border-rose-100 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent'
                                          }`}
                                      >
                                        {user.accessRevoked ? 'Restore Access' : 'Revoke Access'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supplier and Upload Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* Supplier Management */}
              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col h-full">
                <div
                  className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                  onClick={() => toggleSection('suppliers')}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.suppliers ? 'bg-slate-100' : 'bg-rose-50'}`}>
                    {collapsedSections.suppliers ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Suppliers and Offers</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Distributor network management</p>
                  </div>
                </div>

                {!collapsedSections.suppliers && (
                  <div className="animate-in fade-in duration-500 overflow-y-auto max-h-[400px] flex-grow pr-2">
                    {suppliers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                        <Users className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No distributors mapped yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {suppliers.map(supplier => {
                          const supplierProducts = products.filter(p => p.supplier === supplier);
                          const latestUpload = supplierProducts.length > 0
                            ? new Date(Math.max(...supplierProducts.map(p => new Date(p.uploadDate)))).toLocaleDateString()
                            : 'Unknown';

                          return (
                            <div key={supplier} className="flex justify-between items-center p-5 bg-slate-50/30 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200 group">
                              <div>
                                <p className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">{supplier}</p>
                                <div className="flex items-center space-x-3 mt-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-full">{supplierProducts.length} items</span>
                                  <span className="text-[10px] font-bold text-slate-300">Updated: {latestUpload}</span>
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Remove all items for ${supplier}? This cannot be undone.`)) {
                                    const updatedProducts = products.filter(p => p.supplier !== supplier);
                                    await saveProducts(updatedProducts);
                                  }
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                                title="Delete Supplier"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Section */}
              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col h-full">
                <div
                  className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                  onClick={() => toggleSection('upload')}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.upload ? 'bg-slate-100' : 'bg-rose-50'}`}>
                    {collapsedSections.upload ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Import Engine</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Process Excel or PDF price lists</p>
                  </div>
                </div>

                {!collapsedSections.upload && (
                  <div className="animate-in fade-in duration-500 flex flex-col items-center justify-center flex-grow py-8 border-2 border-dashed border-slate-200 rounded-3xl px-8 text-center hover:border-rose-300 hover:bg-rose-50/10 transition-all duration-300">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100/50">
                      <FileSpreadsheet className="w-8 h-8 text-rose-600" />
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">Drop List Here</h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-6 px-10">Supporting .xlsx, .xls, and PDF formats for automatic extraction</p>
                    <button
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all duration-200 flex items-center justify-center space-x-3 active:scale-[0.98] shadow-lg shadow-slate-200"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Select Local File</span>
                    </button>

                    {uploadStatus && (
                      <div className={`mt-6 w-full p-4 rounded-2xl border text-[11px] font-bold uppercase tracking-tight ${uploadStatus.includes('Error') || uploadStatus.includes('failed')
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        {uploadStatus}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Louis Dressner PDF Converter Section */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
              <div
                className="flex items-center mb-6 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                onClick={() => toggleSection('dressner')}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.dressner ? 'bg-slate-100' : 'bg-purple-50'}`}>
                  {collapsedSections.dressner ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-purple-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">External PDF Pipeline</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Louis Dressner protocol converters</p>
                </div>
              </div>

              {!collapsedSections.dressner && (
                <div className="animate-in fade-in duration-500 space-y-8">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                      <span className="font-bold">Automated Protocol:</span> For Louis Dressner source PDFs, use the satellite converters below to generate a compatible schema, then upload the resulting file to the primary dropzone.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-purple-200 hover:shadow-sm transition-all duration-300 group">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                        Desktop Satellite (macOS)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mb-6">Drop-target application for high-volume conversion</p>
                      <a
                        href="/api/placeholder/download/mac-app"
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold text-xs hover:bg-purple-600 hover:text-white transition-all duration-300 shadow-sm"
                        download="louis_dressner_converter_mac.py"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Satellite App</span>
                      </a>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-purple-200 hover:shadow-sm transition-all duration-300 group">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center">
                        <div className="w-2 h-2 bg-slate-400 rounded-full mr-2"></div>
                        Terminal CLI Utility
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mb-4">Python-based command line interface</p>
                      <code className="text-[10px] bg-slate-900 text-slate-300 p-3 rounded-xl block mb-6 font-mono leading-relaxed">
                        python3 convert.py source.pdf output.xlsx
                      </code>
                      <a
                        href="/api/placeholder/download/python-script"
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all duration-300"
                        download="convert_louis_dressner_pdf.py"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download CLI Source</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Product Catalog - Admin View with Pricing */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
              <div
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                onClick={() => toggleSection('catalog')}
              >
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.catalog ? 'bg-slate-100' : 'bg-rose-50'}`}>
                    {collapsedSections.catalog ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Active Catalog</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Inventory & Pricing Management</p>
                  </div>
                </div>

                {!collapsedSections.catalog && (
                  <div className="relative w-full md:w-96" onClick={(e) => e.stopPropagation()}>
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by producer, name, or vintage..."
                      className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 placeholder:text-slate-400 font-medium"
                    />
                  </div>
                )}
              </div>

              {!collapsedSections.catalog && (
                <div className="animate-in fade-in duration-500">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                      <Search className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">
                        {products.length === 0 ? 'No products in catalog yet.' : `No results found for "${searchTerm}"`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-8">
                      <table className="w-full whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-50/50 border-y border-slate-100">
                            <th className="text-left py-4 px-8 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Code</th>
                            <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Producer</th>
                            <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Product Info</th>
                            <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Vintage</th>
                            <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Format/Pack</th>
                            <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Type</th>
                            <th className="text-right py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">FOB Case</th>
                            <th className="text-right py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Btl Price</th>
                            <th className="text-right py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Case Price</th>
                            <th className="text-center py-4 px-8 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredProducts.map((product, idx) => {
                            const calc = calculateFrontlinePrice(product);
                            const frontlineCase = (parseFloat(calc.frontlinePrice) * parseInt(product.packSize || 12)).toFixed(2);

                            return (
                              <tr key={product.id} className="group hover:bg-slate-50/70 transition-colors">
                                <td className="py-5 px-8">
                                  <span className="text-xs font-bold text-slate-400 bg-slate-100/50 px-2 py-1 rounded-md">{product.itemCode}</span>
                                </td>
                                <td className="py-5 px-4">
                                  <p className="text-sm font-bold text-slate-900 leading-tight">{product.producer}</p>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                    <p className="text-[10px] text-slate-400 font-medium uppercase">{product.supplier}</p>
                                    {(product.country || product.region) && (
                                      <>
                                        <span className="text-slate-200">•</span>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                          {product.country}{product.region ? `, ${product.region}` : ''}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-4">
                                  <div className="text-sm font-medium text-slate-700">{product.productName}</div>
                                  {product.appellation && (
                                    <p className="text-[10px] text-slate-400 font-bold italic mt-1 uppercase tracking-tight">{product.appellation}</p>
                                  )}
                                  {/* Dynamic Extra Fields Display */}
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {Object.entries(product).map(([key, value]) => {
                                      const standardFields = ['id', 'itemCode', 'producer', 'productName', 'vintage', 'packSize', 'bottleSize', 'productType', 'fobCasePrice', 'productLink', 'supplier', 'uploadDate', 'frontlinePrice', 'frontlineCase', 'srp', 'whlsBottle', 'whlsCase', 'laidIn', 'formulaUsed', 'country', 'region', 'appellation'];
                                      if (standardFields.includes(key) || !value || typeof value === 'object') return null;
                                      return (
                                        <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-slate-100 text-slate-500 border border-slate-200/50 shadow-sm">
                                          <span className="text-slate-400 mr-1.5">{key}:</span> {String(value)}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="py-5 px-4 text-sm font-bold text-slate-500 tracking-tight">{product.vintage || 'NV'}</td>
                                <td className="py-5 px-4">
                                  <div className="text-xs font-medium text-slate-600">
                                    {product.bottleSize} <span className="text-slate-300 mx-1">•</span> {product.packSize}pk
                                  </div>
                                </td>
                                <td className="py-5 px-4">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${calc.formulaUsed === 'wine' ? 'bg-purple-50 text-purple-700' :
                                    calc.formulaUsed === 'spirits' ? 'bg-amber-50 text-amber-700' :
                                      'bg-blue-50 text-blue-700'
                                    }`}>
                                    {calc.formulaUsed}
                                  </span>
                                </td>
                                <td className="py-5 px-4 text-right">
                                  <span className="text-sm font-bold text-slate-800 tracking-tight">${product.fobCasePrice.toFixed(2)}</span>
                                </td>
                                <td className="py-5 px-4 text-right">
                                  <span className="text-sm font-extrabold text-rose-600 tracking-tight">${calc.frontlinePrice}</span>
                                </td>
                                <td className="py-5 px-4 text-right">
                                  <span className="text-sm font-extrabold text-slate-900 tracking-tight">${frontlineCase}</span>
                                </td>
                                <td className="py-5 px-8">
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      onClick={() => setEditingProduct(product)}
                                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 group/btn"
                                      title="Edit Product"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmation({ id: product.id, name: `${product.producer} - ${product.productName}`, type: 'product' })}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100 group/btn"
                                      title="Delete Product"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Recent Orders */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden text-slate-800">
              <div
                className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                onClick={() => toggleSection('orders')}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.orders ? 'bg-slate-100' : 'bg-rose-50'}`}>
                  {collapsedSections.orders ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Order Archive</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Historical snapshot of submitted lists</p>
                </div>
              </div>

              {!collapsedSections.orders && (
                <div className="animate-in fade-in duration-500">
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                      <ShoppingCart className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium tracking-tight">No historical orders found.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {orders.slice().reverse().map(order => {
                        const hasDiscontinued = order.items.some(item =>
                          discontinuedProducts.find(d => d.id === item.id)
                        );

                        return (
                          <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-300">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 uppercase font-extrabold text-slate-400 text-xs shadow-sm">
                                  {order.customer?.substring(0, 2) || '??'}
                                </div>
                                <div>
                                  <p className="font-extrabold text-slate-900 text-lg tracking-tight uppercase font-sans">{order.customer || 'Unknown Customer'}</p>
                                  <div className="flex items-center space-x-2 mt-0.5">
                                    <p className="text-xs text-slate-400 font-bold tracking-wider">{new Date(order.date).toLocaleDateString()}</p>
                                    {hasDiscontinued && (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100 uppercase tracking-tighter">Legacy Items</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col md:items-end w-full md:w-auto">
                                <p className="text-2xl font-extrabold text-slate-900 tracking-tighter mb-2 font-mono">${order.total}</p>
                                <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-slate-900 text-white rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-sm">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                  <span>Archive Closed</span>
                                </div>
                              </div>
                            </div>

                            {/* Admin Note Section */}
                            <div className="mb-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Note / Signature</label>
                              <div className="relative">
                                <Edit className="absolute left-3 top-3 w-3 h-3 text-slate-300 pointer-events-none" />
                                <textarea
                                  value={order.adminNote || ''}
                                  onChange={(e) => handleUpdateOrderNote(order.id, e.target.value)}
                                  placeholder="Add a note or signature..."
                                  className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-200 transition-all placeholder:text-slate-300 resize-none"
                                  rows={1}
                                  onFocus={(e) => e.target.rows = 3}
                                  onBlur={(e) => e.target.rows = 1}
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-50">
                              <details className="group/details">
                                <summary className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-[0.15em] flex items-center list-none select-none outline-none">
                                  <ChevronRight className="w-3 h-3 mr-1 transition-transform group-open/details:rotate-90" />
                                  View Inventory Snapshot ({order.items.length} items)
                                </summary>
                                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/30">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-slate-100/50 border-b border-slate-100">
                                        <th className="py-2 px-4 text-left font-black text-[10px] text-slate-500 uppercase tracking-widest">Wine / Producer</th>
                                        <th className="py-2 px-4 text-left font-black text-[10px] text-slate-500 uppercase tracking-widest">Fulfillment Status</th>
                                        <th className="py-2 px-4 text-right font-black text-[10px] text-slate-500 uppercase tracking-widest">Fulfillment Ratio</th>
                                        <th className="py-2 px-4 text-right font-black text-[10px] text-slate-500 uppercase tracking-widest">Total Price</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {order.items.map((item, idx) => {
                                        const isDiscontinued = discontinuedProducts.find(d => d.id === item.id);
                                        const isDelivered = (item.status || '').toUpperCase() === 'DELIVERED';

                                        return (
                                          <tr key={idx} className="hover:bg-white transition-colors group">
                                            <td className="py-3 px-4">
                                              <div className="flex flex-col">
                                                <div className="flex items-center space-x-2">
                                                  {isDiscontinued && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="Discontinued"></span>}
                                                  <span className={`font-extrabold ${isDiscontinued ? 'text-amber-800' : 'text-slate-900'} uppercase tracking-tight`}>{item.producer}</span>
                                                </div>
                                                <span className="text-slate-500 font-medium italic mt-0.5">{item.productName}</span>
                                              </div>
                                            </td>
                                            <td className="py-3 px-4">
                                              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${isDelivered
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-rose-50 text-rose-700 border-rose-100'
                                                }`}>
                                                {item.status || 'Archived'}
                                              </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                              <div className="flex flex-col items-end">
                                                <span className="font-black text-slate-900 bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded-lg">
                                                  {isDelivered ? item.quantity : 0} / {item.requestedQuantity || item.quantity}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                                                  Units Fulfilled
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                              ${(parseFloat(item.frontlinePrice) * (isDelivered ? item.quantity : 0)).toFixed(2)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </details>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discontinued Products (In Active Orders) */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
              <div
                className="flex items-center mb-4 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                onClick={() => toggleSection('discontinued')}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.discontinued ? 'bg-slate-100' : 'bg-rose-50'}`}>
                  {collapsedSections.discontinued ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Legacy Inventory</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Discontinued products with active commitments</p>
                </div>
              </div>

              {!collapsedSections.discontinued && (
                <div className="animate-in fade-in duration-500">
                  {discontinuedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 text-sm font-medium">No active commitments to legacy inventory.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {discontinuedProducts.map(product => (
                        <div key={product.id} className="bg-amber-50/30 border border-amber-100 rounded-2xl p-6 hover:bg-amber-50 group transition-all duration-300">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm tracking-tight uppercase group-hover:text-amber-800 transition-colors">{product.producer}</p>
                              <p className="text-sm text-slate-500 font-medium mt-0.5">{product.productName}</p>
                              <div className="flex items-center space-x-3 mt-4">
                                <span className="text-[10px] font-bold text-amber-600 bg-white border border-amber-100 px-2 py-0.5 rounded-full">{product.vintage || 'NV'}</span>
                                <span className="text-[10px] font-bold text-slate-400">{product.supplier}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-amber-700 tracking-tighter">${product.frontlinePrice}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Final Pricing</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pricing Formulas (AOC) */}
            {currentUser.isSuperAdmin && (
              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 overflow-hidden">
                <div
                  className="flex items-center mb-8 cursor-pointer hover:bg-slate-50/50 p-3 -m-3 rounded-2xl transition-all duration-200 group"
                  onClick={() => toggleSection('formulas')}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300 ${collapsedSections.formulas ? 'bg-slate-100' : 'bg-rose-50'}`}>
                    {collapsedSections.formulas ? <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Calculation Engine</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 group-hover:text-slate-700 transition-colors">Pricing algorithms & tax configuration</p>
                  </div>
                </div>

                {!collapsedSections.formulas && (
                  <div className="animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {Object.entries(formulas).map(([type, formula]) => (
                        <div key={type} className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 hover:bg-white hover:border-rose-100 hover:shadow-sm transition-all duration-300">
                          <h3 className="text-sm font-extrabold text-slate-900 mb-6 uppercase tracking-[0.15em] flex items-center">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-2"></span>
                            {type}
                          </h3>
                          <div className="space-y-5">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tax per Liter ($)</label>
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fixed Tax ($)</label>
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Shipping / Case ($)</label>
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Margin Divisor</label>
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">SRP Multiplier</label>
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-10 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start space-x-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 shrink-0 shadow-sm border border-slate-200">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 uppercase tracking-widest text-[10px] mb-2">Algorithm Logic (Vinosmith Standard)</p>
                        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-[11px] font-medium text-slate-500 italic">
                          <li>1. Case Volume = (Pack × Size ML) ÷ 1000</li>
                          <li>2. Combined Tax = (Volume × Tax/L) + Flat Tax</li>
                          <li>3. Laid In Cost = FOB + Delivery + Tax</li>
                          <li>4. Whls Net = Laid In ÷ Margin Divisor</li>
                          <li>5. SRP = ROUNDUP(Unit Net × SRP Mult, 0) - .01</li>
                          <li>6. Frontline = SRP ÷ SRP Mult</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Supplier Selection Modal */}
            {pendingUpload && showSupplierModal && (
              <div className="bg-white rounded-[2.5rem] p-12 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] border border-slate-100 mb-12 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Identify Supplier</h2>
                    <p className="text-sm text-slate-500 font-medium">Which distributor catalog does this file represent?</p>
                  </div>
                  <button
                    onClick={() => {
                      setPendingUpload(null);
                      setShowSupplierModal(false);
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-10">
                  {/* Option A: Existing Suppliers */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
                      Existing Portfolios
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {Array.from(new Set(products.map(p => p.supplier))).sort().map(s => (
                        <button
                          key={s}
                          onClick={() => setPendingUpload({ ...pendingUpload, supplierName: s })}
                          className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border flex items-center space-x-3 ${pendingUpload.supplierName === s
                            ? 'bg-rose-500 text-white border-rose-500 shadow-xl shadow-rose-200 ring-4 ring-rose-500/10'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-rose-200 hover:text-rose-500 hover:bg-rose-50/30'
                            }`}
                        >
                          <Package className={`w-3.5 h-3.5 ${pendingUpload.supplierName === s ? 'text-white' : 'text-slate-300'}`} />
                          <span>{s}</span>
                        </button>
                      ))}
                      {Array.from(new Set(products.map(p => p.supplier))).length === 0 && (
                        <p className="text-xs text-slate-400 italic font-medium py-3">No existing suppliers found in catalog.</p>
                      )}
                    </div>
                  </div>

                  {/* Option B: Manual Entry / New */}
                  <div className="p-8 bg-[#faf9f6]/80 backdrop-blur-sm border border-slate-100 rounded-[2rem]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
                      Manual Identity Assignment
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={pendingUpload.supplierName}
                        onChange={(e) => setPendingUpload({
                          ...pendingUpload,
                          supplierName: e.target.value
                        })}
                        placeholder="Enter supplier name exactly as it should appear..."
                        className="w-full px-8 py-5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 transition-all font-bold text-lg text-slate-900 shadow-sm"
                      />
                      <Edit className="absolute right-6 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-4 ml-1 flex items-center tracking-widest">
                      <span className="w-1 h-1 bg-amber-400 rounded-full mr-2"></span>
                      Critical: Exact matches required to prevent duplicate entries
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setShowSupplierModal(false)}
                      disabled={!pendingUpload.supplierName.trim()}
                      className="w-full bg-[#1a1a1a] text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all duration-300 shadow-2xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <span>Proceed to Column Mapping</span>
                      <ChevronRight className="w-4 h-4 inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Column Mapping UI */}
            {
              pendingUpload && columnMapping && !showSupplierModal && (
                <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] border border-slate-100 mb-12 animate-in zoom-in-95 duration-500">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Initialize Schema</h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Mapping: {pendingUpload.file.name}</p>
                    </div>
                    {pendingUpload.hasTemplate && (
                      <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Active Template Link</span>
                      </div>
                    )}
                  </div>

                  {/* Supplier Name Editor */}
                  <div className="mb-10 p-8 bg-[#faf9f6] border border-slate-100 rounded-3xl">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                      Entity Identification
                    </label>
                    <input
                      type="text"
                      value={pendingUpload.supplierName}
                      onChange={(e) => setPendingUpload({
                        ...pendingUpload,
                        supplierName: e.target.value
                      })}
                      placeholder="Source Entity Name (e.g. Rosenthal)"
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 transition-all font-bold text-lg text-slate-900"
                    />
                    <p className="text-[10px] text-slate-400 font-medium mt-3 ml-1 italic">
                      Establish a unique distributor identifier for cross-catalog synchronization.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    {Object.entries(columnMapping).map(([field, colIndex]) => (
                      <div key={field} className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-rose-100 hover:shadow-sm transition-all duration-300">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <div className="relative">
                          <select
                            value={colIndex}
                            onChange={(e) => setColumnMapping({
                              ...columnMapping,
                              [field]: parseInt(e.target.value)
                            })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-xs appearance-none cursor-pointer text-slate-700"
                          >
                            <option value="-1">NULL (UNMAPPED)</option>
                            {pendingUpload.headers.map((header, idx) => (
                              <option key={idx} value={idx}>
                                COL {idx + 1}: {header || '(VOID)'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    ))}
                  </div>


                  {/* Additional Content Discovery */}
                  {pendingUpload.unmappedHeaders && pendingUpload.unmappedHeaders.length > 0 && (
                    <div className="mb-10 p-8 bg-amber-50/30 border border-amber-100/50 rounded-3xl">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                          <Plus className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Potential Additional Content</h3>
                          <p className="text-[10px] text-slate-500 font-medium">We found columns that aren't part of the standard catalog. Want to include them?</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {pendingUpload.unmappedHeaders.map((header) => (
                          <label
                            key={header.index}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer ${selectedExtraFields.find(f => f.index === header.index)
                              ? 'bg-amber-100 border-amber-200 text-amber-900 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-500 hover:border-amber-100'
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              checked={!!selectedExtraFields.find(f => f.index === header.index)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExtraFields([...selectedExtraFields, header]);
                                } else {
                                  setSelectedExtraFields(selectedExtraFields.filter(f => f.index !== header.index));
                                }
                              }}
                            />
                            <span className="text-[11px] font-black uppercase tracking-widest">{header.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Section */}
                  <div className="mb-10 border-t border-slate-50 pt-10">
                    <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-6 flex items-center">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-2"></span>
                      Schema Data Preview
                    </h3>
                    <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-slate-50/30">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-slate-100/50">
                            <th className="text-left p-4 font-black text-slate-500 uppercase tracking-widest">Producer</th>
                            <th className="text-left p-4 font-black text-slate-500 uppercase tracking-widest">Product</th>
                            <th className="text-left p-4 font-black text-slate-500 uppercase tracking-widest">Vintage</th>
                            <th className="text-left p-4 font-black text-slate-500 uppercase tracking-widest">Size</th>
                            <th className="text-left p-4 font-black text-slate-500 uppercase tracking-widest">Pack</th>
                            <th className="text-right p-4 font-black text-slate-500 uppercase tracking-widest">FOB</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white">
                          {pendingUpload.data.slice(1, 6).map((row, idx) => (
                            <tr key={idx} className="hover:bg-white transition-colors">
                              <td className="p-4 font-bold text-slate-900">{columnMapping.producer >= 0 ? row[columnMapping.producer] : '-'}</td>
                              <td className="p-4 font-medium text-slate-600">{columnMapping.productName >= 0 ? row[columnMapping.productName] : '-'}</td>
                              <td className="p-4 font-black text-slate-400">{columnMapping.vintage >= 0 ? row[columnMapping.vintage] : '-'}</td>
                              <td className="p-4 font-medium text-slate-400">{columnMapping.bottleSize >= 0 ? row[columnMapping.bottleSize] : '-'}</td>
                              <td className="p-4 font-bold text-slate-400">{columnMapping.packSize >= 0 ? row[columnMapping.packSize] : '-'}</td>
                              <td className="p-4 text-right font-black text-rose-600">{columnMapping.fobCasePrice >= 0 ? `$${row[columnMapping.fobCasePrice]}` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={confirmMapping}
                      className="flex-1 bg-[#1a1a1a] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all duration-300 shadow-xl shadow-slate-100 active:scale-[0.98]"
                    >
                      Commit Schema
                    </button>
                    <button
                      onClick={() => {
                        setPendingUpload(null);
                        setColumnMapping(null);
                      }}
                      className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all duration-300"
                    >
                      Abort Import
                    </button>
                  </div>
                </div>
              )
            }

            {/* Edit Product Modal */}
            {editingProduct && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.15)] max-w-2xl w-full max-h-[90vh] overflow-hidden border border-white/50 animate-in zoom-in-95 duration-300">
                  <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-[#faf9f6]/50">
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Modify Inventory</h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Product Details & Core Data</p>
                    </div>
                    <button onClick={() => setEditingProduct(null)} className="p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100 shadow-sm">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateProduct(editingProduct);
                    }}
                    className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Internal Item Code</label>
                        <input
                          type="text"
                          value={editingProduct.itemCode}
                          onChange={(e) => setEditingProduct({ ...editingProduct, itemCode: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-mono text-sm"
                          placeholder="e.g. AOC-123"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Producer / Domain</label>
                        <input
                          type="text"
                          value={editingProduct.producer}
                          onChange={(e) => setEditingProduct({ ...editingProduct, producer: e.target.value })}
                          required
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                        />
                      </div>

                      {/* Location / Origin Section */}
                      <div className="md:col-span-2 pt-4 pb-2 border-t border-slate-100 mt-2">
                        <div className="flex justify-between items-end mb-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Origin Details</label>
                          <button
                            type="button"
                            onClick={() => setUseManualLocation(!useManualLocation)}
                            className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:text-rose-600 transition-colors"
                          >
                            {useManualLocation ? 'Switch to Smart Select' : 'Switch to Manual Entry'}
                          </button>
                        </div>
                      </div>

                      {useManualLocation ? (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Country</label>
                            <input
                              type="text"
                              value={editingProduct.country || ''}
                              onChange={(e) => setEditingProduct({ ...editingProduct, country: e.target.value })}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                              placeholder="e.g. France"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Region</label>
                            <input
                              type="text"
                              value={editingProduct.region || ''}
                              onChange={(e) => setEditingProduct({ ...editingProduct, region: e.target.value })}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                              placeholder="e.g. Bordeaux"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Appellation</label>
                            <input
                              type="text"
                              value={editingProduct.appellation || ''}
                              onChange={(e) => setEditingProduct({ ...editingProduct, appellation: e.target.value })}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                              placeholder="e.g. Margaux"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Country</label>
                            <div className="relative">
                              <select
                                value={editingProduct.country || ''}
                                onChange={(e) => setEditingProduct({ ...editingProduct, country: e.target.value, region: '', appellation: '' })}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm appearance-none"
                              >
                                <option value="">Select Country...</option>
                                {Object.keys(taxonomy).sort().map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Region</label>
                            <div className="relative">
                              <select
                                value={editingProduct.region || ''}
                                onChange={(e) => setEditingProduct({ ...editingProduct, region: e.target.value, appellation: '' })}
                                disabled={!editingProduct.country}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm appearance-none disabled:opacity-50"
                              >
                                <option value="">Select Region...</option>
                                {editingProduct.country && taxonomy[editingProduct.country] && Object.keys(taxonomy[editingProduct.country]).sort().map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>

                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Appellation</label>
                            <div className="relative">
                              <select
                                value={editingProduct.appellation || ''}
                                onChange={(e) => setEditingProduct({ ...editingProduct, appellation: e.target.value })}
                                disabled={!editingProduct.region}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm appearance-none disabled:opacity-50"
                              >
                                <option value="">Select Appellation...</option>
                                {editingProduct.country && editingProduct.region && taxonomy[editingProduct.country] && taxonomy[editingProduct.country][editingProduct.region] && taxonomy[editingProduct.country][editingProduct.region].sort().map(a => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </>
                      )}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Wine/Product Name</label>
                        <input
                          type="text"
                          value={editingProduct.productName}
                          onChange={(e) => setEditingProduct({ ...editingProduct, productName: e.target.value })}
                          required
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Vintage</label>
                        <input
                          type="text"
                          value={editingProduct.vintage}
                          onChange={(e) => setEditingProduct({ ...editingProduct, vintage: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                          placeholder="NV"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Classification</label>
                        <select
                          value={editingProduct.productType}
                          onChange={(e) => setEditingProduct({ ...editingProduct, productType: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm appearance-none"
                        >
                          <option value="Wine">Wine</option>
                          <option value="Spirits">Spirits</option>
                          <option value="Non-Alcoholic">Non-Alcoholic</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Format (e.g. 750ml)</label>
                        <input
                          type="text"
                          value={editingProduct.bottleSize}
                          onChange={(e) => setEditingProduct({ ...editingProduct, bottleSize: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Case Pack</label>
                        <input
                          type="number"
                          value={editingProduct.packSize}
                          onChange={(e) => setEditingProduct({ ...editingProduct, packSize: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5 pt-4 bg-rose-50/30 p-6 rounded-[2rem] border border-rose-100/50">
                        <label className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest ml-1">Cost (FOB Case Price $)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingProduct.fobCasePrice}
                          onChange={(e) => setEditingProduct({ ...editingProduct, fobCasePrice: parseFloat(e.target.value) || 0 })}
                          required
                          className="w-full px-6 py-4 bg-white border border-rose-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all font-mono text-xl font-extrabold text-rose-700"
                        />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2 ml-1 italic">Frontline and SRP will be auto-recalculated by current engine rules.</p>
                      </div>
                    </div>
                    <div className="pt-8 flex space-x-4">
                      <button
                        type="submit"
                        className="flex-1 bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all duration-200 shadow-xl shadow-slate-200 active:scale-[0.98]"
                      >
                        Apply Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all duration-200"
                      >
                        Discard
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 border border-slate-100 animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 mx-auto border border-rose-100 shadow-sm">
                    <Trash2 className="w-10 h-10 text-rose-600" />
                  </div>
                  <div className="text-center mb-10">
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Confirm Deletion</h2>
                    <p className="text-sm text-slate-500 mt-3 leading-relaxed font-medium">
                      {deleteConfirmation.type === 'reset'
                        ? 'This will permanently ERASE all products, orders, and configuration. This is a terminal action.'
                        : `You are about to remove "${deleteConfirmation.name}". This cannot be reversed.`}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={async () => {
                        if (deleteConfirmation.type === 'reset') {
                          try {
                            await window.storage.delete('wine-products');
                            await window.storage.delete('wine-orders');
                            await window.storage.delete('wine-discontinued');
                            await window.storage.delete('wine-formulas');
                            window.location.reload();
                          } catch (e) {
                            alert('Error resetting data');
                          }
                        } else {
                          deleteProduct(deleteConfirmation.id);
                        }
                      }}
                      id="confirm-delete-btn"
                      className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all duration-200 shadow-lg shadow-rose-200 active:scale-[0.98]"
                    >
                      Confirm Deletion
                    </button>
                    <button
                      onClick={() => setDeleteConfirmation(null)}
                      className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all duration-200"
                    >
                      Keep Records
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Admin Tools */}
            {currentUser.isSuperAdmin && (
              <div className="flex justify-center mt-20 pb-10">
                <button
                  onClick={async () => {
                    setDeleteConfirmation({
                      type: 'reset',
                      name: 'ALL SYSTEM DATA'
                    });
                  }}
                  className="px-8 py-4 bg-white text-rose-400 border border-slate-100 rounded-2xl font-bold text-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all duration-300 shadow-sm flex items-center space-x-2 active:scale-95 group"
                >
                  <Trash2 className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span>Reset Entire Database</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="customer-view-transition-container">
          {originalAdmin && (
            <div className="bg-[#1a1a1a] text-white py-3 px-8 flex justify-between items-center animate-in slide-in-from-top duration-500 sticky top-0 z-[100]">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <p className="text-xs font-bold tracking-tight">
                  <span className="text-slate-400">IMPERSONATING:</span> {currentUser.username}
                </p>
              </div>
              <button
                onClick={handleStopImpersonating}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
              >
                Return to Admin Mode
              </button>
            </div>
          )}
          <nav className={`bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky z-50 px-8 py-5 ${originalAdmin ? 'top-[52px]' : 'top-0'}`}>
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100/50">
                  <Wine className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">AOC Wines</h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Exclusive Partner Catalog</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setShowList(!showList);
                    if (!showList) markSpecialOrderUpdatesAsSeen();
                  }}
                  className="relative p-3 bg-white hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 hover:border-rose-100 shadow-sm shadow-slate-100 group"
                  title="View Collection"
                >
                  <ClipboardList className="w-6 h-6 text-slate-600 group-hover:text-rose-600 transition-colors" />
                  {specialOrderList.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#1a1a1a] text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-md animate-in zoom-in-0 duration-300">
                      {specialOrderList.length}
                    </span>
                  )}
                  {specialOrderList.some(item => item.hasUnseenUpdate) && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
                </button>
                <div className="h-10 w-px bg-slate-100 mx-2 hidden md:block"></div>
                <div className="flex items-center space-x-2 text-slate-600 pr-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200/50">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm font-bold tracking-tight hidden md:block">{currentUser.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </nav>

          <div className="max-w-7xl mx-auto p-8">
            {/* Search and Discovery */}
            <div className="bg-white rounded-[2rem] p-8 mb-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Search Collection</h2>
                <button
                  onClick={resetFilters}
                  className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-colors flex items-center"
                >
                  <X className="w-3 h-3 mr-1" />
                  Reset Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2 lg:col-span-1 space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Search</label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Name, vintage, producer..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all placeholder:text-slate-300 font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Country</label>
                  <div className="relative">
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all font-bold text-xs appearance-none cursor-pointer pr-8 text-slate-700 truncate"
                    >
                      <option value="all">All Countries</option>
                      {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Region</label>
                  <div className="relative">
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all font-bold text-xs appearance-none cursor-pointer pr-8 text-slate-700 truncate"
                    >
                      <option value="all">All Regions</option>
                      {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Appellation</label>
                  <div className="relative">
                    <select
                      value={selectedAppellation}
                      onChange={(e) => setSelectedAppellation(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all font-bold text-xs appearance-none cursor-pointer pr-8 text-slate-700 truncate"
                    >
                      <option value="all">All Appellations</option>
                      {uniqueAppellations.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5 lg:col-span-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Distributor / Portfolio</label>
                  <div className="relative">
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all font-bold text-xs appearance-none cursor-pointer pr-8 text-slate-700"
                    >
                      <option value="all">All Suppliers and Offers</option>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Price Range Slider */}
                <div className="md:col-span-2 lg:col-span-2 flex flex-col space-y-2 pb-1 px-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Price Range (Wholesale)</label>
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                      ${priceRange[0]} - ${priceRange[1]}
                    </span>
                  </div>
                  <div className="relative h-10 flex items-center mb-1">
                    <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-400 md:bg-gradient-to-r md:from-rose-400 md:to-rose-600 opacity-80"
                        style={{
                          marginLeft: `${((priceRange[0] - catalogPriceBounds.min) / (catalogPriceBounds.max - catalogPriceBounds.min || 1)) * 100}%`,
                          width: `${((priceRange[1] - priceRange[0]) / (catalogPriceBounds.max - catalogPriceBounds.min || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={catalogPriceBounds.min}
                      max={catalogPriceBounds.max}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), priceRange[1] - 1);
                        setPriceRange([val, priceRange[1]]);
                      }}
                      className="absolute w-full h-1.5 opacity-0 z-20 range-slider-thumb appearance-none bg-transparent pointer-events-none"
                    />
                    <input
                      type="range"
                      min={catalogPriceBounds.min}
                      max={catalogPriceBounds.max}
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), priceRange[0] + 1);
                        setPriceRange([priceRange[0], val]);
                      }}
                      className="absolute w-full h-1.5 opacity-0 z-20 range-slider-thumb appearance-none bg-transparent pointer-events-none"
                    />

                    {/* Visible Thumbs */}
                    <div
                      className="absolute w-5 h-5 bg-white border-2 border-rose-500 rounded-full shadow-md pointer-events-none transform -translate-x-1/2 transition-all"
                      style={{ left: `${((priceRange[0] - catalogPriceBounds.min) / (catalogPriceBounds.max - catalogPriceBounds.min || 1)) * 100}%` }}
                    />
                    <div
                      className="absolute w-5 h-5 bg-white border-2 border-rose-500 rounded-full shadow-md pointer-events-none transform -translate-x-1/2 transition-all"
                      style={{ left: `${((priceRange[1] - catalogPriceBounds.min) / (catalogPriceBounds.max - catalogPriceBounds.min || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-end justify-end space-x-2 lg:col-span-1">
                  <button
                    onClick={() => setCatalogViewMode('grid')}
                    className={`p-3 rounded-xl transition-all ${catalogViewMode === 'grid' ? 'bg-white shadow-md text-rose-600 border border-slate-100' : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCatalogViewMode('list')}
                    className={`p-3 rounded-xl transition-all ${catalogViewMode === 'list' ? 'bg-white shadow-md text-rose-600 border border-slate-100' : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Product Catalog Display */}
            {catalogViewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredProducts.map(product => {
                  const calc = calculateFrontlinePrice(product);
                  return (
                    <div key={product.id} className="bg-white rounded-[2.5rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 hover:border-rose-100 hover:shadow-[0_12px_48px_-12px_rgba(225,29,72,0.08)] transition-all duration-500 group flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">{product.productType || 'Wine'}</span>
                          <span className="text-[11px] font-mono text-slate-300">{product.itemCode}</span>
                        </div>
                        <h3 className="font-extrabold text-2xl text-slate-900 tracking-tight leading-tight group-hover:text-rose-600 transition-colors uppercase">{product.producer}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 mb-2">
                          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">{product.supplier}</p>
                          {(product.country || product.region) && (
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                              <span className="text-slate-200 mx-1.5">•</span>
                              {product.country}{product.region ? ` / ${product.region}` : ''}
                            </p>
                          )}
                        </div>
                        {product.appellation && (
                          <p className="text-[11px] text-slate-500 font-bold italic uppercase tracking-tighter mb-2">{product.appellation}</p>
                        )}
                        {product.productLink ? (
                          <a
                            href={product.productLink.startsWith('http') ? product.productLink : `https://${product.productLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 font-medium mt-1 leading-relaxed hover:text-rose-600 transition-all inline-flex items-center group/link decoration-slate-200"
                          >
                            {product.productName}
                            <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover/link:opacity-100 transition-all transform translate-x-1" />
                          </a>
                        ) : (
                          <p className="text-slate-500 font-medium mt-1 leading-relaxed">{product.productName}</p>
                        )}

                        {/* Dynamic Extra Fields Display */}
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {Object.entries(product).map(([key, value]) => {
                            const standardFields = ['id', 'itemCode', 'producer', 'productName', 'vintage', 'packSize', 'bottleSize', 'productType', 'fobCasePrice', 'productLink', 'supplier', 'uploadDate', 'frontlinePrice', 'frontlineCase', 'srp', 'whlsBottle', 'whlsCase', 'laidIn', 'formulaUsed', 'country', 'region', 'appellation'];
                            if (standardFields.includes(key) || !value || typeof value === 'object') return null;
                            return (
                              <span key={key} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight bg-slate-50 text-slate-400 border border-slate-100 shadow-sm">
                                <span className="text-slate-300 mr-2">{key}:</span> <span className="text-slate-600">{String(value)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-6">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Frontline Price</p>
                            <div className="flex items-baseline space-x-1">
                              <span className="text-3xl font-black text-slate-900 tracking-tighter">${calc.frontlinePrice}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">/ btl</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{product.packSize}pk • {product.bottleSize}</p>
                            <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">{product.vintage || 'NV'}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => addToList({ ...product, ...calc })}
                          className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all duration-300 flex items-center justify-center space-x-3 active:scale-[0.98] shadow-lg shadow-slate-200"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Submit Request</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                        <th className="py-5 px-8 text-left">Producer / Product</th>
                        <th className="py-5 px-6 text-left">Vintage</th>
                        <th className="py-5 px-6 text-left">Format</th>
                        <th className="py-5 px-6 text-left">Type</th>
                        <th className="py-5 px-6 text-right">Unit Net</th>
                        <th className="py-5 px-8 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map(product => {
                        const calc = calculateFrontlinePrice(product);
                        return (
                          <tr key={product.id} className="group hover:bg-rose-50/20 transition-all duration-300">
                            <td className="py-4 px-8">
                              <div>
                                <p className="font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors uppercase tracking-tight">{product.producer}</p>
                                <p className="text-xs text-slate-400 font-medium">{product.productName}</p>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-xs font-bold text-slate-500">{product.vintage || 'NV'}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-2 py-1 rounded-lg">
                                {product.packSize}×{product.bottleSize}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-full">{product.productType || 'Wine'}</span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="text-sm font-black text-slate-900">${calc.frontlinePrice}</span>
                            </td>
                            <td className="py-4 px-8 text-center">
                              <button
                                onClick={() => addToList({ ...product, ...calc })}
                                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-rose-600 transition-all shadow-sm active:scale-90"
                                title="Add to List"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )
      }

      {/* Special Order List Sidebar */}
      {
        showList && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] animate-in fade-in duration-300" onClick={closeSidebar}>
            <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-[-32px_0_128px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col animate-in slide-in-from-right duration-500 ease-out" onClick={(e) => e.stopPropagation()}>
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-[#faf9f6]/80 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{selectedCustomerForList ? `${selectedCustomerForList}'s Request List` : 'My Request List'}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center">
                    <span className="w-1 h-1 bg-rose-500 rounded-full mr-2"></span>
                    Direct Procurement Request
                  </p>
                </div>
                <button onClick={closeSidebar} className="p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 shadow-sm">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {currentUser && currentUser.type === 'admin' && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-[2rem] p-6 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Admin Order Note</label>
                      {orderNotes[selectedCustomerForList || currentUser.username] && (
                        <span className="text-[9px] font-bold text-amber-400 bg-white px-2 py-0.5 rounded-md border border-amber-100">
                          Will be attached to order history
                        </span>
                      )}
                    </div>
                    <textarea
                      value={orderNotes[selectedCustomerForList || currentUser.username] || ''}
                      onChange={(e) => {
                        const user = selectedCustomerForList || currentUser.username;
                        setOrderNotes(prev => ({ ...prev, [user]: e.target.value }));
                      }}
                      placeholder="Add internal notes for this order (e.g. 'Packed by JB', 'Delivery verified')..."
                      rows="2"
                      className="w-full px-5 py-3 bg-white border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-medium text-xs text-slate-600"
                    />
                  </div>
                )}

                {specialOrderList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center border border-slate-100 shadow-sm">
                      <ClipboardList className="w-10 h-10 text-slate-200" />
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-slate-900 tracking-tight">Request list is empty</p>
                      <p className="text-sm text-slate-400 font-medium mt-1">Visit the catalog to reserve inventory.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {specialOrderList.slice().reverse().map(item => (
                      <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1 pr-6">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="font-black text-lg text-slate-900 tracking-tight uppercase group-hover:text-rose-600 transition-colors">{item.producer}</p>
                              {item.hasUnseenUpdate && (
                                <span className="text-[8px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">New Update</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 font-medium">{item.productName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">${item.frontlinePrice} / unit frontline</p>
                          </div>
                          {(!item.submitted || currentUser.type === 'admin') && (
                            <button
                              onClick={() => removeFromList(item.id)}
                              className="p-3 bg-slate-50 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent group-hover:bg-rose-50 group-hover:border-rose-100 shadow-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Order Cases</label>
                            <input
                              type="number"
                              min="0"
                              value={item.cases}
                              onChange={(e) => updateListUnits(item.id, 'cases', e.target.value)}
                              disabled={item.submitted && currentUser.type === 'customer'}
                              className={`w-full px-5 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-mono font-black ${item.submitted && currentUser.type === 'customer' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Order Bottles</label>
                            <input
                              type="number"
                              min="0"
                              value={item.bottles}
                              onChange={(e) => updateListUnits(item.id, 'bottles', e.target.value)}
                              disabled={item.submitted && currentUser.type === 'customer'}
                              className={`w-full px-5 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-mono font-black ${item.submitted && currentUser.type === 'customer' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procurement Status</span>
                            {currentUser.type === 'admin' ? (
                              <select
                                value={item.status || 'Requested'}
                                onChange={(e) => updateListItemMetadata(item.id, e.target.value, item.notes)}
                                className="text-[10px] font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/10 transition-all cursor-pointer"
                              >
                                <option value="Requested">Requested</option>
                                <option value="Sample Pending">Sample Pending</option>
                                <option value="On Purchase Order">On Purchase Order</option>
                                <option value="Backordered">Backordered</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                                <option value="Delivered">Delivered</option>
                              </select>
                            ) : (
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${(item.status || 'Requested').toUpperCase().includes('REQUESTED') ? 'bg-slate-50 text-slate-400 border-slate-100' :
                                (item.status || '').toUpperCase().includes('ORDERED') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  (item.status || '').toUpperCase().includes('STOCK') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    (item.status || '').toUpperCase().includes('BACKORDERED') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                      (item.status || '').toUpperCase().includes('PENDING') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        (item.status || '').toUpperCase().includes('DELIVERED') ? 'bg-green-50 text-green-700 border-green-100' :
                                          'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                {item.status || 'Requested'}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Request Notes</label>
                            <textarea
                              value={item.notes}
                              onChange={(e) => updateListItemMetadata(item.id, item.status, e.target.value)}
                              disabled={false}
                              placeholder="Add memo for distributor..."
                              rows="2"
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-xs text-slate-500 disabled:opacity-50"
                            />
                          </div>

                          {(currentUser.type === 'admin' || item.adminNotes) && (
                            <div className="space-y-1.5 pt-2">
                              <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Admin Comments</label>
                              {currentUser.type === 'admin' ? (
                                <textarea
                                  value={item.adminNotes || ''}
                                  onChange={(e) => updateListItemMetadata(item.id, item.status, item.notes, e.target.value)}
                                  placeholder="Update status comments for customer..."
                                  rows="2"
                                  className="w-full px-5 py-4 bg-rose-50/30 border border-rose-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-xs text-slate-600"
                                />
                              ) : (
                                <div className="px-5 py-4 bg-rose-50/50 border border-rose-100 rounded-2xl font-medium text-xs text-rose-700">
                                  {item.adminNotes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-10 bg-white border-t border-slate-100 sticky bottom-0 z-10 shrink-0">
                <button
                  onClick={submitListUpdate}
                  className="w-full bg-[#1a1a1a] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all duration-300 shadow-xl shadow-slate-100 active:scale-[0.98]"
                >
                  {currentUser.type === 'admin' ? 'Update' : 'Submit/Update Request'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default WineDistributorApp;
