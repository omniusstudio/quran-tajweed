// A short list of cities for setting the place in one tap (coordinates of the city centre, the
// IANA time zone, and the calculation method usual there). Anywhere else: geolocation or typed
// coordinates. Coordinates are rounded to 0.01°, which moves a prayer time by seconds at most.

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  method: string;
}

export const CITIES: City[] = [
  { name: 'دالاس', country: 'الولايات المتحدة', lat: 32.78, lon: -96.8, tz: 'America/Chicago', method: 'isna' },
  { name: 'هيوستن', country: 'الولايات المتحدة', lat: 29.76, lon: -95.37, tz: 'America/Chicago', method: 'isna' },
  { name: 'أوستن', country: 'الولايات المتحدة', lat: 30.27, lon: -97.74, tz: 'America/Chicago', method: 'isna' },
  { name: 'سان أنطونيو', country: 'الولايات المتحدة', lat: 29.42, lon: -98.49, tz: 'America/Chicago', method: 'isna' },
  { name: 'شيكاغو', country: 'الولايات المتحدة', lat: 41.88, lon: -87.63, tz: 'America/Chicago', method: 'isna' },
  { name: 'مينيابوليس', country: 'الولايات المتحدة', lat: 44.98, lon: -93.27, tz: 'America/Chicago', method: 'isna' },
  { name: 'نيويورك', country: 'الولايات المتحدة', lat: 40.71, lon: -74.01, tz: 'America/New_York', method: 'isna' },
  { name: 'واشنطن', country: 'الولايات المتحدة', lat: 38.91, lon: -77.04, tz: 'America/New_York', method: 'isna' },
  { name: 'ديترويت', country: 'الولايات المتحدة', lat: 42.33, lon: -83.05, tz: 'America/Detroit', method: 'isna' },
  { name: 'أتلانتا', country: 'الولايات المتحدة', lat: 33.75, lon: -84.39, tz: 'America/New_York', method: 'isna' },
  { name: 'ميامي', country: 'الولايات المتحدة', lat: 25.76, lon: -80.19, tz: 'America/New_York', method: 'isna' },
  { name: 'دنفر', country: 'الولايات المتحدة', lat: 39.74, lon: -104.99, tz: 'America/Denver', method: 'isna' },
  { name: 'فينيكس', country: 'الولايات المتحدة', lat: 33.45, lon: -112.07, tz: 'America/Phoenix', method: 'isna' },
  { name: 'لوس أنجلوس', country: 'الولايات المتحدة', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles', method: 'isna' },
  { name: 'سياتل', country: 'الولايات المتحدة', lat: 47.61, lon: -122.33, tz: 'America/Los_Angeles', method: 'isna' },
  { name: 'تورنتو', country: 'كندا', lat: 43.65, lon: -79.38, tz: 'America/Toronto', method: 'isna' },
  { name: 'الخرطوم', country: 'السودان', lat: 15.5, lon: 32.56, tz: 'Africa/Khartoum', method: 'egypt' },
  { name: 'أم درمان', country: 'السودان', lat: 15.64, lon: 32.48, tz: 'Africa/Khartoum', method: 'egypt' },
  { name: 'بورتسودان', country: 'السودان', lat: 19.62, lon: 37.22, tz: 'Africa/Khartoum', method: 'egypt' },
  { name: 'القاهرة', country: 'مصر', lat: 30.04, lon: 31.24, tz: 'Africa/Cairo', method: 'egypt' },
  { name: 'مكة المكرمة', country: 'السعودية', lat: 21.42, lon: 39.83, tz: 'Asia/Riyadh', method: 'makkah' },
  { name: 'المدينة المنورة', country: 'السعودية', lat: 24.47, lon: 39.61, tz: 'Asia/Riyadh', method: 'makkah' },
  { name: 'الرياض', country: 'السعودية', lat: 24.71, lon: 46.68, tz: 'Asia/Riyadh', method: 'makkah' },
  { name: 'جدة', country: 'السعودية', lat: 21.54, lon: 39.17, tz: 'Asia/Riyadh', method: 'makkah' },
  { name: 'دبي', country: 'الإمارات', lat: 25.2, lon: 55.27, tz: 'Asia/Dubai', method: 'makkah' },
  { name: 'الدوحة', country: 'قطر', lat: 25.29, lon: 51.53, tz: 'Asia/Qatar', method: 'makkah' },
  { name: 'الكويت', country: 'الكويت', lat: 29.38, lon: 47.98, tz: 'Asia/Kuwait', method: 'makkah' },
  { name: 'عمّان', country: 'الأردن', lat: 31.95, lon: 35.93, tz: 'Asia/Amman', method: 'mwl' },
  { name: 'إسطنبول', country: 'تركيا', lat: 41.01, lon: 28.98, tz: 'Europe/Istanbul', method: 'turkey' },
  { name: 'لندن', country: 'بريطانيا', lat: 51.51, lon: -0.13, tz: 'Europe/London', method: 'mwl' },
  { name: 'باريس', country: 'فرنسا', lat: 48.86, lon: 2.35, tz: 'Europe/Paris', method: 'france' },
  { name: 'برلين', country: 'ألمانيا', lat: 52.52, lon: 13.4, tz: 'Europe/Berlin', method: 'mwl' },
  { name: 'كراتشي', country: 'باكستان', lat: 24.86, lon: 67.0, tz: 'Asia/Karachi', method: 'karachi' },
  { name: 'كوالالمبور', country: 'ماليزيا', lat: 3.14, lon: 101.69, tz: 'Asia/Kuala_Lumpur', method: 'mwl' },
  { name: 'جاكرتا', country: 'إندونيسيا', lat: -6.21, lon: 106.85, tz: 'Asia/Jakarta', method: 'mwl' },
  { name: 'نيروبي', country: 'كينيا', lat: -1.29, lon: 36.82, tz: 'Africa/Nairobi', method: 'mwl' },
];
