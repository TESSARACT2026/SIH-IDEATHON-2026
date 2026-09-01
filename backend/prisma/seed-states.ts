import { PrismaClient, SourceType, VerificationStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// A stable UUID generator for our seeded locations to ensure upserts work correctly.
function generateStableUUID(name: string) {
  const hash = crypto.createHash('md5').update(name).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4000-8000-${hash.slice(12, 24)}`;
}

const statesData = [
  { region: 'Andhra Pradesh', destination: 'Visakhapatnam', attraction: 'Kailasagiri', lat: 17.6868, lng: 83.2185 },
  { region: 'Arunachal Pradesh', destination: 'Tawang', attraction: 'Tawang Monastery', lat: 27.5855, lng: 91.8617 },
  { region: 'Assam', destination: 'Guwahati', attraction: 'Kamakhya Temple', lat: 26.1445, lng: 91.7362 },
  { region: 'Bihar', destination: 'Bodh Gaya', attraction: 'Mahabodhi Temple', lat: 24.6951, lng: 84.9913 },
  { region: 'Chhattisgarh', destination: 'Raipur', attraction: 'Mahant Ghasidas Memorial Museum', lat: 21.2514, lng: 81.6296 },
  { region: 'Goa', destination: 'Goa', attraction: 'Baga Beach', lat: 15.2993, lng: 74.1240 },
  { region: 'Gujarat', destination: 'Ahmedabad', attraction: 'Sabarmati Ashram', lat: 23.0225, lng: 72.5714 },
  { region: 'Haryana', destination: 'Gurugram', attraction: 'Kingdom of Dreams', lat: 28.4595, lng: 77.0266 },
  { region: 'Himachal Pradesh', destination: 'Manali', attraction: 'Rohtang Pass', lat: 32.2396, lng: 77.1887 },
  { region: 'Jharkhand', destination: 'Ranchi', attraction: 'Dassam Falls', lat: 23.3441, lng: 85.3096 },
  { region: 'Karnataka', destination: 'Bengaluru', attraction: 'Lalbagh Botanical Garden', lat: 12.9716, lng: 77.5946 },
  { region: 'Kerala', destination: 'Munnar', attraction: 'Tea Gardens', lat: 10.0889, lng: 77.0595 },
  { region: 'Madhya Pradesh', destination: 'Bhopal', attraction: 'Sanchi Stupa', lat: 23.2599, lng: 77.4126 },
  { region: 'Maharashtra', destination: 'Mumbai', attraction: 'Gateway of India', lat: 18.9220, lng: 72.8347 },
  { region: 'Manipur', destination: 'Imphal', attraction: 'Loktak Lake', lat: 24.8170, lng: 93.9368 },
  { region: 'Meghalaya', destination: 'Shillong', attraction: 'Umiam Lake', lat: 25.5788, lng: 91.8933 },
  { region: 'Mizoram', destination: 'Aizawl', attraction: 'Durtlang Hills', lat: 23.7271, lng: 92.7176 },
  { region: 'Nagaland', destination: 'Kohima', attraction: 'Kohima War Cemetery', lat: 25.6701, lng: 94.1077 },
  { region: 'Odisha', destination: 'Bhubaneswar', attraction: 'Lingaraj Temple', lat: 20.2961, lng: 85.8245 },
  { region: 'Punjab', destination: 'Amritsar', attraction: 'Golden Temple', lat: 31.6200, lng: 74.8765 },
  { region: 'Rajasthan', destination: 'Jaipur', attraction: 'Amber Fort', lat: 26.9124, lng: 75.7873 },
  { region: 'Sikkim', destination: 'Gangtok', attraction: 'Nathu La Pass', lat: 27.3389, lng: 88.6065 },
  { region: 'Tamil Nadu', destination: 'Chennai', attraction: 'Marina Beach', lat: 13.0827, lng: 80.2707 },
  { region: 'Telangana', destination: 'Hyderabad', attraction: 'Charminar', lat: 17.3850, lng: 78.4867 },
  { region: 'Tripura', destination: 'Agartala', attraction: 'Ujjayanta Palace', lat: 23.8315, lng: 91.2868 },
  { region: 'Uttar Pradesh', destination: 'Agra', attraction: 'Taj Mahal', lat: 27.1767, lng: 78.0081 },
  { region: 'Uttarakhand', destination: 'Dehradun', attraction: "Robber's Cave", lat: 30.3165, lng: 78.0322 },
  { region: 'West Bengal', destination: 'Kolkata', attraction: 'Victoria Memorial', lat: 22.5726, lng: 88.3639 },
  // Union Territories
  { region: 'Andaman and Nicobar Islands', destination: 'Port Blair', attraction: 'Cellular Jail', lat: 11.6234, lng: 92.7265 },
  { region: 'Chandigarh', destination: 'Chandigarh', attraction: 'Rock Garden', lat: 30.7333, lng: 76.7794 },
  { region: 'Dadra and Nagar Haveli and Daman and Diu', destination: 'Daman', attraction: 'Jampore Beach', lat: 20.3974, lng: 72.8328 },
  { region: 'Delhi', destination: 'New Delhi', attraction: 'Red Fort', lat: 28.6139, lng: 77.2090 },
  { region: 'Jammu and Kashmir', destination: 'Srinagar', attraction: 'Dal Lake', lat: 34.0837, lng: 74.7973 },
  { region: 'Ladakh', destination: 'Leh', attraction: 'Pangong Lake', lat: 34.1526, lng: 77.5771 },
  { region: 'Lakshadweep', destination: 'Kavaratti', attraction: 'Agatti Island', lat: 10.5667, lng: 72.6417 },
  { region: 'Puducherry', destination: 'Pondicherry', attraction: 'Promenade Beach', lat: 11.9416, lng: 79.8083 },
];

async function main() {
  console.log('🌱 Starting Comprehensive India State Seed...\n');

  const genericSource = await prisma.source.upsert({
    where: { id: generateStableUUID('generic-source') },
    update: {},
    create: {
      id: generateStableUUID('generic-source'),
      name: 'General Tourism Dataset',
      sourceType: SourceType.COMMUNITY,
      reliabilityTier: 3,
    },
  });

  for (const state of statesData) {
    const destId = generateStableUUID(`dest-${state.destination}`);
    
    console.log(`🗺️ Upserting ${state.destination}, ${state.region}...`);
    
    const destination = await prisma.destination.upsert({
      where: { id: destId },
      update: {},
      create: {
        id: destId,
        name: state.destination,
        region: state.region,
        country: 'India',
        latitude: state.lat,
        longitude: state.lng,
        timezone: 'Asia/Kolkata',
      },
    });

    const attrId = generateStableUUID(`attr-${state.attraction}`);
    await prisma.attraction.upsert({
      where: { id: attrId },
      update: {},
      create: {
        id: attrId,
        destinationId: destination.id,
        name: state.attraction,
        categories: ['Heritage', 'Tourism'],
        latitude: state.lat,
        longitude: state.lng,
        indoorOutdoor: 'mixed',
        accessibilityWheelchair: false,
        accessibilityVisual: false,
        accessibilityHearing: true,
        description: `Popular tourist destination in ${state.region}.`,
      },
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
