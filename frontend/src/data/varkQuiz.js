/**
 * VARK Learning Style Quiz Data
 * 10 questions to detect Visual, Auditory, Reading/Writing, Kinesthetic styles
 * @module data/varkQuiz
 */

/**
 * VARK learning style descriptions
 */
export const VARK_DESCRIPTIONS = {
  visual: {
    name: 'Visual',
    shortDescription: 'You learn best through images, diagrams, and spatial understanding.',
    fullDescription: 'Visual learners prefer to see information presented in charts, graphs, maps, and diagrams. You benefit from color-coding, mind maps, and visual representations of concepts. When studying, try using flashcards with images, drawing diagrams, and watching educational videos.',
    tips: [
      'Use diagrams and flowcharts to organize information',
      'Color-code your notes and study materials',
      'Watch video tutorials and demonstrations',
      'Create mind maps to connect concepts',
    ],
  },
  auditory: {
    name: 'Auditory',
    shortDescription: 'You learn best through listening and verbal explanations.',
    fullDescription: 'Auditory learners prefer to hear information explained aloud. You benefit from lectures, discussions, podcasts, and verbal repetition. When studying, try reading aloud, participating in study groups, and using mnemonic devices or songs to remember information.',
    tips: [
      'Listen to podcasts and audio lectures',
      'Participate in group discussions',
      'Read your notes aloud when studying',
      'Record yourself explaining concepts and play it back',
    ],
  },
  reading: {
    name: 'Reading/Writing',
    shortDescription: 'You learn best through reading text and writing notes.',
    fullDescription: 'Reading/Writing learners prefer text-based information. You benefit from reading textbooks, taking detailed notes, and writing summaries. When studying, try rewriting your notes, creating lists, and reading extensively about topics that interest you.',
    tips: [
      'Take detailed written notes during lectures',
      'Rewrite key concepts in your own words',
      'Create lists and outlines to organize information',
      'Read multiple sources on the same topic',
    ],
  },
  kinesthetic: {
    name: 'Kinesthetic',
    shortDescription: 'You learn best through hands-on practice and physical experience.',
    fullDescription: 'Kinesthetic learners prefer to learn by doing. You benefit from hands-on experiments, physical activities, and real-world applications. When studying, try building models, conducting experiments, and taking frequent breaks to move around.',
    tips: [
      'Use hands-on activities and experiments',
      'Take breaks to move around while studying',
      'Apply concepts to real-world scenarios',
      'Use physical objects to represent abstract ideas',
    ],
  },
};

/**
 * VARK Quiz Questions
 * Each question has 4 options mapping to the 4 learning styles
 */
