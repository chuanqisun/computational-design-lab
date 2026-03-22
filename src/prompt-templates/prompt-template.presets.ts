const shampooSceneXml = `<scene>
  <subject>
    <product category="shampoo bottle">Tall rounded bottle with a soft shoulder, wide flip-top cap, and subtle front label recess.</product>
    <finish>Warm white PET body with a satin eucalyptus green cap and soft-touch label.</finish>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Minimal, bright, and clean</background>
  </setting>
  <camera lens="85mm" angle="three-quarter front" distance="mid" depth-of-field="shallow" />
  <lighting source="large softbox" direction="front-left" contrast="soft" colorTemperature="neutral daylight" />
  <style medium="Studio keyshot" grade="clean commercial product render" />
</scene>`;

const mouthwashSceneXml = `<scene>
  <subject>
    <product category="mouthwash bottle">Clear rectangular bottle with beveled shoulders, integrated dosage cap, and a crisp front label panel.</product>
    <liquid>Cool aqua rinse visible through the transparent body.</liquid>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Clinical, bright, and slightly reflective</background>
  </setting>
  <camera lens="100mm" angle="straight-on hero" distance="mid-close" depth-of-field="moderate" />
  <lighting source="strip lights" direction="side and top" contrast="medium" colorTemperature="cool daylight" />
  <style medium="Studio keyshot" grade="clinical premium retail" />
</scene>`;

const refillSceneXml = `<scene>
  <subject>
    <product category="refill pouch">Flexible stand-up pouch for haircare with a compact screw cap and folded gusset base.</product>
    <finish>Matte pearl film with a translucent product window.</finish>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Quiet, sustainable, and editorial</background>
  </setting>
  <camera lens="70mm" angle="slightly elevated" distance="mid" depth-of-field="shallow" />
  <lighting source="soft overhead panel" direction="top-front" contrast="soft" colorTemperature="warm neutral" />
  <style medium="Studio keyshot" grade="sustainable premium packaging render" />
</scene>`;

const shampooSelectionJson = `{
  "shapes": ["Tall rounded bottle", "Soft shoulder silhouette"],
  "materials": ["PET", "PP cap"],
  "surfaceOptions": ["Soft-touch matte label", "Satin cap"],
  "mechanisms": ["Flip-top cap"],
  "colors": ["Warm white", "Eucalyptus green"]
}`;

const mouthwashSelectionJson = `{
  "shapes": ["Rectangular bottle", "Beveled shoulder"],
  "materials": ["Clear PET", "PP dosing cap"],
  "surfaceOptions": ["Gloss bottle", "Matte label"],
  "mechanisms": ["Measured dosage cap"],
  "colors": ["Clear", "Aqua", "White"]
}`;

const refillSelectionJson = `{
  "shapes": ["Stand-up refill pouch", "Compact screw closure"],
  "materials": ["Flexible mono-material film"],
  "surfaceOptions": ["Matte pouch", "Clear product window"],
  "mechanisms": ["Screw cap"],
  "colors": ["Pearl white", "Deep forest green"]
}`;

export const canvasBlendImagesPresets = [
  {
    title: "Shampoo Botanical Merge",
    description: "Blend a hero bottle render with botanical references for a natural care concept.",
    values: {
      instruction: [
        "Blend the uploaded shampoo bottle render with the botanical reference image into one cohesive hero shot.",
        "Keep the bottle silhouette readable and let eucalyptus leaves influence only the supporting composition.",
      ],
      itemNotes: [
        "Reference 1: Rounded shampoo bottle with a matte off-white body and eucalyptus green cap.",
        "Reference 2: Dewy eucalyptus leaves on a pale stone surface with soft morning light.",
      ],
    },
  },
  {
    title: "Mouthwash Clinical Fusion",
    description: "Combine a mouthwash packshot with clean bathroom material cues.",
    values: {
      instruction: [
        "Blend the mouthwash bottle image with the bathroom material reference.",
        "Preserve the transparent aqua liquid and make the final image feel clinical but premium.",
      ],
      itemNotes: [
        "Reference 1: Transparent rectangular mouthwash bottle with integrated dosage cap.",
        "Reference 2: White tile, chrome, and diffused daylight from a modern bathroom interior.",
      ],
    },
  },
  {
    title: "Refill Pouch Editorial Composite",
    description: "Merge a refill pouch concept with sustainability cues for a calm editorial image.",
    values: {
      instruction: [
        "Blend the refill pouch render with the recycled paper and pebble texture reference.",
        "Aim for an editorial sustainability mood with restrained styling.",
      ],
      itemNotes: [
        "Reference 1: Stand-up shampoo refill pouch with pearl matte film and clear window.",
        "Reference 2: Recycled paper, smooth pebbles, and soft side light in a quiet neutral palette.",
      ],
    },
  },
];

