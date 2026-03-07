import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Perfect for getting started",
    price: "Free",
    priceDetail: "forever",
    features: [
      "Up to 50 students",
      "5 AI lesson plans/month",
      "Basic quiz builder",
      "Document storage (1GB)",
      "Email support",
    ],
    cta: "Get Started Free",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Professional",
    description: "For power users and small teams",
    price: "$29",
    priceDetail: "per month",
    features: [
      "Unlimited students",
      "Unlimited AI lesson plans",
      "AI paper checker",
      "Advanced analytics",
      "Document storage (50GB)",
      "Priority support",
      "Plagiarism detection",
    ],
    cta: "Start Free Trial",
    variant: "premium" as const,
    popular: true,
  },
  {
    name: "Business",
    description: "For tutoring businesses",
    price: "Custom",
    priceDetail: "per workspace",
    features: [
      "Everything in Professional",
      "SSO & LDAP integration",
      "Custom branding",
      "Owner dashboard",
      "API access",
      "Dedicated support",
      "FERPA & GDPR compliant",
      "Onboarding & training",
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 block">
            Simple Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Plans That Grow{" "}
            <span className="gradient-text">With You</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free and scale as your needs grow. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-3xl p-8 border transition-all duration-300 ${
                plan.popular
                  ? "border-primary shadow-glow-purple scale-105"
                  : "border-border hover:border-primary/30 hover:shadow-large"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-primary text-white text-sm font-medium shadow-medium">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1 text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.priceDetail}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      plan.popular ? "bg-slime-lime/20" : "bg-primary/10"
                    }`}>
                      <Check className={`w-3 h-3 ${plan.popular ? "text-brand-lime-dark" : "text-primary"}`} />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={plan.variant} className="w-full" size="lg">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust Badge */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Trusted by <span className="font-semibold text-foreground">500+</span> tutoring businesses worldwide.
            All plans include a <span className="font-semibold text-foreground">14-day free trial</span>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