export const VARK_QUESTIONS = [
  {
    id: 1,
    question: 'When learning how to use a new software tool, you prefer to:',
    options: [
      { text: 'Watch a video walkthrough showing exactly what to click', style: 'visual' },
      { text: 'Listen to someone explain each step verbally', style: 'auditory' },
      { text: 'Read the documentation or user manual', style: 'reading' },
      { text: 'Dive in and figure it out by clicking around', style: 'kinesthetic' },
    ],
  },
  {
    id: 2,
    question: 'You need to remember an important phone number. You would most likely:',
    options: [
      { text: 'Visualize the numbers arranged on a keypad', style: 'visual' },
      { text: 'Say the numbers out loud several times', style: 'auditory' },
      { text: 'Write the number down multiple times', style: 'reading' },
      { text: 'Physically dial the number on your phone repeatedly', style: 'kinesthetic' },
    ],
  },
  {
    id: 3,
    question: 'When solving a complex problem, your first instinct is to:',
    options: [
      { text: 'Draw a diagram or sketch to visualize the problem', style: 'visual' },
      { text: 'Talk through the problem out loud, even to yourself', style: 'auditory' },
      { text: 'Write out the problem and possible solutions', style: 'reading' },
      { text: 'Build a prototype or test different approaches hands-on', style: 'kinesthetic' },
    ],
  },
  {
    id: 4,
    question: 'You are presenting a project idea to colleagues. You would prefer to:',
    options: [
      { text: 'Create a slideshow with images, charts, and diagrams', style: 'visual' },
      { text: 'Explain the idea verbally with a compelling narrative', style: 'auditory' },
      { text: 'Prepare a detailed written document to distribute', style: 'reading' },
      { text: 'Give a live demonstration or interactive workshop', style: 'kinesthetic' },
    ],
  },
  {
    id: 5,
    question: 'When studying for an important exam, you typically:',
    options: [
      { text: 'Create flashcards with diagrams and highlight key points with colors', style: 'visual' },
      { text: 'Form a study group to discuss topics or record yourself explaining concepts', style: 'auditory' },
      { text: 'Rewrite your notes and create detailed summaries', style: 'reading' },
      { text: 'Practice with real examples, past papers, or teach someone else', style: 'kinesthetic' },
    ],
  },
  {
    id: 6,
    question: 'You are lost in an unfamiliar city. You would prefer to:',
    options: [
      { text: 'Look at a map or use GPS with visual navigation', style: 'visual' },
      { text: 'Ask a local for verbal directions', style: 'auditory' },
      { text: 'Read street signs and written directions carefully', style: 'reading' },
      { text: 'Walk around and explore until you find your way', style: 'kinesthetic' },
    ],
  },
  {
    id: 7,
    question: 'When explaining a concept to someone else, you tend to:',
    options: [
      { text: 'Draw pictures, diagrams, or use gestures to illustrate', style: 'visual' },
      { text: 'Explain verbally using examples and analogies', style: 'auditory' },
      { text: 'Write out the explanation or point them to reading materials', style: 'reading' },
      { text: 'Show them by doing it yourself or guide them through hands-on practice', style: 'kinesthetic' },
    ],
  },
  {
    id: 8,
    question: 'You want to learn a new recipe. Your preferred approach is to:',
    options: [
      { text: 'Watch a cooking video showing each step', style: 'visual' },
      { text: 'Listen to someone describe the process step by step', style: 'auditory' },
      { text: 'Read through a detailed written recipe', style: 'reading' },
      { text: 'Jump into the kitchen and experiment as you go', style: 'kinesthetic' },
    ],
  },
  {
    id: 9,
    question: 'When you attend a lecture or presentation, you remember best:',
    options: [
      { text: 'The slides, images, and visual demonstrations', style: 'visual' },
      { text: 'The speaker\'s words, tone, and verbal explanations', style: 'auditory' },
      { text: 'The notes you took or handouts provided', style: 'reading' },
      { text: 'The interactive activities or demonstrations you participated in', style: 'kinesthetic' },
    ],
  },
  {
    id: 10,
    question: 'You need to assemble furniture from a flat-pack. You would:',
    options: [
      { text: 'Study the diagrams and pictures in the instruction manual', style: 'visual' },
      { text: 'Have someone read the instructions to you while you work', style: 'auditory' },
      { text: 'Read through all the written instructions before starting', style: 'reading' },
      { text: 'Start putting pieces together and figure it out as you go', style: 'kinesthetic' },
    ],
  },
];

/**
 * Calculate VARK scores from quiz responses
 * @param {Array<{questionId: number, style: string}>} responses - Quiz responses
 * @returns {{ scores: Object, dominant: string, percentages: Object }}
 */
export function calculateVARKScores(responses) {
  // Initialize scores
  const scores = {
    visual: 0,
    auditory: 0,
    reading: 0,
    kinesthetic: 0,
  };

  // Count responses per style
  responses.forEach(response => {
    if (scores.hasOwnProperty(response.style)) {
      scores[response.style]++;
    }
  });

  // Calculate percentages
  const total = responses.length || 1;
  const percentages = {
    visual: Math.round((scores.visual / total) * 100),
    auditory: Math.round((scores.auditory / total) * 100),
    reading: Math.round((scores.reading / total) * 100),
    kinesthetic: Math.round((scores.kinesthetic / total) * 100),
  };

  // Find dominant style
  let dominant = 'visual';
  let maxScore = scores.visual;
  for (const [style, score] of Object.entries(scores)) {
    if (score > maxScore) {
      dominant = style;
      maxScore = score;
    }
  }

  return {
    scores,
    dominant,
    percentages,
    description: VARK_DESCRIPTIONS[dominant],
  };
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get questions with shuffled options
 * @returns {Array} Questions with shuffled options
 */
export function getShuffledQuestions() {
  return VARK_QUESTIONS.map(q => ({
    ...q,
    options: shuffleArray(q.options),
  }));
}

export default {
  VARK_QUESTIONS,
  VARK_DESCRIPTIONS,
  calculateVARKScores,
  getShuffledQuestions,
  shuffleArray,
};
