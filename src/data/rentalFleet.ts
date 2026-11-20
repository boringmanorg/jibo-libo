/**
 * XTSY Rentals self-drive fleet and bikes. Owner, 21 Nov 2026: this car list and these daily rates
 * replace the earlier (diesel) list; every car is petrol except the Toyota Innova Crysta (diesel).
 * Rates are per day with 400 km included. Browser-safe; used by /tours/xtsy-rentals and /book.
 */
export type Vehicle = {
  name: string;
  /** Per-day rate in INR. Omit for vehicles quoted on enquiry. */
  price?: number;
  tag: string;
  specs: string[];
  badge?: string;
  note?: string;
  /** Key into rentalPhotos for the vehicle's photograph. */
  photo?: string;
};

const car = (name: string, price: number, tag: string, seats: number, fuel: 'Petrol' | 'Diesel', photo: string, badge?: string): Vehicle =>
  ({ name, price, tag, specs: [fuel, `${seats} seats`, '400 km/day'], photo, ...(badge ? { badge } : {}) });

export const CARS: Vehicle[] = [
  car('Suzuki Ignis', 1800, 'Compact hatchback', 5, 'Petrol', 'car-ignis'),
  car('Suzuki Swift', 2000, 'Hatchback', 5, 'Petrol', 'car-swift'),
  car('Maruti Baleno', 2250, 'Premium hatchback', 5, 'Petrol', 'car-baleno'),
  car('Hyundai i20', 2250, 'Premium hatchback', 5, 'Petrol', 'car-i20'),
  car('Tata Punch', 2400, 'Micro SUV', 5, 'Petrol', 'car-punch'),
  car('Hyundai Venue', 2600, 'Compact SUV', 5, 'Petrol', 'car-venue'),
  car('Toyota Urban Cruiser', 2600, 'Compact SUV', 5, 'Petrol', 'car-urban-cruiser'),
  car('Kia Sonet', 2800, 'Compact SUV', 5, 'Petrol', 'car-sonet'),
  car('Suzuki Ertiga', 3000, 'Family MPV', 7, 'Petrol', 'car-ertiga'),
  car('Kia Carens', 3500, 'Family MPV', 7, 'Petrol', 'car-carens'),
  car('Toyota Innova Crysta', 4200, 'Premium MPV', 7, 'Diesel', 'car-innova-crysta', 'Diesel'),
];

export const BIKES: Vehicle[] = [
  { name: 'RE Meteor 350', price: 1300, tag: 'Cruiser', specs: ['350cc', '42 km/l'], photo: 'bike-meteor-350' },
  { name: 'RE Himalayan 411', price: 1300, tag: 'Adventure', specs: ['411cc', '35 km/l'], photo: 'bike-himalayan-411' },
  { name: 'RE Hunter 350', price: 1600, tag: 'Roadster', specs: ['350cc', '40 km/l'], photo: 'bike-hunter-350' },
  { name: 'RE Himalayan 450', price: 1800, tag: 'Adventure', specs: ['450cc', '30 km/l'], badge: 'New 2024', photo: 'bike-himalayan-450' },
];

export const CAR_FROM = Math.min(...CARS.map((c) => c.price ?? Infinity));
export const BIKE_FROM = Math.min(...BIKES.map((b) => b.price ?? Infinity));
