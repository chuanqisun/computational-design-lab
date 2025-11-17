export const materials = [
  {
    name: "Clear Glass",
    aliases: ["Flint Glass", "Transparent Glass"],
    physicalQuality: "Heavy, rigid, smooth, excellent barrier properties, highly recyclable.",
    emotionalQuality: "Premium, traditional, pure, trustworthy, high-quality.",
  },
  {
    name: "Amber Glass",
    aliases: ["Brown Glass"],
    physicalQuality: "Heavy, rigid, blocks UV light effectively, good barrier.",
    emotionalQuality: "Medicinal, heritage, protective, artisanal (often used for beer/spirits).",
  },
  {
    name: "Green Glass",
    aliases: ["Emerald Glass"],
    physicalQuality: "Heavy, rigid, offers moderate UV protection.",
    emotionalQuality: "Natural, organic, sophisticated, associated with wine.",
  },
  {
    name: "PET (Polyethylene Terephthalate)",
    aliases: ["Plastic Bottle", "Water Bottle Plastic"],
    physicalQuality: "Lightweight, shatterproof, transparent, good clarity, moderate barrier.",
    emotionalQuality: "Convenient, modern, affordable, everyday use.",
  },
  {
    name: "HDPE (High-Density Polyethylene)",
    aliases: ["Opaque Plastic"],
    physicalQuality: "Durable, opaque/translucent, excellent chemical resistance, slightly flexible.",
    emotionalQuality: "Sturdy, functional, reliable (common for milk, household cleaners).",
  },
  {
    name: "LDPE (Low-Density Polyethylene)",
    aliases: ["Squeeze Bottle Plastic"],
    physicalQuality: "Flexible, soft, translucent, good for dispensing.",
    emotionalQuality: "Accessible, pliable, easy to use.",
  },
  {
    name: "PP (Polypropylene)",
    aliases: ["Plastic Jar Material"],
    physicalQuality: "Heat resistant, semi-rigid, often used for caps/closures, good chemical resistance.",
    emotionalQuality: "Durable, versatile, safe for hot-fill applications.",
  },
  {
    name: "Aluminum (Bottle Form)",
    aliases: ["Metal Bottle"],
    physicalQuality: "Lightweight, highly recyclable, excellent barrier against light and oxygen, cool to the touch.",
    emotionalQuality: "Modern, sleek, sustainable (due to recycling rate), refreshing.",
  },
  {
    name: "Coated Aluminum (Interior)",
    aliases: ["Lined Metal Bottle"],
    physicalQuality: "Requires an internal polymer liner to prevent corrosion or flavor interaction.",
    emotionalQuality: "Secure, protected, high-performance.",
  },
  {
    name: "Bioplastics (PLA/PHA)",
    aliases: ["Compostable Plastic"],
    physicalQuality: "Derived from renewable resources, often rigid, varying barrier properties.",
    emotionalQuality: "Eco-conscious, innovative, responsible.",
  },
  {
    name: "Frosted Glass Finish",
    aliases: ["Etched Glass"],
    physicalQuality: "Textured, slightly diffused light transmission, feels soft.",
    emotionalQuality: "Elegant, soft-focus, luxurious, subtle.",
  },
  {
    name: "Matte Coated Plastic",
    aliases: ["Soft-Touch Plastic"],
    physicalQuality: "Non-reflective surface, tactile, reduces perceived gloss.",
    emotionalQuality: "Sophisticated, modern, high-end tactile experience.",
  },
  {
    name: "High-Gloss Plastic",
    aliases: ["Varnished Plastic"],
    physicalQuality: "Highly reflective, smooth, mimics glass shine.",
    emotionalQuality: "Vibrant, eye-catching, energetic.",
  },
];

