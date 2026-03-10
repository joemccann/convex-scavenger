"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Terminal, Shield, Zap, Activity, ChevronRight, Github } from "lucide-react";

export default function LandingPage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const lineVariants: Variants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: { duration: 1, ease: "easeInOut" },
    },
  };

  return (
    <div className="min-h-screen bg-canvas selection:bg-accent selection:text-canvas overflow-x-hidden">
      {/* Background Grid */}
      <div className="fixed inset-0 instrument-grid opacity-[0.03] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-grid bg-canvas/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand/radon-monogram.svg" alt="Radon" className="w-5 h-5" />
            <span className="font-display font-bold text-xl tracking-tight uppercase">Radon</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-mono text-muted hover:text-primary transition-colors uppercase tracking-widest">Instruments</a>
            <a href="#open-source" className="text-xs font-mono text-muted hover:text-primary transition-colors uppercase tracking-widest">Sovereignty</a>
            <a href="https://github.com/radon-terminal" className="text-xs font-mono text-muted hover:text-primary transition-colors uppercase tracking-widest">Source</a>
          </nav>
          <button className="px-4 py-2 bg-primary text-canvas text-xs font-mono font-bold uppercase tracking-widest hover:bg-accent transition-all">
            Access Terminal
          </button>
        </div>
      </header>

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="flex flex-col items-center text-center"
          >
            <motion.div variants={itemVariants} className="mb-6">
              <span className="px-3 py-1 border border-accent/30 bg-accent/5 text-[10px] font-mono text-accent uppercase tracking-[0.2em]">
                Version 4.0.0 // Institutional Release
              </span>
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-8 max-w-5xl leading-[1.05] tracking-tight"
            >
              Market structure, <span className="text-muted">reconstructed.</span>
            </motion.h1>

            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-secondary max-w-2xl mb-12 font-sans leading-relaxed"
            >
              Radon Terminal is an institutional-grade instrument for reconstructing market structure from noisy signals. Built for the 1% of technical traders who demand sovereignty over their execution.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-4">
              <button className="px-8 py-4 bg-accent text-canvas font-mono font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                Initialize Connection <ChevronRight size={16} />
              </button>
              <button className="px-8 py-4 border border-grid text-primary font-mono font-bold uppercase tracking-widest hover:bg-panel-raised transition-all">
                View Documentation
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* Terminal Preview */}
        <section className="max-w-7xl mx-auto px-6 mb-40">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative"
          >
            {/* Mockup Frame */}
            <div className="border border-grid bg-panel rounded-lg overflow-hidden shadow-2xl">
              <div className="h-10 border-b border-grid bg-panel-raised flex items-center justify-between px-4">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-grid" />
                  <div className="w-2.5 h-2.5 rounded-full bg-grid" />
                  <div className="w-2.5 h-2.5 rounded-full bg-grid" />
                </div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
                  radon-terminal-v4.0.0 // live-feed: connected
                </div>
                <div className="w-12" />
              </div>
              
              <div className="p-1 flex flex-col md:flex-row gap-1 h-[600px]">
                {/* Sidebar Mock */}
                <div className="w-full md:w-48 border-r border-grid p-4 hidden md:flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="h-2 w-full bg-accent opacity-20" />
                    <div className="h-2 w-3/4 bg-grid" />
                    <div className="h-2 w-1/2 bg-grid" />
                  </div>
                  <div className="mt-auto space-y-2">
                    <div className="h-1 w-full bg-grid" />
                    <div className="h-1 w-full bg-grid" />
                  </div>
                </div>
                
                {/* Content Mock */}
                <div className="flex-1 p-6 overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="border border-grid p-4 bg-panel-raised/50">
                        <div className="text-[9px] font-mono text-muted uppercase tracking-widest mb-2">Metric 0{i}</div>
                        <div className="text-2xl font-mono text-primary">0.0000</div>
                      </div>
                    ))}
                  </div>
                  <div className="border border-grid h-full bg-panel-raised/30 p-4">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-grid">
                        <div className="text-xs font-mono uppercase tracking-widest text-accent">Structural Analysis</div>
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-signal-strong animate-pulse" />
                        </div>
                     </div>
                     <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex gap-4 items-center">
                            <div className="w-full h-px bg-grid relative overflow-hidden">
                              <motion.div 
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                                className="absolute inset-0 bg-accent/20 w-1/4"
                              />
                            </div>
                            <div className="text-[10px] font-mono text-muted">CH{i}</div>
                          </div>
                        ))}
                     </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative Spectral Lines */}
            <div className="absolute -top-10 -right-10 w-40 h-40 border border-accent/20 rounded-full opacity-20 animate-ping" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 border border-accent/10 rounded-full opacity-10" />
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 mb-40">
          <div className="grid md:grid-cols-3 gap-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="border-l-2 border-grid pl-8 py-4 hover:border-accent transition-colors group"
            >
              <Activity className="text-accent mb-6 group-hover:scale-110 transition-transform" size={32} />
              <h3 className="text-xl font-display font-bold mb-4 uppercase tracking-tight">Radon Flow</h3>
              <p className="text-secondary font-sans leading-relaxed">
                Decompose institutional flow into principal components. Isolate non-random signals from the noise of retail positioning.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="border-l-2 border-grid pl-8 py-4 hover:border-accent transition-colors group"
            >
              <Zap className="text-accent mb-6 group-hover:scale-110 transition-transform" size={32} />
              <h3 className="text-xl font-display font-bold mb-4 uppercase tracking-tight">Radon Surface</h3>
              <p className="text-secondary font-sans leading-relaxed">
                Map volatility surfaces in real-time. Detect structural dislocations and convexity traps before they materialize in price action.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="border-l-2 border-grid pl-8 py-4 hover:border-accent transition-colors group"
            >
              <Shield className="text-accent mb-6 group-hover:scale-110 transition-transform" size={32} />
              <h3 className="text-xl font-display font-bold mb-4 uppercase tracking-tight">Radon Structure</h3>
              <p className="text-secondary font-sans leading-relaxed">
                Reconstruct cross-asset state from fragmented data. A scientific approach to regime detection and transition probability.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Open Source / Arrogance Section */}
        <section id="open-source" className="max-w-7xl mx-auto px-6 mb-40">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="bg-panel border border-grid p-12 md:p-24 relative overflow-hidden"
          >
            <div className="relative z-10 max-w-3xl">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-8 leading-tight">
                Open Source because we aren't afraid of a code audit. <span className="text-accent underline decoration-accent/30 underline-offset-8">Are you?</span>
              </h2>
              <p className="text-xl text-secondary mb-12 font-sans leading-relaxed">
                We don't hide behind black boxes. The math is public. The execution is transparent. If you can't verify your tools, you don't own your strategy.
              </p>
              <div className="flex gap-6">
                <a href="https://github.com" className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-primary hover:text-accent transition-colors">
                  <Github size={20} /> Inspect Source
                </a>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none overflow-hidden">
               <div className="absolute inset-0 rotate-45 translate-x-1/2 scale-150">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="h-px w-full bg-accent mb-4" />
                  ))}
               </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-6 pt-20 border-t border-grid">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src="/brand/radon-monogram.svg" alt="Radon" className="w-4 h-4" />
                <span className="font-display font-bold text-sm tracking-tight uppercase">Radon</span>
              </div>
              <p className="text-xs font-mono text-muted leading-loose">
                RECONSTRUCTING MARKET STRUCTURE FROM NOISY SIGNALS.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] mb-6">Instruments</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">FLOW</a></li>
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">SURFACE</a></li>
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">SIGNALS</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] mb-6">Protocol</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">DOCUMENTATION</a></li>
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">API SPEC</a></li>
                <li><a href="#" className="text-xs font-mono text-muted hover:text-accent transition-colors">CONTRIBUTE</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] mb-6">Terminal</h4>
              <button className="w-full py-3 border border-accent/50 text-accent text-[10px] font-mono font-bold uppercase tracking-[0.2em] hover:bg-accent hover:text-canvas transition-all">
                Access Live Node
              </button>
            </div>
          </div>
          <div className="pb-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
              © 2026 RADON PROTOCOL // ALL RIGHTS RESERVED
            </span>
            <div className="flex gap-8">
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-signal-strong rounded-full" /> System Status: Operational
              </span>
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
                Latency: 14ms
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
