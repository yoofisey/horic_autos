const HoricData = (() => {
  const INVENTORY_KEY = 'horic_inventory';
  const ENQUIRIES_KEY = 'horic_enquiries';
  const SALES_KEY = 'horic_sales';

  const COST_ASSUMPTIONS = Object.freeze({
    monthlyKm: 2000,
    fuelPrice: { petrol: 16.5, diesel: 17.1, hybrid: 16.5, electric: 1.6 },
    consumption: {
      saloon_petrol: 9.5, saloon_diesel: 7, suv_petrol: 13, suv_diesel: 9.5,
      pickup_diesel: 11, hybrid: 5.5, electric_kwh: 18
    },
    maintenance: { base: 638, electricMul: 0.4, newCarMul: 0.6, suvMul: 1.25, cheapUsedMul: 1.15 },
    insurance: { sedan: 530, suv: 620, truck: 680, hatchback: 480, coupe: 560, van: 590 }
  });


  const DEFAULT_INVENTORY = [
    { id: 'v1', make: 'Toyota', model: 'Land Cruiser V8', year: 2022, price: 580000, condition: 'used', status: 'in_stock', body_type: 'suv', fuel: 'petrol', mileage: 42000, engine: '4.6L V8', transmission: 'automatic', color: 'White', description: 'The king of Ghanaian roads. Unmatched reliability and presence with full 4WD capability.', images: [], features: ['4WD', 'Leather Seats', 'Sunroof', 'Navigation', 'Bluetooth', 'Parking Sensors'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-01-15', updated_at: '2025-01-15', views: 245, enquiries: 12 },
    { id: 'v2', make: 'Toyota', model: 'Corolla Cross Hybrid', year: 2024, price: 195000, condition: 'new', status: 'in_stock', body_type: 'suv', fuel: 'hybrid', mileage: 0, engine: '1.8L Hybrid', transmission: 'automatic', color: 'Silver', description: 'The perfect blend of efficiency and practicality. Hybrid economy meets SUV versatility.', images: [], features: ['Hybrid Engine', 'Apple CarPlay', 'ADAS', 'Backup Camera', 'Cruise Control'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-01', updated_at: '2025-02-01', views: 189, enquiries: 8 },
    { id: 'v3', make: 'Hyundai', model: 'Tucson', year: 2023, price: 220000, condition: 'new', status: 'in_stock', body_type: 'suv', fuel: 'petrol', mileage: 0, engine: '2.0L MPI', transmission: 'automatic', color: 'Phantom Black', description: 'Bold design meets Korean reliability. Packed with tech and safety features.', images: [], features: ['Panoramic Sunroof', 'Wireless Charging', 'LED Headlights', 'Blind Spot Monitor', 'Smart Cruise'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-01-20', updated_at: '2025-01-20', views: 156, enquiries: 6 },
    { id: 'v4', make: 'Toyota', model: 'Hilux Revo', year: 2021, price: 310000, condition: 'used', status: 'in_stock', body_type: 'truck', fuel: 'diesel', mileage: 68000, engine: '2.8L Turbo Diesel', transmission: 'automatic', color: 'Graphite Grey', description: 'Built for Ghanaian terrain. Indestructible workhorse with modern comforts.', images: [], features: ['4WD', 'Turbo Diesel', 'Bed Liner', 'Tow Bar', 'Bluetooth'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-01-10', updated_at: '2025-01-10', views: 198, enquiries: 15 },
    { id: 'v5', make: 'Honda', model: 'Accord', year: 2020, price: 145000, condition: 'used', status: 'in_stock', body_type: 'sedan', fuel: 'petrol', mileage: 55000, engine: '1.5L Turbo', transmission: 'automatic', color: 'Platinum White', description: 'Executive sedan with Honda reliability. Smooth, efficient, and comfortable.', images: [], features: ['Turbo Engine', 'Leather Interior', 'Honda Sensing', 'Android Auto', 'Dual Zone AC'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-05', updated_at: '2025-02-05', views: 134, enquiries: 5 },
    { id: 'v6', make: 'Tesla', model: 'Model 3', year: 2023, price: 420000, condition: 'new', status: 'in_stock', body_type: 'sedan', fuel: 'electric', mileage: 0, engine: 'Electric Motor', transmission: 'automatic', color: 'Midnight Silver', description: 'The future of driving. Zero emissions, maximum performance, cutting-edge tech.', images: [], features: ['Autopilot', 'Full Self-Driving', 'Premium Interior', 'Glass Roof', '15" Touchscreen', 'OTA Updates'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-01-25', updated_at: '2025-01-25', views: 312, enquiries: 20 },
    { id: 'v7', make: 'Kia', model: 'Sportage', year: 2024, price: 210000, condition: 'new', status: 'in_stock', body_type: 'suv', fuel: 'petrol', mileage: 0, engine: '2.0L MPI', transmission: 'automatic', color: 'Gravity Grey', description: 'Award-winning design with a 5-year warranty. Style and substance combined.', images: [], features: ['5-Year Warranty', 'Dual Screens', 'LED DRLs', 'Wireless CarPlay', 'Heated Seats'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-10', updated_at: '2025-02-10', views: 167, enquiries: 9 },
    { id: 'v8', make: 'Nissan', model: 'Navara', year: 2022, price: 275000, condition: 'used', status: 'in_stock', body_type: 'truck', fuel: 'diesel', mileage: 38000, engine: '2.3L Twin Turbo Diesel', transmission: 'manual', color: 'Fuji White', description: 'Comfortable on road, capable off road. The pickup that doubles as a family car.', images: [], features: ['Twin Turbo', '4WD', 'Leather Seats', '360 Camera', 'Hill Descent Control'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-01-08', updated_at: '2025-01-08', views: 143, enquiries: 7 },
    { id: 'v9', make: 'Mercedes-Benz', model: 'C300', year: 2023, price: 385000, condition: 'used', status: 'in_stock', body_type: 'sedan', fuel: 'petrol', mileage: 22000, engine: '2.0L Turbo', transmission: 'automatic', color: 'Obsidian Black', description: 'German luxury at its finest. Impeccable build quality and refined performance.', images: [], features: ['AMG Line', 'MBUX System', 'Burmester Sound', 'Ambient Lighting', 'Keyless Go'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-15', updated_at: '2025-02-15', views: 278, enquiries: 18 },
    { id: 'v10', make: 'Toyota', model: 'Prado', year: 2024, price: 495000, condition: 'new', status: 'in_stock', body_type: 'suv', fuel: 'diesel', mileage: 0, engine: '2.8L Turbo Diesel', transmission: 'automatic', color: 'Precious White', description: 'The ultimate luxury SUV for African roads. Commanding presence, uncompromised comfort.', images: [], features: ['KDSS', 'Multi-Terrain Select', 'Crawl Control', 'JBL Audio', 'Moonroof', '360 Camera'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-20', updated_at: '2025-02-20', views: 201, enquiries: 14 },
    { id: 'v11', make: 'Honda', model: 'CR-V', year: 2023, price: 235000, condition: 'new', status: 'coming_soon', body_type: 'suv', fuel: 'petrol', mileage: 0, engine: '1.5L Turbo', transmission: 'automatic', color: 'Radiant Red', description: 'Versatile family SUV with Honda legendary reliability. Arriving soon.', images: [], features: ['Turbo Engine', 'Honda Sensing', '7 Seats', 'Panoramic Roof', 'Wireless Charging'], sold_price: null, sold_date: null, sold_to: null, created_at: '2025-02-25', updated_at: '2025-02-25', views: 89, enquiries: 4 },
    { id: 'v12', make: 'BMW', model: 'X5', year: 2022, price: 520000, condition: 'used', status: 'sold', body_type: 'suv', fuel: 'petrol', mileage: 31000, engine: '3.0L Turbo Inline-6', transmission: 'automatic', color: 'Alpine White', description: 'Sporty luxury SUV with BMW dynamics. Sold to a happy client.', images: [], features: ['xDrive', 'Harman Kardon', 'Gesture Control', 'Head-Up Display', 'Adaptive Suspension'], sold_price: 505000, sold_date: '2025-02-18', sold_to: 'Kwame M.', created_at: '2025-01-05', updated_at: '2025-02-18', views: 356, enquiries: 22 }
  ];

  const DEFAULT_ENQUIRIES = [
    { id: 'e1', vehicle_id: 'v6', customer_name: 'Ama Asante', customer_phone: '+233241234567', customer_email: 'ama@example.com', message: 'Is the Tesla Model 3 suitable for long-distance travel in Ghana? What is the charging infrastructure like?', status: 'unread', created_at: '2025-02-20' },
    { id: 'e2', vehicle_id: 'v1', customer_name: 'Kofi Mensah', customer_phone: '+233209876543', customer_email: 'kofi@example.com', message: 'Can you negotiate on the Land Cruiser? I am ready to pay cash.', status: 'read', created_at: '2025-02-18' },
    { id: 'e3', vehicle_id: 'v4', customer_name: 'Yaw Boateng', customer_phone: '+233551122334', customer_email: 'yaw@example.com', message: 'Do you accept trade-ins? I have a 2019 Corolla and want to upgrade to the Hilux.', status: 'unread', created_at: '2025-02-22' }
  ];

  function loadInventory() {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    saveInventory(DEFAULT_INVENTORY);
    return [...DEFAULT_INVENTORY];
  }

  function saveInventory(inventory) {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
  }

  function loadEnquiries() {
    try {
      const raw = localStorage.getItem(ENQUIRIES_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    saveEnquiries(DEFAULT_ENQUIRIES);
    return [...DEFAULT_ENQUIRIES];
  }

  function saveEnquiries(enquiries) {
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(enquiries));
  }

  function generateId(prefix = 'v') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatPrice(amount) {
    if (amount == null) return '—';
    return 'GHS ' + Number(amount).toLocaleString('en-US');
  }

  function estimateRunningCosts(car) {
    const body = (car.body_type || 'sedan').toLowerCase();
    const fuel = (car.fuel || 'petrol').toLowerCase();
    const isSuv = body === 'suv' || body === 'truck';
    const catKey = isSuv ? (fuel === 'diesel' ? 'suv_diesel' : 'suv_petrol') : (fuel === 'diesel' ? 'saloon_diesel' : 'saloon_petrol');
    if (fuel === 'electric') {
      const kwh = COST_ASSUMPTIONS.consumption.electric_kwh;
      var fuelCost = (COST_ASSUMPTIONS.monthlyKm / 100) * kwh * COST_ASSUMPTIONS.fuelPrice.electric;
    } else if (fuel === 'hybrid') {
      var fuelCost = (COST_ASSUMPTIONS.monthlyKm / 100) * COST_ASSUMPTIONS.consumption.hybrid * COST_ASSUMPTIONS.fuelPrice.hybrid;
    } else {
      var cons = COST_ASSUMPTIONS.consumption[catKey] || 10;
      var fuelCost = (COST_ASSUMPTIONS.monthlyKm / 100) * cons * (COST_ASSUMPTIONS.fuelPrice[fuel] || 16.5);
    }

    let maintMul = 1;
    if (fuel === 'electric') maintMul = COST_ASSUMPTIONS.maintenance.electricMul;
    else if (car.condition === 'new') maintMul = COST_ASSUMPTIONS.maintenance.newCarMul;
    if (isSuv) maintMul *= COST_ASSUMPTIONS.maintenance.suvMul;
    const maintenance = Math.round(COST_ASSUMPTIONS.maintenance.base * maintMul);

    const insKey = body === 'truck' ? 'truck' : body;
    const insAnnual = COST_ASSUMPTIONS.insurance[insKey] || COST_ASSUMPTIONS.insurance.sedan;
    const comprehensive = car.price * 0.035;
    const insurance = Math.round(Math.max(insAnnual, comprehensive) / 12);

    return {
      fuel: Math.round(fuelCost),
      maintenance,
      insurance,
      total: Math.round(fuelCost + maintenance + insurance)
    };
  }

  function addVehicle(car) {
    const inventory = loadInventory();
    const newCar = {
      id: generateId('v'),
      make: car.make || '',
      model: car.model || '',
      year: Number(car.year) || new Date().getFullYear(),
      price: Number(car.price) || 0,
      condition: car.condition || 'new',
      status: car.status || 'in_stock',
      body_type: car.body_type || 'sedan',
      fuel: car.fuel || 'petrol',
      mileage: Number(car.mileage) || 0,
      engine: car.engine || '',
      transmission: car.transmission || 'automatic',
      color: car.color || '',
      description: car.description || '',
      images: car.images || [],
      features: car.features || [],
      sold_price: null,
      sold_date: null,
      sold_to: null,
      created_at: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString().slice(0, 10),
      views: 0,
      enquiries: 0
    };
    inventory.unshift(newCar);
    saveInventory(inventory);
    return newCar;
  }

  function updateVehicle(id, updates) {
    const inventory = loadInventory();
    const idx = inventory.findIndex(c => c.id === id);
    if (idx === -1) return null;
    inventory[idx] = { ...inventory[idx], ...updates, updated_at: new Date().toISOString().slice(0, 10) };
    saveInventory(inventory);
    return inventory[idx];
  }

  function deleteVehicle(id) {
    const inventory = loadInventory().filter(c => c.id !== id);
    saveInventory(inventory);
  }

  function markAsSold(id, soldPrice, soldTo) {
    return updateVehicle(id, {
      status: 'sold',
      sold_price: Number(soldPrice),
      sold_date: new Date().toISOString().slice(0, 10),
      sold_to: soldTo || 'Client'
    });
  }

  function getVehicle(id) {
    return loadInventory().find(c => c.id === id) || null;
  }

  function incrementViews(id) {
    const inventory = loadInventory();
    const car = inventory.find(c => c.id === id);
    if (car) {
      car.views = (car.views || 0) + 1;
      saveInventory(inventory);
    }
  }

  function addEnquiry(enquiry) {
    const enquiries = loadEnquiries();
    const newEnq = {
      id: generateId('e'),
      vehicle_id: enquiry.vehicle_id || null,
      customer_name: enquiry.customer_name || 'Anonymous',
      customer_phone: enquiry.customer_phone || '',
      customer_email: enquiry.customer_email || '',
      message: enquiry.message || '',
      status: 'unread',
      created_at: new Date().toISOString().slice(0, 10)
    };
    enquiries.unshift(newEnq);
    saveEnquiries(enquiries);
    return newEnq;
  }

  function updateEnquiry(id, updates) {
    const enquiries = loadEnquiries();
    const idx = enquiries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    enquiries[idx] = { ...enquiries[idx], ...updates };
    saveEnquiries(enquiries);
    return enquiries[idx];
  }

  function deleteEnquiry(id) {
    const enquiries = loadEnquiries().filter(e => e.id !== id);
    saveEnquiries(enquiries);
  }

  function getStats() {
    const inv = loadInventory();
    const enq = loadEnquiries();
    const inStock = inv.filter(c => c.status === 'in_stock');
    const sold = inv.filter(c => c.status === 'sold');
    const comingSoon = inv.filter(c => c.status === 'coming_soon');
    const totalValue = inStock.reduce((s, c) => s + c.price, 0);
    const totalSoldValue = sold.reduce((s, c) => s + (c.sold_price || c.price), 0);
    const unreadEnquiries = enq.filter(e => e.status === 'unread').length;
    return {
      totalCars: inv.length,
      inStock: inStock.length,
      sold: sold.length,
      comingSoon: comingSoon.length,
      totalValue,
      totalSoldValue,
      totalEnquiries: enq.length,
      unreadEnquiries,
      avgPrice: inStock.length ? Math.round(totalValue / inStock.length) : 0
    };
  }

  function filterInventory({ search = '', make = '', model = '', body_type = '', fuel = '', condition = '', status = '', minPrice = 0, maxPrice = Infinity, minYear = 0, maxYear = Infinity, maxMileage = Infinity, sort = 'newest' } = {}) {
    let results = loadInventory();

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(c =>
        c.make.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.engine.toLowerCase().includes(q) ||
        (c.color && c.color.toLowerCase().includes(q))
      );
    }
    if (make) results = results.filter(c => c.make === make);
    if (model) results = results.filter(c => c.model === model);
    if (body_type) results = results.filter(c => c.body_type === body_type);
    if (fuel) results = results.filter(c => c.fuel === fuel);
    if (condition) results = results.filter(c => c.condition === condition);
    if (status) results = results.filter(c => c.status === status);
    results = results.filter(c => c.price >= minPrice && c.price <= maxPrice);
    results = results.filter(c => c.year >= minYear && c.year <= maxYear);
    results = results.filter(c => c.mileage <= maxMileage);

    switch (sort) {
      case 'price_asc': results.sort((a, b) => a.price - b.price); break;
      case 'price_desc': results.sort((a, b) => b.price - a.price); break;
      case 'year_desc': results.sort((a, b) => b.year - a.year); break;
      case 'year_asc': results.sort((a, b) => a.year - b.year); break;
      case 'mileage_asc': results.sort((a, b) => a.mileage - b.mileage); break;
      case 'newest': results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
      default: break;
    }

    return results;
  }

  const CAR_MAKES_MODELS = {
    'Acura': ['CDX','ILX','Integra','MDX','NSX','RDX','RL','RLX','RSX','TL','TLX','TSX','ZDX'],
    'Alfa Romeo': ['4C','8C Competizione','Giulia','Giulietta','GT','GTV','MITO','Stelvio','Tonale'],
    'Aston Martin': ['Cygnet','DB11','DB12','DB7','DB9','DBS','DBX','Lagonda','Rapide','Valhalla','Valkyrie','Vantage','Virage'],
    'Audi': ['100','200','50','80','90','A1','A2','A3','A4','A4 Allroad','A5','A6','A6 Allroad','A7','A8','e-tron','e-tron GT','Q2','Q3','Q3 Sportback','Q5','Q5 Sportback','Q6 e-tron','Q7','Q8','R8','RS3','RS4','RS5','RS6','RS7','RS e-tron GT','S3','S4','S5','S6','S7','S8','SQ5','SQ6','SQ7','SQ8','TT','TTS','V8'],
    'Bentley': ['Arnage','Azure','Bentayga','Continental GT','Continental GTC','Flying Spur','Mulsanne','Turbo R'],
    'BMW': ['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','8 Series','i3','i4','i5','i7','i8','iX','iX1','iX3','M2','M3','M4','M5','M8','X1','X2','X3','X4','X5','X5 M','X6','X6 M','X7','XM','Z3','Z4','Z8'],
    'Bugatti': ['Chiron','Divo','Veyron','Mistral'],
    'BYD': ['Atto 3','Dolphin','Han','M6','Qin Plus','Seal','Song Plus','Tang','e2','e3','e6','F3DM','S6'],
    'Cadillac': ['ATS','CT4','CT5','CT6','CTS','Coupe DeVille','DTS','ELR','Escalade','LYRIQ','SRX','STS','XLR','XT4','XT5','XT6','XTS'],
    'Chevrolet': ['Astro','Avalanche','Blazer','Bolt EUV','Bolt EV','Camaro','Caprice','Cavalier','Colorado','Corvette','Cruze','Equinox','Impala','Malibu','Monte Carlo','S-10','Silverado','Sonic','Spark','SS','Suburban','Tahoe','Trailblazer','Traverse','Trax','Uplander','Volt'],
    'Chrysler': ['200','300','300M','Aspen','Crossfire','LeBaron','New Yorker','Pacifica','PT Cruiser','Sebring','Town & Country','Voyager','Windsor'],
    'Citroen': ['Ami','Berlingo','C1','C2','C3','C3 Aircross','C4','C4 Cactus','C4 Picasso','C4 X','C5','C5 Aircross','C5 X','C6','C8','DS3','DS4','DS5','Jumpy','Xantia','Xsara','ZX'],
    'Cupra': ['Born','Formentor','Leon','Tavascan','Terramar'],
    'Dacia': ['Duster','Jogger','Logan','Logan MCV','Sandero','Sandero Stepway','Spring'],
    'Daewoo': ['Espero','Evanda','Kalos','Lacetti','Leganza','Magnus','Matiz','Nubira','Rezzo','Tacuma'],
    'Daihatsu': ['Bego','Charade','Copen','Cuore','Feroza','Materia','Mira','Move','Sirion','Terios','Trevis','YRV'],
    'DFSK': ['Glory 500','Glory 580','K05','F5','Seres 3','Seres 5'],
    'Dodge': ['Avenger','Caliber','Challenger','Charger','Charger Daytona','Dakota','Dart','Durango','Hornet','Intrepid','Journey','Magnum','Neon','Nitro','Power Wagon','Ram 1500','Ram Van','Stratus','Viper'],
    'Ferrari': ['296 GTB','296 GTS','360','399','456','458 Italia','488','512 BB','550 Maranello','575M Maranello','599','612 Scaglietti','812 Competizione','California','Enzo','F12berlinetta','F355','F40','F430','F50','F8 Tributo','FF','LaFerrari','Monza','Purosangue','Roma','SF90 Stradale','SF90 Spider','Superamerica'],
    'Fiat': ['124 Spider','126','127','128','130','131','500','500e','500X','500L','600','Albea','Barchetta','Brava','Bravo','Cinquecento','Coupé','Croma','Doblo','Ducato','Fiorino','Freemont','Grande Punto','Idea','Linea','Marea','Multipla','Palio','Panda','Punto','Punto Evo','Regata','Ritmo','Sedici','Stilo','Strada','Tempra','Tipo','Ulysse','Uno','X1/9'],
    'Ford': ['Aerostar','B-Max','Bronco','Bronco Sport','C-Max','Capri','Courier','Crown Victoria','EcoSport','Edge','Escape','Excursion','Expedition','Explorer','F-150','F-150 Lightning','F-250','F-350','Fairlane','Falcon','Fiesta','Focus','Freestar','Freestyle','Galaxy','Granada','GT','Ka','Kuga','Landau','Maverick','Mondeo','Mustang','Mustang Mach-E','Orion','Pinto','Probe','Ranger','S-Max','Sierra','Taunus','Territory','Thunderbird','Tourneo Connect','Transit','Windstar'],
    'Genesis': ['Electrified G80','Electrified GV70','G70','G80','G90','GV60','GV70','GV80'],
    'GMC': ['Acadia','Canyon','Envoy','Hummer EV','Jimmy','Safari','Sierra','Syclone','Terrain','Typhoon','Vandura','Yukon'],
    'Honda': ['Accord','Accord Crosstour','Acty','Beat','Civic','Civic CRX','Civic del Sol','CR-V','CR-Z','Crosstour','Element','FCX Clarity','Fit','HR-V','Insight','Integra','Jazz','Legend','Logo','N-One','N-Van','N-WGN','Odyssey','Passport','Pilot','Prelude','Prologue','Ridgeline','S2000','Shuttle','Stream','ZR-V'],
    'Hummer': ['H1','H2','H3','H3T'],
    'Hyundai': ['Accent','Atos','Azera','Bayon','Casper','Elantra','Entourage','Excel','Genesis','Getz','Grand Santa Fe','Ioniq','Ioniq 5','Ioniq 5 N','Ioniq 6','Ioniq 9','i10','i20','i30','i40','Kona','Kona Electric','Kona N','LaVerna','Matrix','Palisade','Santa Cruz','Santa Fe','Sonata','Starex','Tiburon','Tucson','Tucson Hybrid','Tuscani','Veloster','Venue','Veracruz','XG'],
    'Infiniti': ['EX','FX','G','I','J','M','Q30','Q40','Q45','Q50','Q60','Q70','QX30','QX4','QX50','QX55','QX56','QX60','QX70','QX80'],
    'Isuzu': ['Ascender','Axiom','D-Max','F-Series','Fuego','Impulse','i-Series','Oasis','Oasis','Pick Up','Rodeo','Sport XC','Trooper','VehiCROSS'],
    'Jaguar': ['D-Type','E-PACE','E-Type','F-PACE','F-Type','I-PACE','Mark 1','Mark 2','S-Type','X-Type','XE','XF','XFR','XJ','XK','XKR'],
    'Jeep': ['Avenger','Cherokee','CJ','Comanche','Commander','Compass','Gladiator','Grand Cherokee','Grand Cherokee L','Grand Wagoneer','Liberty','Patriot','Renegade','Wagoneer','Wrangler'],
    'Kia': ['Amanti','Bongo','Borrego','Carens','Carnival','Ceed','Cerato','Cadenza','EV3','EV5','EV6','EV6 GT','EV9','Forte','K3','K5','K900','Magentis','Mohave','Niro','Niro Hybrid','Niro EV','Opirus','Optima','Picanto','Pride','Ray','Rio','Roadster','Rondo','Sedona','Seltos','Shuma','Sorento','Soul','Sportage','Stinger','Stonic','Venga'],
    'Lamborghini': ['Aventador','Countach','Diablo','Huracan','Jalpa','LM002','Murciélago','Revuelto','Urus'],
    'Land Rover': ['Defender','Discovery','Discovery Sport','Freelander','Range Rover','Range Rover Evoque','Range Rover Sport','Range Rover Velar','Series I','Series II','Series III'],
    'Lexus': ['CT','ES','ES Hybrid','GS','GX','HS','IS','IS F','LBX','LC','LFA','LS','LX','NX','NX Hybrid','RC','RC F','RX','RX Hybrid','RZ','SC','UX','UX Hybrid'],
    'Lincoln': ['Aviator','Blackwood','Continental','Corsair','LS','Mark LT','Mark VII','Mark VIII','MKT','MKZ','Nautilus','Navigator','Town Car','Zephyr'],
    'Lotus': ['Eletre','Emeya','Emira','Esprit','Europa','Evija','Elan','Elise','Excel','Exige','Seven'],
    'Mahindra': ['Bolero','KUV100','Marazzo','NuvoSport','Quanto','Scorpio','Scorpio N','Thar','Thar Roxx','Verito','XUV300','XUV400','XUV500','XUV700','Xylo'],
    'Maserati': ['3500 GT','Bora','Ghibli','GranSport','GranTurismo','GranCabrio','Grecale','Indy','Levante','Merak','Quattroporte','Shamal','Spyder','Trofeo'],
    'Maybach': ['57','62','Landaulet','S500','S580','S600','S650','GLS 600'],
    'Mazda': ['2','3','323','5','6','626','929','B-Series','CX-3','CX-30','CX-5','CX-50','CX-60','CX-7','CX-8','CX-80','CX-9','CX-90','MPV','MX-30','MX-5 Miata','MX-6','MX-3','Millenia','Millenia','Protege','RX-7','RX-8','Tribute','Villager'],
    'McLaren': ['570S','600LT','620R','650S','675LT','720S','750S','765LT','Artura','Elva','GT','MP4-12C','P1','Senna','Speedtail','W1'],
    'Mercedes-Benz': ['190','A-Class','AMG GT','B-Class','C-Class','Citan','CLE','CLA','CLS','E-Class','EQA','EQB','EQC','EQE','EQE SUV','EQS','EQS SUV','EQT','GLA','GLB','GLC','GLE','GLK','GLS','GT 4-Door','M-Class','Maybach S-Class','Maybach GLS','R-Class','S-Class','SL','SLC','SLK','SLR McLaren','Sprinter','V-Class','Vaneo','Viano','Vito','W123','W124','W201'],
    'MG': ['3','5','6','750','HS','MG4','TF','ZS','Cyberster','Comet EV','MGA','MGB','MGF','Montego','Windsor'],
    'Mini': ['Clubman','Countryman','Cooper','Cooper Electric','Cooper S','John Cooper Works','Roadster','Coupe','Paceman'],
    'Mitsubishi': ['3000GT','ASX','Carisma','Colt','Delica','Diamante','Eclipse','Eclipse Cross','Galant','Grandis','i-MiEV','L200','Lancer','Mirage','Montero','Outlander','Outlander PHEV','Pajero','Pajero Sport','Pajero iO','RVR','Sigma','Space Gear','Space Runner','Space Star'],
    'Nissan': ['100NX','200SX','240SX','280ZX','300ZX','350Z','370Z','Almera','Altima','Ariya','Armada','Avenir','Bluebird','Caravan','Cube','Frontier','GT-R','Juke','Kicks','King Cab','Leaf','Maxima','Micra','Murano','Navara','Note','NV200','Pathfinder','Patrol','Pickup','Prairie','Presage','Primera','Pulsar','Qashqai','Quest','Rogue','Rogue Sport','Sentra','Silvia','Skyline','Stagea','Sunny','Teana','Terrano','Titan','Versa','X-Trail','Xterra','Z'],
    'Oldsmobile': ['88','98','Achieva','Alero','Aurora','Bravada','Ciera','Cutlass','Intrigue','Silhouette','Toronado'],
    'Opel': ['Adam','Agila','Ampera','Antara','Astra','Calibra','Cascada','Combo','Commodore','Corsa','Crossland','Frontera','GT','Insignia','Kadett','Manta','Meriva','Mokka','Movano','Omega','Sintra','Speedster','Tigra','Vivaro','Zafira'],
    'Peugeot': ['106','107','108','205','206','207','208','2008','305','306','307','308','3008','405','406','407','408','505','508','5008','605','607','806','807','Bipper','Expert','Partner','Rifter','Traveller'],
    'Pontiac': ['Aztek','Bonneville','Fiero','Firebird','G3','G5','G6','G8','Grand Am','Grand Prix','GTO','LeMans','Montana','Solstice','Sunbird','Sunfire','Torrent','Trans Sport','Vibe'],
    'Porsche': ['356','550 Spyder','718 Cayman','718 Boxster','911','911 Turbo','914','918 Spyder','924','928','944','959','968','Carrera GT','Cayenne','Cayenne Coupe','Macan','Macan Electric','Panamera','Taycan','Taycan Cross Turismo'],
    'Ram': ['1500','1500 Classic','2500','3500','ProMaster','ProMaster City','Rampage'],
    'Renault': ['19','21','25','Alpine A110','Arkana','Austral','Avantime','Captur','Clio','Clio V6','Duster','Espace','Fluence','Fuego','Grand Scenic','Kadjar','Kangoo','Kiger','Koleos','Laguna','Latitude','Loxia','Megane','Modus','Safrane','Scenic','Scenic RXT','Symbioz','Twingo','Twizy','Vel Satis','Wind','Zoe'],
    'Rolls-Royce': ['Armour','Black Badge Dawn','Black Badge Ghost','Black Badge Wraith','Camargue','Corniche','Cullinan','Dawn','Ghost','Phantom','Silver Cloud','Silver Ghost','Silver Shadow','Silver Spirit','Silver Wraith','Spectre'],
    'Rover': ['100','200','25','400','45','600','75','800','CityRover','Metro','Mini','Montego','Sterling'],
    'Saab': ['9-2X','9-3','9-3X','9-4X','9-5','9-7X','900','9000','Sonett'],
    'Saturn': ['Astra','Aura','Ion','L-Series','Outlook','Sky','Vue'],
    'Scion': ['FR-S','iA','iM','iQ','tC','xA','xB','xD'],
    'SEAT': ['Alhambra','Altea','Arona','Ateca','Exeo','Ibiza','Inca','Leon','Mii','Tarraco','Toledo'],
    'Skoda': ['Citigo','Enyaq','Enyaq Coupe','Fabia','Favorit','Felicia','Forman','Karoq','Kodiaq','Kushaq','Octavia','Pick-up','Praktik','Rapid','Roomster','Scala','Superb','Tourer','Yeti'],
    'Smart': ['#1','#3','ForFour','ForTwo','Roadster'],
    'SsangYong': ['Actyon','Korando','Kyron','Musso','Rexton','Rodius','Tivoli','Torres','XLV'],
    'Subaru': ['Ascent','Baja','BRZ','Domingo','Exiga','Forester','Impreza','Justy','Leone','Legacy','Libero','Outback','Pleiades','R1','R2','Solterra','Stereo','SVX','Tribeca','Vivio','WRX','XT'],
    'Suzuki': ['Alto','Baleno','Celerio','Cultus','Dzire','Ertiga','Forenza','Grand Vitara','Ignis','Jimny','Kizashi','Liana','Reno','S-Presso','Sidekick','Splash','Swift','Swift Dzire','SX4','Vitara','Wagon R','X-90','XL-7','XL7'],
    'Tesla': ['Cybertruck','Model 3','Model S','Model X','Model Y','Roadster'],
    'Toyota': ['4Runner','86','Alphard','Aqua','Avensis','Aygo','Aygo X','bZ3','bZ4C','bZ4X','Camry','Carina','Celsior','Corolla','Corolla Axio','Corolla Cross','Corolla Cross Hybrid','Corolla Fielder','Corolla Levin','Corolla Spacio','Corolla Touring','Crown','Crown Kluger','Estima','FJ Cruiser','Fortuner','GR86','Grand Highlander','Harrier','HiAce','Highlander','Hilux','Hilux Revo','Innova','Ipsum','Land Cruiser','Land Cruiser 300','Land Cruiser 70','Land Cruiser 80','Land Cruiser 100','Land Cruiser 200','Land Cruiser Prado','Land Cruiser V8','Mark X','Matrix','Mirai','MR2','Northtuna','Paseo','Passo','Phaeton','Premio','Prius','Prius Alpha','Prius c','Prius v','Proace','RAV4','Raize','Rukus','Rush','Sequoia','Sienna','Sienta','Soarer','Starlet','Supra','Tacoma','Tercel','Tundra','Urban Cruiser','Vellfire','Venza','Vitz','Wish','Yaris','Yaris Cross','Yaris Verso'],
    'Vauxhall': ['Adam','Agila','Ampera','Astra','Calibra','Combo','Corsa','Crossland','Frontera','GT','Insignia','Kadett','Manta','Meriva','Mokka','Movano','Omega','Sintra','Speedster','Tigra','Vivaro','Zafira'],
    'Volkswagen': ['Amarok','Arteon','Atlas','Atlas Cross Sport','Beetle','Caddy','CC','Corrado','Dasher','Eos','Golf','Golf GTI','Golf Plus','ID.3','ID.4','ID.5','ID.7','Jetta','Karmann Ghia','Lupo','New Beetle','Passat','Phaeton','Polo','Quantum','Santana','Scirocco','Sharan','Taos','T-Cross','Tiguan','Tiguan Allspace','Touareg','Touran','T-Roc','Transporter','Up','Vento'],
    'Volvo': ['240','340','360','440','460','480','66','740','760','780','850','940','960','C30','C40','C70','EC40','EX30','EX40','EX90','S40','S60','S70','S80','S90','V40','V50','V60','V70','V90','XC40','XC60','XC70','XC90'],
    'Wuling': ['Almaz','Air EV','Bingo','Confero','Cortez','Formo','Hongguang Mini EV','Starlight','Victory'],
    'Zeekr': ['001','007','009','Mix','X'],
    'Zotye': ['2008','360','5008','SR9','T600','T700','T800','Z100']
  };

  return {
    COST_ASSUMPTIONS, DEFAULT_INVENTORY, CAR_MAKES_MODELS,
    loadInventory, saveInventory, loadEnquiries, saveEnquiries,
    generateId, formatPrice, estimateRunningCosts,
    addVehicle, updateVehicle, deleteVehicle, markAsSold, getVehicle, incrementViews,
    addEnquiry, updateEnquiry, deleteEnquiry,
    getStats, filterInventory
  };
})();