export const canvasCaptionFromImagePresets = [
  {
    title: "Clinical Shelf Caption",
    description: "Short retail caption for a mouthwash image.",
    values: { instruction: "Describe this mouthwash bottle in a short retail-ready caption." },
  },
  {
    title: "Material Focus Caption",
    description: "Highlight finish and packaging details in one line.",
    values: { instruction: "Write a one-sentence caption focusing on material finish, cap design, and overall mood." },
  },
  {
    title: "Campaign Caption",
    description: "Generate a concise hero image caption for shampoo packaging.",
    values: { instruction: "Generate a concise campaign caption for this shampoo packaging image." },
  },
];

export const canvasDesignConceptsPresets = [
  {
    title: "Botanical Shampoo Range",
    description: "Concept generation from a natural haircare board.",
    values: {
      numDesigns: 3,
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
      requirements: [
        "Design a premium shampoo bottle for a botanical repair line.",
        "Use a rounded bottle form, matte surfaces, and restrained green accents.",
      ],
      referenceSummary: [
        "Reference card: eucalyptus leaves, pale stone, soft daylight, calm spa mood.",
        "Reference card: compact rounded bottle with generous shoulders and flip-top cap.",
      ],
    },
  },
  {
    title: "Family Mouthwash Concepts",
    description: "Explore approachable but trustworthy oral care concepts.",
    values: {
      numDesigns: 4,
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
      requirements: [
        "Create mouthwash packaging concepts that feel family-safe and clinically credible.",
        "Make dosage and clarity of use obvious from the form.",
      ],
      referenceSummary: [
        "Reference card: transparent aqua liquid, crisp white labels, bathroom shelf context.",
        "Reference card: beveled rectangular bottle with measurement cap and front label window.",
      ],
    },
  },
  {
    title: "Refill System Concepts",
    description: "Generate sustainable packaging concepts for refill-led haircare.",
    values: {
      numDesigns: 3,
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      requirements: [
        "Create refill-first shampoo packaging concepts for a premium sustainable line.",
        "Balance reduced plastic use with strong shelf presence.",
      ],
      referenceSummary: [
        "Reference card: stand-up pouch, mono-material film, compact cap, neutral editorial styling.",
        "Reference card: reusable countertop bottle paired with soft-touch labels and muted color blocking.",
      ],
    },
  },
];

export const canvasEnhanceImagePromptPresets = [
  {
    title: "Shampoo Hero Upgrade",
    description: "Rewrite a basic shampoo render prompt into a stronger commercial brief.",
    values: {
      originalPrompt: "A shampoo bottle on a white background",
      cardContext: [
        "Rounded botanical repair shampoo bottle with matte warm white body and eucalyptus green cap.",
        "The brand should feel premium, calm, and naturally science-backed.",
      ],
      qualityGoal: [
        "Push toward premium beauty advertising quality.",
        "Keep the prompt concise and image-model friendly.",
      ],
    },
  },
  {
    title: "Mouthwash Clarity Upgrade",
    description: "Improve a mouthwash prompt for transparency and clinical polish.",
    values: {
      originalPrompt: "A mouthwash bottle product shot",
      cardContext: [
        "Clear rectangular mouthwash bottle with visible aqua rinse and measured dosage cap.",
        "Target a clean pharmacy-plus-premium retail mood.",
      ],
      qualityGoal: ["Emphasize glasslike clarity, clean reflections, and label legibility."],
    },
  },
  {
    title: "Refill Editorial Upgrade",
    description: "Sharpen a refill pouch prompt into an editorial sustainability render.",
    values: {
      originalPrompt: "A refill pouch for shampoo",
      cardContext: [
        "Stand-up refill pouch with pearl matte finish, translucent window, and compact closure.",
        "The concept should feel elevated rather than utilitarian.",
      ],
      qualityGoal: ["Create a premium editorial render rather than a generic ecommerce image."],
    },
  },
];

