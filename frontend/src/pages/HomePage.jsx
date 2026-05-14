/**
 * HomePage - Dynamic Landing Page
 * Showcases simulations, RAG, and adaptive learning
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Typing animation component
function TypeWriter({ texts, speed = 50, deleteSpeed = 30, pauseTime = 2000 }) {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentText.length) {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, textIndex, texts, speed, deleteSpeed, pauseTime]);

  return (
    <span>
      {displayText}
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
}

// Live sorting animation component
function SortingAnimation() {
  const [bars, setBars] = useState([35, 65, 25, 80, 45, 55, 20, 70, 40, 60]);
  const [activeIndices, setActiveIndices] = useState([]);
  const [sortedIndices, setSortedIndices] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const bubbleSort = async () => {
      const arr = [...bars];
      const n = arr.length;

      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
          if (!isMounted) return;

          setActiveIndices([j, j + 1]);
          await new Promise(r => setTimeout(r, 150));

          if (arr[j] > arr[j + 1]) {
            [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            setBars([...arr]);
            await new Promise(r => setTimeout(r, 150));
          }
        }
        setSortedIndices(prev => [...prev, n - 1 - i]);
      }

      setSortedIndices(prev => [...prev, 0]);
      setActiveIndices([]);

      // Reset after pause
      await new Promise(r => setTimeout(r, 2000));
      if (isMounted) {
        setBars([35, 65, 25, 80, 45, 55, 20, 70, 40, 60]);
        setSortedIndices([]);
      }
    };

    const interval = setInterval(() => {
      if (isMounted) {
        setSortedIndices([]);
        bubbleSort();
      }
    }, 8000);

    bubbleSort();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-end justify-center gap-1 h-24">
      {bars.map((height, idx) => (
        <motion.div
          key={idx}
          className={`w-4 rounded-t transition-colors duration-150 ${
            sortedIndices.includes(idx)
              ? 'bg-green-500'
              : activeIndices.includes(idx)
              ? 'bg-primary'
              : 'bg-muted-foreground/30'
          }`}
          animate={{ height: `${height}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}
    </div>
  );
}

// Graph traversal animation
function GraphAnimation() {
  const [activeNode, setActiveNode] = useState(0);
  const [visitedNodes, setVisitedNodes] = useState([]);
  const [activeEdge, setActiveEdge] = useState(null);

  const nodes = [
    { id: 0, x: 50, y: 20 },
    { id: 1, x: 20, y: 50 },
    { id: 2, x: 80, y: 50 },
    { id: 3, x: 10, y: 85 },
    { id: 4, x: 40, y: 85 },
    { id: 5, x: 60, y: 85 },
    { id: 6, x: 90, y: 85 },
  ];

  const edges = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]
  ];

  useEffect(() => {
    const traversal = [0, 1, 3, 4, 2, 5, 6];
    const edgeOrder = [null, [0, 1], [1, 3], [1, 4], [0, 2], [2, 5], [2, 6]];
    let step = 0;

    const interval = setInterval(() => {
      if (step < traversal.length) {
        setActiveEdge(edgeOrder[step]);
        setActiveNode(traversal[step]);
        setVisitedNodes(prev => [...prev, traversal[step]]);
        step++;
      } else {
        // Reset
        step = 0;
        setVisitedNodes([]);
        setActiveNode(0);
        setActiveEdge(null);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <svg viewBox="0 0 100 100" className="w-full h-24">
      {/* Edges */}
      {edges.map(([from, to], idx) => {
        const fromNode = nodes[from];
        const toNode = nodes[to];
        const isActive = activeEdge && activeEdge[0] === from && activeEdge[1] === to;
        const isVisited = visitedNodes.includes(from) && visitedNodes.includes(to);

        return (
          <motion.line
            key={idx}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke={isActive ? '#c94f1e' : isVisited ? '#22c55e' : '#9ca3af'}
            strokeWidth={isActive ? 2 : 1.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <motion.circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={activeNode === node.id ? 6 : 5}
          fill={
            activeNode === node.id
              ? '#c94f1e'
              : visitedNodes.includes(node.id)
              ? '#22c55e'
              : '#d1d5db'
          }
          animate={{
            scale: activeNode === node.id ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </svg>
  );
}

// Document processing animation
function DocumentAnimation() {
  const [stage, setStage] = useState(0);
  const stages = ['upload', 'processing', 'chunks', 'ready'];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-32 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-14 border-2 border-dashed border-primary/50 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-muted-foreground">Upload PDF</span>
          </motion.div>
        )}

        {stage === 1 && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground">Processing...</span>
          </motion.div>
        )}

        {stage === 2 && (
          <motion.div
            key="chunks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="w-8 h-10 bg-primary/20 border border-primary/30 rounded text-[8px] p-1 text-primary"
                >
                  ≡≡≡
                </motion.div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Creating chunks</span>
          </motion.div>
        )}

        {stage === 3 && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs text-green-600">Ready to learn!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Adaptive learning visualization
function AdaptiveAnimation() {
  const [level, setLevel] = useState(0);
  const levels = [
    { label: 'Struggling', hint: 'Step-by-step guidance', color: 'text-orange-500', bg: 'bg-orange-500/20' },
    { label: 'Learning', hint: 'Balanced hints', color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    { label: 'Improving', hint: 'Fewer hints', color: 'text-blue-500', bg: 'bg-blue-500/20' },
    { label: 'Mastering', hint: 'Challenge mode', color: 'text-green-500', bg: 'bg-green-500/20' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLevel((prev) => (prev + 1) % levels.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const current = levels[level];

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-500 via-yellow-500 via-blue-500 to-green-500"
          animate={{ width: `${((level + 1) / levels.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Current state */}
      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={`flex items-center gap-3 p-3 rounded-lg ${current.bg}`}
        >
          <div className={`w-10 h-10 rounded-full ${current.bg} flex items-center justify-center`}>
            <span className={`text-lg font-bold ${current.color}`}>
              {level === 0 ? '?' : level === 1 ? '~' : level === 2 ? '!' : '★'}
            </span>
          </div>
          <div>
            <p className={`font-semibold ${current.color}`}>{current.label}</p>
            <p className="text-xs text-muted-foreground">{current.hint}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Live response animation
function LiveResponseAnimation() {
  const [step, setStep] = useState(0);
  const responses = [
    "Let me create a visual explanation for you...",
    "Here's an interactive simulation →"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      {/* User message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: step >= 0 ? 1 : 0 }}
        className="flex justify-end"
      >
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-br-sm text-sm max-w-[80%]">
          How does selection sort   work?
        </div>
      </motion.div>

      {/* AI response */}
      <AnimatePresence>
        {step >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm text-sm max-w-[85%]">
              {step === 1 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              {step >= 2 && responses[Math.min(step - 2, responses.length - 1)]}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header - Premium Styling */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-50 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-caramel to-caramel-dark flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </motion.div>
            <span className="font-headline text-xl font-bold text-foreground hidden sm:inline">VisuaLearn</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Sign In
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2, boxShadow: '0 10px 25px -5px rgba(200, 119, 64, 0.3)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
              className="px-4 sm:px-6 py-2.5 text-sm font-semibold bg-gradient-to-br from-caramel to-caramel-dark text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section - Premium Edition */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <section className="py-16 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-caramel font-bold text-xs sm:text-sm uppercase tracking-widest"
                >
                  ✨ AI-Powered Visual Learning
                </motion.p>
                <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight">
                  Learn
                  <br />
                  <span className="bg-gradient-to-r from-caramel via-caramel to-caramel-dark bg-clip-text text-transparent">
                    <TypeWriter
                      texts={[
                        'algorithms visually',
                        'from your documents',
                        'at your own pace',
                        'with simulations'
                      ]}
                      speed={60}
                      deleteSpeed={40}
                      pauseTime={2000}
                    />
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                  Transform complex concepts into interactive visualizations. Upload your notes and let AI create personalized learning experiences that adapt to your pace.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button
                  whileHover={{ scale: 1.05, y: -4, boxShadow: '0 20px 40px -10px rgba(200, 119, 64, 0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 text-base font-bold bg-gradient-to-br from-caramel to-caramel-dark text-white rounded-lg shadow-xl hover:shadow-2xl transition-all duration-200"
                >
                  Start Learning Free
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, y: -2, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 text-base font-bold text-foreground border-2 border-border/50 rounded-lg hover:border-caramel/50 hover:bg-caramel/5 transition-all duration-200"
                >
                  Watch Demo
                </motion.button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  <span>Free forever plan</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Live Preview - Glassmorphism */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
              className="relative hidden lg:block"
            >
              {/* Decorative Orbs */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-caramel rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-caramel rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000" />

              {/* Glassmorphic Card */}
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="relative z-10 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl hover:shadow-2xl hover:border-caramel/30 transition-all"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-caramel/5 to-transparent pointer-events-none" />
                
                <div className="relative space-y-6">
                  {/* Title */}
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-caramel"></div>
                    <span className="text-sm font-semibold text-caramel uppercase tracking-wide">Live Simulation</span>
                  </div>

                  {/* Live Animation */}
                  <LiveResponseAnimation />

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />

                  {/* Mini Simulation Preview */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Algorithm Visualization</p>
                    <SortingAnimation />
                  </div>

                  {/* Bottom Stats */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center">
                      <p className="text-xl font-bold text-caramel">50+</p>
                      <p className="text-xs text-muted-foreground">Algorithms</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-caramel">100%</p>
                      <p className="text-xs text-muted-foreground">Interactive</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-caramel">Real-time</p>
                      <p className="text-xs text-muted-foreground">Adaptive</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Ornamental Divider */}
        <div className="relative py-12">
          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-caramel mx-4" />
          </div>
        </div>

        {/* Simulation Showcase Section - Bento Grid */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-16"
          >
            <h2 className="font-headline text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
              See algorithms <span className="bg-gradient-to-r from-caramel to-caramel-dark bg-clip-text text-transparent">in action</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              Stop reading about algorithms. Watch them execute step by step with interactive simulations that make complex concepts crystal clear.
            </p>
          </motion.div>

          {/* Bento Grid Layout */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Large Card - Left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="md:col-span-2 md:row-span-2 backdrop-blur-sm bg-card/60 border border-border/40 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-caramel/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-caramel/20 to-caramel/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-caramel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-foreground">Sorting Algorithms</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bubble, Quick, Merge & more</p>
                </div>
              </div>
              <div className="h-32 flex items-center justify-center">
                <SortingAnimation />
              </div>
              <p className="text-sm text-muted-foreground mt-6 text-center">Watch elements swap in real-time with step-by-step visualization</p>
            </motion.div>

            {/* Small Cards - Right */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="backdrop-blur-sm bg-card/60 border border-border/40 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:border-caramel/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-caramel/20 to-caramel/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-caramel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-headline font-semibold text-foreground">Graph Traversal</h3>
                  <p className="text-xs text-muted-foreground">BFS, DFS, Dijkstra</p>
                </div>
              </div>
              <div className="h-20 flex items-center justify-center">
                <GraphAnimation />
              </div>
            </motion.div>

            {/* Feature Cards */}
            {[
              { icon: '🎯', title: 'Dynamic Memory', desc: 'Adapts to your learning style' },
              { icon: '⚡', title: 'Real-time Analysis', desc: 'Instant feedback & hints' },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="backdrop-blur-sm bg-card/60 border border-border/40 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:border-caramel/30 transition-all flex flex-col"
              >
                <span className="text-4xl mb-3">{feature.icon}</span>
                <h4 className="font-headline font-semibold text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Ornamental Divider */}
        <div className="relative py-12">
          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-caramel mx-4" />
          </div>
        </div>

        {/* Document Learning Section */}
        <section className="py-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="backdrop-blur-sm bg-card/60 border border-border/40 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-caramel/30 transition-all"
              >
                <DocumentAnimation />
                <div className="mt-8 space-y-3">
                  {[
                    'Intelligent semantic chunking',
                    'Multi-language RAG support',
                    'Contextual Q&A generation'
                  ].map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-caramel to-caramel-dark"></div>
                      <span className="text-sm text-foreground">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2 space-y-6"
            >
              <h2 className="font-headline text-4xl lg:text-5xl font-bold text-foreground leading-1.2">
                Learn from <span className="bg-gradient-to-r from-caramel to-caramel-dark bg-clip-text text-transparent">your documents</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-1.6">
                Upload lecture notes, textbooks, or research papers. Ask questions and get answers grounded in your own materials with AI-powered document understanding.
              </p>
              <ul className="space-y-4 pt-4">
                {[
                  'PDF, DOCX, and text files supported',
                  'AI finds relevant sections automatically',
                  'Generate quizzes from your content',
                  'Export summaries and key concepts'
                ].map((item, idx) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 * idx }}
                    className="flex items-start gap-4"
                  >
                    <svg className="w-6 h-6 text-caramel mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground text-lg">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Ornamental Divider */}
        <div className="relative py-12">
          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-caramel mx-4" />
          </div>
        </div>

        {/* Adaptive Learning Section */}
        <section className="py-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="font-headline text-4xl lg:text-5xl font-bold text-foreground leading-1.2">
                Learning that <span className="bg-gradient-to-r from-caramel to-caramel-dark bg-clip-text text-transparent">adapts to you</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Our AI monitors your progress in real-time. Struggling? Get more guidance. Mastering it? Face new challenges. No two learning paths are the same.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:border-orange-500/50 transition-colors">
                  <p className="font-headline font-bold text-orange-600">Struggling</p>
                  <p className="text-sm text-muted-foreground mt-2">Step-by-step guided hints</p>
                </div>
                <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/30 hover:border-green-500/50 transition-colors">
                  <p className="font-headline font-bold text-green-600">Mastering</p>
                  <p className="text-sm text-muted-foreground mt-2">Challenging problems</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="backdrop-blur-sm bg-card/60 border border-border/40 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-caramel/30 transition-all"
              >
                <p className="text-sm font-bold text-caramel uppercase tracking-wider mb-6">Real-time Adaptation</p>
                <AdaptiveAnimation />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section - Premium */}
        <section className="py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl"
          >
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-caramel/90 via-caramel-dark/80 to-raisin-dark/90" />
            
            {/* Decorative Orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-10 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
            </div>

            {/* Content */}
            <div className="relative z-10 px-6 sm:px-8 py-16 sm:py-20 max-w-4xl mx-auto text-center space-y-8">
              <h2 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-1.2">
                Ready to learn <span className="text-white/90">smarter</span>?
              </h2>
              <p className="text-white/80 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto">
                Join thousands of learners who've transformed how they understand complex concepts through interactive visualization and adaptive AI.
              </p>
              <motion.button
                whileHover={{ scale: 1.08, y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-10 sm:px-12 py-4 sm:py-5 text-lg sm:text-xl font-bold bg-white text-caramel rounded-xl shadow-2xl hover:shadow-2xl transition-all duration-200 inline-block"
              >
                Get Started Free Today
              </motion.button>
              <p className="text-white/70 text-sm">No credit card required • Free forever plan available</p>
            </div>
          </motion.div>
        </section>

        {/* Ornamental Divider */}
        <div className="relative py-12">
          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        </div>
      </main>

      {/* Footer - Premium */}
      <footer className="border-t border-border/40 bg-card/50 backdrop-blur-sm py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-headline font-bold text-foreground mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-caramel transition">Features</a></li>
                <li><a href="#" className="hover:text-caramel transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-caramel transition">About</a></li>
                <li><a href="#" className="hover:text-caramel transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-caramel transition">Privacy</a></li>
                <li><a href="#" className="hover:text-caramel transition">Terms</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground mb-4">Connect</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-caramel transition">Twitter</a></li>
                <li><a href="#" className="hover:text-caramel transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-caramel" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <span className="font-headline font-bold text-foreground">VisuaLearn</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 VisuaLearn. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

        {/* Diamond Divider */}
        <div className="diamond-divider">
          <span></span>
        </div>

        {/* Simulation Showcase Section */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-headline text-3xl lg:text-4xl font-bold text-foreground mb-4">
              See algorithms <span className="text-primary">in action</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Don't just read about algorithms—watch them execute step by step.
              Interactive simulations make complex concepts crystal clear.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Sorting Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="neu-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-headline font-semibold text-foreground">Sorting Algorithms</h3>
                  <p className="text-xs text-muted-foreground">Bubble, Quick, Merge & more</p>
                </div>
              </div>
              <SortingAnimation />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Watch elements swap in real-time
              </p>
            </motion.div>

            {/* Graph Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="neu-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-headline font-semibold text-foreground">Graph Traversal</h3>
                  <p className="text-xs text-muted-foreground">BFS, DFS, Dijkstra</p>
                </div>
              </div>
              <GraphAnimation />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Follow the path as it explores
              </p>
            </motion.div>
          </div>
        </section>

        {/* Ornamental Line */}
        <div className="ornamental-line"></div>

        {/* Document Learning Section */}
        <section className="py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <motion.div
                whileHover={{ y: -5 }}
                className="neu-card p-6"
              >
                <DocumentAnimation />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-muted-foreground">Intelligent chunking</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-muted-foreground">Semantic search</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-muted-foreground">Contextual answers</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2 space-y-4"
            >
              <h2 className="font-headline text-3xl lg:text-4xl font-bold text-foreground">
                Learn from <span className="text-primary">your documents</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Upload your lecture notes, textbooks, or research papers.
                Ask questions and get answers grounded in your own materials.
              </p>
              <ul className="space-y-3 pt-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground">PDF, DOCX, and text files supported</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground">AI finds relevant sections automatically</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground">Generate quizzes from your content</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Diamond Divider */}
        <div className="diamond-divider">
          <span></span>
        </div>

        {/* Adaptive Learning Section */}
        <section className="py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h2 className="font-headline text-3xl lg:text-4xl font-bold text-foreground">
                Learning that <span className="text-primary">adapts to you</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Our AI monitors your progress in real-time. Struggling? Get more guidance.
                Mastering it? Face new challenges. No two learning paths are the same.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="font-semibold text-orange-600 text-sm">Struggling</p>
                  <p className="text-xs text-muted-foreground mt-1">Step-by-step hints</p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="font-semibold text-green-600 text-sm">Mastering</p>
                  <p className="text-xs text-muted-foreground mt-1">Challenge problems</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <motion.div
                whileHover={{ y: -5 }}
                className="neu-card p-6"
              >
                <p className="text-sm font-medium text-foreground mb-4">Real-time adaptation</p>
                <AdaptiveAnimation />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Ornamental Line */}
        <div className="ornamental-line"></div>

        {/* Features Grid */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-headline text-3xl font-bold text-foreground mb-4">
              Everything you need to learn
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '📖', title: 'Explanations', desc: 'Clear, step-by-step' },
              { icon: '🗺️', title: 'Mind Maps', desc: 'Visual connections' },
              { icon: '🃏', title: 'Flashcards', desc: 'Active recall' },
              { icon: '✅', title: 'Quizzes', desc: 'Test yourself' },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="neu-card-sm p-5 text-center cursor-pointer"
              >
                <span className="text-3xl mb-3 block">{feature.icon}</span>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="neu-card p-12 text-center relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="font-headline text-3xl lg:text-4xl font-bold text-foreground">
                Ready to learn <span className="text-primary">smarter</span>?
              </h2>
              <p className="text-muted-foreground text-lg">
                Join thousands of learners who've transformed how they understand the world.
              </p>
              <motion.button
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="neu-btn-primary px-10 py-4 text-lg font-semibold shadow-lg"
              >
                Get Started Free
              </motion.button>
              <p className="text-sm text-muted-foreground">No credit card required</p>
            </div>
          </motion.div>
        </section>

        {/* Diamond Divider */}
        <div className="diamond-divider">
          <span></span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <span className="font-headline font-semibold text-foreground">VisuaLearn</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered interactive learning
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
