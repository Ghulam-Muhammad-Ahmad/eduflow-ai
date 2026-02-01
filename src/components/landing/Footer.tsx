import Image from "next/image";
import { Twitter, Linkedin, Youtube, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const Footer = () => {
  const footerLinks = {
    Product: ["Features", "Pricing", "Integrations", "Changelog", "Roadmap"],
    Resources: ["Documentation", "API Reference", "Tutorials", "Blog", "Community"],
    Company: ["About Us", "Careers", "Press Kit", "Contact", "Partners"],
    Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR", "FERPA"],
  };

  return (
    <footer className="bg-ink-black text-platinum py-16 noise-overlay">
      <div className="container mx-auto px-4 relative z-10">
        {/* Newsletter Section */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h3 className="text-2xl font-bold mb-4 text-platinum">Stay in the Loop</h3>
          <p className="text-platinum/70 mb-6">
            Get the latest updates on AI in education, new features, and teaching tips.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-platinum placeholder:text-platinum/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-full sm:w-80 transition-all duration-200"
            />
            <Button variant="premium" size="lg">
              Subscribe
            </Button>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4 text-platinum">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-platinum/60 hover:text-slime-lime transition-colors duration-200"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-platinum/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image 
                src="/mainlogo.svg" 
                alt="EduLabLoom Logo" 
                width={32} 
                height={32}
                className="w-8 h-8"
              />
            </div>
            <span className="font-semibold text-platinum">EduLabLoom</span>
          </div>

          <p className="text-sm text-platinum/60">
            © 2025 EduLabLoom. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <a href="#" className="text-platinum/60 hover:text-slime-lime transition-colors duration-200">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-platinum/60 hover:text-slime-lime transition-colors duration-200">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="#" className="text-platinum/60 hover:text-slime-lime transition-colors duration-200">
              <Youtube className="w-5 h-5" />
            </a>
            <a href="#" className="text-platinum/60 hover:text-slime-lime transition-colors duration-200">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