export const canvasFillCardPresets = [
  {
    title: "Missing Title",
    description: "Complete a shampoo concept card missing its title.",
    values: {
      title: "",
      body: [
        "A rounded shampoo bottle inspired by eucalyptus leaves and smooth river stones.",
        "The pack should feel restorative, quiet, and premium without leaning overly clinical.",
      ],
      imagePrompt: ["Studio render of a warm white matte shampoo bottle with a eucalyptus green cap."],
      imageStatus: "image ready",
      guidance: ["Prioritize a short brandable title."],
    },
  },
  {
    title: "Missing Body",
    description: "Fill in descriptive copy for a mouthwash design card.",
    values: {
      title: "Measured Clarity",
      body: [],
      imagePrompt: [
        "Premium mouthwash bottle render, clear rectangular body, aqua rinse, white dosage cap, bright clinical studio lighting.",
      ],
      imageStatus: "image ready",
      guidance: ["Keep the body to two compact sentences and explain the dosage cap benefit."],
    },
  },
  {
    title: "Missing Image Prompt",
    description: "Generate a missing image prompt from card text for a refill concept.",
    values: {
      title: "Refill Ritual",
      body: [
        "A premium shampoo refill pouch designed for countertop rituals rather than hidden storage.",
        "Pearl matte film, a transparent fill window, and calm forest green accents make it feel elevated and sustainable.",
      ],
      imagePrompt: [],
      imageStatus: "no image attached",
      guidance: ["Include lighting, material finish, and camera angle in the generated prompt."],
    },
  },
];

export const canvasGenerateDefinitionPresets = [
  {
    title: "Define Soft-Touch Finish",
    description: "Explain a packaging finish used in beauty concepts.",
    values: { text: ["soft-touch matte finish"] },
  },
  {
    title: "Define Dosage Cap",
    description: "Clarify a functional mouthwash packaging term.",
    values: { text: ["measured dosage cap"] },
  },
  {
    title: "Define Mono-Material Refill",
    description: "Explain a sustainability term relevant to refill packaging.",
    values: { text: ["mono-material refill pouch"] },
  },
];

export const canvasGenerateImagePromptPresets = [
  {
    title: "Botanical Shampoo Prompt",
    description: "Turn a shampoo concept description into a render prompt.",
    values: {
      text: [
        "A rounded botanical repair shampoo bottle with a warm white body, eucalyptus green cap, and subtle recessed front label.",
      ],
      guidance: ["Use premium beauty-ad style lighting.", "Keep the scene minimal and studio-based."],
    },
  },
  {
    title: "Mouthwash Prompt",
    description: "Generate a premium prompt from an oral care description.",
    values: {
      text: [
        "A clear rectangular mouthwash bottle with beveled shoulders, visible aqua liquid, and a clean measured dosage cap.",
      ],
      guidance: ["Emphasize clinical clarity, crisp reflections, and legible front labeling."],
    },
  },
  {
    title: "Refill Pouch Prompt",
    description: "Create a studio prompt for a refill-first packaging concept.",
    values: {
      text: [
        "A premium shampoo refill pouch with pearl matte film, translucent product window, compact cap, and understated forest green accents.",
      ],
      guidance: ["Make it feel editorial and sustainable rather than generic ecommerce."],
    },
  },
];

