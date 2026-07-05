export const resonateItems: string[] = [
  `the gym feels <strong>overwhelming</strong> and you're <strong>unsure where to begin</strong>`,
  `you enjoy movement but <strong>struggle with consistency or structure</strong>`,
  `you value <strong>ageing well</strong> and <strong>moving pain-free</strong> for years to come`,
];

export type CoachingPillar = {
  title: string;
  description: string;
};

export const coachingPillars: CoachingPillar[] = [
  {
    title: "functional strength",
    description:
      "building strength that carries over into daily life, sport and long-term independence",
  },
  {
    title: "muscular conditioning",
    description:
      "practicing progressive, hypertrophy-focused resistance training to increase strength",
  },
  {
    title: "mobility & joint stability",
    description:
      "restoring range of motion and control to support safe, pain-free movement",
  },
  {
    title: "cardiovascular capacity",
    description:
      "building aerobic stamina to support overall health and training performance",
  },
  {
    title: "confidence-building",
    description:
      "cultivating confidence through instruction of technique, awareness and autonomy",
  },
];

export type SessionFlowStep = {
  title: string;
  description: string;
};

export const sessionFlowSteps: SessionFlowStep[] = [
  {
    title: "light cardio",
    description: "to get the heart rate up!",
  },
  {
    title: "dynamic stretching",
    description:
      "to ease the muscles into bearing weight and prevent injury!",
  },
  {
    title: "resistance training",
    description:
      "mix of upper, lower, core/stabilisation and plyometric exercises",
  },
  {
    title: "static stretch & cool down",
    description: "to promote recovery + prevent injury!",
  },
];

export const approachNarrative: string[] = [
  `before i add intensity, i <strong>lay the groundwork: teaching form, correcting posture</strong> and making sure <strong>you feel confident around the gym!</strong> i take a very <strong>hands-on approach</strong> - with <strong>real-time demonstrations, verbal cues</strong> and <strong>tons of cheerleading</strong> along the way!`,
];

export const approachPromise =
  "whether your goal is hypertrophy, fat loss or something else entirely, i will meet you where you are at and get you to where you want to be!";
