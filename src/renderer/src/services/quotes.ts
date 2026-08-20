export interface PositiveQuote {
  quote: string;
  author: string;
  emoji: string;
}

export const POSITIVE_QUOTES: PositiveQuote[] = [
  // Classic Wisdom & Dev Lore
  {
    quote: "A 200 OK a day keeps debugging away.",
    author: "HTTP Proverb",
    emoji: "✨",
  },
  {
    quote: "It works on my machine!",
    author: "Senior Dev",
    emoji: "🚀",
  },
  {
    quote: "Code is poetry with curly braces.",
    author: "Developer Wisdom",
    emoji: "💡",
  },
  {
    quote: "Simplicity is prerequisite for reliability.",
    author: "E. Dijkstra",
    emoji: "🌱",
  },
  {
    quote: "Make it work, make it right, make it fast.",
    author: "Kent Beck",
    emoji: "🏎️",
  },
  {
    quote: "Deleted code is debugged code.",
    author: "Jeff Sickel",
    emoji: "🧘",
  },
  {
    quote: "May your latency stay under 10ms.",
    author: "API Blessing",
    emoji: "🪄",
  },
  {
    quote: "Stay hydrated & take a deep breath.",
    author: "Rubber Duck",
    emoji: "🦆",
  },
  {
    quote: "You're doing great, keep building!",
    author: "KobeanREST",
    emoji: "🌟",
  },
  {
    quote: "Clean architecture, clear mind.",
    author: "Dev Spirit",
    emoji: "⚡",
  },
  {
    quote: "Every expert was once a beginner.",
    author: "Proverb",
    emoji: "🎯",
  },
  {
    quote: "Coffee in, clean APIs out.",
    author: "Dev Life",
    emoji: "☕",
  },
  {
    quote: "There is no place like 127.0.0.1.",
    author: "Localhost Proverb",
    emoji: "🏠",
  },
  {
    quote: "Fix the cause, not the symptom.",
    author: "Steve Maguire",
    emoji: "🔍",
  },
  {
    quote: "Before software can be reusable it first has to be usable.",
    author: "Ralph Johnson",
    emoji: "🧩",
  },
  {
    quote: "When in doubt, console.log it out.",
    author: "Debugging Lore",
    emoji: "📜",
  },
  {
    quote: "May your payload be lean and your headers pristine.",
    author: "REST Proverb",
    emoji: "🛡️",
  },
  {
    quote: "Tests passing on first try? Suspect witchcraft.",
    author: "QA Wisdom",
    emoji: "🧙",
  },
  {
    quote: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
    emoji: "💻",
  },
  {
    quote: "Commit early, commit often, push with confidence.",
    author: "Git Habit",
    emoji: "🌿",
  },
  {
    quote: "The best error message is the one that never happens.",
    author: "Thomas Fuchs",
    emoji: "🎉",
  },
  {
    quote: "Sleep is the best debugger you have.",
    author: "Dev Health",
    emoji: "🌙",
  },
  {
    quote: "One API endpoint at a time.",
    author: "Builder Mindset",
    emoji: "🧱",
  },
  {
    quote: "You solved hard bugs before, you'll solve this one too.",
    author: "Daily Encouragement",
    emoji: "💪",
  },
  {
    quote: "Fast endpoints make happy users.",
    author: "Performance Tip",
    emoji: "⚡",
  },
  {
    quote: "Write code as if the maintainer knows where you live.",
    author: "John Woods",
    emoji: "🪓",
  },
  {
    quote: "Good code is its own best documentation.",
    author: "Steve McConnell",
    emoji: "📖",
  },
  {
    quote: "If at first you don't succeed, call it version 1.0.",
    author: "Release Humor",
    emoji: "📦",
  },
  {
    quote: "May your CI pipeline always glow emerald green.",
    author: "DevOps Wish",
    emoji: "💚",
  },
  {
    quote: "Take five minutes. Fresh eyes spot typos instantly.",
    author: "Senior Advice",
    emoji: "👀",
  },
  // Expanded Developer Motivation & Architecture
  {
    quote: "Walking away from the keyboard solves 80% of weird bugs.",
    author: "Senior Dev Wisdom",
    emoji: "🚶",
  },
  {
    quote: "Good API design is empathy made into endpoints.",
    author: "API Architect",
    emoji: "❤️",
  },
  {
    quote: "A bug in production is just an unplanned QA test.",
    author: "Dev Humor",
    emoji: "🎪",
  },
  {
    quote: "First do it, then do it right, then do it better.",
    author: "Addy Osmani",
    emoji: "📈",
  },
  {
    quote: "May your CORS headers be forever permissive and secure.",
    author: "Web Dev Blessing",
    emoji: "🌐",
  },
  {
    quote: "Optimism is an occupational hazard of programming.",
    author: "Kent Beck",
    emoji: "🌈",
  },
  {
    quote: "Don't comment bad code — rewrite it.",
    author: "Brian Kernighan",
    emoji: "✏️",
  },
  {
    quote: "Quality is not an act, it is a habit.",
    author: "Aristotle (for Devs)",
    emoji: "🏆",
  },
  {
    quote: "Your code is shipping value to real humans. Be proud!",
    author: "Builder Spirit",
    emoji: "🌍",
  },
  {
    quote: "Keep your functions small and your ambitions big.",
    author: "Clean Coder",
    emoji: "📐",
  },
  {
    quote: "May your Bearer tokens never expire mid-demo.",
    author: "Live Demo Prayer",
    emoji: "🔐",
  },
  {
    quote: "Refactoring without tests is just moving bugs around.",
    author: "TDD Rule",
    emoji: "🧪",
  },
  {
    quote: "Great APIs feel intuitive before you even read the docs.",
    author: "DX Philosophy",
    emoji: "✨",
  },
  {
    quote: "You are not your code. Detach your ego, embrace feedback.",
    author: "Mindful Engineering",
    emoji: "🧠",
  },
  {
    quote: "The only way to go fast is to go well.",
    author: "Uncle Bob Martin",
    emoji: "🚀",
  },
  {
    quote: "Never underestimate the power of a fresh cup of tea.",
    author: "Tea-Driven Dev",
    emoji: "🍵",
  },
  {
    quote: "Today is a great day to close that tricky ticket.",
    author: "Daily Motivation",
    emoji: "🎯",
  },
  {
    quote: "Schemas are promises kept between frontend and backend.",
    author: "Contract First",
    emoji: "🤝",
  },
  {
    quote: "Every master programmer was once a junior who broke prod.",
    author: "Badge of Honor",
    emoji: "🎖️",
  },
  {
    quote: "Trust the process, run the tests, and enjoy the craft.",
    author: "Software Artisan",
    emoji: "🎨",
  }
];

export function getRandomPositiveQuote(): PositiveQuote {
  const index = Math.floor(Math.random() * POSITIVE_QUOTES.length);
  return POSITIVE_QUOTES[index];
}
