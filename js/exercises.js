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
    id: 1,
    name: 'HipAbductionBed',
    displayName: 'Hip Abduction (Bed)',
    frequency: 'Alt1',
    maxProgression: 2,
    progressions: [
      {
        level: 0,
        description: 'Put plastic bag over left foot. Lie on bed (keep pelvis flat!).  Bend the right knee. Slide left leg slightly to the left.',
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
    frequency: 'Alt1',
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: 'Standing facing table, tighten buttocks, lift right knee to hip height, then lower.',
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
        description: 'Same as Level 2, alternating legs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      }
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
        description: 'Lying on your back, bring operated knee to your chest using towel. Hold gently.',
        type: 'Time',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but increase hold time to 45 seconds.',
        type: 'Time',
        defaultCount: 30,
        defaultRepeats: 3,
      },
    ],
  },
{
    id: 2,
    name: 'HipBendingStretch2',
    displayName: 'Hip Bending Stretch2',
    frequency: 'Daily',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Lying on your back, flatten operated leg.  Bring right knee to your chest using towel.',
        type: 'Time',
        defaultCount: 10,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 1 but increase hold time to 45 seconds.',
        type: 'Time',
        defaultCount: 30,
        defaultRepeats: 3,
      },
    ],
  },

  {
    id: 17,
    name: 'SeatedHamstringStretch',
    displayName: 'Seated Hamstring Stretch',
    frequency: 'Daily',
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
    id: 11,
    name: 'SmallSquat',
    displayName: 'Small Squat',
    frequency: 'Alt1',
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: 'Hold on to counter, push buttocks out and bend slightly from knees.',
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
        defaultCount: 5,
        defaultRepeats: 3,
      },
      {
        level: 1,
        description: 'Same as Level 0.',
        type: 'Rep',
        defaultCount: 10,
        defaultRepeats: 3,
      },
    {   
        level: 2,
        description: 'Same as Level 1 with a resistance band around your thighs.',
        type: 'Rep',
        defaultCount: 15,
        defaultRepeats: 3,
      },
    ],
  },

];

export { EXERCISES };