import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Express } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function seedDemoData(userId: number, businessName: string) {
  await storage.createProduct({
    userId,
    name: "60cm Ceramic Hob",
    price: 4500.0,
    moq: 1,
    supplier: businessName,
    rating: 4.7,
    reviews: 12,
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
    category: "Built-in Hobs",
    specs: { Size: "60cm", Type: "Ceramic", Brand: "Generic" },
    stock: 20,
    description: "Standard 60cm ceramic hob for modern kitchens.",
  });

  await storage.createProduct({
    userId,
    name: "90cm Gas Cooktop",
    price: 8500.0,
    moq: 1,
    supplier: businessName,
    rating: 4.5,
    reviews: 8,
    image: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=400&fit=crop",
    category: "Gas Cooktops",
    specs: { Size: "90cm", Type: "Gas", Burners: "5" },
    stock: 15,
    description: "Professional 90cm gas cooktop with 5 burners.",
  });

  await storage.createProduct({
    userId,
    name: "Built-in Electric Oven",
    price: 12000.0,
    moq: 1,
    supplier: businessName,
    rating: 4.8,
    reviews: 22,
    image: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=400&h=400&fit=crop",
    category: "Ovens",
    specs: { Type: "Electric", Capacity: "65L", Features: "Fan-assisted" },
    stock: 8,
    description: "Premium built-in electric oven with fan-assisted cooking.",
  });

  await storage.createProduct({
    userId,
    name: "Countertop Microwave 30L",
    price: 2800.0,
    moq: 1,
    supplier: businessName,
    rating: 4.3,
    reviews: 35,
    image: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=400&h=400&fit=crop",
    category: "Microwaves",
    specs: { Capacity: "30L", Power: "900W", Type: "Countertop" },
    stock: 30,
    description: "Compact 30L countertop microwave with multiple power levels.",
  });

  await storage.createProduct({
    userId,
    name: "Double Door Refrigerator",
    price: 18500.0,
    moq: 1,
    supplier: businessName,
    rating: 4.9,
    reviews: 5,
    image: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&h=400&fit=crop",
    category: "Refrigerators",
    specs: { Type: "Double Door", Capacity: "420L", Energy: "A+" },
    stock: 6,
    description: "Energy-efficient double door refrigerator with frost-free technology.",
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const baseRevenue = 20000 + Math.random() * 30000;
  for (const month of months) {
    const variance = 0.7 + Math.random() * 0.6;
    await storage.createSalesData({
      userId,
      month,
      revenue: Math.round(baseRevenue * variance),
      orders: Math.round(10 + Math.random() * 30),
    });
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
      businessName: string;
      role: string;
    }
  }
}

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "smartprice-lesotho-secret-2024",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid email or password" });

          const isValid = await comparePasswords(password, user.password);
          if (!isValid) return done(null, false, { message: "Invalid email or password" });

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      const { password, ...safeUser } = user;
      done(null, safeUser as Express.User);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, businessName } = req.body;

      if (!email || !password || !name || !businessName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        businessName,
      });

      await seedDemoData(user.id, businessName);

      const { password: _, ...safeUser } = user;

      req.login(safeUser as Express.User, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(safeUser);
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      const { password, ...safeUser } = user;
      req.login(safeUser as Express.User, (err) => {
        if (err) return next(err);
        res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}
