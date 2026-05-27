/* FFP Provider Experiences Loader — v3
   v3 changes (Grant's feedback):
   - Added "Experience type" field back with 6 clear, distinct options:
     Training camp / Competition trip / Spectator trip / Wellness retreat /
     Adventure trip / Active getaway. Helper text clarifies the choice.
     Saved to existing exp_type column.
   - Picker functions exposed as window.FFPPicker for events/deals loaders to reuse.

   v2: Activity picker + Country/City dropdowns + textareas + removed Format field.
   v1: Initial wiring.
*/
(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════
  // FFP_CITIES — 58 countries, 541 cities. UAE first, then alphabetical by region.
  // ════════════════════════════════════════════════════════════════════════
  var FFP_CITIES = {
    'United Arab Emirates': ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Al Ain", "Umm Al Quwain"],
    'Saudi Arabia': ["Riyadh", "Jeddah", "NEOM", "AlUla", "Medina", "Mecca", "Dammam", "Khobar"],
    'Qatar': ["Doha", "Lusail", "Al Wakrah", "Al Khor"],
    'Oman': ["Muscat", "Salalah", "Nizwa", "Sur", "Khasab"],
    'Bahrain': ["Manama", "Riffa", "Muharraq"]
  };
  /* Cities data continues below — injected for compactness */
  Object.assign(FFP_CITIES, {
    'Kuwait': ["Kuwait City", "Hawalli", "Salmiya"],
    'Lebanon': ["Beirut", "Byblos", "Tripoli", "Sidon", "Baalbek"],
    'Jordan': ["Amman", "Petra", "Aqaba", "Wadi Rum", "Dead Sea", "Jerash"],
    'Israel': ["Tel Aviv", "Jerusalem", "Haifa", "Eilat", "Nazareth", "Tiberias"],
    'United Kingdom': ["London", "Manchester", "Edinburgh", "Glasgow", "Liverpool", "Birmingham", "Bristol", "Leeds", "Cardiff", "Belfast", "Newcastle", "Sheffield", "Brighton", "Oxford", "Cambridge", "Bath", "York", "Aberdeen"],
    'France': ["Paris", "Nice", "Lyon", "Marseille", "Bordeaux", "Cannes", "Toulouse", "Strasbourg", "Montpellier", "Lille", "Nantes", "Saint-Tropez", "Biarritz", "Avignon", "Aix-en-Provence", "Chamonix"],
    'Spain': ["Barcelona", "Madrid", "Valencia", "Seville", "Malaga", "Bilbao", "Ibiza", "Mallorca", "Granada", "Marbella", "San Sebastian", "Tenerife", "Gran Canaria", "Cordoba", "Salamanca"],
    'Italy': ["Rome", "Milan", "Venice", "Florence", "Naples", "Turin", "Bologna", "Verona", "Sicily", "Palermo", "Genoa", "Pisa", "Amalfi", "Cinque Terre", "Sardinia", "Lake Como", "Capri", "Positano"],
    'Germany': ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Dresden", "Leipzig", "Heidelberg", "Nuremberg", "Bremen", "Hannover", "Baden-Baden"],
    'Netherlands': ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Maastricht", "Haarlem", "Delft", "Leiden"],
    'Portugal': ["Lisbon", "Porto", "Faro", "Madeira", "Funchal", "Coimbra", "Braga", "Cascais", "Sintra", "Albufeira", "Lagos", "Azores"],
    'Greece': ["Athens", "Santorini", "Mykonos", "Crete", "Thessaloniki", "Rhodes", "Corfu", "Naxos", "Paros", "Zakynthos", "Kos", "Patras", "Skiathos"],
    'Switzerland': ["Zurich", "Geneva", "Bern", "Lausanne", "Lucerne", "Basel", "Zermatt", "Interlaken", "St. Moritz", "Davos", "Lugano", "Montreux"],
    'Austria': ["Vienna", "Salzburg", "Innsbruck", "Graz", "Linz", "Hallstatt", "Klagenfurt", "Bregenz", "Kitzbühel"],
    'Belgium': ["Brussels", "Bruges", "Antwerp", "Ghent", "Liège", "Leuven", "Mechelen", "Namur"],
    'Czech Republic': ["Prague", "Brno", "Ostrava", "Karlovy Vary", "Cesky Krumlov", "Plzen", "Olomouc", "Liberec"],
    'Denmark': ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Helsingor", "Roskilde"],
    'Finland': ["Helsinki", "Rovaniemi", "Tampere", "Turku", "Oulu", "Lapland", "Espoo", "Vantaa"],
    'Hungary': ["Budapest", "Debrecen", "Szeged", "Pecs", "Miskolc", "Gyor", "Eger"],
    'Iceland': ["Reykjavik", "Akureyri", "Vik", "Hofn", "Selfoss", "Keflavik", "Husavik"],
    'Ireland': ["Dublin", "Galway", "Cork", "Limerick", "Killarney", "Belfast", "Kilkenny", "Waterford"],
    'Norway': ["Oslo", "Bergen", "Tromso", "Stavanger", "Trondheim", "Lofoten", "Geiranger", "Alesund"],
    'Poland': ["Warsaw", "Krakow", "Gdansk", "Wroclaw", "Poznan", "Lodz", "Zakopane", "Lublin"],
    'Sweden': ["Stockholm", "Gothenburg", "Malmo", "Uppsala", "Lund", "Vasteras", "Lapland", "Kiruna"],
    'Russia': ["Moscow", "Saint Petersburg", "Sochi", "Kazan", "Novosibirsk", "Yekaterinburg", "Vladivostok"],
    'United States': ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin", "San Francisco", "Seattle", "Denver", "Washington DC", "Boston", "Miami", "Las Vegas", "Portland", "Atlanta", "Nashville", "New Orleans", "Honolulu", "Aspen", "Park City"],
    'Canada': ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City", "Winnipeg", "Halifax", "Victoria", "Banff", "Whistler", "Mont-Tremblant", "Niagara Falls"],
    'Mexico': ["Mexico City", "Cancun", "Tulum", "Playa del Carmen", "Cabo San Lucas", "Puerto Vallarta", "Oaxaca", "Guadalajara", "Merida", "Cozumel", "Isla Mujeres"],
    'Costa Rica': ["San Jose", "Manuel Antonio", "Tamarindo", "La Fortuna", "Monteverde", "Puerto Viejo"],
    'Brazil': ["Rio de Janeiro", "Sao Paulo", "Salvador", "Florianopolis", "Brasilia", "Fortaleza", "Recife", "Manaus", "Iguazu Falls", "Buzios"],
    'Argentina': ["Buenos Aires", "Mendoza", "Bariloche", "Cordoba", "Salta", "El Calafate", "Ushuaia", "Iguazu"],
    'Chile': ["Santiago", "Valparaiso", "Atacama", "Patagonia", "Easter Island", "Pucon", "Punta Arenas"],
    'Japan': ["Tokyo", "Kyoto", "Osaka", "Yokohama", "Sapporo", "Hiroshima", "Nagoya", "Kobe", "Fukuoka", "Sendai", "Nara", "Nikko", "Hakone", "Okinawa", "Niseko", "Kanazawa", "Takayama"],
    'South Korea': ["Seoul", "Busan", "Incheon", "Jeju", "Daegu", "Daejeon", "Gwangju", "Suwon", "Gyeongju"],
    'China': ["Shanghai", "Beijing", "Hong Kong", "Shenzhen", "Guangzhou", "Chengdu", "Xi'an", "Hangzhou", "Macau", "Suzhou", "Sanya", "Lhasa", "Chongqing"],
    'Taiwan': ["Taipei", "Kaohsiung", "Taichung", "Tainan", "Hualien", "Taroko"],
    'Singapore': ["Singapore"],
    'Thailand': ["Bangkok", "Phuket", "Chiang Mai", "Koh Samui", "Krabi", "Pattaya", "Hua Hin", "Koh Phi Phi", "Koh Tao", "Chiang Rai"],
    'Vietnam': ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hoi An", "Nha Trang", "Hue", "Halong Bay", "Phu Quoc", "Sapa", "Dalat"],
    'Indonesia': ["Bali", "Jakarta", "Yogyakarta", "Lombok", "Surabaya", "Bandung", "Komodo", "Gili Islands", "Ubud", "Seminyak"],
    'Malaysia': ["Kuala Lumpur", "Penang", "Langkawi", "Johor Bahru", "Malacca", "Kota Kinabalu", "Kuching", "Ipoh", "Borneo"],
    'Philippines': ["Manila", "Cebu", "Boracay", "Palawan", "Davao", "Bohol", "Siargao", "El Nido", "Coron"],
    'India': ["Mumbai", "New Delhi", "Bangalore", "Goa", "Jaipur", "Kolkata", "Chennai", "Hyderabad", "Pune", "Agra", "Udaipur", "Varanasi", "Kerala", "Rishikesh", "Darjeeling"],
    'Maldives': ["Male", "Hulhumale", "Maafushi"],
    'Sri Lanka': ["Colombo", "Galle", "Kandy", "Negombo", "Nuwara Eliya", "Ella", "Mirissa", "Anuradhapura"],
    'Australia': ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Hobart", "Darwin", "Cairns", "Byron Bay", "Newcastle", "Wollongong", "Sunshine Coast"],
    'New Zealand': ["Auckland", "Wellington", "Christchurch", "Queenstown", "Hamilton", "Tauranga", "Dunedin", "Rotorua", "Napier", "Nelson"],
    'Egypt': ["Cairo", "Sharm El Sheikh", "Hurghada", "Luxor", "Aswan", "Alexandria", "Dahab", "Marsa Alam"],
    'Morocco': ["Marrakech", "Casablanca", "Fez", "Tangier", "Rabat", "Chefchaouen", "Essaouira", "Agadir", "Meknes"],
    'South Africa': ["Cape Town", "Johannesburg", "Durban", "Port Elizabeth", "Pretoria", "Stellenbosch", "Knysna", "Hermanus", "Plettenberg Bay"],
    'Kenya': ["Nairobi", "Mombasa", "Maasai Mara", "Kisumu", "Nakuru", "Diani Beach", "Lamu"],
    'Tanzania': ["Zanzibar", "Dar es Salaam", "Arusha", "Serengeti", "Stone Town", "Kilimanjaro"],
    'Turkey': ["Istanbul", "Bodrum", "Antalya", "Cappadocia", "Izmir", "Marmaris", "Pamukkale", "Ankara", "Fethiye", "**58 countries**", "**541 cities**", "**8 regions:** Middle East", "Europe", "North America", "South America", "Asia", "Oceania", "Africa", "Other", "`ffp-member-dashboard-v3.html` - Add City modal in Passport panel", "Future: Travel wishlist", "journey tracking", "city autocomplete fields", "map pins"]
  });

  var FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'Professional'];

  // Six clear experience types — replaces the old vague "Format" field
  var EXPERIENCE_TYPES = [
    'Training camp',
    'Competition trip',
    'Spectator trip',
    'Wellness retreat',
    'Adventure trip',
    'Active getaway'
  ];

  // Cache for activity_types fetched once per session
  window.FFP_ACTIVITIES_CACHE = window.FFP_ACTIVITIES_CACHE || null;

  // ════════════════════════════════════════════════════════════════════════
  // Utilities
  // ════════════════════════════════════════════════════════════════════════
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Experiences]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }
  function escHtml(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function arrFromText(s) {
    if (!s) return [];
    return String(s).split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
  }
  function textFromArr(a) {
    if (!a || !a.length) return null;
    return a.filter(function (x) { return x && String(x).trim(); }).join('\n') || null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // CSS injection
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('ffp-provider-experiences-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-experiences-css';
    css.textContent = [
      // FFP rule: no native scrollbars
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '#panel-experiences{overflow-x:hidden;}',

      // Native select styling — thin chevron (FFP brand)
      'select.select, select.input, .modal select, .modal-body select {' +
        'appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;background-position:right 12px center;background-size:16px;' +
        'padding-right:36px;color-scheme:dark;}',
      '.modal select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      'input.input[type="date"]{color-scheme:dark;}',

      // Picker button (replaces the native select inside the experience modal)
      '.ffp-picker-btn{' +
        'width:100%;display:flex;align-items:center;justify-content:space-between;' +
        'background:#0a1825;border:1px solid #1a2f44;border-radius:10px;' +
        'padding:11px 14px;color:#e8eef4;font-size:14px;font-family:inherit;cursor:pointer;' +
        'text-align:left;}',
      '.ffp-picker-btn:hover{border-color:#2a4564;}',
      '.ffp-picker-btn.placeholder{color:#6c7a8b;}',
      '.ffp-picker-btn .caret{flex-shrink:0;margin-left:10px;color:#8a99a8;}',
      '.ffp-picker-btn .picked{display:flex;flex-direction:column;line-height:1.3;gap:1px;overflow:hidden;}',
      '.ffp-picker-btn .picked .name{color:#e8eef4;font-weight:500;}',
      '.ffp-picker-btn .picked .group{color:#8a99a8;font-size:11px;}',
      '.ffp-picker-btn[disabled]{opacity:0.5;cursor:not-allowed;}',

      // Picker overlay (sits ABOVE the experience modal)
      '.ffp-picker-overlay{' +
        'position:fixed;inset:0;background:rgba(0,8,20,0.75);z-index:100000;' +
        'display:flex;align-items:center;justify-content:center;padding:20px;' +
        'opacity:0;transition:opacity 150ms ease;}',
      '.ffp-picker-overlay.open{opacity:1;}',
      '.ffp-picker-modal{' +
        'background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;' +
        'width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;' +
        'box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;}',
      '.ffp-picker-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;}',
      '.ffp-picker-title{color:#e8eef4;font-size:16px;font-weight:600;}',
      '.ffp-picker-close{background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;padding:0 4px;}',
      '.ffp-picker-close:hover{color:#e8eef4;}',
      '.ffp-picker-search{padding:14px 20px;border-bottom:1px solid #1a2f44;}',
      '.ffp-picker-search input{' +
        'width:100%;background:#0a1825;border:1px solid #1a2f44;border-radius:10px;' +
        'padding:10px 14px;color:#e8eef4;font-size:14px;font-family:inherit;outline:none;}',
      '.ffp-picker-search input:focus{border-color:#2ba8e0;}',
      '.ffp-picker-list{flex:1;overflow-y:auto;padding:8px 0;}',
      '.ffp-picker-group-hdr{padding:10px 20px 6px;color:#8a99a8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}',
      '.ffp-picker-item{padding:11px 20px;color:#e8eef4;font-size:14px;cursor:pointer;}',
      '.ffp-picker-item:hover{background:rgba(43,168,224,0.08);}',
      '.ffp-picker-item.selected{background:rgba(43,168,224,0.15);color:#2ba8e0;font-weight:500;}',
      '.ffp-picker-empty{padding:30px 20px;text-align:center;color:#6c7a8b;font-size:14px;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Fetch + cache activity_types
  // ════════════════════════════════════════════════════════════════════════
  async function getActivities() {
    if (window.FFP_ACTIVITIES_CACHE && window.FFP_ACTIVITIES_CACHE.length) {
      return window.FFP_ACTIVITIES_CACHE;
    }
    var res = await window.supabase
      .from('activity_types')
      .select('slug, name, category')
      .eq('active', true)
      .order('sort_order');
    if (res.error) {
      console.error('[FFP Experiences] fetch activities:', res.error);
      toast('Could not load activities', 'error');
      return [];
    }
    window.FFP_ACTIVITIES_CACHE = res.data || [];
    return window.FFP_ACTIVITIES_CACHE;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Generic picker overlay — used for activities, countries, cities
  // ════════════════════════════════════════════════════════════════════════
  function openPicker(opts) {
    // opts: { title, items: [{name, label?, group?}], currentValue, placeholder, onSelect, groupBy }
    closePicker();
    var overlay = document.createElement('div');
    overlay.className = 'ffp-picker-overlay';
    overlay.id = 'ffp-picker-overlay';
    overlay.innerHTML =
      '<div class="ffp-picker-modal">' +
        '<div class="ffp-picker-header">' +
          '<div class="ffp-picker-title">' + escHtml(opts.title || 'Choose') + '</div>' +
          '<button type="button" class="ffp-picker-close" id="ffp-picker-close">&times;</button>' +
        '</div>' +
        '<div class="ffp-picker-search">' +
          '<input type="text" id="ffp-picker-search-input" placeholder="' + escHtml(opts.placeholder || 'Search…') + '" autocomplete="off">' +
        '</div>' +
        '<div class="ffp-picker-list" id="ffp-picker-list"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });

    var input = document.getElementById('ffp-picker-search-input');
    var listEl = document.getElementById('ffp-picker-list');

    function renderList(filter) {
      var f = (filter || '').trim().toLowerCase();
      var items = opts.items || [];
      var matches = items.filter(function (it) {
        if (!f) return true;
        return (it.name || '').toLowerCase().indexOf(f) >= 0 ||
               (it.group || '').toLowerCase().indexOf(f) >= 0;
      });
      if (!matches.length) {
        listEl.innerHTML = '<div class="ffp-picker-empty">No matches</div>';
        return;
      }
      if (opts.groupBy) {
        // Group items
        var groups = {};
        var groupOrder = [];
        matches.forEach(function (it) {
          var g = it.group || 'Other';
          if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
          groups[g].push(it);
        });
        var html = '';
        groupOrder.forEach(function (g) {
          html += '<div class="ffp-picker-group-hdr">' + escHtml(g) + '</div>';
          groups[g].forEach(function (it) {
            var sel = (it.name === opts.currentValue) ? ' selected' : '';
            html += '<div class="ffp-picker-item' + sel + '" data-value="' + escHtml(it.name) + '" data-group="' + escHtml(it.group || '') + '">' + escHtml(it.name) + '</div>';
          });
        });
        listEl.innerHTML = html;
      } else {
        var html2 = '';
        matches.forEach(function (it) {
          var sel = (it.name === opts.currentValue) ? ' selected' : '';
          html2 += '<div class="ffp-picker-item' + sel + '" data-value="' + escHtml(it.name) + '">' + escHtml(it.name) + '</div>';
        });
        listEl.innerHTML = html2;
      }
    }
    renderList('');

    input.addEventListener('input', function () { renderList(input.value); });
    input.focus();

    listEl.addEventListener('click', function (e) {
      var item = e.target.closest('.ffp-picker-item');
      if (!item) return;
      var value = item.dataset.value;
      var group = item.dataset.group || '';
      closePicker();
      if (opts.onSelect) opts.onSelect(value, group);
    });

    document.getElementById('ffp-picker-close').addEventListener('click', closePicker);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePicker();
    });
    document.addEventListener('keydown', escClosePicker);
  }
  function escClosePicker(e) {
    if (e.key === 'Escape') closePicker();
  }
  function closePicker() {
    var ov = document.getElementById('ffp-picker-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', escClosePicker);
  }

  // Open activity picker
  async function openActivityPicker(currentValue, onSelect) {
    var activities = await getActivities();
    var items = activities.map(function (a) {
      return { name: a.name, group: a.category, slug: a.slug };
    });
    openPicker({
      title: 'Choose activity',
      placeholder: 'Search 379 activities…',
      items: items,
      currentValue: currentValue,
      groupBy: 'category',
      onSelect: onSelect
    });
  }

  // Open country picker
  function openCountryPicker(currentValue, onSelect) {
    var items = Object.keys(FFP_CITIES).map(function (c) { return { name: c }; });
    openPicker({
      title: 'Choose country',
      placeholder: 'Search countries…',
      items: items,
      currentValue: currentValue,
      onSelect: onSelect
    });
  }

  // Open city picker for a given country
  function openCityPicker(country, currentValue, onSelect) {
    if (!country || !FFP_CITIES[country]) {
      toast('Choose a country first', 'info');
      return;
    }
    var items = FFP_CITIES[country].map(function (c) { return { name: c }; });
    openPicker({
      title: 'Choose city in ' + country,
      placeholder: 'Search cities…',
      items: items,
      currentValue: currentValue,
      onSelect: onSelect
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // DB ↔ UI mapping
  // ════════════════════════════════════════════════════════════════════════
  function mapForUi(row) {
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      overview: row.overview || '',
      activity: row.activity || '',
      category: row.category || '',
      experience_type: row.exp_type || '',
      start_date: row.starts_at || '',
      end_date: row.ends_at || '',
      duration_days: row.duration_days || 0,
      country: row.country || '',
      destination: row.destination || '',
      price_aed: row.price_aed || '',
      price_includes: arrFromText(row.what_included),
      price_excludes: arrFromText(row.what_not_included),
      accommodation: row.accommodation || '',
      flights: row.flights_info || '',
      travel_reqs: row.travel_reqs || '',
      fitness_reqs: row.fitness_reqs || '',
      fitness_level: row.fitness_level || 'Beginner',
      itinerary: Array.isArray(row.itinerary) ? row.itinerary : [],
      hero_url: row.hero_image_url || null,
      status: row.status || 'pending',
      verified: row.status === 'live',
      featured: !!row.featured,
      applications: 0,
      capacity: row.capacity || 0,
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  async function fetchExperiences() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    var res = await window.supabase
      .from('experiences')
      .select('id, provider_id, title, description, overview, exp_type, activity, category, hero_image_url, destination, country, starts_at, ends_at, duration_days, price_aed, what_not_included, what_included, itinerary, accommodation, flights_info, travel_reqs, fitness_reqs, fitness_level, capacity, status, featured, created_at, updated_at')
      .eq('provider_id', window.FFP_PROVIDER.id)
      .order('starts_at', { ascending: true });
    if (res.error) {
      console.error('[FFP Experiences] fetch:', res.error);
      toast('Could not load experiences', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    if (typeof experiences === 'undefined') return;
    var rows = await fetchExperiences();
    experiences.length = 0;
    rows.forEach(function (r) { experiences.push(r); });
    if (typeof window.renderExperiences === 'function') { try { window.renderExperiences(); } catch (e) {} }
    if (typeof window.renderNav === 'function')         { try { window.renderNav();         } catch (e) {} }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Picker button helpers — update DOM state
  // ════════════════════════════════════════════════════════════════════════
  function setActivityBtn(activityName, category) {
    var btn = document.getElementById('xm-activity-btn');
    if (!btn) return;
    btn.dataset.value = activityName || '';
    btn.dataset.category = category || '';
    if (activityName) {
      btn.classList.remove('placeholder');
      btn.innerHTML =
        '<div class="picked"><div class="name">' + escHtml(activityName) + '</div>' +
        (category ? '<div class="group">' + escHtml(category) + '</div>' : '') +
        '</div>' +
        '<span class="ms caret">expand_more</span>';
    } else {
      btn.classList.add('placeholder');
      btn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>';
    }
  }
  function setCountryBtn(country) {
    var btn = document.getElementById('xm-country-btn');
    if (!btn) return;
    btn.dataset.value = country || '';
    if (country) {
      btn.classList.remove('placeholder');
      btn.innerHTML = '<span>' + escHtml(country) + '</span><span class="ms caret">expand_more</span>';
    } else {
      btn.classList.add('placeholder');
      btn.innerHTML = '<span>Choose country…</span><span class="ms caret">expand_more</span>';
    }
    // Reset city when country changes
    var cityBtn = document.getElementById('xm-city-btn');
    if (cityBtn && cityBtn.dataset.country !== country) {
      cityBtn.dataset.country = country || '';
      setCityBtn('');
    }
  }
  function setCityBtn(city) {
    var btn = document.getElementById('xm-city-btn');
    if (!btn) return;
    btn.dataset.value = city || '';
    if (city) {
      btn.classList.remove('placeholder');
      btn.innerHTML = '<span>' + escHtml(city) + '</span><span class="ms caret">expand_more</span>';
    } else {
      btn.classList.add('placeholder');
      btn.innerHTML = '<span>Choose city…</span><span class="ms caret">expand_more</span>';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Modal — overrides openExperienceModal
  // ════════════════════════════════════════════════════════════════════════
  function realOpenExperienceModal(id) {
    var editing = id ? experiences.find(function (x) { return x.id === id; }) : null;
    var e = editing || {
      title: '', description: '', overview: '',
      activity: '', category: '',
      start_date: '', end_date: '',
      country: '', destination: '', price_aed: '',
      price_includes: [], price_excludes: [],
      accommodation: '', flights: '', travel_reqs: '',
      fitness_reqs: '', fitness_level: 'Beginner',
      itinerary: [], hero_url: null, capacity: '', status: ''
    };
    window.modalItinerary = JSON.parse(JSON.stringify(e.itinerary || []));

    var body =
      '<div class="form-section">' +
        '<div class="form-section-title">Photo</div>' +
        '<div id="listing-photo-slot" data-url="' + escHtml(e.hero_url || '') + '"></div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Overview</div>' +
        '<div class="form-grid">' +
          '<div class="field full">' +
            '<div class="label">Title <span class="req">*</span></div>' +
            '<input class="input" id="xm-title" value="' + escHtml(e.title) + '" placeholder="e.g. Hatta Mountain Endurance Camp">' +
          '</div>' +
          '<div class="field full">' +
            '<div class="label">Short description</div>' +
            '<input class="input" id="xm-description" value="' + escHtml(e.description) + '" placeholder="One-sentence summary">' +
          '</div>' +
          '<div class="field full">' +
            '<div class="label">Overview</div>' +
            '<textarea class="textarea" id="xm-overview" rows="4" placeholder="The full story — what makes this experience unique">' + escHtml(e.overview) + '</textarea>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Activity <span class="req">*</span> <span class="label-hint">— what is it?</span></div>' +
            '<button type="button" class="ffp-picker-btn placeholder" id="xm-activity-btn" data-value="" data-category="">' +
              '<span>Choose activity…</span><span class="ms caret">expand_more</span>' +
            '</button>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Experience type <span class="req">*</span> <span class="label-hint">— what kind of trip?</span></div>' +
            '<select class="select" id="xm-exp-type">' +
              '<option value="">Choose type…</option>' +
              EXPERIENCE_TYPES.map(function (t) {
                return '<option value="' + escHtml(t) + '"' + (e.experience_type === t ? ' selected' : '') + '>' + escHtml(t) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Fitness level required</div>' +
            '<select class="select" id="xm-fitness-level">' +
              FITNESS_LEVELS.map(function (l) {
                return '<option value="' + escHtml(l) + '"' + (e.fitness_level === l ? ' selected' : '') + '>' + escHtml(l) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">When &amp; where</div>' +
        '<div class="form-grid">' +
          '<div class="field"><div class="label">Start date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="xm-start" value="' + escHtml(e.start_date) + '"></div>' +
          '<div class="field"><div class="label">End date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="xm-end" value="' + escHtml(e.end_date) + '"></div>' +
          '<div class="field"><div class="label">Country <span class="req">*</span></div>' +
            '<button type="button" class="ffp-picker-btn placeholder" id="xm-country-btn" data-value="">' +
              '<span>Choose country…</span><span class="ms caret">expand_more</span>' +
            '</button></div>' +
          '<div class="field"><div class="label">City</div>' +
            '<button type="button" class="ffp-picker-btn placeholder" id="xm-city-btn" data-value="" data-country="">' +
              '<span>Choose city…</span><span class="ms caret">expand_more</span>' +
            '</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Price</div>' +
        '<div class="form-grid">' +
          '<div class="field"><div class="label">Price per person (AED) <span class="req">*</span></div>' +
            '<input class="input" type="number" id="xm-price" value="' + escHtml(e.price_aed) + '" placeholder="e.g. 1850"></div>' +
          '<div class="field"><div class="label">Capacity</div>' +
            '<input class="input" type="number" id="xm-capacity" value="' + escHtml(e.capacity) + '" placeholder="e.g. 16"></div>' +
          '<div class="field full"><div class="label">What\'s included <span class="label-hint">— one per line</span></div>' +
            '<textarea class="textarea" id="xm-includes" rows="4" placeholder="Lodging (twin share)\nAll meals\nCoaching\nTransport from Dubai">' + escHtml((e.price_includes || []).join('\n')) + '</textarea></div>' +
          '<div class="field full"><div class="label">What\'s NOT included <span class="label-hint">— one per line</span></div>' +
            '<textarea class="textarea" id="xm-excludes" rows="3" placeholder="Personal gear\nTrail running shoes\nTravel insurance">' + escHtml((e.price_excludes || []).join('\n')) + '</textarea></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Itinerary</div>' +
        '<div class="itin-wrap" id="xm-itinerary"></div>' +
        '<button class="itin-add-day" type="button" onclick="addItinDay()"><span class="ms">add</span> Add a day</button>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Practical info</div>' +
        '<div class="form-grid">' +
          '<div class="field full"><div class="label">Accommodation</div>' +
            '<textarea class="textarea" id="xm-accommodation" rows="2" placeholder="Where members stay, room type, amenities">' + escHtml(e.accommodation) + '</textarea></div>' +
          '<div class="field full"><div class="label">Flights / Transport</div>' +
            '<textarea class="textarea" id="xm-flights" rows="2" placeholder="Are flights included? Group transport? Self-arrival?">' + escHtml(e.flights) + '</textarea></div>' +
          '<div class="field full"><div class="label">Travel requirements</div>' +
            '<textarea class="textarea" id="xm-travel-reqs" rows="2" placeholder="Visas, vaccinations, insurance">' + escHtml(e.travel_reqs) + '</textarea></div>' +
          '<div class="field full"><div class="label">Fitness requirements</div>' +
            '<textarea class="textarea" id="xm-fitness-reqs" rows="2" placeholder="What members should be able to do before joining">' + escHtml(e.fitness_reqs) + '</textarea></div>' +
        '</div>' +
      '</div>' +
      (editing && (e.status === 'live' || e.status === 'paused')
        ? '<div class="help-strip" style="margin-top:14px;"><span class="ms">info</span><div><b>This experience is approved.</b> Saving changes will send it back to admin for re-approval.</div></div>'
        : '');

    var foot =
      (editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteExperience(\'' + editing.id + '\'); closeModal()"><span class="ms">delete</span> Delete</button>' : '') +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pri" onclick="saveExperience(\'' + (editing ? editing.id : '') + '\')">' +
        (editing ? 'Save changes' : 'Submit for review') +
      '</button>';

    if (typeof window.openModalShell === 'function') {
      window.openModalShell('lg', (editing ? 'Edit experience' : 'New experience'), body, foot);
    }
    if (typeof window.renderListingUploader === 'function') {
      try { window.renderListingUploader(e.hero_url); } catch (er) {}
    }
    if (typeof window.renderItinerary === 'function') {
      try { window.renderItinerary(); } catch (er) {}
    }

    // Wire up picker buttons
    setTimeout(function () {
      setActivityBtn(e.activity, e.category);
      setCountryBtn(e.country);
      var cityBtn = document.getElementById('xm-city-btn');
      if (cityBtn) cityBtn.dataset.country = e.country || '';
      setCityBtn(e.destination);

      var aBtn = document.getElementById('xm-activity-btn');
      if (aBtn) aBtn.addEventListener('click', function () {
        openActivityPicker(aBtn.dataset.value, function (name, cat) {
          setActivityBtn(name, cat);
        });
      });
      var coBtn = document.getElementById('xm-country-btn');
      if (coBtn) coBtn.addEventListener('click', function () {
        openCountryPicker(coBtn.dataset.value, function (name) {
          setCountryBtn(name);
        });
      });
      var ciBtn = document.getElementById('xm-city-btn');
      if (ciBtn) ciBtn.addEventListener('click', function () {
        var country = document.getElementById('xm-country-btn').dataset.value;
        openCityPicker(country, ciBtn.dataset.value, function (name) {
          setCityBtn(name);
        });
      });
    }, 50);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Save
  // ════════════════════════════════════════════════════════════════════════
  function computeDurationDays(startDate, endDate) {
    if (!startDate || !endDate) return null;
    var s = new Date(startDate);
    var e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }

  async function realSaveExperience(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) { toast('Provider not loaded', 'error'); return; }
    var get = function (key) {
      var el = document.getElementById('xm-' + key);
      return el ? (el.value || '').trim() : '';
    };

    var title = get('title');
    var aBtn = document.getElementById('xm-activity-btn');
    var coBtn = document.getElementById('xm-country-btn');
    var ciBtn = document.getElementById('xm-city-btn');
    var activity = aBtn ? aBtn.dataset.value : '';
    var category = aBtn ? aBtn.dataset.category : '';
    var country  = coBtn ? coBtn.dataset.value : '';
    var city     = ciBtn ? ciBtn.dataset.value : '';
    var expType  = get('exp-type');
    var start = get('start');
    var end   = get('end');
    var price = get('price');

    if (!title)    { toast('Title is required', 'error'); return; }
    if (!activity) { toast('Activity is required', 'error'); return; }
    if (!expType)  { toast('Experience type is required', 'error'); return; }
    if (!country)  { toast('Country is required', 'error'); return; }
    if (!start)    { toast('Start date is required', 'error'); return; }
    if (!end)      { toast('End date is required', 'error'); return; }
    if (!price)    { toast('Price is required', 'error'); return; }

    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;

    var capRaw = get('capacity');
    var capacity = capRaw ? parseInt(capRaw, 10) : null;
    if (capacity != null && isNaN(capacity)) capacity = null;

    var priceNum = parseFloat(price);
    if (isNaN(priceNum)) priceNum = null;

    var payload = {
      title:           title,
      description:     get('description') || null,
      overview:        get('overview') || null,
      activity:        activity,
      category:        category || null,
      exp_type:        expType,
      fitness_level:   get('fitness-level') || null,
      starts_at:       start,
      ends_at:         end,
      duration_days:   computeDurationDays(start, end),
      country:         country,
      destination:     city || null,
      price_aed:       priceNum,
      capacity:        capacity,
      what_included:     textFromArr(arrFromText(get('includes'))),
      what_not_included: textFromArr(arrFromText(get('excludes'))),
      accommodation:   get('accommodation') || null,
      flights_info:    get('flights') || null,
      travel_reqs:     get('travel-reqs') || null,
      fitness_reqs:    get('fitness-reqs') || null,
      itinerary:       Array.isArray(window.modalItinerary) ? window.modalItinerary : [],
      hero_image_url:  heroUrl
    };

    var reapprovalNote = '';
    try {
      if (id) {
        var existing = experiences.find(function (x) { return x.id === id; });
        if (existing && (existing.status === 'live' || existing.status === 'paused')) {
          payload.status = 'pending';
          reapprovalNote = ' (sent back for re-approval)';
        }
        var upd = await window.supabase.from('experiences').update(payload).eq('id', id);
        if (upd.error) throw upd.error;
        toast('Experience updated' + reapprovalNote, 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        payload.provider_id = window.FFP_PROVIDER.id;
        payload.status = 'pending';
        payload.featured = false;
        var ins = await window.supabase.from('experiences').insert(payload).select().single();
        if (ins.error) throw ins.error;
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showSubmittedModal === 'function') {
          try { window.showSubmittedModal('experience'); } catch (er) {}
        } else {
          toast('Submitted for review', 'success');
        }
      }
      await refresh();
    } catch (e) {
      console.error('[FFP Experiences] save:', e);
      var msg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(msg)) msg = 'Save blocked by RLS';
      else if (/does not exist/i.test(msg))         msg = 'Schema mismatch — see console';
      toast(msg, 'error');
    }
  }

  async function realDeleteExperience(id) {
    if (!id) return;
    var doDelete = async function () {
      try {
        var res = await window.supabase.from('experiences').delete().eq('id', id);
        if (res.error) throw res.error;
        toast('Experience deleted', 'success');
        await refresh();
      } catch (e) {
        console.error('[FFP Experiences] delete:', e);
        toast(e.message || 'Delete failed', 'error');
      }
    };
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this experience?', 'Members who applied keep their record, but no new applications can be made.', doDelete);
    } else {
      if (confirm('Delete this experience?')) await doDelete();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Init
  // ════════════════════════════════════════════════════════════════════════
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderExperiences === 'function' &&
             typeof experiences !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Experiences] dependencies never loaded'); return; }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) { console.warn('[FFP Experiences] FFP_PROVIDER not set'); return; }

    injectStyles();

    // Pre-warm activities cache so first picker open is instant
    getActivities().catch(function () {});

    try {
      await refresh();
      console.log('[FFP Experiences v2] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Experiences] initial load:', e);
    }

    window.openExperienceModal     = realOpenExperienceModal;
    window.saveExperience          = realSaveExperience;
    window.confirmDeleteExperience = realDeleteExperience;

    // Expose pickers for events/deals loaders to reuse
    window.FFPPicker = {
      openActivity: openActivityPicker,
      openCountry:  openCountryPicker,
      openCity:     openCityPicker,
      getActivities: getActivities
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
