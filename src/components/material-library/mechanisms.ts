export const mechanisms = [
  {
    id: "pump-dispenser",
    name: "Pump Dispenser",
    interaction:
      "The user places one hand under the spout and presses down on the pump head with the other hand. A piston mechanism draws product up through a dip tube and dispenses a measured dose through the nozzle. Releasing the pump head allows the spring to reset the mechanism for the next stroke.",
    acoustics:
      "A soft mechanical click or creak at the start of the downstroke, followed by a wet gurgling or slurping sound as product is drawn up through the dip tube. The dispensed product lands with a quiet, viscous splat. On the return stroke, there is a faint hiss of air being drawn back into the chamber and a light spring-loaded snap as the pump head returns to its resting position.",
    haptics:
      "Initial resistance is felt as the spring compresses under the fingertip or palm. There is a smooth, dampened downward travel with a subtle internal detent at the start. Mid-stroke, a slight hydraulic resistance is felt as the piston pressurizes the chamber. At the bottom of the stroke, a firm stop is reached. On release, the spring pushes the pump head back up with a light, steady rebound force against the fingers.",
    interactionOptions: [
      "Press down on pump head with fingertips",
      "Press down on pump head with palm",
      "Release pump head to let spring reset",
      "Repeat pump strokes for additional product",
      "Twist pump head to unlock from closed/locked travel position",
      "Twist pump head to lock into closed travel position",
      "Hold hand or container under spout to catch dispensed product",
    ],
  },
  {
    id: "disc-top-cap",
    name: "Disc Top Cap",
    interaction:
      "The user presses down on one side of a flat, circular disc embedded in the cap. The opposite side pivots upward to reveal a dispensing orifice. The user then inverts or squeezes the bottle to dispense product through the opening. Pressing the raised side back down re-seals the closure flush with the cap surface.",
    acoustics:
      "A short, crisp plastic click or pop when the disc is pressed and the opposite side snaps upward. Squeezing the bottle produces a soft, muffled crinkle of the plastic body followed by a quiet, thick gurgle as product exits the orifice. Re-closing produces another light plastic snap or click as the disc seats back into its flush position.",
    haptics:
      "A brief, firm resistance under the fingertip before the disc pivots — then a sudden, satisfying give as it pops open. The raised side of the disc protrudes slightly, providing a tactile cue that the cap is open. Squeezing the bottle requires moderate hand pressure against the flexible plastic walls. Re-closing involves pressing the raised edge down with a fingertip until a small detent is felt and the disc locks flush.",
    interactionOptions: [
      "Press down on one side of disc with fingertip to pop open",
      "Squeeze the bottle body to dispense product",
      "Invert the bottle to let gravity assist dispensing",
      "Tilt the bottle at an angle to control flow rate",
      "Press the raised side of disc back down with fingertip to close",
      "Tap the bottom of the bottle to encourage product flow",
    ],
  },
  {
    id: "flip-top-cap",
    name: "Flip Top Cap",
    interaction:
      "The user grips the bottle and pushes the hinged lid upward with a thumb or fingertip until it swings open past its vertical position, revealing the dispensing orifice. The bottle is then inverted and squeezed to dispense product. To close, the user pushes the lid back down until it snaps shut.",
    acoustics:
      "A distinct plastic snap or click when the lid is flipped open, as the hinge passes its detent point. Squeezing the bottle produces a soft crinkle of plastic and a wet, low-pitched squirt or glug as product exits. Closing produces a second, slightly sharper snap as the lid locks back into the closed position.",
    haptics:
      "A small resistance is felt at the hinge detent as the lid is pushed open, followed by a sudden release as it swings freely past the tipping point. The hinge has a slightly stiff, springy quality. When squeezing the bottle, the user feels the flexible walls compress under hand pressure. Closing requires pressing the lid down against a slight resistance until a positive, tactile click confirms the seal.",
    interactionOptions: [
      "Push the hinged lid upward with thumb",
      "Push the hinged lid upward with fingertip",
      "Flick the lid open with thumbnail",
      "Grip the lid tab and pull upward",
      "Squeeze the bottle body to dispense product",
      "Invert the bottle to let gravity assist dispensing",
      "Tilt the bottle at an angle to control flow rate",
      "Push the lid down with thumb to snap shut",
      "Press the lid closed against a flat surface",
      "Tap the bottom of the bottle to encourage product flow",
    ],
  },
  {
    id: "fine-mist-sprayer",
    name: "Fine Mist Sprayer",
    interaction:
      "The user presses down on a small actuator button on top of the bottle with a fingertip. This forces liquid through a precision nozzle that breaks the stream into tiny droplets. Often used for 'dry' shampoos or leave-in conditioning treatments.",
    acoustics:
      "A sharp, airy 'psst' or 'shhh' sound as the liquid is atomized. This is preceded by a tiny mechanical click of the actuator and followed by a faint, hollow suction sound as the pump chamber refills.",
    haptics:
      "A high-tension spring resistance that requires a quick, decisive press. The travel is short and ends in a firm bottom-out. The user feels a very slight vibration in the bottle as the liquid is forced through the atomizer nozzle.",
    interactionOptions: [
      "Press down on actuator button with index finger",
      "Press down on actuator button with thumb",
      "Release actuator to let spring reset",
      "Repeat spray strokes for wider coverage",
      "Aim nozzle direction before pressing",
      "Remove protective dust cap before first use",
      "Replace protective dust cap after use",
      "Prime the pump with several initial presses before first use",
      "Shake the bottle before spraying",
    ],
  },
  {
    id: "push-pull-spout-cap",
    name: "Push-Pull Spout Cap",
    interaction:
      "The user grips the spout nozzle between the thumb and forefinger (or pulls it up with the teeth) and lifts it upward until it locks in the open position, exposing the dispensing orifice. The bottle is then squeezed or tilted to dispense. To close, the user pushes the spout straight back down until it seats flush with the cap.",
    acoustics:
      "A soft, slightly gritty plastic sliding sound as the spout is pulled upward, sometimes ending with a faint click as it reaches the open detent. Dispensing produces a quiet squirt or stream sound depending on product viscosity. Pushing the spout back down produces a similar sliding friction sound followed by a muted plastic pop or thud as it seats closed.",
    haptics:
      "A steady, linear pulling resistance is felt as the spout slides upward against friction — the motion is smooth but firm. A subtle detent or stop is felt when the spout reaches its fully open position. The spout nozzle is small and narrow, requiring a pinch grip. Pushing it closed requires moderate downward thumb pressure against friction until a slight bottoming-out sensation confirms the seal.",
    interactionOptions: [
      "Grip spout nozzle between thumb and forefinger and pull upward",
      "Pull spout upward with teeth",
      "Hook fingertip under spout lip and pull upward",
      "Squeeze the bottle body to dispense product",
      "Tilt the bottle to pour product",
      "Invert the bottle to let gravity assist dispensing",
      "Push spout straight down with thumb to close",
      "Push spout down against a flat surface to close",
    ],
  },
  {
    id: "continuous-thread-screw-cap",
    name: "Continuous Thread Screw Cap",
    interaction:
      "The user grips the cap and rotates it counter-clockwise to unscrew it from the bottle neck. The cap is removed entirely, and the bottle is tilted to pour product. For mouthwash, the cap typically doubles as a measuring cup. After use, the cap is placed back on and twisted clockwise until snug.",
    acoustics:
      "A rhythmic, light plastic-on-plastic threading sound — a series of faint ridged clicks or rasps — as the cap is twisted off. Pouring produces a hollow, liquid glugging or splashing sound as product exits the open bottle neck and air enters. Re-threading produces the same rasping twist sound, ending with a subtle tightening creak as the cap is secured.",
    haptics:
      "The ridged or knurled outer surface of the cap provides grip texture under the fingertips. Twisting requires a light rotational force with mild friction from the threads. As the cap loosens, the resistance drops and the cap spins freely for the last turn. Pouring requires a controlled tilt of the wrist. Re-tightening involves increasing rotational resistance until the cap compresses against a liner or seal, providing a firm stop that signals the bottle is sealed.",
    interactionOptions: [
      "Grip the cap with fingertips",
      "Grip the cap with full hand wrap",
      "Twist the cap counter-clockwise to loosen",
      "Continue twisting until cap separates from bottle",
      "Lift the cap off the bottle neck",
      "Set the cap aside or hold in other hand",
      "Tilt the bottle to pour product",
      "Pour product into the cap used as a measuring cup",
      "Control pour speed by adjusting tilt angle",
      "Return the bottle to upright position to stop pouring",
      "Place the cap back onto the bottle neck",
      "Twist the cap clockwise to tighten",
      "Continue twisting until snug resistance is felt",
      "Break tamper-evident seal ring on first opening",
    ],
  },
  {
    id: "inverted-squeeze-bottle",
    name: "Inverted Squeeze Bottle (Tottle)",
    interaction:
      "The bottle is designed to stand upside-down on a wide flat cap. The user opens the cap (typically a flip-top or disc-top at the bottom of the inverted bottle) and squeezes the flexible bottle body. Product flows out immediately aided by gravity and compression.",
    acoustics:
      "The cap opening produces a click or snap identical to its closure type. Because the product is gravity-fed to the opening, dispensing is quieter than a standard bottle — a soft, smooth squirt or ooze with minimal air glugging. Squeezing the bottle produces a muffled plastic crinkle.",
    haptics:
      "Opening the cap feels identical to its closure type. Squeezing requires less hand force than a right-side-up bottle because gravity assists product flow. The bottle walls are typically soft and pliable, compressing easily under light to moderate grip pressure. When the user releases the squeeze, the bottle slowly re-expands, creating a slight vacuum pull.",
    interactionOptions: [
      "Flip open the hinged cap at the base of the inverted bottle",
      "Press disc top open at the base of the inverted bottle",
      "Pick up the bottle from its inverted standing position",
      "Squeeze the bottle body gently to dispense product",
      "Control flow rate by varying squeeze pressure",
      "Release squeeze to stop dispensing",
      "Tap the side or bottom of the bottle to settle product toward the cap",
      "Close the cap (flip shut or press disc down)",
      "Return the bottle to its inverted standing position",
    ],
  },
  {
    id: "child-resistant-cap",
    name: "Child-Resistant Cap",
    interaction:
      "The user must perform a two-step action: pressing down on the cap while simultaneously twisting it counter-clockwise. This unlocks the safety mechanism and allows the cap to unscrew. Once removed, the user pours the product — for mouthwash, often into the cap used as a measuring cup.",
    acoustics:
      "A muted plastic creak or groan as downward pressure is applied to engage the locking mechanism. This is followed by the threading rasp of the cap unscrewing. Re-closing produces a threading sound ending with one or more distinct ratcheting clicks as the child-resistant lock re-engages.",
    haptics:
      "The user feels a firm downward resistance that must be maintained while simultaneously applying rotational torque. The locking mechanism may produce a subtle internal shifting sensation as it disengages. Re-closing involves twisting until a positive ratcheting detent is felt under the fingers, confirming the lock has re-engaged.",
    interactionOptions: [
      "Grip the cap firmly with full hand or palm",
      "Press down on the cap to engage the unlock mechanism",
      "While pressing down, twist the cap counter-clockwise",
      "Maintain simultaneous downward pressure and rotation until cap loosens",
      "Continue twisting until cap separates from bottle",
      "Lift the cap off the bottle neck",
      "Tilt the bottle to pour product",
      "Pour product into the cap used as a measuring cup",
      "Control pour speed by adjusting tilt angle",
      "Return the bottle to upright position to stop pouring",
      "Place the cap back onto the bottle neck",
      "Twist the cap clockwise to re-tighten",
      "Continue twisting until ratcheting clicks confirm child-resistant lock is re-engaged",
      "Break tamper-evident seal ring on first opening",
    ],
  },
  {
    id: "wall-mounted-press-dispenser",
    name: "Wall-Mounted Press Dispenser",
    interaction:
      "The user places one hand or a cupped palm beneath the dispensing nozzle and presses a lever, push-bar, or large button with the other hand, forearm, or elbow. A single press dispenses a pre-measured dose of product.",
    acoustics:
      "A hollow, mechanical clunk or thunk as the lever or push-bar is depressed, resonating through the wall-mounted housing. This is followed by a wet squirt or thick drip as product is expelled from the nozzle. The spring return produces a softer, secondary clunk or plastic rattle.",
    haptics:
      "The lever or bar offers broad, even resistance under the palm or elbow. A smooth, short-travel compression is felt, bottoming out with a firm mechanical stop. The spring return pushes back against the hand with a steady, predictable rebound.",
    interactionOptions: [
      "Cup one hand beneath the dispensing nozzle",
      "Press the lever or push-bar with the other hand's palm",
      "Press the lever or push-bar with the forearm",
      "Press the lever or push-bar with the elbow",
      "Press a large button with the fingertips",
      "Release the lever to allow spring return",
      "Repeat press for an additional dose of product",
    ],
  },
  {
    id: "automatic-touchless-dispenser",
    name: "Automatic Touchless Dispenser",
    interaction:
      "The user places an open hand or cupped palm beneath the dispenser's sensor window. An infrared proximity sensor detects the hand and activates a motorized pump that dispenses a pre-set dose of product.",
    acoustics:
      "A brief, quiet electronic whir or buzz as the motorized pump activates — typically lasting one to two seconds. This is accompanied by a soft, wet squirt or drip as product is expelled from the nozzle into the user's hand.",
    haptics:
      "The user feels no tactile interaction with the dispenser itself. The only haptic sensation is the product landing in the open palm: a cool, wet, soft impact of the dispensed liquid or gel.",
    interactionOptions: [
      "Place open hand beneath the sensor window",
      "Cup palm beneath the dispensing nozzle",
      "Hold hand steady while sensor activates and product dispenses",
      "Withdraw hand after product is dispensed",
      "Wave hand beneath sensor again for an additional dose",
      "Press manual override button if sensor fails (on some models)",
    ],
  },
];
