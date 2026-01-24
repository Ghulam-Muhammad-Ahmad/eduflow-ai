import { 
  FileText, 
  ClipboardCheck, 
  Brain, 
  Calendar, 
  Target,
  Shield,
  Zap,
  BarChart3
} from "lucide-react";

const features = [
  {
    icon: FileText,
    iconClass: "feature-icon-purple",
    title: "Document Management",
    description: "Upload, organize, and version control all your teaching materials. AI-powered summarization and smart search by topic or learning objective."
  },
  {
    icon: ClipboardCheck,
    iconClass: "feature-icon-lime",
    title: "Quiz & Assignment Builder",
    description: "Create assessments manually or let AI generate them from your materials. MCQ, short answer, coding challenges, and file uploads supported."
  },
  {
    icon: Brain,
    iconClass: "feature-icon-purple",
    title: "AI Paper Checking",
    description: "Automated evaluation with rubric-based scoring, strengths analysis, and line-by-line feedback. Full teacher control to edit and override."
  },
  {
    icon: Calendar,
    iconClass: "feature-icon-lime",
    title: "AI Lesson Planner",
    description: "Generate complete lesson plans from curriculum standards and objectives. Includes teaching flow, activities, homework, and assessments."
  },
  {
    icon: Target,
    iconClass: "feature-icon-purple",
    title: "Student Learning Hub",
    description: "Personalized study plans with AI-generated practice questions, smart revision summaries, and weak-area detection."
  },
  {
    icon: Shield,
    iconClass: "feature-icon-lime",
    title: "Plagiarism Detection",
    description: "Advanced similarity scoring and plagiarism detection to maintain academic integrity across all submissions."
  },
  {
    icon: Zap,
    iconClass: "feature-icon-purple",
    title: "Instant Feedback",
    description: "Students receive immediate, actionable feedback on their work. Teachers save hours while improving learning outcomes."
  },
  {
    icon: BarChart3,
    iconClass: "feature-icon-lime",
    title: "Progress Analytics",
    description: "Comprehensive dashboards for tracking student progress, class performance, and identifying areas needing attention."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 block">
            Powerful Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Everything You Need to{" "}
            <span className="gradient-text">Teach Smarter</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            From lesson planning to grading, EduLabLoom provides AI-powered tools 
            that save time while improving educational outcomes.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-card p-6 rounded-2xl border border-border hover:border-primary/30 hover:shadow-large transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`${feature.iconClass} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
