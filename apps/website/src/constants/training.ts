export const philosophySectionTitle = "our training philosophy";

export const philosophyParagraphs: string[] = [
  `i truly believe <strong>strength training is one of the most powerful tools</strong> for women of all ages to build <strong>confidence, longevity</strong> and <strong>resilience.</strong>`,
  `with a background in <strong>life sciences,</strong> i'm passionate about cutting through <strong>fitness misinformation</strong> and focusing on <em><strong>what actually works: progressive lifting, consistency</strong></em> and <strong>respect</strong> for the body you're in!`,
  `most importantly, i work closely with each client to understand <strong>what feels right for their body.</strong> there is <strong>no one-size-fits-all approach</strong> here! this enables me to create <strong>tailored, personalised</strong> programs that empower you to feel <strong>strong and capable</strong> - at <strong>any stage of life.</strong>`,
];

export const approachSectionTitle = "our approach";

export const resonateHeading =
  "this style of training may resonate with you if:";

export const coachingHeading = "my coaching is centered around:";

export const sessionFlowHeading =
  "sessions are structured through a systematic flow:";

export const promiseHeading = "my promise to you:";

export const ctaHeadline = "excited to take the next step with me?";

export const ctaSubtext = "or have any other questions?";

export const ctaButtonLabel = "book a free consultation call!";

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
    description: "to ease the muscles into bearing weight and prevent injury!",
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

export const packagesSectionTitle = "our packages";

export const packagesIntroHtml = `whether you're <strong>new to strength training</strong> or <strong>looking to level up your current routine</strong>, i offer a range of personal training programs that are <em>individualised, holistic and grounded in science.</em>`;

export type TrainingPackage = {
  title: string;
  sessionsLabel: string;
  tagline: string;
  descriptionHtml: string;
  pricePerSession: string;
  totalPrice: string;
};

export const trainingPackages: TrainingPackage[] = [
  {
    title: "DISCOVER",
    sessionsLabel: "1 session",
    tagline: "perfect for a trial session.",
    descriptionHtml: `this <strong>one-time session</strong> is perfect for those who want to explore <strong>personal training</strong>, discuss <strong>goals</strong> and get a professional assessment of your current <strong>physical state and potential.</strong> in this session, we'll chat and then get you lifting!`,
    pricePerSession: "SG$95.00 per session",
    totalPrice: "SG$95.00 in total",
  },
  {
    title: "BUILD",
    sessionsLabel: "5 sessions",
    tagline: "helpful for finding your rhythm.",
    descriptionHtml: `a <strong>short term plan</strong> to <strong>build consistency</strong> and develop a training routine that is tailored to <strong>your goals, lifestyle and schedule.</strong> through guided sessions and exercise instruction, we'll work towards establishing a <strong>sustainable routine</strong> that supports lasting change!`,
    pricePerSession: "SG$90.00 per session",
    totalPrice: "SG$450.00 in total",
  },
  {
    title: "TRANSFORM",
    sessionsLabel: "10 sessions",
    tagline: "for a complete transformation.",
    descriptionHtml: `a <strong>comprehensive program</strong> to drive <strong>sustainable change</strong> in your training, performance and lifestyle. over 10 sessions, we'll dive deep into <strong>progressive overload</strong>, <strong>conditioning and nutritional guidance</strong>, designed to help you achieve long term transformation, all while keeping sessions <strong>fresh, interesting and tailored</strong> to where you're at!`,
    pricePerSession: "SG$80.00 per session",
    totalPrice: "SG$800.00 in total",
  },
];

export const testimonialsSectionTitle = "what our clients say";

export type Testimonial = {
  authorName: string;
  rating: number;
  quote: string;
};

export const testimonials: Testimonial[] = [
  {
    authorName: "neha & kartisha",
    rating: 5,
    quote: `i would like to describe ishita as a kind human being and an exceptional, passionate gym coach. my 12-year-old daughter, who is a competitive swimmer in singapore, has been working with her to improve overall strength and muscle development.

from the initial assessment through to ongoing training, ishita has taken a highly structured and thoughtful approach, carefully considering my daughter's abilities, strengths, and areas for improvement. she provides clear guidance and consistent, timely feedback, while also helping us as parents understand how we can support our daughter's journey toward a fitter and healthier lifestyle.

my daughter has felt very comfortable and motivated throughout the training process. in her own words, "ishita is easy to talk to, very easy to work with, guides me properly, and motivates me to reach my full potential. it's fun to go to gym with coach ishita"

we are extremely happy with the progress and overall experience, and deeply appreciate ishita's professionalism, dedication, and supportive coaching style. i would highly recommend her to anyone looking for a knowledgeable and encouraging coach to achieve a healthier and fitter lifestyle.`,
  },
  {
    authorName: "aishwarya",
    rating: 5,
    quote: `training with ishita has honestly been such a wonderful experience! she is incredibly motivating, positive, professional and always makes every session feel comfortable and encouraging. i truly admire her technical knowledge and understanding of workouts and nutrition - she always knows exactly how to guide me according to my goals of fat loss and achieving a toned body.

since we have started training, i've noticed a big improvement in my strength, energy levels and overall fitness. my clothes fit much better now and i feel far more motivated and confident to stay consistent with workouts.

thank you for always pushing me in the best way possible while also being so supportive and helpful throughout the journey. i'm really grateful for all your effort and guidance!`,
  },
  {
    authorName: "anesh",
    rating: 5,
    quote: `i have been working with ishita for the last 10 weeks. she has a very pleasant disposition which helps making the sessions enjoyable. she is very knowledgeable and takes every care to ensure i am comfortable and not going to injure myself. i have managed to perform a forearm plank for 1 minute - consistently for the last 7 weeks. that accomplishment was thanks to ishita's guidance, drive and encouragement during our sessions.`,
  },
  {
    authorName: "sonali",
    rating: 5,
    quote: `training with ishita has been a truly positive experience. she brings a wonderful balance of technical expertise, care, and motivation to every session, always taking the time to understand my individual needs while ensuring i train safely and effectively. what i especially appreciate is how encouraging and supportive she has been, gently pushing me beyond what i thought i was capable of while remaining attentive and caring throughout the process.

over time, i have noticed a significant improvement in my overall strength. her professionalism, knowledge, and genuine commitment to her clients' wellbeing have made a real difference, and i'm very grateful for the journey we've had training together.`,
  },
  {
    authorName: "claudia",
    rating: 5,
    quote: `training with ishita has been such an enjoyable and rewarding experience. she's incredibly thorough in her explanations and always takes the time to answer all my questions patiently and in detail. every session feels engaging, and there's always something new to learn and look forward to.

since training with ishita, i've become much more confident in the gym, especially when working out on my own. my knowledge of gym equipment has improved significantly, and i've also noticed a real improvement in my stamina.`,
  },
  {
    authorName: "sapna",
    rating: 5,
    quote: `i found my sessions with ishita incredibly helpful. she patiently listened to my concerns and objectives, adapting my program as we went along to take into account injury risks, and both age and gender specific concerns.

i greatly appreciated her personalised approach, as well as her professional guidance, underpinned by a deep understanding of physical strength and fitness.`,
  },
];
