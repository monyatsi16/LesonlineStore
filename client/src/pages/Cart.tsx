import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShieldCheck, ArrowRight } from "lucide-react";
import { PRODUCTS } from "@/lib/mockData";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const { toast } = useToast();
  // Mock cart items
  const [cartItems, setCartItems] = useState([
    { product: PRODUCTS[1], quantity: 50 },
    { product: PRODUCTS[3], quantity: 100 },
  ]);

  const subtotal = cartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const shipping = 150.00;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    toast({
      title: "Order Placed Successfully",
      description: `Order #${Math.floor(Math.random() * 10000)} has been sent to suppliers.`,
    });
    setCartItems([]);
  };

  const removeItem = (index: number) => {
    const newItems = [...cartItems];
    newItems.splice(index, 1);
    setCartItems(newItems);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-heading font-bold mb-6">Shopping Cart ({cartItems.length} items)</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-lg border">
                 <p className="text-muted-foreground mb-4">Your cart is empty.</p>
                 <Button onClick={() => window.location.href = '/'}>Continue Sourcing</Button>
               </div>
            ) : (
              cartItems.map((item, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4 flex gap-4">
                    <div className="h-24 w-24 bg-slate-100 rounded border p-2 flex-shrink-0">
                      <img src={item.product.image} alt={item.product.name} className="h-full w-full object-contain" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-sm truncate pr-4">{item.product.name}</h3>
                          <p className="text-xs text-muted-foreground mb-2">Supplier: {item.product.supplier}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-muted-foreground">Qty:</span>
                           <Input 
                             type="number" 
                             defaultValue={item.quantity} 
                             className="w-20 h-8 text-sm" 
                             min={item.product.moq}
                           />
                           <span className="text-xs text-muted-foreground">Min: {item.product.moq}</span>
                        </div>
                        <div className="font-bold text-lg">
                          M{(item.product.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">M{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping (Est.)</span>
                  <span className="font-medium">M{shipping.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">M{total.toFixed(2)}</span>
                </div>

                <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 flex gap-2 items-start">
                   <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                   <div>
                     <span className="font-bold block">Trade Assurance</span>
                     Payment protected until delivery confirmed.
                   </div>
                </div>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <Button className="w-full h-12 text-lg font-bold" onClick={handleCheckout} disabled={cartItems.length === 0}>
                  Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
