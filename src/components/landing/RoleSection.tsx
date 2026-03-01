import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  BookOpen, 
  FileCheck, 
  LineChart, 
  Clock,
  Lightbulb,
  TrendingUp,
  Award,
  Users
} from "lucide-react";

const teacherBenefits = [
  { icon: Clock, text: "Save 10+ hours weekly on grading" },
  { icon: BookOpen, text: "AI-generated lesson plans in seconds" },
  { icon: FileCheck, text: "Automated rubric-based assessments" },
  { icon: LineChart, text: "Track class progress effortlessly" },
];

const studentBenefits = [
  { icon: Lightbulb, text: "Personalized study recommendations" },
  { icon: TrendingUp, text: "Track your learning progress" },
  { icon: Award, text: "Instant feedback on submissions" },
  { icon: Users, text: "Collaborative learning tools" },
];

const RoleSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        {/* Tutors Section */}
        <div id="tutors" className="grid lg:grid-cols-2 gap-16 items-center mb-32">
          <div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 block">
              For Tutors
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Reclaim Your Time,{" "}
              <span className="gradient-text">Amplify Your Impact</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Edulabloom handles the repetitive tasks so you can focus on what matters most: 
              inspiring and connecting with your students.
            </p>
            
            <div className="space-y-4 mb-8">
              {teacherBenefits.map((benefit) => (
                <div key={benefit.text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{benefit.text}</span>
                </div>
              ))}
            </div>

            <Button variant="hero" size="lg" asChild>
              <a href="/auth?mode=signup&accountType=solo_tutor">Start Tutoring Smarter</a>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-slime-lime/10 rounded-3xl blur-3xl" />
            <div className="relative glass-card rounded-3xl p-8">
              <div className="bg-secondary/50 rounded-2xl p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">AI Lesson Plan Generator</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-slime-lime/20 text-brand-lime-dark font-medium">Generating...</span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-primary/20 rounded-full w-full animate-pulse" />
                  <div className="h-3 bg-primary/15 rounded-full w-4/5 animate-pulse" style={{ animationDelay: "0.1s" }} />
                  <div className="h-3 bg-primary/10 rounded-full w-3/5 animate-pulse" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slime-lime/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-brand-lime-dark mb-1">87%</div>
                  <div className="text-xs text-muted-foreground">Time Saved</div>
                </div>
                <div className="bg-primary/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary mb-1">4.8★</div>
                  <div className="text-xs text-muted-foreground">Teacher Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Students Section */}
        <div id="students" className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-slime-lime/20 to-primary/10 rounded-3xl blur-3xl" />
            <div className="relative glass-card rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
                  S
                </div>
                <div>
                  <div className="font-semibold text-foreground">Sarah&apos;s Progress</div>
                  <div className="text-sm text-muted-foreground">Advanced Mathematics</div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground">Algebra</span>
                    <span className="text-brand-lime-dark font-medium">92%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-slime-lime rounded-full" style={{ width: "92%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground">Calculus</span>
                    <span className="text-primary font-medium">78%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "78%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground">Statistics</span>
                    <span className="text-primary font-medium">65%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-progress rounded-full" style={{ width: "65%" }} />
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="text-sm font-medium mb-1 text-foreground">🎯 AI Recommendation</div>
                <div className="text-sm text-muted-foreground">Focus on Statistics practice problems this week</div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-sm font-semibold text-slime-lime uppercase tracking-wider mb-4 block">
              For Students
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Learn at Your Pace,{" "}
              <span className="gradient-text-premium">Achieve More</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Personalized learning paths, instant feedback, and AI-powered study tools 
              help you master subjects faster and more effectively.
            </p>
            
            <div className="space-y-4 mb-8">
              {studentBenefits.map((benefit) => (
                <div key={benefit.text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slime-lime/10 flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-brand-lime-dark" />
                  </div>
                  <span className="font-medium text-foreground">{benefit.text}</span>
                </div>
              ))}
            </div>

            <Button variant="premium" size="lg" asChild>
              <a href="/auth?mode=signup&accountType=student">Start Learning Today</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoleSection;
