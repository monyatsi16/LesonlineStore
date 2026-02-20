import machineImg from '../assets/products/machine.jpg';
import headphonesImg from '../assets/products/headphones.jpg';
import fabricImg from '../assets/products/fabric.jpg';
import smartwatchImg from '../assets/products/smartwatch.jpg';

export interface Product {
  id: string;
  name: string;
  price: number;
  moq: number; // Minimum Order Quantity
  supplier: string;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  specs: Record<string, string>;
  stock: number;
  description: string;
}

export interface PriceRecommendation {
  id: string;
  productId: string;
  productName: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  reason: string;
  timestamp: string;
  trend: 'up' | 'down' | 'stable';
}

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Industrial CNC Laser Cutting Machine 1000W Fiber',
    price: 15000.00,
    moq: 1,
    supplier: 'Shenzhen Laser Tech Co., Ltd',
    rating: 4.8,
    reviews: 124,
    image: machineImg,
    category: 'Machinery',
    specs: {
      'Power': '1000W',
      'Working Area': '1300*2500mm',
      'Laser Type': 'Fiber Laser',
      'Cooling Mode': 'Water Cooling'
    },
    stock: 5,
    description: 'High precision fiber laser cutting machine suitable for carbon steel, stainless steel, and aluminum. Includes 2-year warranty and onsite installation support.'
  },
  {
    id: '2',
    name: 'Wireless Noise Cancelling Headphones Bluetooth 5.3',
    price: 24.50,
    moq: 50,
    supplier: 'AudioMasters Electronics',
    rating: 4.5,
    reviews: 856,
    image: headphonesImg,
    category: 'Consumer Electronics',
    specs: {
      'Battery Life': '40 Hours',
      'Bluetooth': 'V5.3',
      'Driver': '40mm Dynamic',
      'Charging': 'USB-C'
    },
    stock: 2000,
    description: 'Premium sound quality with active noise cancellation. Bulk customization available for branding.'
  },
  {
    id: '3',
    name: '100% Cotton Canvas Fabric Rolls - 280GSM',
    price: 3.20,
    moq: 500,
    supplier: 'Global Textiles Ltd',
    rating: 4.9,
    reviews: 42,
    image: fabricImg,
    category: 'Apparel & Fabric',
    specs: {
      'Material': '100% Cotton',
      'Weight': '280GSM',
      'Width': '150cm',
      'Technics': 'Woven'
    },
    stock: 10000,
    description: 'Heavy duty cotton canvas suitable for bags, shoes, and home decor. Eco-friendly dyeing process.'
  },
  {
    id: '4',
    name: 'Smart Watch Series 8 Clone - Heart Rate Monitor',
    price: 12.80,
    moq: 100,
    supplier: 'Shenzhen Smart Wearables',
    rating: 4.2,
    reviews: 2100,
    image: smartwatchImg,
    category: 'Consumer Electronics',
    specs: {
      'Screen': '1.9 inch IPS',
      'Waterproof': 'IP67',
      'Battery': '280mAh',
      'App': 'FitPro'
    },
    stock: 5000,
    description: 'Best-selling smart watch with fitness tracking, sleep monitoring, and bluetooth calling.'
  }
];

export const PRICE_RECOMMENDATIONS: PriceRecommendation[] = [
  {
    id: 'r1',
    productId: '2',
    productName: 'Wireless Noise Cancelling Headphones',
    currentPrice: 24.50,
    recommendedPrice: 26.95,
    confidence: 0.92,
    reason: 'Gradient Boosting Model: High demand detected in North American region. Residual positive.',
    timestamp: '2 mins ago',
    trend: 'up'
  },
  {
    id: 'r2',
    productId: '4',
    productName: 'Smart Watch Series 8 Clone',
    currentPrice: 12.80,
    recommendedPrice: 11.50,
    confidence: 0.85,
    reason: 'Gradient Boosting Model: Market saturation increasing. Negative residual adjustment.',
    timestamp: '15 mins ago',
    trend: 'down'
  },
  {
    id: 'r3',
    productId: '3',
    productName: '100% Cotton Canvas Fabric',
    currentPrice: 3.20,
    recommendedPrice: 3.25,
    confidence: 0.65,
    reason: 'Gradient Boosting Model: Raw material costs rising. Slight positive residual.',
    timestamp: '1 hour ago',
    trend: 'stable'
  }
];

export const SALES_DATA = [
  { name: 'Jan', revenue: 4000, orders: 240 },
  { name: 'Feb', revenue: 3000, orders: 139 },
  { name: 'Mar', revenue: 2000, orders: 980 },
  { name: 'Apr', revenue: 2780, orders: 390 },
  { name: 'May', revenue: 1890, orders: 480 },
  { name: 'Jun', revenue: 2390, orders: 380 },
  { name: 'Jul', revenue: 3490, orders: 430 },
];
