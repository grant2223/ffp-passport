/* FFP Taxonomy - v5 (2026-06-03)
   v5: + Passports (Pick A Passport map lens). Exposes FFP_TAX.passports (list_key='passport')
       and FFP_TAX.categoryPassport (category value → passport id, from each category row's
       `parent`). Admin assigns a passport per category in the Taxonomies panel; the member
       map reads this live. Colours/icons stay in member-dashboard code (PASSPORT_META).
   v4: static gender fallback aligned to the DB taxonomy — removed 'Non-binary' (not in
       taxonomy_items list_key='gender'). The DB is the single source of truth and hydrates
       FFP_TAX.genders on load via FFP_TAX_READY; gender is now controlled entirely from the
       Taxonomy (admin) — add/remove there and every form follows. This fallback only shows if
       the DB is unreachable, and now it matches.
   v3: consolidated Running&walking (Walking/Running/Trail/Half/Marathon/Ultra) and
       Swimming (Swimming/Open water) — removed distance-variant spam (Run 2/5/10km etc.).
   v2: + genders, ageGroups, phoneCodes, professionalRoles (centralised so every form shares them).
   v1: single source of truth for cross-platform reference lists, extracted VERBATIM from
       the member dashboard (CITIES_DB, ACTIVITIES_DB) + shared fitness levels + nationalities.
       Loaded before dashboards; forms/admin read window.FFP_TAX instead of inline copies.
*/
(function(){
  'use strict';
  window.FFP_TAX = {
    cities: {

      'Argentina': ['Bariloche','Buenos Aires','Cordoba','El Calafate','Iguazu','Mendoza','Salta','Ushuaia'],
      'Australia': ['Adelaide','Brisbane','Byron Bay','Cairns','Canberra','Darwin','Gold Coast','Hobart','Melbourne','Newcastle','Perth','Sunshine Coast','Sydney','Wollongong'],
      'Austria': ['Bregenz','Graz','Hallstatt','Innsbruck','Kitzbuhel','Klagenfurt','Linz','Salzburg','Vienna'],
      'Bahrain': ['Manama','Muharraq','Riffa'],
      'Belgium': ['Antwerp','Bruges','Brussels','Ghent','Leuven','Liege','Mechelen','Namur'],
      'Brazil': ['Brasilia','Buzios','Florianopolis','Fortaleza','Iguazu Falls','Manaus','Recife','Rio de Janeiro','Salvador','Sao Paulo'],
      'Canada': ['Banff','Calgary','Edmonton','Halifax','Mont-Tremblant','Montreal','Niagara Falls','Ottawa','Quebec City','Toronto','Vancouver','Victoria','Whistler','Winnipeg'],
      'Chile': ['Atacama','Easter Island','Patagonia','Pucon','Punta Arenas','Santiago','Valparaiso'],
      'China': ['Beijing','Chengdu','Chongqing','Guangzhou','Hangzhou','Hong Kong','Lhasa','Macau','Sanya','Shanghai','Shenzhen','Suzhou','Xian'],
      'Costa Rica': ['La Fortuna','Manuel Antonio','Monteverde','Puerto Viejo','San Jose','Tamarindo'],
      'Czech Republic': ['Brno','Cesky Krumlov','Karlovy Vary','Liberec','Olomouc','Ostrava','Plzen','Prague'],
      'Denmark': ['Aalborg','Aarhus','Copenhagen','Esbjerg','Helsingor','Odense','Roskilde'],
      'Egypt': ['Alexandria','Aswan','Cairo','Dahab','Hurghada','Luxor','Marsa Alam','Sharm El Sheikh'],
      'Finland': ['Espoo','Helsinki','Lapland','Oulu','Rovaniemi','Tampere','Turku','Vantaa'],
      'France': ['Aix-en-Provence','Avignon','Biarritz','Bordeaux','Cannes','Chamonix','Lille','Lyon','Marseille','Montpellier','Nantes','Nice','Paris','Saint-Tropez','Strasbourg','Toulouse'],
      'Germany': ['Baden-Baden','Berlin','Bremen','Cologne','Dresden','Dusseldorf','Frankfurt','Hamburg','Hannover','Heidelberg','Leipzig','Munich','Nuremberg','Stuttgart'],
      'Greece': ['Athens','Corfu','Crete','Kos','Mykonos','Naxos','Paros','Patras','Rhodes','Santorini','Skiathos','Thessaloniki','Zakynthos'],
      'Hungary': ['Budapest','Debrecen','Eger','Gyor','Miskolc','Pecs','Szeged'],
      'Iceland': ['Akureyri','Hofn','Husavik','Keflavik','Reykjavik','Selfoss','Vik'],
      'India': ['Agra','Bangalore','Chennai','Darjeeling','Goa','Hyderabad','Jaipur','Kerala','Kolkata','Mumbai','New Delhi','Pune','Rishikesh','Udaipur','Varanasi'],
      'Indonesia': ['Bali','Bandung','Gili Islands','Jakarta','Komodo','Lombok','Seminyak','Surabaya','Ubud','Yogyakarta'],
      'Ireland': ['Belfast','Cork','Dublin','Galway','Kilkenny','Killarney','Limerick','Waterford'],
      'Israel': ['Eilat','Haifa','Jerusalem','Nazareth','Tel Aviv','Tiberias'],
      'Italy': ['Amalfi','Bologna','Capri','Cinque Terre','Florence','Genoa','Lake Como','Milan','Naples','Palermo','Pisa','Positano','Rome','Sardinia','Sicily','Turin','Venice','Verona'],
      'Japan': ['Fukuoka','Hakone','Hiroshima','Kanazawa','Kobe','Kyoto','Nagoya','Nara','Nikko','Niseko','Okinawa','Osaka','Sapporo','Sendai','Takayama','Tokyo','Yokohama'],
      'Jordan': ['Amman','Aqaba','Dead Sea','Jerash','Petra','Wadi Rum'],
      'Kenya': ['Diani Beach','Kisumu','Lamu','Maasai Mara','Mombasa','Nairobi','Nakuru'],
      'Kuwait': ['Hawalli','Kuwait City','Salmiya'],
      'Lebanon': ['Baalbek','Beirut','Byblos','Sidon','Tripoli'],
      'Malaysia': ['Borneo','Ipoh','Johor Bahru','Kota Kinabalu','Kuala Lumpur','Kuching','Langkawi','Malacca','Penang'],
      'Maldives': ['Hulhumale','Maafushi','Male'],
      'Mexico': ['Cabo San Lucas','Cancun','Cozumel','Guadalajara','Isla Mujeres','Merida','Mexico City','Oaxaca','Playa del Carmen','Puerto Vallarta','Tulum'],
      'Morocco': ['Agadir','Casablanca','Chefchaouen','Essaouira','Fez','Marrakech','Meknes','Rabat','Tangier'],
      'Netherlands': ['Amsterdam','Delft','Eindhoven','Groningen','Haarlem','Leiden','Maastricht','Rotterdam','The Hague','Utrecht'],
      'New Zealand': ['Auckland','Christchurch','Dunedin','Hamilton','Napier','Nelson','Queenstown','Rotorua','Tauranga','Wellington'],
      'Norway': ['Alesund','Bergen','Geiranger','Lofoten','Oslo','Stavanger','Tromso','Trondheim'],
      'Oman': ['Khasab','Muscat','Nizwa','Salalah','Sur'],
      'Philippines': ['Boracay','Bohol','Cebu','Coron','Davao','El Nido','Manila','Palawan','Siargao'],
      'Poland': ['Gdansk','Krakow','Lodz','Lublin','Poznan','Warsaw','Wroclaw','Zakopane'],
      'Portugal': ['Albufeira','Azores','Braga','Cascais','Coimbra','Faro','Funchal','Lagos','Lisbon','Madeira','Porto','Sintra'],
      'Qatar': ['Al Khor','Al Wakrah','Doha','Lusail'],
      'Russia': ['Kazan','Moscow','Novosibirsk','Saint Petersburg','Sochi','Vladivostok','Yekaterinburg'],
      'Saudi Arabia': ['AlUla','Dammam','Jeddah','Khobar','Mecca','Medina','NEOM','Riyadh'],
      'Singapore': ['Singapore'],
      'South Africa': ['Cape Town','Durban','Hermanus','Johannesburg','Knysna','Plettenberg Bay','Port Elizabeth','Pretoria','Stellenbosch'],
      'South Korea': ['Busan','Daegu','Daejeon','Gwangju','Gyeongju','Incheon','Jeju','Seoul','Suwon'],
      'Spain': ['Barcelona','Bilbao','Cordoba','Granada','Gran Canaria','Ibiza','Madrid','Malaga','Mallorca','Marbella','Salamanca','San Sebastian','Seville','Tenerife','Valencia'],
      'Sri Lanka': ['Anuradhapura','Colombo','Ella','Galle','Kandy','Mirissa','Negombo','Nuwara Eliya'],
      'Sweden': ['Gothenburg','Kiruna','Lapland','Lund','Malmo','Stockholm','Uppsala','Vasteras'],
      'Switzerland': ['Basel','Bern','Davos','Geneva','Interlaken','Lausanne','Lucerne','Lugano','Montreux','St. Moritz','Zermatt','Zurich'],
      'Taiwan': ['Hualien','Kaohsiung','Taichung','Tainan','Taipei','Taroko'],
      'Tanzania': ['Arusha','Dar es Salaam','Kilimanjaro','Serengeti','Stone Town','Zanzibar'],
      'Thailand': ['Bangkok','Chiang Mai','Chiang Rai','Hua Hin','Koh Phi Phi','Koh Samui','Koh Tao','Krabi','Pattaya','Phuket'],
      'Turkey': ['Ankara','Antalya','Bodrum','Cappadocia','Fethiye','Istanbul','Izmir','Marmaris','Pamukkale'],
      'United Arab Emirates': ['Abu Dhabi','Ajman','Al Ain','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain'],
      'United Kingdom': ['Aberdeen','Bath','Belfast','Birmingham','Brighton','Bristol','Cambridge','Cardiff','Edinburgh','Glasgow','Leeds','Liverpool','London','Manchester','Newcastle','Oxford','Sheffield','York'],
      'United States': ['Aspen','Atlanta','Austin','Boston','Chicago','Dallas','Denver','Honolulu','Houston','Las Vegas','Los Angeles','Miami','Nashville','New Orleans','New York','Park City','Philadelphia','Phoenix','Portland','San Antonio','San Diego','San Francisco','Seattle','Washington DC'],
      'Vietnam': ['Da Nang','Dalat','Halong Bay','Hanoi','Ho Chi Minh City','Hoi An','Hue','Nha Trang','Phu Quoc','Sapa']
    },
    activities: [
    { n: 'Walking', c: 'Running & walking' },
    { n: 'Running', c: 'Running & walking' },
    { n: 'Trail running', c: 'Running & walking' },
    { n: 'Half marathon', c: 'Running & walking' },
    { n: 'Marathon', c: 'Running & walking' },
    { n: 'Ultramarathon', c: 'Running & walking' },
    { n: 'Road cycling', c: 'Cycling' },
    { n: 'Mountain biking', c: 'Cycling' },
    { n: 'Indoor cycling', c: 'Cycling' },
    { n: 'Track cycling', c: 'Cycling' },
    { n: 'Swimming', c: 'Swimming' },
    { n: 'Open water swimming', c: 'Swimming' },
    { n: 'Surfing', c: 'Watersports' },
    { n: 'Kitesurfing', c: 'Watersports' },
    { n: 'Stand-up paddleboard', c: 'Watersports' },
    { n: 'Sailing', c: 'Watersports' },
    { n: 'Kayaking', c: 'Watersports' },
    { n: 'Scuba diving', c: 'Watersports' },
    { n: 'Tennis', c: 'Racquet sports' },
    { n: 'Padel', c: 'Racquet sports' },
    { n: 'Pickleball', c: 'Racquet sports' },
    { n: 'Squash', c: 'Racquet sports' },
    { n: 'Badminton', c: 'Racquet sports' },
    { n: 'Football (soccer)', c: 'Team sports' },
    { n: 'Futsal', c: 'Team sports' },
    { n: 'American football', c: 'Team sports' },
    { n: 'Australian rules football', c: 'Team sports' },
    { n: 'Basketball', c: 'Team sports' },
    { n: 'Baseball', c: 'Team sports' },
    { n: 'Cricket', c: 'Team sports' },
    { n: 'Rugby union', c: 'Team sports' },
    { n: 'Rugby league', c: 'Team sports' },
    { n: 'Rugby sevens', c: 'Team sports' },
    { n: 'Touch rugby', c: 'Team sports' },
    { n: 'Ice hockey', c: 'Team sports' },
    { n: 'Field hockey', c: 'Team sports' },
    { n: 'Lacrosse', c: 'Team sports' },
    { n: 'Volleyball', c: 'Team sports' },
    { n: 'Beach volleyball', c: 'Team sports' },
    { n: 'Water polo', c: 'Team sports' },
    { n: 'Netball', c: 'Team sports' },
    { n: 'Handball', c: 'Team sports' },
    { n: 'Kabaddi', c: 'Team sports' },
    { n: 'Dodgeball', c: 'Team sports' },
    { n: 'Ultimate frisbee', c: 'Team sports' },
    { n: 'Curling', c: 'Team sports' },
    { n: 'Boxing', c: 'Combat sports' },
    { n: 'Kickboxing', c: 'Combat sports' },
    { n: 'Muay Thai', c: 'Combat sports' },
    { n: 'Brazilian Jiu-Jitsu', c: 'Combat sports' },
    { n: 'MMA', c: 'Combat sports' },
    { n: 'Judo', c: 'Combat sports' },
    { n: 'Karate', c: 'Combat sports' },
    { n: 'Taekwondo', c: 'Combat sports' },
    { n: 'Wrestling', c: 'Combat sports' },
    { n: 'Fencing', c: 'Combat sports' },
    { n: 'Strength training', c: 'Strength & fitness' },
    { n: 'Powerlifting', c: 'Strength & fitness' },
    { n: 'Olympic lifting', c: 'Strength & fitness' },
    { n: 'CrossFit', c: 'Strength & fitness' },
    { n: 'HIIT', c: 'Strength & fitness' },
    { n: 'F45', c: 'Strength & fitness' },
    { n: 'Functional training', c: 'Strength & fitness' },
    { n: 'Calisthenics', c: 'Strength & fitness' },
    { n: 'Vinyasa yoga', c: 'Mind-body' },
    { n: 'Hot yoga', c: 'Mind-body' },
    { n: 'Yin yoga', c: 'Mind-body' },
    { n: 'Pilates mat', c: 'Mind-body' },
    { n: 'Pilates reformer', c: 'Mind-body' },
    { n: 'Barre', c: 'Mind-body' },
    { n: 'Meditation', c: 'Mind-body' },
    { n: 'Breathwork', c: 'Mind-body' },
    { n: 'Tai Chi', c: 'Mind-body' },
    { n: 'Cryotherapy', c: 'Recovery & wellness' },
    { n: 'Ice bath', c: 'Recovery & wellness' },
    { n: 'Sauna', c: 'Recovery & wellness' },
    { n: 'Infrared sauna', c: 'Recovery & wellness' },
    { n: 'Sports massage', c: 'Recovery & wellness' },
    { n: 'Hiking', c: 'Outdoor & adventure' },
    { n: 'Mountain hike', c: 'Outdoor & adventure' },
    { n: 'Indoor climbing', c: 'Outdoor & adventure' },
    { n: 'Outdoor climbing', c: 'Outdoor & adventure' },
    { n: 'Bouldering', c: 'Outdoor & adventure' },
    { n: 'Skiing', c: 'Snow sports' },
    { n: 'Snowboarding', c: 'Snow sports' },
    { n: 'Cross-country skiing', c: 'Snow sports' },
    { n: 'Golf round', c: 'Golf' },
    { n: 'Driving range', c: 'Golf' },
    { n: 'Horse riding', c: 'Equestrian' },
    { n: 'Polo', c: 'Equestrian' },
    { n: 'Skydiving', c: 'Air & extreme' },
    { n: 'Paragliding', c: 'Air & extreme' },
    { n: 'Bungee jump', c: 'Air & extreme' },
    { n: 'Triathlon', c: 'Multi-sport' },
    { n: 'Ironman', c: 'Multi-sport' },
    { n: 'Hyrox', c: 'Multi-sport' },
    { n: 'Spartan', c: 'Multi-sport' }
  ],
    fitnessLevels: ['Not Tried','Social','Competitive','Representative','Professional'],
    nationalities: [
      'Argentinian','Australian','Austrian','Belgian','Brazilian','British','Bulgarian',
      'Canadian','Chilean','Chinese','Colombian','Croatian','Czech','Danish','Dutch',
      'Egyptian','Emirati','Filipino','Finnish','French','German','Greek','Hungarian',
      'Indian','Indonesian','Irish','Israeli','Italian','Japanese','Jordanian','Kenyan',
      'Kuwaiti','Lebanese','Malaysian','Mexican','Moroccan','New Zealander','Nigerian',
      'Norwegian','Omani','Pakistani','Peruvian','Polish','Portuguese','Qatari','Romanian',
      'Russian','Saudi Arabian','Singaporean','South African','South Korean','Spanish',
      'Sri Lankan','Swedish','Swiss','Thai','Turkish','Ukrainian','American','Vietnamese'
    ]
  };
  // convenience: flat sorted city list across all countries
  window.FFP_TAX.allCities = function(){ var o=[]; var c=window.FFP_TAX.cities||{}; Object.keys(c).forEach(function(k){ (c[k]||[]).forEach(function(x){o.push(x);}); }); return o.sort(); };
})();

