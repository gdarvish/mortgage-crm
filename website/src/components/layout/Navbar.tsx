import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navLinks = [
  { label: "מחשבון משכנתא", path: "/mortgage-calculator" },
  { label: "רכישת דירה", path: "/purchase-calculator" },
  { label: "איחוד הלוואות", path: "/consolidation-calculator" },
  { label: "בלוג", path: "/blog" },
];

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida/ADBb0uhbrTULDeVR6Dc45PgPVAUiV-rolauU0ya0G2zzPxLk5fTwjS8Jrp3kxKQof12hd8n5UZT3YLNnKWL84Tjuebhv5I0-t9JprhhSEG8MvYmkdoO25OahEpgLWKUDmmN7JJYXwUWQ853Hk2cbSCvRn39Q0L1HaIAr7BqA7M_Pvybapi31Whb7o6yWh4k61h_xDDCP6Ixoge18zPyoA0AmJEyaZxMj5OFrnHjApaN0bkR4HEhSQpQ64DIfSdDvws4Yw412myM3Gw";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={LOGO_URL} alt="הבית הכלכלי" className="w-10 h-10 rounded-full object-cover" />
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
            <Link
              to="/#contact"
              className="hidden md:inline-flex items-center gap-1 px-4 py-2 bg-brand-gold text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              ייעוץ אישי
            </Link>

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
            <Link
              to="/#contact"
              onClick={() => setMobileOpen(false)}
              className="block mt-2 px-4 py-2 bg-brand-gold text-white text-sm font-medium rounded-lg text-center hover:opacity-90 transition-opacity"
            >
              ייעוץ אישי
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
