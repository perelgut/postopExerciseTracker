// Static exercise data — exports EXERCISES array with all 12 exercises and progressions.
// Source: PostOp_Exercises_version_1.xlsx (updated)
// Exercise order: Ex 0 (Walk) first, then Ex 7-17 in order.

const EXERCISES = [
  {
    id: 0,
    name: "Walk",
    displayName: "Ex 0: Walk",
    frequency: "Daily",
    maxProgression: 0,
    progressions: [
      {
        level: 0,
        description: "Walk anywhere for a continuous time. Start at 20 minutes and build to an hour eventually.",
        type: "Time",
        defaultCount: 60,
        defaultRepeats: 1
      }
    ]
  },
  {
    id: 7,
    name: "Bridge",
    displayName: "Ex 7: Bridge",
    frequency: "Alt1",
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: "Lying on back, knees bent and squeeze buttocks and lift off bed.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Lying on back, knees bent and squeeze buttocks and lift off bed.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 2,
        description: "Lying on back, knees bent and squeeze buttocks and lift off bed. While up, lift non-operated leg slightly off bed.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 3,
        description: "Lying on back, knees bent with operated leg closer to body, and squeeze buttocks and lift off bed.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 8,
    name: "Clam Shell",
    displayName: "Ex 8: Clam Shell",
    frequency: "Alt1",
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: "Lie on non-operated side with hips and knees slightly bent, keep feet together, lift operated (top) knee up but do not roll hips.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Lie on non-operated side with hips and knees slightly bent, keep feet together, lift operated (top) knee up but do not roll hips.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 9,
    name: "Hip Flexor Strengthening",
    displayName: "Ex 9: Hip Flexor Strengthening",
    frequency: "Daily",
    maxProgression: 2,
    progressions: [
      {
        level: 0,
        description: "While sitting tall, lift operated leg up so foot is off floor (do not bend back or turn knee to side). Hold for 5-count.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "While sitting tall, lift operated leg up so foot is off floor (do not bend back or turn knee to side). Hold for 5-count.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 2,
        description: "While sitting tall, lift operated leg up so foot is off floor (do not bend back or turn knee to side). Push down on knee with hands or cane. Hold for 5-count.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 10,
    name: "Standing Hip Abduction",
    displayName: "Ex 10: Standing Hip Abduction",
    frequency: "Alt2",
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: "Hold counter for balance, move operated leg out to side with foot slightly off floor, hips level, upper body straight.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Hold counter for balance, move operated leg out to side with foot slightly off floor, hips level, upper body straight. Alternate legs.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 11,
    name: "Squat",
    displayName: "Ex 11: Squat",
    frequency: "Alt2",
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: "Hold counter and bend knees while sticking buttocks out.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 1,
        description: "Sit in middle of chair, lean forward, stand up without using hands.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 12,
    name: "Crab Walk",
    displayName: "Ex 12: Crab Walk",
    frequency: "Alt2",
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: "Start with feet shoulder-width apart, stick buttocks out and hold then take 2 steps in one direction then 2 back. Keep feet at hip width apart.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Start with feet shoulder-width apart, stick buttocks out and hold then take 2 steps in one direction then 2 back. Keep feet at hip width apart.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 13,
    name: "Standing Leg Abductor",
    displayName: "Ex 13: Standing Leg Abductor",
    frequency: "Alt2",
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: "Hold on to counter with hand on non-operated side and stand on operated leg and bend non-operated leg pushing knee against counter/wall. Keep hips level.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Hold on to counter with hand on non-operated side and stand on operated leg and bend non-operated leg pushing knee against counter/wall. Keep hips level.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 2
      },
      {
        level: 2,
        description: "Hold on to counter with hand on non-operated side and stand on operated leg and bend non-operated leg pushing knee against counter/wall. Keep hips level.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 3,
        description: "Stand on operated leg without holding counter and bend non-operated leg pushing knee against counter/wall. Keep hips level.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 4
      }
    ]
  },
  {
    id: 14,
    name: "Marching in Place",
    displayName: "Ex 14: Marching in Place",
    frequency: "Daily",
    maxProgression: 3,
    progressions: [
      {
        level: 0,
        description: "Hold on to counter with hand on non-operated side and march on the spot, alternating legs while keeping spine straight.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 1
      },
      {
        level: 1,
        description: "Hold on to counter with hand on non-operated side and march on the spot, alternating legs while keeping spine straight.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 2,
        description: "Do not hold on, slowly march on the spot, alternating legs while keeping spine straight.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      },
      {
        level: 3,
        description: "On an uneven surface (or a pillow), do not hold on, slowly march on the spot, alternating legs while keeping spine straight.",
        type: "Rep",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 15,
    name: "Hip Bending Stretch",
    displayName: "Ex 15: Hip Bending Stretch",
    frequency: "Daily",
    maxProgression: 1,
    progressions: [
      {
        level: 0,
        description: "While lying down, bend knee and pull operated leg toward chest, use towel to get a little extra stretch.",
        type: "Time",
        defaultCount: 45,
        defaultRepeats: 3
      },
      {
        level: 1,
        description: "While lying down, pull both knees up together and rock side to side without lifting back (like a windshield wiper).",
        type: "Time",
        defaultCount: 15,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 16,
    name: "Hip Flexor Stretch",
    displayName: "Ex 16: Hip Flexor Stretch",
    frequency: "Daily",
    maxProgression: 0,
    progressions: [
      {
        level: 0,
        description: "Lie with operated leg hanging over the end (or side) of the bed. Bend the non-operated leg toward the chest (use a towel if necessary). Hold.",
        type: "Time",
        defaultCount: 45,
        defaultRepeats: 3
      }
    ]
  },
  {
    id: 17,
    name: "Seated Hamstring Stretch",
    displayName: "Ex 17: Seated Hamstring Stretch",
    frequency: "Daily",
    maxProgression: 0,
    progressions: [
      {
        level: 0,
        description: "Sit on edge of chair with non-operated leg flat on floor. Straighten operated leg while keeping heel on floor and toes pointed to ceiling.",
        type: "Time",
        defaultCount: 45,
        defaultRepeats: 3
      }
    ]
  }
];

export { EXERCISES };