export const shapes = [
  {
    name: "Cylindrical",
    aliases: ["Standard Round", "Tubular"],
    physicalQuality: "Uniform diameter from base to shoulder, maximizes labeling surface area, highly stable.",
    emotionalQuality: "Utilitarian, straightforward, reliable, traditional.",
  },
  {
    name: "Square/Rectangular",
    aliases: ["Boxy Bottle", "Cuboid"],
    physicalQuality: "Maximizes shelf density by eliminating gaps between units, strong structural integrity.",
    emotionalQuality: "Modern, architectural, bold, space-efficient.",
  },
  {
    name: "Shouldered (Apothecary Style)",
    aliases: ["Spirit Bottle", "Classic Liquor Shape"],
    physicalQuality:
      "Features a distinct, often steep transition from the neck to the main body; typically heavy glass.",
    emotionalQuality: "Heritage, premium, classic, established quality.",
  },
  {
    name: "Boston Round",
    aliases: ["Pharmacist Bottle", "Round Shoulder Bottle"],
    physicalQuality: "Rounded shoulder tapering to a narrow neck; very durable and resistant to tipping.",
    emotionalQuality: "Clinical, trustworthy, functional, laboratory standard.",
  },
  {
    name: "Flask/Flat Profile",
    aliases: ["Hip Flask Shape", "Pocket Bottle"],
    physicalQuality: "Thin profile, designed for portability and easy gripping, less stable when standing.",
    emotionalQuality: "Personal, portable, intimate, discreet.",
  },
  {
    name: "Teardrop/Ovoid",
    aliases: ["Egg Shape", "Organic Shape"],
    physicalQuality: "Curved, asymmetrical body that flows smoothly; often requires specialized filling equipment.",
    emotionalQuality: "Artisanal, luxurious, unique, soft, natural.",
  },
  {
    name: "Stubby",
    aliases: ["Short and Wide", "Beer Bottle Shape"],
    physicalQuality: "Short height relative to diameter, very stable base, often used for carbonated beverages.",
    emotionalQuality: "Casual, robust, accessible, traditional beverage feel.",
  },
  {
    name: "Slim/Tall",
    aliases: ["Elegant Cylinder", "Perfume Bottle"],
    physicalQuality: "High aspect ratio (tall and narrow), emphasizes verticality, often requires a stable base.",
    emotionalQuality: "Elegant, sophisticated, aspirational, delicate.",
  },
  {
    name: "Hourglass/Waisted",
    aliases: ["Contoured Bottle", "Curved Body"],
    physicalQuality: "Features a noticeable indentation or narrowing in the middle of the body for ergonomic grip.",
    emotionalQuality: "Ergonomic, sensual, distinctive, high-end spirits.",
  },
];

export const finishes = [
  {
    name: "High Gloss (Varnished)",
    aliases: ["Shiny Finish", "Lacquer Finish"],
    physicalQuality: "Highly reflective surface, smooth to the touch, maximizes color vibrancy.",
    emotionalQuality: "Energetic, new, eye-catching, traditional premium look.",
  },
  {
    name: "Matte (Soft Finish)",
    aliases: ["Flat Finish", "Satin Finish"],
    physicalQuality: "Non-reflective, diffuses light, often feels slightly velvety or smooth but not slick.",
    emotionalQuality: "Sophisticated, modern, understated luxury, calming.",
  },
  {
    name: "Frosted/Etched",
    aliases: ["Acid Etched", "Semi-Opaque"],
    physicalQuality:
      "Light is diffused, creating a soft, semi-transparent appearance; surface has a fine, slightly gritty texture.",
    emotionalQuality: "Elegant, delicate, ethereal, high-end cosmetic or spirit feel.",
  },
  {
    name: "Soft-Touch Coating",
    aliases: ["Rubberized Finish", "Velvet Coating"],
    physicalQuality:
      "A polymer coating applied to plastic or metal that provides a warm, slightly grippy, rubber-like tactile sensation.",
    emotionalQuality: "Luxurious tactile experience, intimate, high-quality grip.",
  },
  {
    name: "Embossed/Debossed Pattern",
    aliases: ["Raised Detail", "Molded Texture"],
    physicalQuality:
      "Three-dimensional texture molded directly into the material (glass or plastic), providing grip and visual depth.",
    emotionalQuality: "Artisanal, heritage, tactile engagement, structural interest.",
  },
  {
    name: "Sandblasted/Grit Finish",
    aliases: ["Abrasive Finish", "Rough Glass"],
    physicalQuality:
      "A coarse, visibly textured surface achieved by blasting the material with abrasive particles; highly tactile and opaque.",
    emotionalQuality: "Rustic, raw, natural, grounded, durable.",
  },
  {
    name: "Spot UV (Gloss on Matte)",
    aliases: ["Selective Varnish", "Contrast Finish"],
    physicalQuality:
      "A high-gloss coating applied only to specific areas (like a logo or band) over a matte base, creating sharp contrast.",
    emotionalQuality: "Dynamic, focused, contemporary, premium branding.",
  },
  {
    name: "Metallic/Chrome Plating",
    aliases: ["Mirror Finish", "Vacuum Metallization"],
    physicalQuality: "Extremely high reflectivity, often applied to plastic or aluminum; feels cool and slick.",
    emotionalQuality: "Futuristic, bold, high-impact, technological.",
  },
  {
    name: "Textured Grip Band",
    aliases: ["Knurled Finish", "Ribbed Surface"],
    physicalQuality:
      "A specific area (usually the lower body or neck) featuring parallel lines or a cross-hatch pattern for enhanced handling.",
    emotionalQuality: "Functional, secure, industrial, performance-oriented.",
  },
  {
    name: "Iridescent/Pearlescent",
    aliases: ["Opalescent", "Rainbow Sheen"],
    physicalQuality: "The surface shifts color slightly depending on the viewing angle due to microscopic layering.",
    emotionalQuality: "Magical, luxurious, cosmetic, ethereal.",
  },
];
