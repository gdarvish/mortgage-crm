import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SEOHead from "../components/seo/SEOHead";
import { loadPosts, type BlogPost } from "../data/blogPosts";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [contactForm, setContactForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const articles = posts.filter((p) => p.id !== featured?.id);
  const categories = [...new Set(posts.map((p) => p.category))];

  return (
    <>
      <SEOHead
        title="בלוג נדל״ן ומשכנתאות | הבית הכלכלי"
        description="מאמרים, טיפים ומדריכים בנושאי משכנתאות, נדל״ן ותכנון פיננסי מאת המומחים של הבית הכלכלי."
        keywords="בלוג משכנתאות, טיפים משכנתא, מדריך רכישת דירה, נדלן ישראל"
      />

      <div className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Featured Article */}
          {featured && (
            <section className="mb-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-xl editorial-shadow bg-surface-container-lowest">
                <div className="lg:col-span-7 relative h-64 lg:h-[500px]">
                  <img src={featured.imageUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="lg:col-span-5 p-8 lg:p-12 flex flex-col justify-center bg-primary-container text-white">
                  <span className="text-secondary-fixed text-xs font-bold tracking-widest uppercase mb-3">{featured.category}</span>
                  <h1 className="font-headline text-2xl lg:text-4xl font-extrabold mb-4 leading-tight">{featured.title}</h1>
                  <p className="text-on-primary-container text-sm lg:text-base mb-6 leading-relaxed">{featured.excerpt}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-lg">person</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{featured.author}</p>
                      {featured.authorRole && <p className="text-xs text-on-primary-container">{featured.authorRole}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Articles Grid */}
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-headline text-2xl font-bold text-primary">מאמרים אחרונים</h2>
                <div className="h-px flex-grow mx-6 bg-outline-variant/20" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {articles.map((post) => (
                  <article key={post.id} className="group">
                    <div className="relative aspect-[16/10] mb-4 overflow-hidden rounded-lg">
                      <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-primary uppercase">{post.category}</div>
                    </div>
                    <h3 className="font-headline text-lg font-bold text-primary mb-2 group-hover:text-brand-gold transition-colors leading-snug">{post.title}</h3>
                    <p className="text-on-surface-variant text-sm mb-3 line-clamp-2">{post.excerpt}</p>
                    <span className="text-brand-gold font-bold text-xs inline-flex items-center gap-1 group-hover:underline">
                      קרא עוד <span className="material-symbols-outlined text-sm">arrow_back</span>
                    </span>
                  </article>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
              {/* Newsletter */}
              <div className="bg-surface-container-low p-6 rounded-lg border-b-2 border-brand-gold">
                <span className="material-symbols-outlined text-brand-gold text-3xl mb-3 block">mail</span>
                <h4 className="font-headline text-xl font-bold text-primary mb-3">הצטרפו לניוזלטר</h4>
                <p className="text-on-surface-variant text-sm mb-4">קבלו עדכונים שבועיים על שוק הנדל״ן וטיפים למשכנתא.</p>
                <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder="yourname@email.com" className="w-full bg-surface-container-high border-none rounded-sm px-3 py-2 text-sm focus:ring-1 focus:ring-brand-gold" />
                  <button type="submit" className="w-full bg-primary-container text-white py-2 rounded font-bold text-sm hover:bg-primary transition-colors">הרשמה עכשיו</button>
                </form>
              </div>

              {/* Categories */}
              <div>
                <h4 className="font-headline text-lg font-bold text-primary mb-4 border-r-4 border-brand-gold pr-3">נושאים</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <span key={cat} className="px-3 py-1.5 bg-surface-container-highest rounded-full text-xs font-medium hover:bg-secondary-container transition-colors cursor-pointer">{cat}</span>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div className="bg-primary p-6 rounded-lg text-white">
                <span className="material-symbols-outlined text-secondary-container text-2xl mb-3 block">format_quote</span>
                <p className="text-base italic leading-relaxed mb-4 opacity-90">"תכנון כלכלי נכון הוא לא רק חיסכון בכסף, הוא בניית השקט הנפשי שלכם לעתיד."</p>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 bg-secondary-container w-6" />
                  <span className="font-bold text-xs">הצוות הכלכלי</span>
                </div>
              </div>

              {/* Admin link */}
              <Link to="/blog/admin" className="flex items-center justify-center gap-2 p-3 bg-surface-container rounded-lg text-on-surface-variant text-sm hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                ניהול תכנים
              </Link>
            </aside>
          </div>

          {/* Contact CTA */}
          <section className="mt-20">
            <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-10 lg:p-16 relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                  <span className="text-secondary-fixed text-xs font-bold uppercase tracking-widest mb-4 block">צרו קשר</span>
                  <h2 className="font-headline text-3xl lg:text-4xl font-extrabold text-white mb-6">בואו נבנה לכם עתיד כלכלי יציב</h2>
                  <p className="text-on-primary-container text-base mb-8">השאירו פרטים ומומחה מטעמנו יחזור אליכם.</p>
                  <div className="flex items-center gap-3 text-white">
                    <span className="material-symbols-outlined text-secondary-container">call</span>
                    <span className="font-semibold" dir="ltr">054-209-1980</span>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-2xl">
                  <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                    <div>
                      <label className="text-xs font-bold text-brand-gold uppercase mb-1 block">שם מלא</label>
                      <input type="text" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-surface-container border-none p-3 rounded text-sm focus:ring-2 focus:ring-brand-gold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-brand-gold uppercase mb-1 block">טלפון</label>
                      <input type="tel" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} className="w-full bg-surface-container border-none p-3 rounded text-sm focus:ring-2 focus:ring-brand-gold" />
                    </div>
                    <button type="submit" className="w-full bg-brand-gold text-white py-3 rounded-lg font-bold hover:opacity-90 transition-all">שליחת בקשה</button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
