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
    name: 'Smeg 90cm Black Ceramic Electric Hob - SE495ETD',
    price: 15500.00,
    moq: 1,
    supplier: 'Smeg Official',
    rating: 4.9,
    reviews: 42,
    image: 'https://lesonline.store/cdn/shop/files/5tvn5vzg.png?v=1753355592&width=533',
    category: 'Built-in Hobs',
    specs: {
      'Size': '90cm',
      'Material': 'Black Ceramic',
      'Type': 'Electric Hob',
      'Brand': 'Smeg'
    },
    stock: 12,
    description: 'Premium Smeg 90cm black ceramic electric hob with multicooking technology.'
  },
  {
    id: '2',
    name: 'Whirlpool 60cm Glass Hob - AKT8090/NE',
    price: 4500.00,
    moq: 1,
    supplier: 'Whirlpool Authorized',
    rating: 4.7,
    reviews: 28,
    image: 'https://lesonline.store/cdn/shop/files/ff3vyxzo.png?v=1697570992&width=533',
    category: 'Built-in Hobs',
    specs: {
      'Size': '60cm',
      'Material': 'Glass',
      'Brand': 'Whirlpool'
    },
    stock: 25,
    description: 'Sleek Whirlpool 60cm glass hob for modern kitchens.'
  },
  {
    id: '3',
    name: 'DEFY-COMBINATION HOB - DHG605',
    price: 6500.00,
    moq: 1,
    supplier: 'Defy Store',
    rating: 4.8,
    reviews: 56,
    image: 'https://lesonline.store/cdn/shop/files/WhatsAppImage2023-06-26at19.08.28.jpg?v=1691657007&width=533',
    category: 'Built-in Hobs',
    specs: {
      'Brand': 'Defy',
      'Type': 'Combination',
      'Model': 'DHG605'
    },
    stock: 18,
    description: 'Versatile Defy combination hob with gas and electric burners.'
  },
  {
    id: '4',
    name: 'AEG 60cm Touch Control Ceramic Hob – HRB64600CB',
    price: 4250.00,
    moq: 1,
    supplier: 'AEG Lesotho',
    rating: 4.6,
    reviews: 15,
    image: 'https://lesonline.store/cdn/shop/products/AP105636-1.webp?v=1678805439&width=533',
    category: 'Built-in Hobs',
    specs: {
      'Brand': 'AEG',
      'Control': 'Touch',
      'Size': '60cm'
    },
    stock: 8,
    description: 'High-performance AEG ceramic hob with precise touch control.'
  },
  {
    id: '5',
    name: 'Siemens iQ700 90cm Black Gas on Glass Hob',
    price: 19500.00,
    moq: 1,
    supplier: 'Siemens Premium',
    rating: 5.0,
    reviews: 10,
    image: 'https://lesonline.store/cdn/shop/files/mnrad76o.png?v=1769070854&width=533',
    category: 'Built-in Hobs',
    specs: {
      'Brand': 'Siemens',
      'Type': 'Gas on Glass',
      'Series': 'iQ700'
    },
    stock: 5,
    description: 'Top-tier Siemens iQ700 gas on glass hob for professional-grade home cooking.'
  }
];

export const PRICE_RECOMMENDATIONS: PriceRecommendation[] = [
  {
    id: 'r1',
    productId: '1',
    productName: 'Smeg 90cm Black Ceramic Electric Hob',
    currentPrice: 15500.00,
    recommendedPrice: 14850.00,
    confidence: 0.92,
    reason: 'Gradient Boosting: Competitor stock surplus detected. Negative residual to maintain market share.',
    timestamp: 'Just now',
    trend: 'down'
  },
  {
    id: 'r2',
    productId: '2',
    productName: 'Whirlpool 60cm Glass Hob',
    currentPrice: 4500.00,
    recommendedPrice: 4725.00,
    confidence: 0.85,
    reason: 'Gradient Boosting: High demand for compact hobs. Positive demand residual.',
    timestamp: '5 mins ago',
    trend: 'up'
  },
  {
    id: 'r3',
    productId: '5',
    productName: 'Siemens iQ700 90cm Gas on Glass Hob',
    currentPrice: 19500.00,
    recommendedPrice: 20100.00,
    confidence: 0.95,
    reason: 'Gradient Boosting: Premium segment growth residual. Competitor prices rising.',
    timestamp: '15 mins ago',
    trend: 'up'
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
