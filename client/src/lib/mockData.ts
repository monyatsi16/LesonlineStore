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
    name: 'Basotho Blanket - Seanamarena',
    price: 1250.00,
    moq: 1,
    supplier: 'Aranda Lesotho',
    rating: 4.8,
    reviews: 124,
    image: 'https://images.unsplash.com/photo-1584917666458-9679237227d8?q=80&w=800',
    category: 'Traditional Wear',
    specs: {
      'Material': '100% Virgin Wool',
      'Size': '155cm x 165cm',
      'Origin': 'Made in Lesotho',
      'Brand': 'Seanamarena'
    },
    stock: 45,
    description: 'Authentic 100% wool Basotho blanket, the iconic Seanamarena brand. A symbol of status and tradition in the Mountain Kingdom.'
  },
  {
    id: '2',
    name: 'Mokorotlo (Basotho Hat)',
    price: 350.00,
    moq: 5,
    supplier: 'Thaba-Bosiu Crafts',
    rating: 4.9,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1590005354167-6da97870c757?q=80&w=800',
    category: 'Crafts',
    specs: {
      'Material': 'Loti Grass',
      'Handmade': 'Yes',
      'Symbol': 'National Identity'
    },
    stock: 120,
    description: 'Hand-woven conical straw hat, the national symbol of Lesotho, traditionally worn by the Basotho people.'
  },
  {
    id: '3',
    name: 'Maluti Mountain Coffee - 500g',
    price: 185.00,
    moq: 10,
    supplier: 'Highland Roasters',
    rating: 4.7,
    reviews: 56,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=80&w=800',
    category: 'Food & Beverage',
    specs: {
      'Weight': '500g',
      'Roast': 'Medium-Dark',
      'Altitude': '2000m+'
    },
    stock: 200,
    description: 'Premium roasted coffee beans grown in the unique climate of the Lesotho highlands.'
  },
  {
    id: '4',
    name: 'Lesotho Highlands Honey',
    price: 95.00,
    moq: 20,
    supplier: 'Mountain Apiaries',
    rating: 4.9,
    reviews: 210,
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=800',
    category: 'Food & Beverage',
    specs: {
      'Type': 'Wild Blossom',
      'Purity': '100% Raw',
      'Location': 'Maluti Mountains'
    },
    stock: 15,
    description: 'Pure, organic wild blossom honey harvested from the pristine Maluti mountains.'
  }
];

export const PRICE_RECOMMENDATIONS: PriceRecommendation[] = [
  {
    id: 'r1',
    productId: '1',
    productName: 'Basotho Blanket - Seanamarena',
    currentPrice: 1250.00,
    recommendedPrice: 1325.00,
    confidence: 0.94,
    reason: 'Gradient Boosting: High seasonal demand residual. Residual 1 (Demand) is high.',
    timestamp: 'Just now',
    trend: 'up'
  },
  {
    id: 'r2',
    productId: '4',
    productName: 'Lesotho Highlands Honey',
    currentPrice: 95.00,
    recommendedPrice: 89.50,
    confidence: 0.88,
    reason: 'Gradient Boosting: Seasonal surplus identified. Residual 2 (Inventory) driving price drop.',
    timestamp: '10 mins ago',
    trend: 'down'
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
