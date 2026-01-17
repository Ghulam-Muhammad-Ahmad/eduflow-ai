import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, BookOpen, Brain, Users } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-edu-teal/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-primary/5 via-transparent to-edu-purple/5 rounded-full" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Education Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-slide-up">
            Transform Teaching with{" "}
            <span className="gradient-text">Intelligent</span>{" "}
            Learning Tools
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            EduLabLoom streamlines lesson planning, assessment, and student preparation 
            using AI-assisted workflows. Designed for schools, colleges, and online educators.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="xl">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="hero-outline" size="xl">
              <Play className="w-5 h-5" />
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">10K+</div>
              <div className="text-sm text-muted-foreground">Active Teachers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">500K+</div>
              <div className="text-sm text-muted-foreground">Students Learning</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">95%</div>
              <div className="text-sm text-muted-foreground">Time Saved</div>
            </div>
          </div>
        </div>

        {/* Floating Feature Cards */}
        <div className="relative mt-20 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-2xl animate-float">
              <div className="feature-icon-indigo mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Smart Lesson Plans</h3>
              <p className="text-sm text-muted-foreground">AI generates curriculum-aligned lesson plans in seconds</p>
            </div>

            <div className="glass-card p-6 rounded-2xl animate-float-delayed">
              <div className="feature-icon-teal mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">AI Grading</h3>
              <p className="text-sm text-muted-foreground">Instant, unbiased assessment with detailed feedback</p>
            </div>

            <div className="glass-card p-6 rounded-2xl animate-float">
              <div className="feature-icon-purple mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Student Hub</h3>
              <p className="text-sm text-muted-foreground">Personalized study plans and progress tracking</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
