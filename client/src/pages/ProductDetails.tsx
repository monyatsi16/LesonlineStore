import { Navbar } from "@/components/Navbar";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Truck, ShieldCheck, Heart, Share2, MessageSquare, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

export default function ProductDetails() {
  const [, params] = useRoute("/product/:id");
  const productId = params?.id;
  
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Product not found.</div>
      </div>
    );
  }

  const specs = (product.specs && typeof product.specs === 'object') ? product.specs as Record<string, string> : {};

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <div className="bg-slate-50 border-b">
        <div className="container mx-auto px-4 py-3 text-sm text-muted-foreground">
          <Link href="/">Home</Link> / {product.category} / <span className="text-foreground font-medium">{product.name}</span>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          
          <div className="md:col-span-5 lg:col-span-4">
            <div className="border rounded-lg overflow-hidden bg-white mb-4">
              <div className="aspect-square p-8 flex items-center justify-center">
                <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" data-testid="img-product" />
              </div>
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-5">
             <h1 className="text-2xl font-heading font-semibold text-foreground mb-4 leading-snug" data-testid="text-product-name">
               {product.name}
             </h1>

             <div className="flex items-center gap-4 text-sm mb-6 border-b pb-4">
               <div className="flex items-center gap-1 text-orange-500 font-bold">
                 <Star className="h-4 w-4 fill-current" />
                 {product.rating}
               </div>
               <div className="text-muted-foreground border-l pl-4">
                 <span className="text-foreground font-medium">{product.reviews}</span> Reviews
               </div>
             </div>

             <div className="bg-slate-50 p-4 rounded-lg border mb-6">
                <div className="mb-4">
                   <div className="text-sm text-muted-foreground mb-1">Price</div>
                   <div className="text-3xl font-bold text-primary" data-testid="text-product-price">M{product.price.toFixed(2)} <span className="text-sm font-normal text-slate-500">/ piece</span></div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                   <div className="text-muted-foreground">Min. Order:</div>
                   <div className="font-medium">{product.moq} Pieces</div>
                   
                   <div className="text-muted-foreground">Stock:</div>
                   <div className="font-medium">{product.stock} units</div>
                   
                   <div className="text-muted-foreground">Supplier:</div>
                   <div className="font-medium">{product.supplier}</div>
                </div>
             </div>

             <div className="flex flex-col gap-3">
               <div className="flex gap-3">
                 <Link href="/cart" className="flex-1">
                   <Button className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90" data-testid="button-start-order">
                     Start Order
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </Button>
                 </Link>
                 <Button variant="outline" className="flex-1 h-12 text-base font-semibold border-primary text-primary hover:bg-primary/5" data-testid="button-contact-supplier">
                   <MessageSquare className="mr-2 h-4 w-4" />
                   Contact Supplier
                 </Button>
               </div>
             </div>
          </div>

          <div className="hidden lg:block lg:col-span-3">
             <div className="border rounded-lg p-6 sticky top-24">
                <h3 className="font-bold text-lg mb-1">{product.supplier}</h3>
                <div className="flex items-center gap-2 mb-6">
                   <Badge variant="secondary" className="bg-slate-100">LSO</Badge>
                   <span className="text-xs text-muted-foreground">Authorized Dealer</span>
                </div>

                <div className="space-y-4 mb-6 text-sm">
                   <div className="flex justify-between border-b pb-2 border-dashed">
                      <span className="text-muted-foreground">Response Time</span>
                      <span className="font-medium">{"< 4h"}</span>
                   </div>
                   <div className="flex justify-between border-b pb-2 border-dashed">
                      <span className="text-muted-foreground">On-time Delivery</span>
                      <span className="font-medium">98.2%</span>
                   </div>
                </div>

                <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 flex gap-2 items-start mb-6">
                   <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                   <div>
                     <span className="font-bold block">Trade Assurance</span>
                     Protects your LESonline.Store orders
                   </div>
                </div>

                <Button variant="outline" className="w-full" data-testid="button-view-profile">View Company Profile</Button>
             </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 p-0 h-12">
              <TabsTrigger value="details" className="h-12 px-6 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Product Details</TabsTrigger>
              <TabsTrigger value="reviews" className="h-12 px-6 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Reviews ({product.reviews})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="p-8">
              <h3 className="text-lg font-bold mb-6">Overview</h3>
              
              <div className="mb-8">
                 <h4 className="font-medium mb-4 text-slate-900 bg-slate-100 p-2">Key Specifications</h4>
                 <Table>
                   <TableBody>
                     {Object.entries(specs).map(([key, value]) => (
                       <TableRow key={key}>
                         <TableCell className="bg-slate-50 w-1/3 font-medium text-muted-foreground">{key}</TableCell>
                         <TableCell>{value}</TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
              </div>

              <div>
                <h4 className="font-medium mb-4 text-slate-900 bg-slate-100 p-2">Product Description</h4>
                <p className="text-muted-foreground leading-relaxed max-w-3xl">
                  {product.description}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="p-8">
               <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <p>Reviews Content Placeholder</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