(function () {
  var T = window.FFP_TAX || (window.FFP_TAX = {});
  T.genders = ['Male', 'Female', 'Prefer not to say']; // fallback only — matches the DB taxonomy (taxonomy_items list_key='gender'); DB is the source of truth and hydrates this on load
  // Passports (Pick A Passport on the member map). DB-driven: list = taxonomy_items list_key='passport';
  // each category's passport = that category row's `parent`. These are fallbacks until hydration.
  T.passports = [
    { id: 'sports', label: 'Sports' }, { id: 'fitness', label: 'Fitness' },
    { id: 'wellness', label: 'Wellness' }, { id: 'adventure', label: 'Adventure' },
    { id: 'food', label: 'Health Food' }
  ];
  T.categoryPassport = {  // category value → passport id (hydrated from DB category.parent)
    'Fitness': 'fitness', 'Coaching': 'fitness', 'Wellness': 'wellness', 'Yoga & Pilates': 'wellness',
    'Recovery': 'wellness', 'Padel': 'sports', 'Combat sports': 'sports', 'Adventure': 'adventure',
    'Climbing': 'adventure', 'Nutrition': 'food', 'Retail': 'food'
  };
  T.ageGroups = ['18-24', '25-34', '35-44', '45-54', '55+'];
  T.phoneCodes = [
    { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },{ code: '+93', country: 'Afghanistan', flag: '🇦🇫' },{ code: '+54', country: 'Argentina', flag: '🇦🇷' },{ code: '+61', country: 'Australia', flag: '🇦🇺' },{ code: '+43', country: 'Austria', flag: '🇦🇹' },{ code: '+973', country: 'Bahrain', flag: '🇧🇭' },{ code: '+32', country: 'Belgium', flag: '🇧🇪' },{ code: '+55', country: 'Brazil', flag: '🇧🇷' },{ code: '+359', country: 'Bulgaria', flag: '🇧🇬' },{ code: '+1', country: 'Canada', flag: '🇨🇦' },{ code: '+56', country: 'Chile', flag: '🇨🇱' },{ code: '+86', country: 'China', flag: '🇨🇳' },{ code: '+57', country: 'Colombia', flag: '🇨🇴' },{ code: '+385', country: 'Croatia', flag: '🇭🇷' },{ code: '+420', country: 'Czech Republic', flag: '🇨🇿' },{ code: '+45', country: 'Denmark', flag: '🇩🇰' },{ code: '+20', country: 'Egypt', flag: '🇪🇬' },{ code: '+358', country: 'Finland', flag: '🇫🇮' },{ code: '+33', country: 'France', flag: '🇫🇷' },{ code: '+49', country: 'Germany', flag: '🇩🇪' },{ code: '+30', country: 'Greece', flag: '🇬🇷' },{ code: '+852', country: 'Hong Kong', flag: '🇭🇰' },{ code: '+36', country: 'Hungary', flag: '🇭🇺' },{ code: '+91', country: 'India', flag: '🇮🇳' },{ code: '+62', country: 'Indonesia', flag: '🇮🇩' },{ code: '+98', country: 'Iran', flag: '🇮🇷' },{ code: '+353', country: 'Ireland', flag: '🇮🇪' },{ code: '+972', country: 'Israel', flag: '🇮🇱' },{ code: '+39', country: 'Italy', flag: '🇮🇹' },{ code: '+81', country: 'Japan', flag: '🇯🇵' },{ code: '+962', country: 'Jordan', flag: '🇯🇴' },{ code: '+254', country: 'Kenya', flag: '🇰🇪' },{ code: '+965', country: 'Kuwait', flag: '🇰🇼' },{ code: '+961', country: 'Lebanon', flag: '🇱🇧' },{ code: '+60', country: 'Malaysia', flag: '🇲🇾' },{ code: '+52', country: 'Mexico', flag: '🇲🇽' },{ code: '+212', country: 'Morocco', flag: '🇲🇦' },{ code: '+31', country: 'Netherlands', flag: '🇳🇱' },{ code: '+64', country: 'New Zealand', flag: '🇳🇿' },{ code: '+234', country: 'Nigeria', flag: '🇳🇬' },{ code: '+47', country: 'Norway', flag: '🇳🇴' },{ code: '+968', country: 'Oman', flag: '🇴🇲' },{ code: '+92', country: 'Pakistan', flag: '🇵🇰' },{ code: '+51', country: 'Peru', flag: '🇵🇪' },{ code: '+63', country: 'Philippines', flag: '🇵🇭' },{ code: '+48', country: 'Poland', flag: '🇵🇱' },{ code: '+351', country: 'Portugal', flag: '🇵🇹' },{ code: '+974', country: 'Qatar', flag: '🇶🇦' },{ code: '+40', country: 'Romania', flag: '🇷🇴' },{ code: '+7', country: 'Russia', flag: '🇷🇺' },{ code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },{ code: '+65', country: 'Singapore', flag: '🇸🇬' },{ code: '+27', country: 'South Africa', flag: '🇿🇦' },{ code: '+82', country: 'South Korea', flag: '🇰🇷' },{ code: '+34', country: 'Spain', flag: '🇪🇸' },{ code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },{ code: '+46', country: 'Sweden', flag: '🇸🇪' },{ code: '+41', country: 'Switzerland', flag: '🇨🇭' },{ code: '+66', country: 'Thailand', flag: '🇹🇭' },{ code: '+90', country: 'Turkey', flag: '🇹🇷' },{ code: '+380', country: 'Ukraine', flag: '🇺🇦' },{ code: '+44', country: 'United Kingdom', flag: '🇬🇧' },{ code: '+1', country: 'United States', flag: '🇺🇸' },{ code: '+84', country: 'Vietnam', flag: '🇻🇳' }
  ];
  T.professionalRoles = {
    'Strength & Body Composition': ['Powerlifting Coach','Weightlifting Coach (Olympic)','Bodybuilding Coach','Strongman Coach','Calisthenics Coach','Kettlebell Coach','Gymnastic Strength Coach','Animal Flow Coach','Weight Loss Coach','Fat Loss Coach','Body Recomposition Coach','Lean Bulk Coach','Contest Prep Coach','Pre/Postnatal Strength Coach','Youth Strength Coach','Senior Strength Coach'],
    'Functional & Conditioning': ['CrossFit Coach','HIIT Coach','Plyometric Coach','Mobility Coach','Functional Training Coach','Bootcamp Coach','F45 Coach','Hyrox Coach','TRX / Suspension Coach','Sandbag Training Coach','Battle Rope Coach','Stability & Balance Coach'],
    'Endurance & Running': ['Running Coach','Trail Running Coach','Marathon Coach','Ultra Endurance Coach','Triathlon Coach','Cycling Coach','Mountain Bike Coach','Indoor Cycling / Spin Instructor','Speed & Agility Coach','Sprinting Coach','Track & Field Coach','Walking / Hiking Coach'],
    'Sport-Specific Coaching': ['Tennis Coach','Padel Coach','Pickleball Coach','Squash Coach','Badminton Coach','Table Tennis Coach','Football (Soccer) Coach','Futsal Coach','American Football Coach','Basketball Coach','Cricket Coach','Rugby Coach','Volleyball Coach','Beach Volleyball Coach','Baseball Coach','Field Hockey Coach','Ice Hockey Coach','Lacrosse Coach','Ultimate Frisbee Coach','Handball Coach','Golf Coach','Skateboarding Coach','BMX Coach','Equestrian Coach','Archery Coach','Shooting Coach'],
    'Combat Sports & Martial Arts': ['Boxing Coach','Muay Thai Coach','Kickboxing Coach','Brazilian Jiu-Jitsu Instructor','MMA Coach','Karate Sensei','Taekwondo Instructor','Judo Coach','Wrestling Coach','Krav Maga Instructor','Self-Defense Instructor','Fencing Coach','Capoeira Instructor','Aikido Instructor'],
    'Yoga, Pilates & Movement': ['Yoga Instructor (Hatha)','Yoga Instructor (Vinyasa)','Yoga Instructor (Ashtanga)','Hot Yoga Instructor','Yin Yoga Instructor','Aerial Yoga Instructor','Pilates Instructor (Mat)','Reformer Pilates Instructor','Barre Instructor','Pole Fitness Instructor','Movement Specialist','Posture Coach','Stretching Coach'],
    'Dance & Rhythm': ['Contemporary Dance Instructor','Choreographer','Ballet Teacher','Latin Dance Instructor','Hip Hop Dance Instructor','Ballroom Dance Instructor','Zumba Instructor'],
    'Mind & Mental Performance': ['Meditation Teacher','Mindfulness Coach','Breathwork Coach','Mental Performance Coach','Sports Psychologist','Mental Health Coach','Therapist / Counsellor','Hypnotherapist','Stress Management Coach','Life Coach'],
    'Sports Therapy & Bodywork': ['Physiotherapist','Sports Physiotherapist','Osteopath','Chiropractor','Sports Therapist','Biomechanics Specialist','Rehabilitation Coach','Injury Prevention Coach','Sports Doctor','Sports Scientist','Massage Therapist','Sports Massage Therapist','Deep Tissue Therapist','Stretching Therapist','Reflexologist'],
    'Recovery & Wellness Practices': ['Cryotherapy Specialist','Sauna / Heat Therapy Practitioner','Cold Exposure Practitioner','IV Therapy Specialist','Float Tank Therapist','Acupuncturist','Aromatherapist','Reiki Practitioner','Sound Healer','Energy Healer'],
    'Nutrition & Health': ['Nutritionist','Sports Nutritionist','Performance Nutritionist','Registered Dietitian','Holistic Nutrition Coach','Plant-Based Nutrition Coach','Health Coach','Wellness Coach','Holistic Health Practitioner','Naturopath','Sleep Coach','Hormone Coach','Gut Health Coach','Functional Medicine Practitioner'],
    'Adventure & Outdoor': ['Adventure Guide','Mountain Guide','Trekking Guide','Hiking Guide','Climbing Instructor','Bouldering Coach','Ski Instructor','Snowboard Instructor','Wilderness Instructor','Survival Instructor','Bike Tour Guide','Bushcraft Instructor','Canyoning Guide'],
    'Watersports': ['Swim Coach','Open Water Swim Coach','Surfing Instructor','Kitesurfing Instructor','Windsurfing Instructor','SUP (Paddleboard) Instructor','Sailing Instructor','Scuba Diving Instructor','Freediving Instructor','Spearfishing Guide','Wakeboard Coach','Watersports Guide','Lifeguard / Aquatic Safety','Underwater Photographer','Kayaking Instructor'],
    'Industry & Business': ['Studio Owner','Gym Owner','Brand Owner','Sports Apparel Brand','Supplement Brand','Equipment Brand','Event Organizer','Race Director','Tournament Organizer','Sports Photographer','Action Videographer','Sports Journalist','Sports Commentator','Sports Agent','Athlete Manager','Sports Marketing Specialist','Sponsorship Specialist','Sports PR'],
    'Athletes & Creators': ['Professional Athlete','Sponsored Athlete','National Team Athlete','Olympic / Paralympic Athlete','Adventure Athlete','Content Creator','Fitness Influencer','Wellness Influencer','Adventure Influencer','Author / Educator','Podcast Host','Public Speaker'],
    'Other': ['Entrepreneur','Investor','Consultant','Sports Tech Founder','Wellness Tech Founder','Researcher','Educator','Other']
  };
})();

