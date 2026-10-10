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
  intro: 'A collection of memories, thanks and best wishes from your colleagues.',

  /** Real Mission Log entries; an empty list hides this section outside demo mode. */
  milestones: [] as Array<{ year: string; title: string; text: string }>,

  /** Browser tab and link-preview text. Resolved at build time from this configuration. */
  metadata: {
    title: '', // Empty uses the honoree's full name automatically.
    description: 'Share a message, photo or video to celebrate a colleague and wish him well.',
  },

  /** Public contact shown after a successful submission. */
  organiser: {
    name: 'Akisa Tachibana',
    email: 'akisa.tachibana@pmi.com',
  },

  closing: 'Wherever you go next, you will always be part of our orbit.',
  signedBy: 'With appreciation, your colleagues',
} as const;
