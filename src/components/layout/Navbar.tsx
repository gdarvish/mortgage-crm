import { useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const navLinks = [
  { label: "מחשבון משכנתא", path: "/mortgage-calculator" },
  { label: "מחשבון רכישת דירה", path: "/purchase-calculator" },
  { label: "מחשבון איחוד הלוואות", path: "/consolidation-calculator" },
  { label: "בלוג", path: "/blog" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const scrollToContact = useCallback(() => {
    setMobileOpen(false);
    const scroll = () => {
      const el = document.getElementById("contact");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };
    if (location.pathname === "/") {
      scroll();
    } else {
      navigate("/");
      setTimeout(scroll, 300);
    }
  }, [location.pathname, navigate]);

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="הבית הכלכלי" className="w-10 h-10 object-contain" />
            <span className="font-headline text-lg font-bold text-primary">הבית הכלכלי</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 flex-row-reverse">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.path)
                    ? "text-brand-gold border-b-2 border-brand-gold"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA + Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToContact}
              className="hidden md:inline-flex items-center gap-1 px-4 py-2 bg-brand-gold text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              ייעוץ אישי
            </button>

            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="תפריט"
            >
              <span className="material-symbols-outlined">
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-outline-variant/30">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.path)
                    ? "text-brand-gold bg-brand-gold/10"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={scrollToContact}
              className="block w-full mt-2 px-4 py-2 bg-brand-gold text-white text-sm font-medium rounded-lg text-center hover:opacity-90 transition-opacity"
            >
              ייעוץ אישי
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
