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

from the initial assessment through to ongoing training, ishita has taken a highly structured and thoughtful approach, carefully considering my daughter's abilities, strengths and areas for improvement. she provides clear guidance and consistent, timely feedback, while also helping us as parents understand how we can support our daughter's journey toward a fitter and healthier lifestyle.

my daughter has felt very comfortable and motivated throughout the training process. in her own words, "ishita is easy to talk to, very easy to work with, guides me properly and motivates me to reach my full potential. it's fun to go to gym with coach ishita"

we are extremely happy with the progress and overall experience and deeply appreciate ishita's professionalism, dedication and supportive coaching style. i would highly recommend her to anyone looking for a knowledgeable and encouraging coach to achieve a healthier and fitter lifestyle.`,
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
    quote: `training with ishita has been a truly positive experience. she brings a wonderful balance of technical expertise, care and motivation to every session, always taking the time to understand my individual needs while ensuring i train safely and effectively. what i especially appreciate is how encouraging and supportive she has been, gently pushing me beyond what i thought i was capable of while remaining attentive and caring throughout the process.

over time, i have noticed a significant improvement in my overall strength. her professionalism, knowledge and genuine commitment to her clients' wellbeing have made a real difference and i'm very grateful for the journey we've had training together.`,
  },
  {
    authorName: "claudia",
    rating: 5,
    quote: `training with ishita has been such an enjoyable and rewarding experience. she's incredibly thorough in her explanations and always takes the time to answer all my questions patiently and in detail. every session feels engaging and there's always something new to learn and look forward to.

since training with ishita, i've become much more confident in the gym, especially when working out on my own. my knowledge of gym equipment has improved significantly and i've also noticed a real improvement in my stamina.`,
  },
  {
    authorName: "sapna",
    rating: 5,
    quote: `i found my sessions with ishita incredibly helpful. she patiently listened to my concerns and objectives, adapting my program as we went along to take into account injury risks and both age and gender specific concerns.

i greatly appreciated her personalised approach, as well as her professional guidance, underpinned by a deep understanding of physical strength and fitness.`,
  },
];

export const faqSectionTitle = "frequently asked questions!";

export type FaqItem = {
  question: string;
  answerHtml: string;
};

export type FaqCategory = {
  title: string;
  items: FaqItem[];
};

export const faqCategories: FaqCategory[] = [
  {
    title: "about the trainer",
    items: [
      {
        question: "what are your qualifications?",
        answerHtml: `i am a registered <strong>nasm personal fitness trainer [non ncca-accredited certificate]</strong>; i'm also <strong>cpr-aed certified</strong>, trained to respond appropriately in the unlikely event of a medical emergency!`,
      },
      {
        question: "what differentiates you as a trainer?",
        answerHtml: `i'm incredibly <strong>passionate</strong> about the work i do! i always show up early, with a <strong>fresh hand-written plan</strong> and loads of <strong>energy</strong>! i'm a <strong>visual learner</strong> - so having a <strong>keen eye</strong> and instructing my clients through <strong>proper form</strong> comes naturally to me!`,
      },
    ],
  },
  {
    title: "sessions & logistics",
    items: [
      {
        question: "where do the sessions happen?",
        answerHtml: `i train in the <strong>east</strong> and <strong>central</strong> areas (along the <strong>brown line</strong>): either (a) at <strong>clients' condo</strong> (if facilities are sufficient!) or (b) at the <strong>katong activesg gym</strong>; it's low-cost ($2.50/ entry) and accessible with <strong>state-of-the-art facilities</strong>!`,
      },
      {
        question: "are you able to train in the cbd area during the lunch time?",
        answerHtml: `yes! a lot of my clients are <strong>busy working professionals</strong> - i have partnered with <strong>peak gym (cecil street)</strong> to cater to this need; a <strong>$30 rental fee</strong> will be charged to use the space, in addition to the cost of the session :)`,
      },
      {
        question: "how many sessions should i do per week?",
        answerHtml: `i recommend <strong>2-3 sessions/ week</strong> to maximise how much you're getting out of the program but ultimately, <strong>whatever is feasible <em>and</em> sustainable is always ideal</strong>!`,
      },
      {
        question: "how long are the sessions?",
        answerHtml: `sessions are intended to be <strong>60 minutes long</strong> - they do occasionally <strong>run overtime [~70-75 minutes]</strong> but please let me know if you have a <strong>hard stop</strong>!`,
      },
      {
        question: "when do you offer sessions?",
        answerHtml: `i offer sessions anytime from <strong>8 am - 7 pm</strong> on <strong>weekdays and weekends</strong>!!`,
      },
    ],
  },
  {
    title: "programs & pricing",
    items: [
      {
        question: "what packages do you offer and do you do a trial session?",
        answerHtml: `i offer <strong>3 different packages</strong>: <em>discover</em> [1 session] - trial session, <em>build</em> [5 sessions] and <em>transform</em> [10 sessions]; the cost of an individual session <strong>works out more reasonable, the bigger the package is</strong> ❤️`,
      },
      {
        question: "do you offer couples training? can i work out with a buddy?",
        answerHtml: `yes, i totally understand that many people <strong>find comfort</strong> in being able to train with a <strong>partner</strong> or a <strong>friend</strong>! i charge <strong>$30 extra per head</strong> per session.`,
      },
      {
        question: "when and how do i make the payment for the package?",
        answerHtml: `the <strong>full payment</strong> is made <strong>before the first session</strong> takes place (via <strong>paynow @ +65 8934 9627</strong>) and a <strong>formal invoice</strong> can be <strong>requested by the client</strong> for record-keeping purposes!`,
      },
    ],
  },
  {
    title: "training approach",
    items: [
      {
        question: "how are the sessions structured?",
        answerHtml: `sessions follow a <strong>systematic flow: light cardio &gt; dynamic stretching &gt; resistance training &gt; static stretch &amp; cool down</strong>! this <strong>primes the body</strong> for movement, <strong>maximises hypertrophy</strong> and <strong>prevents injury</strong>!`,
      },
      {
        question: "how is the first session unique?",
        answerHtml: `i do a <strong>diagnostic</strong> that involves baselining through a: (a) <strong>posture and movement screening</strong>, (b) <strong>cardiorespiratory fitness test</strong>, (c) <strong>rudimentary resistance training movements</strong> and (d) <strong>goal setting</strong>!`,
      },
      {
        question:
          "do you work with people of all fitness levels or do i need prior experience?",
        answerHtml: `i work with clients of <strong>all fitness levels</strong> (tons of <strong>first-timers</strong>)! i can also tailor the program if clients have certain <strong>mobility constraints</strong> or <strong>history of injury</strong>, as long as they're <strong>cleared to work out by a physician</strong>!`,
      },
    ],
  },
  {
    title: "policies",
    items: [
      {
        question: "what is your rescheduling policy for sessions?",
        answerHtml: `i always try to be as <strong>accommodating</strong> as possible (life happens!) but a <strong>24-hour notice</strong> is required for the session to <strong>not be forfeited/ defaulted</strong>! provided 24 hour notice, <strong>one free reschedule</strong> is permitted, within the <strong>following 7 days</strong>.`,
      },
    ],
  },
];
