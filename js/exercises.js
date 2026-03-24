// exercises.js — Master exercise catalogue for PostOp Exercise Tracker.
//
// Each ExerciseObject has:
//   id             {number}   — unique, stable identifier
//   name           {string}   — short machine name
//   displayName    {string}   — label shown in UI
//   frequency      {string}   — 'Daily' | 'Alt1' | 'Alt2' | 'shelved'
//   maxProgression {number}   — highest level index (0 = single-level)
//   progressions   {object[]} — array of ProgressionLevel objects
//
// Each ProgressionLevel has:
//   level          {number}   — 0-based index
//   description    {string}   — instructions shown to patient
//   type           {string}   — 'Rep' | 'Time' | 'Minutes'
//                               'Rep'     → count is reps,    unit 'reps'
//                               'Time'    → count is seconds, unit 's'
//                               'Minutes' → count is minutes, unit 'min'
//   defaultCount   {number}   — pre-filled count value
//   defaultRepeats {number}   — pre-filled sets value
//
// CHANGE LOG:
//   v1.1 — Exercise 0 (Walk): type changed from 'Time' to 'Minutes';
//           defaultCount changed from 60 to 20 (goal is 60 min/day);
//           description updated to reflect minutes.

const EXERCISES = [

  // ── Daily exercises ──────────────────────────────────────────────────────────

  {
    id: 0,
    name: 'Walk',
    displayName: 'Walk',
    frequency: 'Daily',
    maxProgression: 2,
    progressions: [
      {
        level: 0,
        description: 'Walk anywhere for a continuous time. Start at 20 minutes and build to 60 minutes eventually.',
        type: 'Minutes',
        defaultCount: 20,
        defaultRepeats: 1,
      },
      {
        level: 1,
        description: 'Walk anywhere for a continuous time. Start at 20 minutes and build to 60 minutes eventually.',
        type: 'Minutes',
        defaultCount: 30,
        defaultRepeats: 1,
      },
      {
        level: 2,
        description: 'Walk anywhere for a continuous time. Start at 20 minutes and build to 60 minutes eventually.',
        type: 'Minutes',
        defaultCount: 60,
        defaultRepeats: 1,
      },
    ],
  },

  {
    id: 9,
    name: 'HipFlexorStr',
    displayName: 'Hip Flexor Strengthening',
    frequency: 'Daily',
    maxProgression: 2,
    progressions: [
      {
        level: 0,
        description: 'Siting tall, lift your operated leg up so your foot is off the floor.  Avoid leaning back.  Do not let your nee turn out.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but increase to 15 repetitions per leg per set.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 2,
        description: 'Same as Level 2 with added resistance band around thighs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 14,
    name: 'MarchingInPlace',
    displayName: 'Marching In Place',
    frequency: 'Daily',
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: 'Standing, lift one knee to hip height, then lower. Alternate legs in a marching motion.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but increase to 15 repetitions per side.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 2,
        description: 'Same as Level 2, adding arm swings opposite to the lifted knee.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 3,
        description: 'Same as Level 3 with resistance band around thighs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 15,
    name: 'HipBendingStretch',
    displayName: 'Hip Bending Stretch',
    frequency: 'Daily',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Lying on your back, bring operated knee to your chest using towel. Hold gently. Alternate legs.',
        type: 'Time',
        defaultCount: 30,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but increase hold time to 45 seconds.',
        type: 'Time',
        defaultCount: 45,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 16,
    name: 'StraightLegPushDown',
    displayName: 'Straight Leg Push Down',
    frequency: 'Daily',
    maxProgression: 0,
    progressions: [
      {
        level: 0,
        description: 'Using a towel, bring the good leg to the chest while keeping the operated leg straight, pushing toward the bed. Hold 10 seconds',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 17,
    name: 'SeatedHamstringStretch',
    displayName: 'Seated Hamstring Stretch',
    frequency: 'shelved',
    maxProgression: 0,
    progressions: [
      {
        level: 0,
        description: 'Seated on a chair, straighten one leg and reach toward your toes. Hold the stretch. Alternate legs.',
        type: 'Time',
        defaultCount: 30,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 18,
    name: 'AbductorStretch',
    displayName: 'AbductorStretch',
    frequency: 'Daily',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Stand at counter and lean forward on forearms. Bend good leg and straighten operated leg to the side.  Feel stretch on inner thigh.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Stand at counter and lean forward on forearms. Bend good leg and straighten operated leg to the side.  Feel stretch on inner thigh.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

  // ── Alt1 exercises (Mon / Wed / Fri) ─────────────────────────────────────────

  {
    id: 7,
    name: 'Bridge',
    displayName: 'Bridge',
    frequency: 'Alt1',
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: 'Lying on your back with knees bent and feet flat, squeeze your glutes and lift your hips off the floor. Hold briefly then lower.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but hold the raised position for 5 seconds each rep.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 2,
        description: 'Same as Level 2 but perform as a single-leg bridge — one foot flat, the other leg extended straight.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 3,
        description: 'Same as Level 3 with a resistance band around your thighs.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 8,
    name: 'ClamShell',
    displayName: 'Clam Shell',
    frequency: 'Alt1',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Lying on your side, belly down, back straight, with knees bent, keep feet together and lift the top knee as high as comfortable without rolling your hips.  Feel in back pocket muscles.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 with a resistance band around your thighs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

  // ── Alt2 exercises (Tue / Thu / Sat) ─────────────────────────────────────────

  {
    id: 10,
    name: 'StandingHipAbd',
    displayName: 'Standing Hip Abduction',
    frequency: 'Alt2',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Standing beside a wall for balance, lift one leg straight out to the side. Keep toes pointed forward. Alternate legs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 with a resistance band around your ankles.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 11,
    name: 'Squat',
    displayName: 'Squat',
    frequency: 'Alt2',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Stand with feet shoulder-width apart. Lower yourself as if sitting into an elevated chair, keeping your chest up and knees over your toes. Return to standing.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but lower to a deeper position (90-degree knee angle) if comfortable.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 12,
    name: 'CrabWalk',
    displayName: 'Crab Walk',
    frequency: 'Alt2',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'With a resistance band around your thighs, slightly bend your knees and step sideways — 5 steps in each direction.',
        type: 'Rep',
        defaultCount: 1,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but move the resistance band up to just above your knees.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 13,
    name: 'StandingLegAbd',
    displayName: 'Standing Leg Abduction',
    frequency: 'Alt2',
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: 'Standing, lift one leg straight back behind you, squeezing your glutes at the top. Hold briefly then lower. Alternate legs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but hold the raised position for 3 seconds each rep.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 2,
        description: 'Same as Level 2 with a resistance band around your ankles.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
      {
        level: 3,
        description: 'Same as Level 3 with increased resistance band tension.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

];

export { EXERCISES };