export const canvasGeneratePersonasPresets = [
  {
    title: "Salon-Lite Shoppers",
    description: "Generate personas for a premium botanical shampoo segment.",
    values: {
      trait: "ingredient consciousness",
      segment: ["Premium shampoo shoppers", "Urban professionals"],
      numUsers: 3,
    },
  },
  {
    title: "Family Oral Care",
    description: "Create personas for approachable mouthwash packaging decisions.",
    values: {
      trait: "trust in clinical cues",
      segment: ["Parents shopping for family oral care"],
      numUsers: 4,
    },
  },
  {
    title: "Eco Refill Buyers",
    description: "Generate refill-oriented packaging personas.",
    values: {
      trait: "willingness to adopt refill systems",
      segment: ["Sustainability-minded personal care buyers"],
      numUsers: 3,
    },
  },
];

export const canvasGenerateTitleGeminiPresets = [
  {
    title: "Title From Shampoo Body",
    description: "Summarize a botanical shampoo concept into a short title.",
    values: {
      text: [
        "A restorative shampoo bottle concept inspired by eucalyptus leaves, smooth stone forms, and a calm spa ritual. The bottle uses a rounded shoulder silhouette and muted green cap to signal repair and softness.",
      ],
    },
  },
  {
    title: "Title From Mouthwash Brief",
    description: "Condense a mouthwash brief into a compact concept title.",
    values: {
      text: [
        "A clear mouthwash bottle designed around trust, dosage clarity, and premium retail restraint. The geometry is rectilinear, the cap measures the dose, and the label architecture stays crisp and clinical.",
      ],
    },
  },
  {
    title: "Title From Refill Concept",
    description: "Summarize a refill concept into a short naming seed.",
    values: {
      text: [
        "A countertop-friendly shampoo refill pouch that treats sustainability as a premium ritual. Soft pearl film, a translucent product window, and quiet forest tones make the format feel elevated.",
      ],
    },
  },
];

export const canvasGenerateTitleOpenaiPresets = [
  {
    title: "OpenAI Shampoo Title",
    description: "Generate a short title from a repair shampoo concept.",
    values: {
      fullText: [
        "This shampoo bottle concept pairs restorative botanical cues with a rounded, palm-friendly silhouette. Warm white surfaces, eucalyptus green accents, and minimal typography create a calm premium presence.",
      ],
    },
  },
  {
    title: "OpenAI Mouthwash Title",
    description: "Generate a short title from a mouthwash concept.",
    values: {
      fullText: [
        "The mouthwash bottle emphasizes dosage precision, visible formula clarity, and trusted pharmacy aesthetics. It uses a beveled rectangular body and a measured cap to communicate control and cleanliness.",
      ],
    },
  },
  {
    title: "OpenAI Refill Title",
    description: "Generate a short title from a refill-led design concept.",
    values: {
      fullText: [
        "This refill pouch concept reframes sustainable packaging as something premium enough to stay on the counter. The format is soft, minimal, and intentionally quiet, with a translucent fill window and pearl matte finish.",
      ],
    },
  },
];

export const canvasRankDesignsPresets = [
  {
    title: "Ingredient-Driven Ranking",
    description: "Rank shampoo concepts for an ingredient-conscious shopper.",
    values: {
      personaSummary:
        "You are a 34-year-old product designer who shops for shampoo based on ingredient transparency, calm aesthetics, and whether the pack looks credible in a premium bathroom.",
      trait: "premium",
      designCount: 3,
      designSummaries: [
        "A1: Rounded matte shampoo bottle with eucalyptus green cap and minimal recessed label.",
        "B2: Glossy shampoo bottle with high-contrast botanical graphics and metallic cap.",
        "C3: Refill pouch plus reusable countertop bottle system with soft neutral labeling.",
      ],
    },
  },
  {
    title: "Clinical Trust Ranking",
    description: "Rank mouthwash concepts for a trust-seeking oral care buyer.",
    values: {
      personaSummary:
        "You are a parent comparing mouthwash packs and care most about visible dosage cues, product clarity, and whether the design looks safe and clinically trustworthy.",
      trait: "trustworthy",
      designCount: 3,
      designSummaries: [
        "A1: Transparent aqua mouthwash bottle with measured dosage cap and crisp white label.",
        "B2: Dark opaque bottle with bold flavor graphics and neon accents.",
        "C3: Frosted bottle with soft blue cap and oversized ingredient callouts.",
      ],
    },
  },
  {
    title: "Sustainability Ranking",
    description: "Rank refill concepts for eco-oriented packaging users.",
    values: {
      personaSummary:
        "You actively choose refill systems when they feel easy to use and premium enough to justify countertop space.",
      trait: "sustainable",
      designCount: 3,
      designSummaries: [
        "A1: Mono-material refill pouch with reusable pump bottle companion.",
        "B2: Conventional rigid shampoo bottle with recycled plastic claim on pack.",
        "C3: Concentrate pod system with small reusable aluminum bottle.",
      ],
    },
  },
];

