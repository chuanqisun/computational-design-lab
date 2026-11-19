<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Scan Product Features

Extract product shapes, materials, mechanisms, and colors from a scanned photo (sent as an image part before the text) using only library-backed options; streamed JSON constrained by a library-enum schema.

- **Template:** `src/prompt-templates/studio-scan-product-features.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** image → json
- **Sources:** `src/lib/studio-ai.ts`, `src/studio-page.ts`
- **Categories:** studio, image-to-json, feature-extraction

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `shapes` | text | no | yes | Shape library options as `id (name)`; defaults to the full shape library. |
| `materials` | text | no | yes | Material library options as `id (name)`; defaults to the full material library. |
| `mechanisms` | text | no | yes | Mechanism library options as `id (name)`; defaults to the full mechanism library. |
| `colors` | text | no | yes | Color library names; defaults to the full color library. |

## Example: Shampoo Feature Library

Scan against a shampoo-oriented subset of library options.

### User

```text
Analyze this photo of a product. Ignore any text labels, background elements, hands, and other non-product objects. Focus only on the product itself. Identify the following features from the provided library options ONLY. Pick the closest matches.

Available shapes: boston-round (Boston Round), cosmo-oval (Cosmo Oval), tottle (Tottle)
Available materials: colored-hdpe (Colored HDPE), translucent-colored-pet (Translucent Colored PET)
Available mechanisms: flip-top-cap (Flip Top Cap), pump-dispenser (Pump Dispenser), disc-top-cap (Disc Top Cap)
Available colors: White, Ivory, Sea Green, Dark Slate Gray

For each identified feature, return:
- Shape: id, name, and description from library
- Material: id, name, and visual from library
- Mechanism: id, name, and interaction from library
- Color: name and hex from library

Pick only items that are visibly present on the product in the photo. Return empty arrays for categories not found.
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "shapes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": [
              "boston-round",
              "cosmo-round",
              "cosmo-oval",
              "cylinder-round",
              "oval-oblong",
              "square",
              "tottle",
              "trigger-spray-bottle",
              "f-style",
              "modern-round",
              "industrial-round",
              "dundee-oval",
              "pinch-grip",
              "teardrop",
              "beveled-rectangle"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "description"
        ]
      }
    },
    "materials": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": [
              "clear-pet",
              "translucent-colored-pet",
              "colored-hdpe",
              "aluminum",
              "glass"
            ]
          },
          "name": {
            "type": "string"
          },
          "visual": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "visual"
        ]
      }
    },
    "mechanisms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": [
              "pump-dispenser",
              "disc-top-cap",
              "flip-top-cap",
              "fine-mist-sprayer",
              "push-pull-spout-cap",
              "continuous-thread-screw-cap",
              "inverted-squeeze-bottle",
              "child-resistant-cap",
              "wall-mounted-press-dispenser",
              "automatic-touchless-dispenser"
            ]
          },
          "name": {
            "type": "string"
          },
          "interaction": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "interaction"
        ]
      }
    },
    "colors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "enum": [
              "Alice Blue",
              "Antique White",
              "Aqua",
              "Aquamarine",
              "Azure",
              "Beige",
              "Bisque",
              "Black",
              "Blanched Almond",
              "Blue",
              "Blue Violet",
              "Brown",
              "Burlywood",
              "Cadet Blue",
              "Chartreuse",
              "Chocolate",
              "Coral",
              "Cornflower Blue",
              "Cornsilk",
              "Crimson",
              "Dark Blue",
              "Dark Cyan",
              "Dark Goldenrod",
              "Dark Gray",
              "Dark Green",
              "Dark Khaki",
              "Dark Magenta",
              "Dark Olive Green",
              "Dark Orange",
              "Dark Orchid",
              "Dark Red",
              "Dark Salmon",
              "Dark Sea Green",
              "Dark Slate Blue",
              "Dark Slate Gray",
              "Dark Turquoise",
              "Dark Violet",
              "Deep Pink",
              "Deep Sky Blue",
              "Dim Gray",
              "Dodger Blue",
              "Firebrick",
              "Floral White",
              "Forest Green",
              "Fuchsia",
              "Gainsboro",
              "Ghost White",
              "Gold",
              "Goldenrod",
              "Gray",
              "Green",
              "Green Yellow",
              "Honeydew",
              "Hot Pink",
              "Indian Red",
              "Indigo",
              "Ivory",
              "Khaki",
              "Lavender",
              "Lavender Blush",
              "Lawn Green",
              "Lemon Chiffon",
              "Light Blue",
              "Light Coral",
              "Light Cyan",
              "Light Goldenrod Yellow",
              "Light Gray",
              "Light Green",
              "Light Pink",
              "Light Salmon",
              "Light Sea Green",
              "Light Sky Blue",
              "Light Slate Gray",
              "Light Steel Blue",
              "Light Yellow",
              "Lime",
              "Lime Green",
              "Linen",
              "Maroon",
              "Medium Aquamarine",
              "Medium Blue",
              "Medium Orchid",
              "Medium Purple",
              "Medium Sea Green",
              "Medium Slate Blue",
              "Medium Spring Green",
              "Medium Turquoise",
              "Medium Violet Red",
              "Midnight Blue",
              "Mint Cream",
              "Misty Rose",
              "Moccasin",
              "Navajo White",
              "Navy",
              "Old Lace",
              "Olive",
              "Olive Drab",
              "Orange",
              "Orange Red",
              "Orchid",
              "Pale Goldenrod",
              "Pale Green",
              "Pale Turquoise",
              "Pale Violet Red",
              "Papaya Whip",
              "Peach Puff",
              "Peru",
              "Pink",
              "Plum",
              "Powder Blue",
              "Purple",
              "Rebecca Purple",
              "Red",
              "Rosy Brown",
              "Royal Blue",
              "Saddle Brown",
              "Salmon",
              "Sandy Brown",
              "Sea Green",
              "Seashell",
              "Sienna",
              "Silver",
              "Sky Blue",
              "Slate Blue",
              "Slate Gray",
              "Snow",
              "Spring Green",
              "Steel Blue",
              "Tan",
              "Teal",
              "Thistle",
              "Tomato",
              "Turquoise",
              "Violet",
              "Wheat",
              "White",
              "White Smoke",
              "Yellow",
              "Yellow Green"
            ]
          },
          "hex": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "hex"
        ]
      }
    }
  },
  "required": [
    "shapes",
    "materials",
    "mechanisms",
    "colors"
  ]
}
```

## Presets

- **Shampoo Feature Library** — Scan against a shampoo-oriented subset of library options.
- **Mouthwash Feature Library** — Scan against oral care packaging options.
- **Refill Feature Library** — Scan against refill-focused pack options.
