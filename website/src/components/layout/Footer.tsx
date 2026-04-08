import { Link } from "react-router-dom";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida/ADBb0uhbrTULDeVR6Dc45PgPVAUiV-rolauU0ya0G2zzPxLk5fTwjS8Jrp3kxKQof12hd8n5UZT3YLNnKWL84Tjuebhv5I0-t9JprhhSEG8MvYmkdoO25OahEpgLWKUDmmN7JJYXwUWQ853Hk2cbSCvRn39Q0L1HaIAr7BqA7M_Pvybapi31Whb7o6yWh4k61h_xDDCP6Ixoge18zPyoA0AmJEyaZxMj5OFrnHjApaN0bkR4HEhSQpQ64DIfSdDvws4Yw412myM3Gw";

const navLinks = [
  { label: "דף הבית", path: "/" },
  { label: "מחשבון משכנתא", path: "/mortgage-calculator" },
  { label: "רכישת דירה", path: "/purchase-calculator" },
  { label: "איחוד הלוואות", path: "/consolidation-calculator" },
  { label: "בלוג", path: "/blog" },
];

export default function Footer() {
  return (
    <footer className="bg-brand-footer text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={LOGO_URL} alt="הבית הכלכלי" className="w-10 h-10 rounded-full object-cover" />
              <span className="font-headline text-lg font-bold text-brand-gold-light">הבית הכלכלי</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              ייעוץ משכנתאות מקצועי ואישי. אנו מלווים אתכם לאורך כל הדרך
              לקבלת התנאים הטובים ביותר עבורכם.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-gold/30 transition-colors"
                aria-label="Facebook"
              >
                <span className="material-symbols-outlined text-lg text-white/80">group</span>
              </a>
              <a
                href="mailto:g.darvish@gmail.com"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-gold/30 transition-colors"
                aria-label="Email"
              >
                <span className="material-symbols-outlined text-lg text-white/80">mail</span>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-headline font-semibold text-brand-gold-light mb-4">ניווט</h3>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-white/60 hover:text-brand-gold-light transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-headline font-semibold text-brand-gold-light mb-4">צור קשר</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <span className="material-symbols-outlined text-base text-brand-gold-light">phone</span>
                <a href="tel:0532773844" className="hover:text-brand-gold-light transition-colors" dir="ltr">
                  053-277-3844
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <span className="material-symbols-outlined text-base text-brand-gold-light">mail</span>
                <a href="mailto:g.darvish@gmail.com" className="hover:text-brand-gold-light transition-colors">
                  g.darvish@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/60">
                <span className="material-symbols-outlined text-base text-brand-gold-light mt-0.5">location_on</span>
                <span>המלאכה 18, נתניה</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-headline font-semibold text-brand-gold-light mb-4">מידע משפטי</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-sm text-white/60 hover:text-brand-gold-light transition-colors">
                  תנאי שימוש
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-white/60 hover:text-brand-gold-light transition-colors">
                  מדיניות פרטיות
                </Link>
              </li>
              <li>
                <Link to="/accessibility" className="text-sm text-white/60 hover:text-brand-gold-light transition-colors">
                  נגישות
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-white/40">
            &copy; {new Date().getFullYear()} הבית הכלכלי. כל הזכויות שמורות.
          </p>
        </div>
      </div>
    </footer>
  );
}
