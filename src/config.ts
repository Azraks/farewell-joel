/** Editable page content. Confirm names, title and milestones before sharing. */
export const site = {
  honoree: {
    firstName: 'Joel',
    fullName: 'Joel Trincherini',
    title: 'Senior Director, Technology',
    department: 'IT',
    /** Put a photo at public/assets/joel.jpg and set this to 'assets/joel.jpg'. Leave empty for the monogram avatar. */
    photo: '',
  },

  /** Farewell date/time in Japan time, e.g. '2026-11-28T18:00:00+09:00'. '' hides the countdown. */
  farewellDate: '',

  /** Last moment to submit, e.g. '2026-11-25T23:59:00+09:00'. '' = always open. Also set the server deadline in tribute_settings. */
  submissionDeadline: '',

  tagline: 'Thank you for lighting the way.',
  /** Paragraph under "Mission log". */
  intro: 'From an intranet in Switzerland to nearly seven years in Japan — a few chapters from Joel’s career, with a little exploring along the way.',

  /** Adapted from supplied accounts; relative labels are not appointment dates. */
  milestones: [
    {
      year: 'Twenty years ago',
      title: 'A beginning in Switzerland',
      text: 'Joel started out building a corporate intranet in Switzerland. It was the beginning of a career spent figuring out how technology could make a real difference to the business.',
    },
    {
      year: 'Over two decades',
      title: 'From analyst to technology leader',
      text: 'The roles changed, but his question stayed much the same: does this actually help the business? From analyst to technology leader, Joel helped technology become part of how the business worked, rather than something called in for support.',
    },
    {
      year: 'Nearly seven years in Asia',
      title: 'Taking local reality seriously',
      text: 'Based in Japan and working across Asian markets, Joel learned that what works in one place doesn’t necessarily work in another. Japan, Korea and Indonesia each had their own way of doing things — and a global template wasn’t always the answer.',
    },
    {
      year: 'A culture of learning',
      title: 'Making room to grow',
      text: 'Joel backed regular learning sessions and encouraged colleagues to make time for their development. As AI became part of everyday work, there was plenty more to learn — starting with how to ask a good question.',
    },
    {
      year: 'Along the way',
      title: 'Building leaders, setting the guardrails',
      text: 'His approach was straightforward: set the direction, then give people room to get on with it. Security wasn’t something to trade away for a deadline, and with AI, getting the ground rules right came first.',
    },
    {
      year: 'Across teams and markets',
      title: 'Bringing people together',
      text: 'Through market visits and conversations with colleagues, Joel helped teams stay connected across borders. The work mattered, and so did getting to know the people behind it.',
    },
    {
      year: 'Beyond the workplace',
      title: 'Discovering Japan',
      text: 'Away from work, Joel has been getting to know Japan properly: 35 of its 47 prefectures visited so far. Twelve still to go — so the travel list isn’t quite finished yet.',
    },
  ] as Array<{ year: string; title: string; text: string }>,

  /** Browser tab and link-preview text. Resolved at build time from this configuration. */
  metadata: {
    title: '', // Empty uses the honoree's full name automatically.
    description: 'Share a memory, a photo or a video to let Joel know how much he’s meant to us, and send him into his next chapter with our heartfelt thanks.',
  },

  /** Public contact shown after a successful submission. */
  organiser: {
    name: 'Akisa Tachibana',
    email: 'akisa.tachibana@pmi.com',
  },

  closing: 'Wherever you go next, you will always be part of our orbit.',
  signedBy: 'With appreciation, your colleagues',
} as const;