export const canvasScanConceptsPresets = [
  {
    title: "Extract Bottle Cues",
    description: "Pull key form and finish concepts from packaging references.",
    values: {
      instruction: [
        "Distill the key bottle form, finish, and brand mood concepts from the provided shampoo references.",
      ],
    },
  },
  {
    title: "Extract Oral Care Signals",
    description: "Identify concepts that make mouthwash packaging feel trustworthy.",
    values: {
      instruction: [
        "Identify the 3-5 strongest concepts that make the mouthwash references feel clinically trustworthy and easy to use.",
      ],
    },
  },
  {
    title: "Extract Refill Ideas",
    description: "Focus concept extraction on sustainability and ritual.",
    values: {
      instruction: [
        "Distill the key concepts around sustainability, refill behavior, and countertop desirability from these references.",
      ],
    },
  },
];

export const canvasScanMoodsPresets = [
  {
    title: "Calm Botanical Moods",
    description: "Analyze a shampoo concept for soft restorative moods.",
    values: {
      instruction: [
        "Analyze this shampoo packaging concept for moods and arousal levels with a focus on restorative botanical care.",
      ],
      outputCount: 5,
    },
  },
  {
    title: "Clinical Fresh Moods",
    description: "Analyze a mouthwash design for crisp oral care moods.",
    values: {
      instruction: [
        "Analyze this mouthwash concept for moods and arousal levels with attention to freshness, trust, and cleanliness.",
      ],
      outputCount: 4,
    },
  },
  {
    title: "Editorial Sustainable Moods",
    description: "Analyze a refill concept for quieter emotional tones.",
    values: {
      instruction: [
        "Analyze this refill packaging concept for moods and arousal levels, emphasizing sustainability and calm ritual.",
      ],
      outputCount: 5,
    },
  },
];

export const canvasScanMoodsSupervisedPresets = [
  {
    title: "Botanical Supervised",
    description: "Score a shampoo concept against a targeted mood list.",
    values: {
      instruction: ["Analyze this shampoo packaging concept for the required moods and arousal levels."],
      requiredList: ["Calm", "Restorative", "Premium", "Natural"],
    },
  },
  {
    title: "Mouthwash Supervised",
    description: "Score a mouthwash concept against trust-related moods.",
    values: {
      instruction: ["Analyze this mouthwash packaging concept for the required moods and arousal levels."],
      requiredList: ["Fresh", "Clinical", "Trustworthy", "Precise"],
    },
  },
  {
    title: "Refill Supervised",
    description: "Score a refill concept against sustainability moods.",
    values: {
      instruction: ["Analyze this refill packaging concept for the required moods and arousal levels."],
      requiredList: ["Sustainable", "Calm", "Modern", "Minimal"],
    },
  },
];

