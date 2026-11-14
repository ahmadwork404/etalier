export const demoPhotos = [
  {
    key: "juliette",
    image: "1745434159123-5b99b94206ca",
    credit: "Brooke Balentine",
    source: "https://unsplash.com/photos/cdZcNIca4w0",
  },
  {
    key: "sofia",
    image: "1569925444984-9e2e5fc3d1fb",
    credit: "Ayo Ogunseinde",
    source: "https://unsplash.com/photos/8VghbLlZUdQ",
  },
  {
    key: "clara",
    image: "1653512488965-c8a5b10427a4",
    credit: "Tim Mossholder",
    source: "https://unsplash.com/photos/IvIq2emytZE",
  },
  {
    key: "lucas",
    image: "1769961982389-bb243681421a",
    credit: "Maccy",
    source: "https://unsplash.com/photos/7fXswhCS9Fk",
  },
  {
    key: "oliver",
    image: "1590086782957-93c06ef21604",
    credit: "Ludovic Migneault",
    source: "https://unsplash.com/photos/EZ4TYgXPNWk",
  },
  {
    key: "camille",
    image: "1774011211544-dfd53584118b",
    credit: "Ionela Mat",
    source: "https://unsplash.com/photos/dKy82cGE0Rw",
  },
  {
    key: "emma",
    image: "1552334949-51934e5f2d38",
    credit: "Baylee Gramling",
    source: "https://unsplash.com/photos/RnHhR_sip7M",
  },
  {
    key: "lea",
    image: "1551386234-48770e28e791",
    credit: "Victória Kubiaki",
    source: "https://unsplash.com/photos/PcT8ygbVP4Y",
  },
  {
    key: "marais",
    image: "1746723378067-83a345ff3160",
    credit: "SumUp",
    source: "https://unsplash.com/photos/5xFEY6ZEE8g",
  },
  {
    key: "rive-gauche",
    image: "1781455793310-8427c96454c7",
    credit: "Barney Goodman",
    source: "https://unsplash.com/photos/AXurvQTtO3Y",
  },
  {
    key: "hair-service",
    image: "1675034743339-0b0747047727",
    credit: "Vinicius amnx Amano",
    source: "https://unsplash.com/photos/lK8oXGycy88",
  },
];
export function europeanDemoPlan(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const date = (offset: number) => {
    const day = new Date(today + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  };
  const employees = [
    {
      name: "Juliette Moreau",
      title: "Creative director",
      branch: 0,
      salary: 320000,
      commission: 1200,
      photo: "juliette",
      frequency: "monthly",
    },
    {
      name: "Sofia Rossi",
      title: "Colour specialist",
      branch: 0,
      salary: 280000,
      commission: 1000,
      photo: "sofia",
      frequency: "biweekly",
    },
    {
      name: "Clara Dubois",
      title: "Beauty therapist",
      branch: 1,
      salary: 250000,
      commission: 800,
      photo: "clara",
      frequency: "monthly",
    },
    {
      name: "Lucas Bernard",
      title: "Senior stylist",
      branch: 1,
      salary: 270000,
      commission: 1000,
      photo: "lucas",
      frequency: "weekly",
    },
  ];
  const customers = [
    {
      name: "Camille Martin",
      photo: "camille",
      note: "Prefers a soft, natural finish.",
    },
    {
      name: "Emma Laurent",
      photo: "emma",
      note: "Likes low-maintenance colour and warm tones.",
    },
    {
      name: "Oliver Reed",
      photo: "oliver",
      note: "Usually books an early afternoon appointment.",
    },
    {
      name: "Léa Bernard",
      photo: "lea",
      note: "Enjoys a polished blow-dry for special occasions.",
    },
    {
      name: "Anna Schmidt",
      photo: null,
      note: "Prefers fragrance-free finishing products.",
    },
    {
      name: "Lucie Moreau",
      photo: null,
      note: "Favourite service: signature cut and finish.",
    },
    { name: "Hugo Durand", photo: null, note: "Prefers a textured crop." },
    {
      name: "Inès Costa",
      photo: null,
      note: "Likes a short consultation before colour services.",
    },
    { name: "Eva Novak", photo: null, note: "Prefers quiet appointments." },
    {
      name: "Noah Andersson",
      photo: null,
      note: "Usually visits every four weeks.",
    },
    {
      name: "Mila Jansen",
      photo: null,
      note: "Likes a smooth finish and light styling.",
    },
    { name: "Alice Petit", photo: null, note: "Prefers weekend bookings." },
  ];
  const services = [
    {
      name: "Signature cut & finish",
      price: 6500,
      minutes: 60,
      icon: "haircut",
      photo: "hair-service",
    },
    {
      name: "Balayage & gloss",
      price: 14500,
      minutes: 120,
      icon: "color",
      photo: "hair-service",
    },
    {
      name: "Blow-dry & style",
      price: 4000,
      minutes: 45,
      icon: "wash",
      photo: "hair-service",
    },
    {
      name: "Gentlemen’s cut",
      price: 3800,
      minutes: 30,
      icon: "haircut",
      photo: null,
    },
    {
      name: "Hydrating facial",
      price: 8500,
      minutes: 60,
      icon: "facial",
      photo: null,
    },
    {
      name: "Express manicure",
      price: 3200,
      minutes: 30,
      icon: "nails",
      photo: null,
    },
    {
      name: "Brow shape & tint",
      price: 2800,
      minutes: 30,
      icon: "brows",
      photo: null,
    },
    {
      name: "Scalp ritual",
      price: 5500,
      minutes: 45,
      icon: "massage",
      photo: null,
    },
  ];
  const leaves = [
    {
      employee: 0,
      date: date(3),
      from: "09:00",
      until: "19:00",
      paid: true,
      reason: "Personal day",
    },
    {
      employee: 0,
      date: date(5),
      from: "09:00",
      until: "13:00",
      paid: false,
      reason: "Personal appointment",
    },
    {
      employee: 1,
      date: date(-6),
      from: "15:00",
      until: "19:00",
      paid: true,
      reason: "Annual leave",
    },
  ];
  const appointments: any[] = [];
  for (let offset = -28; offset <= 14; offset++) {
    if (offset !== 0 && offset % 3 === 0) continue;
    const slots = offset === 0 ? [9, 11, 14, 16] : [10, 14];
    slots.forEach((starts, index) => {
      const employee = (Math.abs(offset) + index) % employees.length,
        service = (Math.abs(offset) * 2 + index) % services.length;
      if (
        leaves.some(
          (l) =>
            l.employee === employee &&
            l.date === date(offset) &&
            starts < Number(l.until.slice(0, 2)) &&
            starts + services[service].minutes / 60 >
              Number(l.from.slice(0, 2)),
        )
      )
        return;
      let status =
        offset < 0
          ? "completed"
          : offset > 0
            ? "confirmed"
            : starts + services[service].minutes / 60 <= hour
              ? "completed"
              : "confirmed";
      if (offset < 0 && Math.abs(offset) % 11 === 0) status = "cancelled";
      else if (offset < 0 && Math.abs(offset) % 13 === 0) status = "no_show";
      appointments.push({
        date: date(offset),
        hour: starts,
        employee,
        service,
        customer: (Math.abs(offset) * 3 + index) % customers.length,
        status,
        advance: offset > 0 && index === 0,
      });
    });
  }
  const quickVisits: any[] = [];
  for (let index = 0; index < 24; index++)
    quickVisits.push({
      date: date(-1 - Math.floor(index / 2)),
      hour: 12 + (index % 5),
      employee: index % 4,
      service: (index + 2) % 8,
      customer: index % 12,
      walkin: index % 5 === 0,
      discount: index % 7 === 0 ? 500 : 0,
      tip: index % 3 === 0 ? 500 : 0,
    });
  for (let index = 0; index < 5; index++)
    quickVisits.push({
      date: today,
      hour: Math.min(Math.max(0, hour - 1), 10 + index),
      employee: index % 4,
      service: (index + 2) % 8,
      customer: index % 12,
      walkin: index === 3,
      discount: 0,
      tip: index % 2 ? 500 : 0,
    });
  return {
    syntheticDataOnly: true,
    salon: {
      name: "Maison Élan",
      slug: "maison-elan-demo",
      currency: "EUR",
      timezone: "Europe/Paris",
      address: "18 Rue des Archives, 75004 Paris, France",
      email: "bonjour@maison-elan.example",
      phone: "+33 1 00 00 20 24",
    },
    today,
    locations: [
      {
        name: "Le Marais",
        address: "18 Rue des Archives, 75004 Paris, France",
        photo: "marais",
      },
      {
        name: "Rive Gauche",
        address: "42 Rue du Cherche-Midi, 75006 Paris, France",
        photo: "rive-gauche",
      },
    ],
    employees,
    customers,
    services,
    leaves,
    appointments,
    quickVisits,
  };
}
