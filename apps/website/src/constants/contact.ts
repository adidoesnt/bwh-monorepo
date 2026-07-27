export const contactPageTitle = "contact us";

export const contactIntroParagraphs: string[] = [
  "we'd love to hear from you!",
  "whether you have any questions about our blog, personal training services, upcoming activewear collection, brand collaborations and partnerships, or just want to say hello and share any feedback, please feel free to reach out.",
];

export const socialsSectionTitle = "let's connect on socials";

export const socialsDescription =
  "we love providing value and interacting with our community on a regular basis - follow us on socials for some fun yet insightful content!";

export const contactFormLabels = {
  firstName: "first name",
  lastName: "last name",
  email: "email",
  subject: "subject",
  message: "message",
  isHuman: "i am a human.",
  submit: "send",
} as const;

export const contactFormPlaceholders = {
  firstName: "john",
  lastName: "doe",
  email: "john.doe@example.com",
  subject: "type your subject here...",
  message: "type your message here...",
} as const;

export const contactSuccessMessage = "message sent successfully.";

export const contactErrorMessage =
  "something went wrong sending your message. please try again later.";