export const canvasVisualizeConceptPresets = [
  {
    title: "Visualize Shampoo Concept",
    description: "Create render prompts from a botanical shampoo concept.",
    values: {
      conceptTitle: "Eucalyptus Repair",
      conceptDescription: [
        "A rounded shampoo bottle with a soft shoulder profile, matte warm white body, and eucalyptus green cap.",
        "The concept should feel restorative, calm, and premium with subtle spa references.",
      ],
      instruction: ["Generate premium studio render prompts with restrained styling and beauty-ad polish."],
      maxPrompts: 3,
    },
  },
  {
    title: "Visualize Mouthwash Concept",
    description: "Create prompts from a clinical mouthwash concept.",
    values: {
      conceptTitle: "Measured Clarity",
      conceptDescription: [
        "A transparent mouthwash bottle with beveled shoulders, visible aqua formula, and a measured dosage cap.",
        "The design communicates trust, freshness, and controlled use.",
      ],
      instruction: ["Generate clean commercial prompts with crisp lighting and front-label legibility."],
      maxPrompts: 3,
    },
  },
  {
    title: "Visualize Refill Concept",
    description: "Create prompts from a refill-first packaging concept.",
    values: {
      conceptTitle: "Refill Ritual",
      conceptDescription: [
        "A pearl matte shampoo refill pouch intended to sit visibly on a bathroom shelf.",
        "It balances sustainability with premium editorial appeal and quiet color blocking.",
      ],
      instruction: ["Generate prompts that make the pouch feel elevated, tactile, and environmentally considered."],
      maxPrompts: 4,
    },
  },
];

export const studioGenerateSoundDescriptionPresets = [
  {
    title: "Shampoo Cap Flip Sound",
    description: "Describe sound for a shampoo product interaction.",
    values: {
      sceneXml: shampooSceneXml,
      animationPrompt: [
        "The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap.",
      ],
    },
  },
  {
    title: "Mouthwash Pour Sound",
    description: "Describe sound for a mouthwash dosage motion.",
    values: {
      sceneXml: mouthwashSceneXml,
      animationPrompt: [
        "The bottle tilts into the dosage cap, the liquid glugs once, then the cap clicks back onto the bottle.",
      ],
    },
  },
  {
    title: "Refill Pouch Decant Sound",
    description: "Describe sound for a refill pouch transfer.",
    values: {
      sceneXml: refillSceneXml,
      animationPrompt: [
        "A refill pouch unscrews, softly flexes, and pours product into a reusable bottle before being sealed again.",
      ],
    },
  },
];

export const studioImportCanvasInstructionsPresets = [
  {
    title: "Import Shampoo Cards",
    description: "Import two shampoo concept cards into studio instructions.",
    values: {
      cardDescriptions: [
        "Eucalyptus Repair\nA rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.",
        "Soft Shoulder Ritual\nA palm-friendly silhouette that makes restorative care feel premium and tactile.",
      ],
    },
  },
  {
    title: "Import Mouthwash Cards",
    description: "Import mouthwash concept cards into studio instructions.",
    values: {
      cardDescriptions: [
        "Measured Clarity\nA transparent mouthwash bottle built around trust, visible formula clarity, and an intuitive dosage cap.",
        "Fresh Precision\nClinical geometry and crisp label architecture for a premium pharmacy shelf presence.",
      ],
    },
  },
  {
    title: "Import Refill Cards",
    description: "Import refill-led packaging concepts into studio instructions.",
    values: {
      cardDescriptions: [
        "Refill Ritual\nA countertop-worthy shampoo refill pouch with pearl matte film and a translucent product window.",
        "Countertop System\nReusable primary bottle plus elegant refill format designed for sustainable routines.",
      ],
    },
  },
];

export const studioReviseSceneXmlPresets = [
  {
    title: "Revise For Softer Light",
    description: "Adjust a shampoo scene toward warmer, gentler presentation.",
    values: {
      editInstructions: [
        "Keep the bottle geometry unchanged.",
        "Soften the lighting, warm the color temperature slightly, and make the label feel more tactile and premium.",
      ],
    },
  },
  {
    title: "Revise For Dosage Demo",
    description: "Revise a mouthwash scene for clearer cap interaction cues.",
    values: {
      editInstructions: [
        "Update the subject description so the measured dosage cap reads more clearly in the scene.",
        "Preserve the clean studio environment and emphasize liquid visibility.",
      ],
    },
  },
  {
    title: "Revise For Sustainability",
    description: "Push a refill concept toward a more tactile sustainable mood.",
    values: {
      editInstructions: [
        "Make the refill pouch material feel more premium and mono-material.",
        "Introduce subtle cues that it belongs in a calm, sustainable bathroom ritual.",
      ],
    },
  },
];

