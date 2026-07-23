const HoricData = (() => {
  const COST_ASSUMPTIONS = Object.freeze({
    monthlyKm: 2000,
    fuelPrice: { petrol: 14.50, diesel: 16.14, hybrid: 14.50, electric: 1.97 },
    consumption: {
      saloon_petrol: 9.5, saloon_diesel: 7, suv_petrol: 13, suv_diesel: 9.5,
      pickup_diesel: 11, hybrid: 5.5, electric_kwh: 18
    },
    maintenance: { base: 480, electricMul: 0.35, newCarMul: 0.55, suvMul: 1.25, cheapUsedMul: 1.15 },
    insurance: { thirdPartyAnnual: 557, comprehensiveRate: 0.06 }
  });

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
      var fuelCost = (COST_ASSUMPTIONS.monthlyKm / 100) * COST_ASSUMPTIONS.consumption.electric_kwh * COST_ASSUMPTIONS.fuelPrice.electric;
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

    const insAnnual = Math.max(COST_ASSUMPTIONS.insurance.thirdPartyAnnual, car.price * COST_ASSUMPTIONS.insurance.comprehensiveRate);
    const insurance = Math.round(insAnnual / 12);

    return {
      fuel: Math.round(fuelCost),
      maintenance,
      insurance,
      total: Math.round(fuelCost + maintenance + insurance)
    };
  }

  function filterInventory(vehicles, { search = '', make = '', model = '', body_type = '', fuel = '', condition = '', status = '', minPrice = 0, maxPrice = Infinity, minYear = 0, maxYear = Infinity, maxMileage = Infinity, sort = 'newest' } = {}) {
    let results = [...vehicles];

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(c =>
        c.make.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.engine && c.engine.toLowerCase().includes(q)) ||
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
    results = results.filter(c => (c.mileage || 0) <= maxMileage);

    switch (sort) {
      case 'price_asc': results.sort((a, b) => a.price - b.price); break;
      case 'price_desc': results.sort((a, b) => b.price - a.price); break;
      case 'year_desc': results.sort((a, b) => b.year - a.year); break;
      case 'year_asc': results.sort((a, b) => a.year - b.year); break;
      case 'mileage_asc': results.sort((a, b) => (a.mileage || 0) - (b.mileage || 0)); break;
      case 'newest': results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
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
    'Isuzu': ['Ascender','Axiom','D-Max','F-Series','Fuego','Impulse','i-Series','Oasis','Pick Up','Rodeo','Sport XC','Trooper','VehiCROSS'],
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
    'Mazda': ['2','3','323','5','6','626','929','B-Series','CX-3','CX-30','CX-5','CX-50','CX-60','CX-7','CX-8','CX-80','CX-9','CX-90','MPV','MX-30','MX-5 Miata','MX-6','MX-3','Millenia','Protege','RX-7','RX-8','Tribute','Villager'],
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
    COST_ASSUMPTIONS, CAR_MAKES_MODELS,
    formatPrice, estimateRunningCosts, filterInventory
  };
})();