/* ── DB HYDRATION (v4, 2026-06-01) ──────────────────────────────────────────────
   The Admin > Taxonomies panel edits public.taxonomy_items. On every page load we
   pull those lists and OVERRIDE the hardcoded FFP_TAX arrays IN PLACE (so admin
   changes propagate platform-wide). If the DB is empty/unreachable, the hardcoded
   lists above remain as a safe fallback — nothing breaks. Exposes window.FFP_TAX_READY
   (promise) and fires a document 'ffp-tax-ready' event so forms can rebuild if needed. */
(function () {
  'use strict';
  var T = window.FFP_TAX; if (!T) return;
  var SB_URL = 'https://kxzyuofecmtymablnmak.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4enl1b2ZlY210eW1hYmxubWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDM1MTYsImV4cCI6MjA5NTAxOTUxNn0.cWn0x1AeD-x9C-HHf9MShXbFRWdkWi5RMgHLgWJwOuE';

  // category 'c' would be lost for activities (taxonomy_items has no category),
  // so capture the original name->c map to preserve grouping for known activities.
  var actCat = {};
  (T.activities || []).forEach(function (a) { if (a && a.n) actCat[a.n] = a.c || ''; });

  function getClient() {
    var sb = window.supabase;
    if (sb && typeof sb.from === 'function') return sb;                 // already a client (dashboards)
    if (sb && typeof sb.createClient === 'function') return sb.createClient(SB_URL, SB_ANON); // UMD namespace
    return null;
  }
  function fill(arr, vals) { if (!arr) return; arr.length = 0; vals.forEach(function (v) { arr.push(v); }); }

  function apply(rows) {
    var by = {};
    rows.forEach(function (r) { (by[r.list_key] = by[r.list_key] || []).push(r); });
    function vals(k) {
      return (by[k] || []).sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
        .map(function (r) { return r.label || r.value; });
    }
    if (by.activity) {
      var names = vals('activity');
      T.activities.length = 0;
      names.forEach(function (n) { T.activities.push({ n: n, c: (actCat[n] || '') }); });
    }
    if (by.fitness_level) fill(T.fitnessLevels, vals('fitness_level'));
    if (by.nationality)   fill(T.nationalities, vals('nationality'));
    if (by.gender)        fill(T.genders, vals('gender'));
    if (by.age_group)     fill(T.ageGroups, vals('age_group'));
    if (by.category && window.FFP_CONST && window.FFP_CONST.providerCategories) {
      fill(window.FFP_CONST.providerCategories, vals('category'));
    }
    if (by.experience_type) { T.experienceTypes = vals('experience_type'); }
    // Passports + category→passport mapping (Pick A Passport). list = list_key='passport';
    // each category row's `parent` is its passport id.
    if (by.passport && by.passport.length) {
      T.passports = by.passport.slice()
        .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
        .map(function (r) { return { id: r.value, label: r.label || r.value }; });
    }
    if (by.category) {
      var cp = {};
      by.category.forEach(function (r) { if (r.parent) cp[r.value] = r.parent; });
      T.categoryPassport = cp;
    }
    if (by.city && by.city.length) {
      // rebuild the country -> [cities] map in place from the country + city lists
      var cityByCountry = {};
      by.city.slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
        .forEach(function (r) { if (r.parent) (cityByCountry[r.parent] = cityByCountry[r.parent] || []).push(r.label || r.value); });
      var order = (by.country || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); }).map(function (r) { return r.value; });
      Object.keys(T.cities).forEach(function (k) { delete T.cities[k]; });
      order.forEach(function (c) { if (cityByCountry[c]) T.cities[c] = cityByCountry[c]; });
      Object.keys(cityByCountry).forEach(function (c) { if (!T.cities[c]) T.cities[c] = cityByCountry[c]; });
    }
    try { document.dispatchEvent(new CustomEvent('ffp-tax-ready', { detail: { source: 'db' } })); } catch (e) {}
  }

  window.FFP_TAX_READY = (async function () {
    try {
      var c = getClient(); if (!c) return false;
      var res = await c.from('taxonomy_items')
        .select('list_key, value, label, sort_order, active, parent').eq('active', true);
      if (res.error || !res.data || !res.data.length) return false;
      apply(res.data);
      return true;
    } catch (e) { return false; }
  })();
})();
