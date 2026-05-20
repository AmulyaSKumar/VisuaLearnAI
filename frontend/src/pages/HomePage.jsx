import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LogoMark from '../components/LogoMark';

const MotionDiv = motion.div;
const MotionArticle = motion.article;
const MotionSection = motion.section;
const MotionHeader = motion.header;
const MotionP = motion.p;

const accents = {
  primary: '#111111',
  secondary: '#0F766E',
  amber: '#F59E0B',
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

function AmbientBackground() {
  const { scrollYProgress } = useScroll();
  const inkY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);
  const tealY = useTransform(scrollYProgress, [0, 1], ['0%', '-7%']);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#FAF7F2]">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(17,17,17,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.055) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(circle at 42% 18%, black, transparent 72%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.8'/%3E%3C/svg%3E\")",
        }}
      />
      <MotionDiv
        style={{ y: inkY }}
        className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-[#111111]/8 blur-3xl"
      />
      <MotionDiv
        style={{ y: tealY }}
        className="absolute right-[-8rem] top-[34rem] h-96 w-96 rounded-full bg-[#0F766E]/14 blur-3xl"
      />
      <MotionDiv
        animate={{ x: [0, 14, 0], y: [0, -8, 0], opacity: [0.12, 0.18, 0.12] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[58%] top-28 h-72 w-72 rounded-full bg-[#0F766E]/16 blur-3xl"
      />
    </div>
  );
}

function FlowNode({ label, detail, accent, active }) {
  return (
    <MotionDiv
      animate={{
        borderColor: active ? accent : 'rgba(17,17,17,0.12)',
        backgroundColor: active ? 'rgba(17,17,17,0.04)' : 'rgba(255,255,255,0.9)',
      }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative rounded-2xl border p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">step</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className="text-base font-medium text-[#111111]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#4B5563]">{detail}</p>
    </MotionDiv>
  );
}

const learningModeCycle = [
  'Show me visually',
  'Ask guiding questions',
  'Check my understanding',
  'Review the basics',
  'Walk me through it',
  'Keep it short',
];

function AdaptiveVisualization() {
  const [active, setActive] = useState(0);
  const [modeIndex, setModeIndex] = useState(0);
  const nodes = [
    { label: 'You ask', detail: 'Start with any topic or question', accent: accents.primary },
    { label: 'We understand', detail: 'VisuaLearn notices what you need next', accent: accents.secondary },
    { label: 'Lesson adjusts', detail: 'The format changes to match your progress', accent: accents.amber },
    { label: 'Best format', detail: learningModeCycle[modeIndex], accent: accents.primary },
    { label: 'You practice', detail: 'Notes, visuals, cards, or a quick quiz', accent: accents.secondary },
  ];

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % 5;
        if (next === 3) {
          setModeIndex((mode) => (mode + 1) % learningModeCycle.length);
        }
        return next;
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] border border-[#E7E1D7]" />
      <div className="rounded-[1.75rem] border border-[#E7E1D7] bg-[#FFFFFF] p-4 sm:p-5 shadow-[0_24px_80px_rgba(17,17,17,0.06)]">
        <div className="mb-5 flex items-center justify-between border-b border-[#E7E1D7] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#6B7280]">your lesson, shaped in real time</p>
            <p className="mt-2 text-sm text-[#4B5563]">Ask - Understand - Choose - Practice - Remember</p>
          </div>
          <MotionDiv
            animate={{ opacity: active === 2 ? 1 : 0.5, scale: active === 2 ? 1.08 : 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#E7E1D7] shadow-[0_0_24px_rgba(17,17,17,0.10)]"
          >
            <span className="h-2 w-2 rounded-full bg-[#111111]" />
          </MotionDiv>
        </div>
        <div className="relative grid gap-3">
          {nodes.map((node, index) => (
            <div key={node.label} className="relative">
              <FlowNode {...node} active={active === index} />
              {index < nodes.length - 1 && (
                <div className="mx-6 h-5 w-px overflow-hidden bg-[#F3EEE7]">
                  <MotionDiv
                    className="h-full w-px"
                    style={{ backgroundColor: nodes[index + 1].accent }}
                    animate={{ y: active > index ? ['-100%', '0%'] : '-100%' }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorialCard({ eyebrow, title, children, accent = accents.primary, className = '' }) {
  return (
    <MotionArticle
      variants={fadeUp}
      whileHover={{
        y: -6,
        scale: 1.015,
        borderColor: accent,
      }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`group relative overflow-hidden rounded-3xl border border-[#E7E1D7] bg-[#FFFFFF] p-7 shadow-[0_20px_70px_rgba(17,17,17,0.045)] sm:p-8 ${className}`}
    >
      <MotionDiv
        className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: accent }}
        initial={{ scaleX: 0, transformOrigin: 'left' }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-120px' }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280]">{eyebrow}</p>
      <h3 className="mt-5 max-w-xl text-2xl font-semibold leading-tight text-[#111111] sm:text-3xl">{title}</h3>
      <div className="mt-7 text-[#4B5563]">{children}</div>
    </MotionArticle>
  );
}

function PathPreview() {
  const steps = ['Bubble Sort', 'Visualization', 'Flashcards', 'Quiz', 'Mastery'];
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <MotionDiv
          key={step}
          variants={fadeUp}
          className="flex items-center gap-4"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E7E1D7] text-sm text-[#111111]">
            {index + 1}
          </div>
          <div className="flex-1 rounded-2xl border border-[#E7E1D7] bg-[#FFFFFF] px-4 py-3">
            <p className="text-sm font-medium text-[#111111]">{step}</p>
            <MotionDiv
              initial={{ width: 0 }}
              whileInView={{ width: `${32 + index * 15}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.08, ease: 'easeOut' }}
              className="mt-3 h-1 rounded-full"
              style={{ backgroundColor: index % 2 === 0 ? accents.primary : accents.secondary }}
            />
          </div>
        </MotionDiv>
      ))}
    </div>
  );
}

function AdaptationStack() {
  const items = [
    ['Understand', 'The lesson starts from your question and current comfort level.'],
    ['Choose format', 'VisuaLearn picks a visual, question, example, card, or quiz.'],
    ['Teach', 'You get the explanation style that fits the moment.'],
    ['Notice friction', 'If something feels unclear, the lesson slows down and adds support.'],
    ['Build confidence', 'Each step moves you toward recall, practice, and mastery.'],
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % items.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <div className="relative space-y-4">
      {items.map(([title, detail], index) => (
        <div key={title}>
          <MotionDiv
            variants={fadeUp}
            animate={{
              borderColor: active === index ? accents.secondary : 'rgba(17,17,17,0.12)',
              opacity: active === index ? 1 : 0.68,
            }}
            whileHover={{ x: 6, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid gap-3 rounded-2xl border bg-[#FFFFFF] p-4 sm:grid-cols-[12rem_1fr]"
          >
            <span className="text-sm font-medium text-[#111111]">{title}</span>
            <span className="text-sm leading-6 text-[#4B5563]">{detail}</span>
          </MotionDiv>
          {index < items.length - 1 && (
            <div className="ml-6 h-5 w-px overflow-hidden bg-[#F3EEE7]">
              <MotionDiv
                className="h-full w-px bg-[#0F766E]"
                animate={{ y: active > index ? ['-100%', '0%'] : '-100%' }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InteractiveDemo() {
  const stages = [
    ['Question', '"What is recursion?"', 'A learner asks for a concept that benefits from structure.'],
    ['First approach', 'Visual explanation', 'Start with a simple picture and a concrete example.'],
    ['Learner moment', 'Still unclear', 'The lesson notices you may need a different angle.'],
    ['New approach', 'Guiding questions', 'The lesson turns into smaller prompts you can answer.'],
    ['Artifact appears', 'Flashcards generated', 'Key definitions and examples become a quick review set.'],
    ['Outcome', 'Confidence improves', 'You leave with a clearer mental model and practice set.'],
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % stages.length);
    }, 1200);
    return () => window.clearInterval(id);
  }, [stages.length]);

  return (
    <MotionSection
      id="demo"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-120px' }}
      className="grid gap-10 border-y border-[#E7E1D7] py-24 lg:grid-cols-[0.82fr_1.18fr]"
    >
      <MotionDiv variants={fadeUp} className="max-w-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[#6B7280]">product demo</p>
        <h2 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-[#111111] sm:text-[42px]">
          See adaptation in action
        </h2>
        <p className="mt-6 text-base leading-7 text-[#4B5563]">
          A single question can become an explanation, a new angle, flashcards,
          and a confidence-building review loop.
        </p>
      </MotionDiv>
      <MotionDiv variants={fadeUp} className="rounded-[2rem] border border-[#E7E1D7] bg-[#FFFFFF] p-4 sm:p-6">
        <div className="mb-6 grid grid-cols-6 gap-2">
          {stages.map(([label], index) => (
            <div key={label} className="h-1 overflow-hidden rounded-full bg-[#F3EEE7]">
              <MotionDiv
                className="h-full rounded-full"
                style={{ backgroundColor: [accents.primary, accents.secondary, accents.secondary][index % 3] }}
                animate={{ width: active >= index ? '100%' : '0%' }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          {stages.map(([label, value, detail], index) => (
            <MotionDiv
              key={label}
              animate={{
                opacity: active === index ? 1 : 0.42,
                scale: active === index ? 1.015 : 1,
                borderColor: active === index ? [accents.primary, accents.secondary, accents.secondary][index % 3] : 'rgba(17,17,17,0.10)',
              }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="rounded-2xl border bg-[#FAF7F2] p-4"
            >
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#6B7280]">{label}</p>
              <p className="mt-2 text-base font-medium text-[#111111]">{value}</p>
              <p className="mt-1 text-sm leading-6 text-[#4B5563]">{detail}</p>
            </MotionDiv>
          ))}
        </div>
      </MotionDiv>
    </MotionSection>
  );
}

function ExampleRail() {
  const examples = [
    ['What is recursion?', 'simple visual example', accents.primary],
    ['Teach binary trees', 'Ask guiding questions', accents.secondary],
    ['Explain merge sort', 'step-by-step practice', accents.secondary],
  ];

  return (
    <div className="grid gap-4">
      {examples.map(([question, output, accent], index) => (
        <MotionDiv
          key={question}
          variants={fadeUp}
          whileHover={{ x: index % 2 === 0 ? 10 : -10 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-3xl border border-[#E7E1D7] bg-[#FFFFFF] p-5"
        >
          <p className="font-medium text-[#111111]">"{question}"</p>
          <div className="mt-4 flex items-center gap-3 text-sm text-[#4B5563]">
            <span className="h-px flex-1" style={{ backgroundColor: accent }} />
            <span>{output}</span>
          </div>
        </MotionDiv>
      ))}
    </div>
  );
}

function Metrics() {
  const metrics = [
    ['6', 'Ways to Learn', accents.primary],
    ['8', 'Learning Cues', accents.secondary],
    ['Live', 'Lesson Adjustment', accents.amber],
    ['Personal', 'Study Workspace', accents.primary],
  ];

  return (
    <MotionSection
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-120px' }}
      className="grid gap-4 py-24 sm:grid-cols-2 lg:grid-cols-4"
    >
      {metrics.map(([value, label, accent]) => (
        <MotionDiv
          key={label}
          variants={fadeUp}
          whileHover={{ y: -5, borderColor: accent }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-3xl border border-[#E7E1D7] bg-[#FFFFFF] p-7"
        >
          <MotionP
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="text-4xl font-semibold tracking-tight text-[#111111] sm:text-5xl"
          >
            {value}
          </MotionP>
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-[#6B7280]">{label}</p>
        </MotionDiv>
      ))}
    </MotionSection>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/chat/new', { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF7F2] text-[#111111]">
        <div className="h-8 w-8 rounded-full border border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F2] text-[#111111]">
      <AmbientBackground />

      <MotionHeader
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10"
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-7 lg:px-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-left"
            aria-label="VisuaLearn home"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#E7E1D7] bg-[#FFFFFF] text-[#111111] shadow-[0_12px_30px_rgba(17,17,17,0.06)]">
              <LogoMark className="h-7 w-7" inverted />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.22em] text-[#111111]">VISUALEARN</span>
              <span className="block text-xs text-[#6B7280]">Personal study workspace</span>
            </span>
          </button>
          <nav className="hidden items-center gap-7 text-sm text-[#4B5563] md:flex" aria-label="Primary navigation">
            <a className="transition-colors hover:text-[#111111]" href="#how-it-works">How it works</a>
            <a className="transition-colors hover:text-[#111111]" href="#demo">Demo</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden rounded-full px-5 py-2.5 text-sm text-[#4B5563] transition-colors hover:text-[#111111] sm:block"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_38px_rgba(17,17,17,0.16)] transition duration-200 hover:scale-[1.02] hover:bg-[#000000]"
            >
              Start learning
            </button>
          </div>
        </div>
      </MotionHeader>

      <main className="relative z-10 mx-auto max-w-[1280px] px-6 pb-24 lg:px-10">
        <MotionSection
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid min-h-[78vh] items-center gap-14 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:py-20"
        >
          <MotionDiv variants={fadeUp} className="max-w-4xl">
            <h1 className="max-w-4xl text-6xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#111111] sm:text-7xl lg:text-[80px]">
              Study with lessons that adapt
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-8 text-[#4B5563]">
              Learn with explanations, visuals, flashcards, and quizzes that shift with your pace
              so the next step always feels clear.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/login')}
                className="rounded-full bg-[#111111] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_50px_rgba(17,17,17,0.16)] transition duration-200 hover:scale-[1.02] hover:bg-[#000000] hover:shadow-[0_22px_70px_rgba(17,17,17,0.20)]"
              >
                Start learning
              </button>
              <a
                href="#adaptation"
                className="rounded-full border border-[#111111]/45 px-8 py-4 text-base font-semibold text-[#111111] shadow-[0_0_28px_rgba(17,17,17,0.08)] transition duration-200 hover:border-[#111111] hover:bg-[#111111]/10"
              >
                See how it works
              </a>
            </div>
          </MotionDiv>

          <MotionDiv variants={fadeUp} className="lg:pt-16">
            <AdaptiveVisualization />
          </MotionDiv>
        </MotionSection>

        <MotionSection
          id="how-it-works"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="grid gap-6 border-t border-[#E7E1D7] py-24 lg:grid-cols-[0.72fr_1fr]"
        >
          <MotionDiv variants={fadeUp} className="pt-4">
            <p className="text-xs uppercase tracking-[0.35em] text-[#6B7280]">interactive learning paths</p>
            <h2 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-[#111111] sm:text-5xl">
              Turn any topic into a clear study path.
            </h2>
          </MotionDiv>
          <EditorialCard eyebrow="path preview" title="A topic can become notes, visuals, flashcards, and a quiz." accent={accents.primary}>
            <PathPreview />
          </EditorialCard>
        </MotionSection>

        <MotionSection
          id="adaptation"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="grid gap-6 py-24 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <EditorialCard eyebrow="how adaptation works" title="A calmer way to move from confusion to confidence." accent={accents.secondary}>
            <AdaptationStack />
          </EditorialCard>
          <MotionDiv variants={fadeUp} className="flex items-end">
            <div className="max-w-lg pb-8 lg:pl-10">
              <p className="text-xs uppercase tracking-[0.35em] text-[#6B7280]">closed loop teaching</p>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-[#111111] sm:text-5xl">
                The lesson changes when your understanding changes.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#4B5563]">
                Instead of giving the same answer every time, VisuaLearn can slow down,
                ask a question, show a visual, or turn the idea into practice.
              </p>
            </div>
          </MotionDiv>
        </MotionSection>

        <InteractiveDemo />

        <MotionSection
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="grid gap-6 py-24 lg:grid-cols-[0.85fr_1.15fr]"
        >
          <MotionDiv variants={fadeUp} className="lg:order-2">
            <EditorialCard eyebrow="real examples" title="Different questions deserve different learning formats." accent={accents.secondary}>
              <ExampleRail />
            </EditorialCard>
          </MotionDiv>
          <MotionDiv variants={fadeUp} className="flex items-center lg:order-1">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#6B7280]">dynamic previews</p>
              <h2 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-[#111111] sm:text-5xl">
                A workspace that feels built for studying, not prompting.
              </h2>
            </div>
          </MotionDiv>
        </MotionSection>

        <Metrics />
      </main>
    </div>
  );
}
