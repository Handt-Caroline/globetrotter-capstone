// The category filter chips shown on Explore, and the category options in
// the add/edit place form. One list so a place added in the form filters
// correctly under the matching chip (both use the `id`).

import {
  Landmark, Church, Palette, Users, Coffee, TreePine, BookOpen, UtensilsCrossed,
  Martini, Mic2, PartyPopper, Mountain, Flower2, ShoppingBag, Baby, Gem, Coins,
  Laptop, Compass, Flame, Trophy, Binoculars,
} from "lucide-react";

export const CATEGORIES = [
  { id: "all", label: "All places", icon: Compass, color: "#14b8a6" },
  { id: "landmarks", label: "Historical Landmarks", icon: Landmark, color: "#f97316" },
  { id: "museums", label: "Museums & Heritage", icon: Palette, color: "#ec4899" },
  { id: "religious", label: "Religious Sites", icon: Church, color: "#8b5cf6" },
  { id: "traditions", label: "Traditions & Craft", icon: Users, color: "#d97706" },
  { id: "streetfood", label: "Street Food", icon: Flame, color: "#ea580c" },
  { id: "restaurant", label: "Food & Restaurants", icon: UtensilsCrossed, color: "#ef4444" },
  { id: "cafe", label: "Cafés & Coffee", icon: Coffee, color: "#a16207" },
  { id: "shopping", label: "Markets & Shopping", icon: ShoppingBag, color: "#eab308" },
  { id: "nightlife", label: "Live Music & Nightlife", icon: Martini, color: "#db2777" },
  { id: "arts", label: "Performing Arts", icon: Mic2, color: "#7c3aed" },
  { id: "festivals", label: "Festivals & Events", icon: PartyPopper, color: "#f43f5e" },
  { id: "sports", label: "Football & Sport", icon: Trophy, color: "#0284c7" },
  { id: "viewpoints", label: "Viewpoints & Hills", icon: Binoculars, color: "#0d9488" },
  { id: "nature", label: "Nature & Parks", icon: TreePine, color: "#22c55e" },
  { id: "outdoor", label: "Outdoor & Hiking", icon: Mountain, color: "#16a34a" },
  { id: "hidden", label: "Hidden Gems", icon: Gem, color: "#a855f7" },
  { id: "library", label: "Libraries & Archives", icon: BookOpen, color: "#6366f1" },
  { id: "wellness", label: "Wellness & Spas", icon: Flower2, color: "#f472b6" },
  { id: "family", label: "Family & Kids", icon: Baby, color: "#0ea5e9" },
  { id: "budget", label: "Budget-Friendly / Free", icon: Coins, color: "#10b981" },
  { id: "coworking", label: "Coworking & Remote Work", icon: Laptop, color: "#64748b" },
];

// Just the choosable ones (everything except the "all" pseudo-filter).
export const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.id !== "all");