export const studioScanProductFeaturesPresets = [
  {
    title: "Shampoo Feature Library",
    description: "Scan against a shampoo-oriented set of library options.",
    values: {
      shapes: ["Tall rounded bottle", "Soft shoulder silhouette", "Wide oval footprint"],
      materials: ["PET", "HDPE", "PP cap"],
      mechanisms: ["Flip-top cap", "Pump", "Screw cap"],
      colors: ["Warm white", "Eucalyptus green", "Charcoal", "Amber"],
    },
  },
  {
    title: "Mouthwash Feature Library",
    description: "Scan against oral care packaging options.",
    values: {
      shapes: ["Rectangular bottle", "Beveled shoulder bottle", "Tall cylindrical bottle"],
      materials: ["Clear PET", "PETG", "PP dosing cap"],
      mechanisms: ["Measured dosage cap", "Child-safe screw cap", "Flip cap"],
      colors: ["Clear", "Aqua", "White", "Cool blue"],
    },
  },
  {
    title: "Refill Feature Library",
    description: "Scan against refill-focused pack options.",
    values: {
      shapes: ["Stand-up refill pouch", "Slim refill carton", "Compact concentrate pod"],
      materials: ["Mono-material film", "Flexible PE pouch", "Paper-laminate carton"],
      mechanisms: ["Screw cap", "Spout", "Snap fit closure"],
      colors: ["Pearl white", "Forest green", "Stone", "Transparent"],
    },
  },
];

export const studioStagePhotoScenePresets = [
  {
    title: "Bathroom Shelf Shampoo",
    description: "Place the shampoo bottle in a calm bathroom shelf scene.",
    values: {
      currentXml: shampooSceneXml,
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
      scene: [
        "Stage the bottle on a premium bathroom shelf with folded towels, pale stone, and diffused morning light.",
      ],
    },
  },
  {
    title: "Sinkside Mouthwash",
    description: "Place the mouthwash bottle near a sink for a usage-oriented photo scene.",
    values: {
      currentXml: mouthwashSceneXml,
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
      scene: [
        "Place the bottle beside a clean sink with white tile, chrome reflections, and a subtle dental-care context.",
      ],
    },
  },
  {
    title: "Editorial Refill Scene",
    description: "Stage a refill pouch in a restrained sustainable editorial environment.",
    values: {
      currentXml: refillSceneXml,
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      scene: ["Place the refill pouch on a pale stone counter with recycled paper props and soft side lighting."],
    },
  },
];

export const studioSynthesizeSceneXmlPresets = [
  {
    title: "Synthesize Shampoo Scene",
    description: "Generate scene XML from shampoo selections and instructions.",
    values: {
      selectionJson: shampooSelectionJson,
      photoCount: 1,
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
      customInstructions: [
        "Design a bottle inspired by calm botanical repair rituals.",
        "Keep the presentation premium, tactile, and suitable for a beauty campaign render.",
      ],
    },
  },
  {
    title: "Synthesize Mouthwash Scene",
    description: "Generate scene XML from mouthwash library selections.",
    values: {
      selectionJson: mouthwashSelectionJson,
      photoCount: 0,
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
      customInstructions: [
        "Create a premium mouthwash bottle scene that emphasizes trust, dosage clarity, and visible formula freshness.",
      ],
    },
  },
  {
    title: "Synthesize Refill Scene",
    description: "Generate scene XML for a refill-led personal care concept.",
    values: {
      selectionJson: refillSelectionJson,
      photoCount: 2,
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      customInstructions: [
        "Treat the refill pouch as premium enough for countertop display.",
        "Balance sustainable cues with a refined editorial studio render.",
      ],
    },
  },
];
