// Kaohsiung Trip — July 24–28, 2025
// Edit this file to update itinerary content, packing list, budget, or food spots.

export const DEFAULT = {
  days: [
    { id:1, date:"July 24 (Thu)", theme:"Arrival Day", emoji:"✈️", color:"#C8956C", stops:[
      {id:"1a",time:"5:25 PM",place:"Kaohsiung Airport (KHH)",note:"Land & clear immigration. MRT Red Line to hotel (~15–20 min).",icon:"🛬",checked:false},
      {id:"1b",time:"7:30 PM",place:"Dome of Light — Formosa Blvd MRT",note:"Free entry, open until midnight. World's largest glass art installation.",icon:"🌈",checked:false},
      {id:"1c",time:"8:15 PM",place:"Liuhe Night Market",note:"Open daily until 2 AM. Try: oyster omelette, grilled squid, papaya milk, beef steak.",icon:"🍢",checked:false},
    ]},
    { id:2, date:"July 25 (Fri)", theme:"Temples, Art & Local Market", emoji:"🏯", color:"#7B9E6B", stops:[
      {id:"2a",time:"7:00 AM",place:"Lotus Pond Scenic Area",note:"Go early to beat the heat. Dragon & Tiger Pagoda, lakeside walk. MRT Red Line to Zuoying.",icon:"🐉",checked:false},
      {id:"2b",time:"10:00 AM",place:"Sunfong Temple (Sanfeng)",note:"Famous red lantern canopy. Free entry. Stunning photo spot — especially at dusk.",icon:"🏮",checked:false},
      {id:"2c",time:"3:00 PM",place:"Pier 2 Art Center",note:"Converted warehouse art district. Harbor views, street art, indie galleries. Open until 8 PM Fri.",icon:"🎨",checked:false},
      {id:"2d",time:"6:30 PM",place:"Ruifeng Night Market",note:"Open Fri ✅ More local crowd. Angel fried chicken, watermelon milk, green onion cake.",icon:"🍗",checked:false},
    ]},
    { id:3, date:"July 26 (Sat)", theme:"Island + Skyline + Waterfront", emoji:"🏝", color:"#5B8FA8", stops:[
      {id:"3a",time:"8:00 AM",place:"Cijin Island",note:"5-min ferry from Gushan Pier (NT$15). Rent electric bicycle. Beach, Tianhou Temple, seafood old street.",icon:"⛵",checked:false},
      {id:"3b",time:"12:00 PM",place:"Dream Mall",note:"Taiwan's largest mall. Rooftop Ferris wheel, food court. Beat the midday heat indoors.",icon:"🎡",checked:false},
      {id:"3c",time:"2:30 PM",place:"85 Sky Tower",note:"74th floor observation deck. Panoramic city and harbor views.",icon:"🏙",checked:false},
      {id:"3d",time:"5:00 PM",place:"Glory Pier",note:"Open-air food stalls, ferry rides, light show. Very lively on Saturdays.",icon:"⚓",checked:false},
      {id:"3e",time:"7:00 PM",place:"Love River Bay",note:"Short walk from Glory Pier. Lit-up boats and riverside night stroll.",icon:"🌊",checked:false},
    ]},
    { id:4, date:"July 27 (Sun)", theme:"Fo Guang Shan + Museum + Final Night Market", emoji:"🛕", color:"#9B7BA8", stops:[
      {id:"4a",time:"9:00 AM",place:"Fo Guang Shan Buddha Museum",note:"Taxi ~NT$500, 40 min. Free entry. Taiwan's most impressive Buddhist complex. Plan 3–4 hrs.",icon:"☸️",checked:false},
      {id:"4b",time:"2:30 PM",place:"Kaohsiung Museum of Fine Arts",note:"Free entry. Peaceful grounds with a pond. Great air-conditioned afternoon stop.",icon:"🖼",checked:false},
      {id:"4c",time:"6:30 PM",place:"Guanghua Night Market",note:"Open daily 5 PM. FINAL night market! Try the stinky tofu with black pepper.",icon:"🔥",checked:false},
    ]},
    { id:5, date:"July 28 (Mon)", theme:"Departure Day", emoji:"🛫", color:"#C8956C", stops:[
      {id:"5a",time:"Morning",place:"Last Breakfast + Souvenir Shopping",note:"Relax near Formosa Blvd area. Pack up, hotel checkout by 12 PM.",icon:"🛍",checked:false},
      {id:"5b",time:"2:30 PM",place:"Head to KHH Airport",note:"MRT Red Line, 15–20 min. Arrive by 3 PM for 18:25 flight. Safe travels! 💕",icon:"🛬",checked:false},
    ]},
  ],
  notes:[
    {id:"n1",icon:"🏨",title:"Where to Stay",text:"Near Formosa Blvd MRT or Yancheng District. Try Chateau de Chine — rated 4.6/5."},
    {id:"n2",icon:"☀️",title:"July Heat",text:"Do outdoor activities before 10 AM or after 4:30 PM. Malls and museums for midday."},
    {id:"n3",icon:"🚇",title:"Getting Around",text:"MRT covers most spots. Use Grab/taxi for Fo Guang Shan. Ferry for Cijin Island."},
    {id:"n4",icon:"💵",title:"Cash is King",text:"Bring NT$ (Taiwan Dollar). Most night market stalls don't accept cards."},
  ],
  packing:[
    {id:"p1",item:"Passport + travel docs",done:false},
    {id:"p2",item:"Travel insurance",done:false},
    {id:"p3",item:"NT$ cash (exchange before or at airport)",done:false},
    {id:"p4",item:"EasyCard — MRT prepaid (get at airport)",done:false},
    {id:"p5",item:"Lightweight clothes (33°C+ in July)",done:false},
    {id:"p6",item:"Sunscreen + sunglasses + hat",done:false},
    {id:"p7",item:"Portable fan or cooling towel",done:false},
    {id:"p8",item:"Comfortable walking shoes",done:false},
    {id:"p9",item:"Power bank",done:false},
    {id:"p10",item:"Universal adapter (Type A — same as PH)",done:false},
    {id:"p11",item:"Reusable water bottle",done:false},
    {id:"p12",item:"Light rain jacket (typhoon season)",done:false},
  ],
  budget:[
    {id:"b1",category:"Flights (round trip, 2 pax)",estimate:14000,actual:""},
    {id:"b2",category:"Hotel (4 nights × 2 pax)",estimate:12000,actual:""},
    {id:"b3",category:"Daily food budget (×4 days)",estimate:6000,actual:""},
    {id:"b4",category:"Transport (MRT + Grab + ferry)",estimate:2000,actual:""},
    {id:"b5",category:"Attractions & entrance fees",estimate:1500,actual:""},
    {id:"b6",category:"Shopping & pasalubong",estimate:3000,actual:""},
    {id:"b7",category:"Contingency / misc",estimate:2000,actual:""},
  ],
  food:[
    {id:"f1", category:"restaurant", name:"Old New Taiwanese Cuisine", tag:"Omakase · 1000–1500 NTD", desc:"Modern Taiwanese twist. Highly rated — book ahead.", maps:"https://maps.google.com/?q=Old+New+Taiwanese+Cuisine+Kaohsiung", hours:"11:30 AM – 2 PM, 5:30 – 9:30 PM", lat:22.6416, lng:120.3014},
    {id:"f2", category:"restaurant", name:"Ciao Chiao Table", tag:"Italian fusion · $$", desc:"Michelin-level quality at affordable prices.", maps:"https://maps.google.com/?q=Ciao+Chiao+Table+Kaohsiung", hours:"10 AM – 3 PM · Mon, Tue, Fri–Sun", lat:22.6258, lng:120.3021},
    {id:"f3", category:"restaurant", name:"Xing Long Ju", tag:"Taiwanese breakfast · $", desc:"Iconic spot — flatbread, pork buns, soy milk.", maps:"https://maps.google.com/?q=Xing+Long+Ju+Kaohsiung", hours:"4:30 – 11:30 AM · Wed–Sun", lat:22.6305, lng:120.2985},
    {id:"f4", category:"restaurant", name:"Simmer House", tag:"Taiwanese stew · $$", desc:"Michelin Guide listed. Try the chili chicken soup.", maps:"https://maps.google.com/?q=Simmer+House+Kaohsiung", hours:"12 – 2:30 PM, 5 – 8 PM · Tue–Sun", lat:22.6215, lng:120.3125},
    {id:"f5", category:"nightmarket", name:"Ruifeng Night Market", tag:"Night market · $", desc:"Local favorite. Angel fried chicken & green onion cake.", maps:"https://maps.google.com/?q=Ruifeng+Night+Market+Kaohsiung", hours:"5 PM – 12 AM · Tue, Thu–Sun", lat:22.6659, lng:120.3004},
    {id:"f6", category:"nightmarket", name:"Guanghua Night Market", tag:"Night market · $", desc:"Local dinner spot. Famous for black pepper stinky tofu.", maps:"https://maps.google.com/?q=Guanghua+Night+Market+Kaohsiung", hours:"5 PM – 1 AM · Daily", lat:22.6145, lng:120.3185},
    {id:"f7", category:"cafe", name:"My Cofi", tag:"Specialty coffee · $$", desc:"Famous for 3D latte art — personalized cups.", maps:"https://maps.google.com/?q=My+Cofi+Kaohsiung", hours:"10 AM – 5 PM · Tue–Sat", lat:22.6355, lng:120.3150},
    {id:"f8", category:"cafe", name:"Ruh Cafe No.1", tag:"Coffee roastery · $", desc:"Tatami seating, retro vibes. Amazing chocolate cake.", maps:"https://maps.google.com/?q=Ruh+Cafe+No.1+Kaohsiung", hours:"9 AM – 6:30 PM · Tue–Sun", lat:22.6395, lng:120.3020},
    {id:"f9", category:"cafe", name:"Coffee Serenity", tag:"Cozy cafe · $$", desc:"Handmade cinnamon rolls and wooden Taiwanese interior.", maps:"https://maps.google.com/?q=Coffee+Serenity+Kaohsiung", hours:"10:30 AM – 5:30 PM · Mon–Sun", lat:22.6280, lng:120.2920},
    {id:"f10", category:"cafe", name:"Do Good Coffee & Dessert", tag:"Specialty coffee · $$", desc:"Queer-friendly spot in Yancheng. Excellent scones.", maps:"https://maps.google.com/?q=Do+Good+Coffee+Dessert+Kaohsiung", hours:"10 AM – 6 PM · Mon–Sun", lat:22.6220, lng:120.2850},
    {id:"f11", category:"cafe", name:"Aroma Cafe Live", tag:"Specialty coffee · $$", desc:"Family roastery. Amazing caramel macchiato.", maps:"https://maps.google.com/?q=Aroma+Cafe+Live+Kaohsiung", hours:"12 – 6 PM · Mon–Sun", lat:22.6320, lng:120.3010},
  ],
};
